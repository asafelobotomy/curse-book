use crate::compiler::compile_preset;
use crate::db::Database;
use crate::types::{BookManifest, DeployDiff, DeployResult, ManifestArtifact, SyncStatus};
use chrono::Utc;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DeployError {
    #[error("Project path does not exist: {0}")]
    ProjectNotFound(String),
    #[error("Compiler error: {0}")]
    Compiler(#[from] crate::compiler::CompilerError),
    #[error("Database error: {0}")]
    Database(#[from] crate::db::DbError),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

pub type DeployResultType<T> = Result<T, DeployError>;

pub fn preview_deploy(db: &Database, preset_id: &str, project_path: &str) -> DeployResultType<Vec<DeployDiff>> {
    let compiled = compile_preset(db, preset_id)?;
    let root = Path::new(project_path);
    if !root.exists() {
        return Err(DeployError::ProjectNotFound(project_path.to_string()));
    }

    let mut diffs = Vec::new();
    for artifact in &compiled.artifacts {
        let full_path = root.join(&artifact.relative_path);
        let old_content = if full_path.exists() {
            Some(fs::read_to_string(&full_path)?)
        } else {
            None
        };

        let action = if old_content.is_none() {
            "create"
        } else if old_content.as_ref() == Some(&artifact.content) {
            "unchanged"
        } else {
            "update"
        };

        if action != "unchanged" {
            diffs.push(DeployDiff {
                path: artifact.relative_path.clone(),
                action: action.to_string(),
                old_content,
                new_content: artifact.content.clone(),
            });
        }
    }

    Ok(diffs)
}

pub fn deploy_preset(
    db: &Database,
    preset_id: &str,
    project_path: &str,
) -> DeployResultType<DeployResult> {
    let preset = db
        .get_preset(preset_id)?
        .ok_or_else(|| DeployError::ProjectNotFound(format!("Preset {preset_id} not found")))?;
    let compiled = compile_preset(db, preset_id)?;
    let root = Path::new(project_path);
    if !root.exists() {
        return Err(DeployError::ProjectNotFound(project_path.to_string()));
    }

    let mut deployed_files = Vec::new();
    let mut manifest_artifacts = Vec::new();

    for artifact in &compiled.artifacts {
        let full_path = root.join(&artifact.relative_path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent)?;
        }
        atomic_write(&full_path, &artifact.content)?;
        deployed_files.push(artifact.relative_path.clone());
        manifest_artifacts.push(ManifestArtifact {
            relative_path: artifact.relative_path.clone(),
            checksum: checksum(&artifact.content),
        });
    }

    let manifest = BookManifest {
        version: 1,
        preset_id: preset.id.clone(),
        preset_name: preset.name.clone(),
        deployed_at: Utc::now().to_rfc3339(),
        artifacts: manifest_artifacts,
    };

    let manifest_path = ".curse/book.manifest.json";
    let manifest_full = root.join(manifest_path);
    if let Some(parent) = manifest_full.parent() {
        fs::create_dir_all(parent)?;
    }
    let manifest_json = serde_json::to_string_pretty(&manifest)?;
    atomic_write(&manifest_full, &manifest_json)?;
    deployed_files.push(manifest_path.to_string());

    Ok(DeployResult {
        project_path: project_path.to_string(),
        deployed_files,
        manifest_path: manifest_path.to_string(),
    })
}

pub fn check_sync(project_path: &str) -> DeployResultType<SyncStatus> {
    let root = Path::new(project_path);
    let manifest_path = root.join(".curse/book.manifest.json");

    if !manifest_path.exists() {
        return Ok(SyncStatus {
            project_path: project_path.to_string(),
            in_sync: false,
            drifted_files: vec![".curse/book.manifest.json".to_string()],
        });
    }

    let manifest: BookManifest = serde_json::from_str(&fs::read_to_string(&manifest_path)?)?;
    let mut drifted = Vec::new();

    for artifact in &manifest.artifacts {
        let full_path = root.join(&artifact.relative_path);
        if !full_path.exists() {
            drifted.push(artifact.relative_path.clone());
            continue;
        }
        let content = fs::read_to_string(&full_path)?;
        if checksum(&content) != artifact.checksum {
            drifted.push(artifact.relative_path.clone());
        }
    }

    Ok(SyncStatus {
        project_path: project_path.to_string(),
        in_sync: drifted.is_empty(),
        drifted_files: drifted,
    })
}

fn atomic_write(path: &Path, content: &str) -> std::io::Result<()> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, content)?;
    fs::rename(tmp, path)
}

fn checksum(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    hex::encode(hasher.finalize())
}
