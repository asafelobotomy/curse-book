use crate::compiler::compile_preset;
use crate::db::Database;
use crate::mcp;
use crate::types::{
    BookManifest, DeployDiff, DeployResult, GlobalBookManifest, GlobalManifestEntry,
    InstalledPlugin, ManifestArtifact, McpMergePreview, SyncStatus,
};
use chrono::Utc;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum DeployError {
    #[error("Project path does not exist: {0}")]
    ProjectNotFound(String),
    #[error("Invalid deploy target for artifact type")]
    InvalidTarget,
    #[error("Home directory not found")]
    HomeNotFound,
    #[error("Plugin name required")]
    PluginNameRequired,
    #[error("Compiler error: {0}")]
    Compiler(#[from] crate::compiler::CompilerError),
    #[error("Database error: {0}")]
    Database(#[from] crate::db::DbError),
    #[error("MCP error: {0}")]
    Mcp(#[from] mcp::McpError),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

pub type DeployResultType<T> = Result<T, DeployError>;

#[derive(Debug, Clone)]
pub enum DeployTarget {
    Project { path: String },
    UserCursebook,
    UserCursor { subdir: String },
    PluginLocal { name: String },
}

const PROJECT_MANIFEST: &str = ".curse/book.manifest.json";
const GLOBAL_MANIFEST: &str = ".curse/book.manifest.json";
const PLUGIN_MANIFEST: &str = ".curse/plugin-manifest.json";

pub fn preview_deploy(
    db: &Database,
    preset_id: &str,
    target: &DeployTarget,
) -> DeployResultType<Vec<DeployDiff>> {
    let preset = db
        .get_preset(preset_id)?
        .ok_or_else(|| DeployError::ProjectNotFound(format!("Preset {preset_id} not found")))?;
    validate_target(&preset.artifact_type, target)?;

    if preset.artifact_type == "mcp" {
        return preview_mcp_deploy(db, preset_id, target);
    }

    let compiled = compile_preset(db, preset_id)?;
    let root = resolve_root(target)?;
    ensure_root_exists(&root, target)?;

    let mut diffs = Vec::new();
    for artifact in &compiled.artifacts {
        let relative_path = map_artifact_path(&artifact.relative_path, target, &preset.artifact_type);
        let content = normalize_hook_content(&artifact.content, target, &preset.artifact_type);
        let full_path = root.join(&relative_path);
        let old_content = if full_path.exists() {
            Some(fs::read_to_string(&full_path)?)
        } else {
            None
        };

        let action = diff_action(old_content.as_deref(), &content);
        if action != "unchanged" {
            diffs.push(DeployDiff {
                path: relative_path,
                action: action.to_string(),
                old_content,
                new_content: content,
            });
        }
    }

    Ok(diffs)
}

pub fn deploy_preset(
    db: &Database,
    preset_id: &str,
    target: &DeployTarget,
) -> DeployResultType<DeployResult> {
    let preset = db
        .get_preset(preset_id)?
        .ok_or_else(|| DeployError::ProjectNotFound(format!("Preset {preset_id} not found")))?;
    validate_target(&preset.artifact_type, target)?;

    if preset.artifact_type == "mcp" {
        return deploy_mcp_preset(db, preset_id, target);
    }

    let compiled = compile_preset(db, preset_id)?;
    let root = resolve_root(target)?;
    ensure_root_exists(&root, target)?;

    let mut deployed_files = Vec::new();
    let mut manifest_artifacts = Vec::new();

    for artifact in &compiled.artifacts {
        let relative_path = map_artifact_path(&artifact.relative_path, target, &preset.artifact_type);
        let content = normalize_hook_content(&artifact.content, target, &preset.artifact_type);
        let full_path = root.join(&relative_path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent)?;
        }
        atomic_write(&full_path, &content)?;
        if artifact.executable {
            set_executable(&full_path)?;
        }
        deployed_files.push(relative_path.clone());
        manifest_artifacts.push(ManifestArtifact {
            relative_path,
            checksum: checksum(&content),
        });
    }

    let deployed_at = Utc::now().to_rfc3339();

    match target {
        DeployTarget::Project { path } => {
            write_project_manifest(
                &root,
                &preset.id,
                &preset.name,
                &deployed_at,
                manifest_artifacts,
            )?;
            deployed_files.push(PROJECT_MANIFEST.to_string());

            Ok(DeployResult {
                project_path: path.clone(),
                deployed_files,
                manifest_path: PROJECT_MANIFEST.to_string(),
            })
        }
        DeployTarget::UserCursebook | DeployTarget::UserCursor { .. } => {
            update_global_manifest(&preset.id, &preset.name, &deployed_at, manifest_artifacts)?;
            deployed_files.push(GLOBAL_MANIFEST.to_string());

            Ok(DeployResult {
                project_path: root.to_string_lossy().to_string(),
                deployed_files,
                manifest_path: GLOBAL_MANIFEST.to_string(),
            })
        }
        DeployTarget::PluginLocal { name } => {
            let plugin_path = root.to_string_lossy().to_string();
            let checksum_val = manifest_artifacts
                .iter()
                .map(|a| a.checksum.as_str())
                .collect::<Vec<_>>()
                .join(",");
            let plugin = InstalledPlugin {
                id: Uuid::new_v4().to_string(),
                name: name.clone(),
                version: None,
                path: plugin_path.clone(),
                checksum: Some(checksum_val),
                installed_at: deployed_at.clone(),
            };
            db.upsert_installed_plugin(&plugin)?;
            update_plugin_manifest(&plugin)?;
            deployed_files.push(PLUGIN_MANIFEST.to_string());

            Ok(DeployResult {
                project_path: plugin_path,
                deployed_files,
                manifest_path: PLUGIN_MANIFEST.to_string(),
            })
        }
    }
}

pub fn merge_preview_mcp(
    db: &Database,
    preset_id: &str,
    target: &DeployTarget,
) -> DeployResultType<McpMergePreview> {
    let preset = db
        .get_preset(preset_id)?
        .ok_or_else(|| DeployError::ProjectNotFound(format!("Preset {preset_id} not found")))?;
    if preset.artifact_type != "mcp" {
        return Err(DeployError::InvalidTarget);
    }

    let template = db
        .get_template(&preset.template_id)?
        .ok_or_else(|| DeployError::ProjectNotFound("Template not found".to_string()))?;
    let (server_key, fragment) = mcp::compile_mcp_fragment(&template, &preset.parameters)?;

    let root = resolve_root(target)?;
    let mcp_path = mcp_file_path(target);
    let full_path = root.join(&mcp_path);
    let existing = mcp::read_mcp_config(&full_path)?;
    let key_exists = mcp::key_exists_in_config(&existing, &server_key);
    let old_content = if full_path.exists() {
        Some(fs::read_to_string(&full_path)?)
    } else {
        None
    };
    let new_content = mcp::merge_mcp_at_path(&full_path, &server_key, &fragment)?;

    Ok(McpMergePreview {
        path: mcp_path,
        server_key,
        key_exists,
        old_content,
        new_content,
    })
}

pub fn deploy_project_presets(
    db: &Database,
    project_path: &str,
    preset_ids: &[String],
) -> DeployResultType<Vec<DeployResult>> {
    let target = DeployTarget::Project {
        path: project_path.to_string(),
    };
    let mut results = Vec::new();
    for preset_id in preset_ids {
        let preset = db
            .get_preset(preset_id)?
            .ok_or_else(|| DeployError::ProjectNotFound(format!("Preset {preset_id} not found")))?;
        if preset.artifact_type == "plugin" {
            continue;
        }
        results.push(deploy_preset(db, preset_id, &target)?);
    }
    Ok(results)
}

pub fn uninstall_plugin(db: &Database, name: &str) -> DeployResultType<()> {
    if let Some(plugin) = db.get_installed_plugin(name)? {
        let path = PathBuf::from(&plugin.path);
        if path.exists() {
            fs::remove_dir_all(&path)?;
        }
        db.delete_installed_plugin(name)?;
    }
    Ok(())
}

pub fn check_sync(project_path: &str) -> DeployResultType<SyncStatus> {
    let root = Path::new(project_path);
    let manifest_path = root.join(PROJECT_MANIFEST);

    if !manifest_path.exists() {
        return Ok(SyncStatus {
            project_path: project_path.to_string(),
            in_sync: false,
            drifted_files: vec![PROJECT_MANIFEST.to_string()],
        });
    }

    let manifest: BookManifest = serde_json::from_str(&fs::read_to_string(&manifest_path)?)?;
    let drifted = drifted_artifacts(root, &manifest.artifacts);

    Ok(SyncStatus {
        project_path: project_path.to_string(),
        in_sync: drifted.is_empty(),
        drifted_files: drifted,
    })
}

pub fn check_global_sync() -> DeployResultType<SyncStatus> {
    let home = home_dir()?;
    let manifest_path = home.join(GLOBAL_MANIFEST);

    if !manifest_path.exists() {
        return Ok(SyncStatus {
            project_path: home.to_string_lossy().to_string(),
            in_sync: true,
            drifted_files: Vec::new(),
        });
    }

    let manifest: GlobalBookManifest =
        serde_json::from_str(&fs::read_to_string(&manifest_path)?)?;
    let mut drifted = Vec::new();
    for entry in manifest.entries.values() {
        drifted.extend(drifted_artifacts(&home, &entry.artifacts));
    }

    Ok(SyncStatus {
        project_path: home.to_string_lossy().to_string(),
        in_sync: drifted.is_empty(),
        drifted_files: drifted,
    })
}

pub fn check_plugin_sync(db: &Database, name: &str) -> DeployResultType<SyncStatus> {
    let plugin = db
        .get_installed_plugin(name)?
        .ok_or_else(|| DeployError::ProjectNotFound(format!("Plugin not installed: {name}")))?;
    let root = PathBuf::from(&plugin.path);
    let manifest_path = home_dir()?.join(PLUGIN_MANIFEST);

    if !manifest_path.exists() {
        return Ok(SyncStatus {
            project_path: plugin.path.clone(),
            in_sync: !root.exists(),
            drifted_files: vec![],
        });
    }

    let manifest: GlobalBookManifest = serde_json::from_str(&fs::read_to_string(&manifest_path)?)?;
    let entry = manifest.entries.get(&plugin.id);
    let drifted = if let Some(entry) = entry {
        drifted_artifacts(&root, &entry.artifacts)
    } else {
        vec![PLUGIN_MANIFEST.to_string()]
    };

    Ok(SyncStatus {
        project_path: plugin.path.clone(),
        in_sync: drifted.is_empty(),
        drifted_files: drifted,
    })
}

fn preview_mcp_deploy(
    db: &Database,
    preset_id: &str,
    target: &DeployTarget,
) -> DeployResultType<Vec<DeployDiff>> {
    let preview = merge_preview_mcp(db, preset_id, target)?;
    let action = if preview.old_content.is_none() {
        "create"
    } else if preview.old_content.as_deref() == Some(preview.new_content.as_str()) {
        "unchanged"
    } else {
        "update"
    };

    if action == "unchanged" {
        return Ok(vec![]);
    }

    Ok(vec![DeployDiff {
        path: preview.path,
        action: action.to_string(),
        old_content: preview.old_content,
        new_content: preview.new_content,
    }])
}

fn deploy_mcp_preset(
    db: &Database,
    preset_id: &str,
    target: &DeployTarget,
) -> DeployResultType<DeployResult> {
    let preset = db
        .get_preset(preset_id)?
        .ok_or_else(|| DeployError::ProjectNotFound(format!("Preset {preset_id} not found")))?;
    let preview = merge_preview_mcp(db, preset_id, target)?;
    let root = resolve_root(target)?;
    ensure_root_exists(&root, target)?;

    let full_path = root.join(&preview.path);
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)?;
    }
    atomic_write(&full_path, &preview.new_content)?;

    let deployed_at = Utc::now().to_rfc3339();
    let manifest_artifact = ManifestArtifact {
        relative_path: preview.path.clone(),
        checksum: checksum(&preview.new_content),
    };

    match target {
        DeployTarget::Project { path } => {
            write_project_manifest(
                &root,
                &preset.id,
                &preset.name,
                &deployed_at,
                vec![manifest_artifact],
            )?;
            Ok(DeployResult {
                project_path: path.clone(),
                deployed_files: vec![preview.path, PROJECT_MANIFEST.to_string()],
                manifest_path: PROJECT_MANIFEST.to_string(),
            })
        }
        DeployTarget::UserCursebook | DeployTarget::UserCursor { .. } => {
            update_global_manifest(
                &preset.id,
                &preset.name,
                &deployed_at,
                vec![manifest_artifact],
            )?;
            Ok(DeployResult {
                project_path: root.to_string_lossy().to_string(),
                deployed_files: vec![preview.path, GLOBAL_MANIFEST.to_string()],
                manifest_path: GLOBAL_MANIFEST.to_string(),
            })
        }
        DeployTarget::PluginLocal { name } => {
            let plugin_path = root.to_string_lossy().to_string();
            let plugin = InstalledPlugin {
                id: Uuid::new_v4().to_string(),
                name: name.clone(),
                version: None,
                path: plugin_path.clone(),
                checksum: Some(checksum(&preview.new_content)),
                installed_at: deployed_at,
            };
            db.upsert_installed_plugin(&plugin)?;
            update_plugin_manifest(&plugin)?;
            Ok(DeployResult {
                project_path: plugin_path,
                deployed_files: vec!["mcp.json".to_string(), PLUGIN_MANIFEST.to_string()],
                manifest_path: PLUGIN_MANIFEST.to_string(),
            })
        }
    }
}

fn validate_target(artifact_type: &str, target: &DeployTarget) -> DeployResultType<()> {
    let ok = match (artifact_type, target) {
        ("rule", DeployTarget::Project { .. }) | ("rule", DeployTarget::PluginLocal { .. }) => {
            true
        }
        ("skill", DeployTarget::Project { .. })
        | ("skill", DeployTarget::UserCursebook)
        | ("skill", DeployTarget::PluginLocal { .. }) => true,
        ("subagent", DeployTarget::Project { .. })
        | ("subagent", DeployTarget::PluginLocal { .. }) => true,
        ("subagent", DeployTarget::UserCursor { subdir }) if subdir == "agents/cursebook" => {
            true
        }
        ("hook", DeployTarget::Project { .. }) | ("hook", DeployTarget::PluginLocal { .. }) => {
            true
        }
        ("hook", DeployTarget::UserCursor { subdir }) if subdir == "hooks" => true,
        ("mcp", _) => true,
        ("plugin", DeployTarget::PluginLocal { .. }) => true,
        _ => false,
    };
    if ok {
        Ok(())
    } else {
        Err(DeployError::InvalidTarget)
    }
}

fn resolve_root(target: &DeployTarget) -> DeployResultType<PathBuf> {
    match target {
        DeployTarget::Project { path } => Ok(PathBuf::from(path)),
        DeployTarget::UserCursebook => home_dir(),
        DeployTarget::UserCursor { .. } => home_dir(),
        DeployTarget::PluginLocal { name } => Ok(home_dir()?
            .join(".cursor")
            .join("plugins")
            .join("local")
            .join(name)),
    }
}

fn ensure_root_exists(root: &Path, target: &DeployTarget) -> DeployResultType<()> {
    match target {
        DeployTarget::Project { .. } => {
            if !root.exists() {
                return Err(DeployError::ProjectNotFound(
                    root.to_string_lossy().to_string(),
                ));
            }
        }
        DeployTarget::UserCursebook => {
            fs::create_dir_all(root.join(".cursor/skills/cursebook"))?;
        }
        DeployTarget::UserCursor { subdir } => {
            if subdir == "hooks" {
                fs::create_dir_all(root.join(".cursor/hooks"))?;
            } else if subdir == "mcp" {
                fs::create_dir_all(root.join(".cursor"))?;
            } else {
                fs::create_dir_all(root.join(".cursor").join(subdir))?;
            }
        }
        DeployTarget::PluginLocal { .. } => {
            fs::create_dir_all(root)?;
        }
    }
    Ok(())
}

fn home_dir() -> DeployResultType<PathBuf> {
    dirs::home_dir().ok_or(DeployError::HomeNotFound)
}

fn mcp_file_path(target: &DeployTarget) -> String {
    match target {
        DeployTarget::PluginLocal { .. } => "mcp.json".to_string(),
        DeployTarget::Project { .. } => ".cursor/mcp.json".to_string(),
        DeployTarget::UserCursebook | DeployTarget::UserCursor { .. } => ".cursor/mcp.json".to_string(),
    }
}

fn map_artifact_path(relative_path: &str, target: &DeployTarget, artifact_type: &str) -> String {
    match target {
        DeployTarget::Project { .. } => relative_path.to_string(),
        DeployTarget::UserCursebook => {
            if let Some(rest) = relative_path.strip_prefix(".cursor/skills/") {
                format!(".cursor/skills/cursebook/{rest}")
            } else {
                relative_path.to_string()
            }
        }
        DeployTarget::UserCursor { subdir } => {
            if subdir == "agents/cursebook" {
                if let Some(rest) = relative_path.strip_prefix(".cursor/agents/") {
                    format!(".cursor/agents/cursebook/{rest}")
                } else {
                    relative_path.to_string()
                }
            } else if subdir == "hooks" {
                relative_path
                    .replacen(".cursor/", ".cursor/", 1)
                    .to_string()
            } else {
                relative_path.to_string()
            }
        }
        DeployTarget::PluginLocal { .. } => {
            if artifact_type == "plugin" {
                relative_path.to_string()
            } else {
                relative_path
                    .replacen(".cursor/rules/", "rules/", 1)
                    .replacen(".cursor/skills/", "skills/", 1)
                    .replacen(".cursor/agents/", "agents/", 1)
                    .replacen(".cursor/hooks.json", "hooks/hooks.json", 1)
                    .replacen(".cursor/hooks/", "hooks/", 1)
                    .replacen(".cursor/mcp.json", "mcp.json", 1)
            }
        }
    }
}

fn normalize_hook_content(content: &str, target: &DeployTarget, artifact_type: &str) -> String {
    if artifact_type != "hook" {
        return content.to_string();
    }
    match target {
        DeployTarget::UserCursor { subdir } if subdir == "hooks" => content
            .replace(".cursor/hooks/", "./hooks/")
            .replace(r#""command": ".cursor/hooks/"#, r#""command": "./hooks/"#),
        DeployTarget::PluginLocal { .. } => content
            .replace(".cursor/hooks/", "hooks/")
            .replace(r#""command": ".cursor/hooks/"#, r#""command": "hooks/"#),
        _ => content.to_string(),
    }
}

fn write_project_manifest(
    root: &Path,
    preset_id: &str,
    preset_name: &str,
    deployed_at: &str,
    artifacts: Vec<ManifestArtifact>,
) -> DeployResultType<()> {
    let manifest = BookManifest {
        version: 1,
        preset_id: preset_id.to_string(),
        preset_name: preset_name.to_string(),
        deployed_at: deployed_at.to_string(),
        artifacts,
    };
    let manifest_full = root.join(PROJECT_MANIFEST);
    if let Some(parent) = manifest_full.parent() {
        fs::create_dir_all(parent)?;
    }
    atomic_write(&manifest_full, &serde_json::to_string_pretty(&manifest)?)?;
    Ok(())
}

fn update_global_manifest(
    preset_id: &str,
    preset_name: &str,
    deployed_at: &str,
    artifacts: Vec<ManifestArtifact>,
) -> DeployResultType<()> {
    let home = home_dir()?;
    let manifest_path = home.join(GLOBAL_MANIFEST);

    let mut manifest = if manifest_path.exists() {
        serde_json::from_str::<GlobalBookManifest>(&fs::read_to_string(&manifest_path)?)?
    } else {
        GlobalBookManifest {
            version: 1,
            entries: HashMap::new(),
        }
    };

    manifest.entries.insert(
        preset_id.to_string(),
        GlobalManifestEntry {
            preset_id: preset_id.to_string(),
            preset_name: preset_name.to_string(),
            deployed_at: deployed_at.to_string(),
            artifacts,
        },
    );

    if let Some(parent) = manifest_path.parent() {
        fs::create_dir_all(parent)?;
    }
    atomic_write(&manifest_path, &serde_json::to_string_pretty(&manifest)?)?;
    Ok(())
}

fn update_plugin_manifest(plugin: &InstalledPlugin) -> DeployResultType<()> {
    let home = home_dir()?;
    let manifest_path = home.join(PLUGIN_MANIFEST);
    let mut manifest = if manifest_path.exists() {
        serde_json::from_str::<GlobalBookManifest>(&fs::read_to_string(&manifest_path)?)?
    } else {
        GlobalBookManifest {
            version: 1,
            entries: HashMap::new(),
        }
    };

    manifest.entries.insert(
        plugin.id.clone(),
        GlobalManifestEntry {
            preset_id: plugin.id.clone(),
            preset_name: plugin.name.clone(),
            deployed_at: plugin.installed_at.clone(),
            artifacts: vec![],
        },
    );

    if let Some(parent) = manifest_path.parent() {
        fs::create_dir_all(parent)?;
    }
    atomic_write(&manifest_path, &serde_json::to_string_pretty(&manifest)?)?;
    Ok(())
}

fn drifted_artifacts(root: &Path, artifacts: &[ManifestArtifact]) -> Vec<String> {
    let mut drifted = Vec::new();
    for artifact in artifacts {
        let full_path = root.join(&artifact.relative_path);
        if !full_path.exists() {
            drifted.push(artifact.relative_path.clone());
            continue;
        }
        if let Ok(content) = fs::read_to_string(&full_path) {
            if checksum(&content) != artifact.checksum {
                drifted.push(artifact.relative_path.clone());
            }
        } else {
            drifted.push(artifact.relative_path.clone());
        }
    }
    drifted
}

fn diff_action(old_content: Option<&str>, new_content: &str) -> &'static str {
    match old_content {
        None => "create",
        Some(old) if old == new_content => "unchanged",
        Some(_) => "update",
    }
}

fn atomic_write(path: &Path, content: &str) -> std::io::Result<()> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, content)?;
    fs::rename(tmp, path)
}

