use crate::db::Database;
use crate::types::{SourcesRegistry, TemplateDefinition};
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CatalogError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Database error: {0}")]
    Database(#[from] crate::db::DbError),
}

pub fn default_custom_catalog_paths() -> Vec<String> {
    dirs::home_dir()
        .map(|h| h.join(".curse").join("catalog"))
        .map(|p| p.to_string_lossy().to_string())
        .into_iter()
        .collect()
}

pub fn load_custom_catalog_paths(db: &Database) -> Result<Vec<String>, CatalogError> {
    match db.get_setting("custom_catalog_paths") {
        Ok(Some(json)) => {
            let paths: Vec<String> = serde_json::from_str(&json)?;
            Ok(paths)
        }
        Ok(None) => Ok(default_custom_catalog_paths()),
        Err(e) => Err(CatalogError::Database(e)),
    }
}

pub fn load_builtin_catalog(db: Option<&Database>) -> Result<Vec<TemplateDefinition>, CatalogError> {
    let mut templates = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();

    for dir in catalog_search_paths() {
        collect_templates_from_dir(&dir, &mut templates, &mut seen_ids)?;
    }

    if let Some(db) = db {
        for dir in load_custom_catalog_paths(db)? {
            let path = PathBuf::from(&dir);
            if path.exists() {
                collect_templates_from_dir(&path, &mut templates, &mut seen_ids)?;
            }
        }
    }

    Ok(templates)
}

fn is_catalog_meta_file(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
        return false;
    };
    name == "sources.json" || name.ends_with("-import-meta.json")
}

fn collect_templates_from_dir(
    dir: &Path,
    templates: &mut Vec<TemplateDefinition>,
    seen_ids: &mut std::collections::HashSet<String>,
) -> Result<(), CatalogError> {
    if !dir.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_templates_from_dir(&path, templates, seen_ids)?;
        } else if path.extension().and_then(|e| e.to_str()) == Some("json")
            && !is_catalog_meta_file(&path)
        {
            let content = fs::read_to_string(&path)?;
            if let Ok(template) = serde_json::from_str::<TemplateDefinition>(&content) {
                if seen_ids.insert(template.id.clone()) {
                    templates.push(template);
                }
            }
        }
    }
    Ok(())
}

pub fn import_catalog_to_db(db: &Database) -> Result<usize, CatalogError> {
    let templates = load_builtin_catalog(Some(db))?;
    let count = templates.len();
    for template in templates {
        db.upsert_template(&template)?;
    }
    import_catalog_source_meta(db)?;
    Ok(count)
}

fn import_catalog_source_meta(db: &Database) -> Result<(), CatalogError> {
    let meta_rel_paths = [
        "imported/acr-import-meta.json",
        "imported/plugin-import-meta.json",
    ];

    for rel in meta_rel_paths {
        for base in catalog_search_paths() {
            let path = base.join(rel);
            if !path.exists() {
                continue;
            }
            let content = fs::read_to_string(&path)?;
            let meta: serde_json::Value = serde_json::from_str(&content)?;
            let id = meta
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();
            let item_count = meta
                .get("pluginCount")
                .or_else(|| meta.get("templateCount"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32;
            let source = crate::types::PluginSource {
                id,
                repo: meta
                    .get("repo")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                commit_sha: meta.get("commitSha").and_then(|v| v.as_str()).map(str::to_string),
                imported_at: meta
                    .get("importedAt")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                plugin_count: item_count,
            };
            db.upsert_plugin_source(&source)?;
            break;
        }
    }
    Ok(())
}

pub fn load_sources_registry() -> Result<SourcesRegistry, CatalogError> {
    for base in catalog_search_paths() {
        let path = base.join("sources.json");
        if path.exists() {
            let content = fs::read_to_string(&path)?;
            return Ok(serde_json::from_str(&content)?);
        }
    }
    Ok(SourcesRegistry {
        version: 1,
        min_stars_policy: 1000,
        sources: Vec::new(),
    })
}

fn catalog_search_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        paths.push(cwd.join("catalog"));
        paths.push(cwd.join("..").join("catalog"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            paths.push(parent.join("catalog"));
            paths.push(parent.join("../catalog"));
        }
    }
    paths.push(PathBuf::from("catalog"));
    paths
}
