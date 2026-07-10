use crate::db::Database;
use crate::types::TemplateDefinition;
use std::fs;
use std::path::PathBuf;
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

pub fn load_builtin_catalog() -> Result<Vec<TemplateDefinition>, CatalogError> {
    let mut templates = Vec::new();
    let catalog_dirs = catalog_search_paths();

    for dir in catalog_dirs {
        collect_templates_from_dir(&dir, &mut templates)?;
    }

    Ok(templates)
}

fn collect_templates_from_dir(
    dir: &std::path::Path,
    templates: &mut Vec<TemplateDefinition>,
) -> Result<(), CatalogError> {
    if !dir.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_templates_from_dir(&path, templates)?;
        } else if path.extension().and_then(|e| e.to_str()) == Some("json") {
            let content = fs::read_to_string(&path)?;
            if let Ok(template) = serde_json::from_str::<TemplateDefinition>(&content) {
                templates.push(template);
            }
        }
    }
    Ok(())
}

pub fn import_catalog_to_db(db: &Database) -> Result<usize, CatalogError> {
    let templates = load_builtin_catalog()?;
    let count = templates.len();
    for template in templates {
        db.upsert_template(&template)?;
    }
    Ok(count)
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

pub fn normalize_legacy_cursorrules(
    id: &str,
    name: &str,
    category: &str,
    content: &str,
    globs: Option<&str>,
) -> TemplateDefinition {
    TemplateDefinition {
        id: id.to_string(),
        name: name.to_string(),
        description: format!("Normalized from awesome-cursorrules: {name}"),
        category: category.to_string(),
        artifact_type: "rule".to_string(),
        tags: vec![category.to_string(), "imported".to_string()],
        parameters: vec![],
        rule_frontmatter: Some(crate::types::RuleFrontmatter {
            description: format!("Conventions for {name}"),
            globs: globs.map(|s| s.to_string()),
            always_apply: globs.is_none(),
        }),
        skill_frontmatter: None,
        body_template: content.to_string(),
        source: Some("awesome-cursorrules".to_string()),
    }
}