#[cfg(unix)]
fn set_executable(path: &Path) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let mut perms = fs::metadata(path)?.permissions();
    perms.set_mode(0o755);
    fs::set_permissions(path, perms)
}

#[cfg(not(unix))]
fn set_executable(_path: &Path) -> std::io::Result<()> {
    Ok(())
}

fn checksum(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn parse_deploy_target(
    kind: &str,
    project_path: Option<&str>,
    plugin_name: Option<&str>,
) -> DeployResultType<DeployTarget> {
    match kind {
        "project" => Ok(DeployTarget::Project {
            path: project_path
                .ok_or_else(|| DeployError::ProjectNotFound("project path required".to_string()))?
                .to_string(),
        }),
        "user_cursebook" => Ok(DeployTarget::UserCursebook),
        "user_agents" => Ok(DeployTarget::UserCursor {
            subdir: "agents/cursebook".to_string(),
        }),
        "user_hooks" => Ok(DeployTarget::UserCursor {
            subdir: "hooks".to_string(),
        }),
        "user_mcp" => Ok(DeployTarget::UserCursor {
            subdir: "mcp".to_string(),
        }),
        "plugin_local" => Ok(DeployTarget::PluginLocal {
            name: plugin_name
                .ok_or(DeployError::PluginNameRequired)?
                .to_string(),
        }),
        _ => Err(DeployError::InvalidTarget),
    }
}
