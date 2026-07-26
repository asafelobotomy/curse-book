use crate::compiler::compile_preset;
use crate::db::Database;
use std::path::Path;
use std::process::Command;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum WorkflowError {
    #[error("Compiler error: {0}")]
    Compiler(#[from] crate::compiler::CompilerError),
    #[error("Database error: {0}")]
    Database(#[from] crate::db::DbError),
    #[error("Workflow error: {0}")]
    Other(String),
}

pub type WorkflowResult<T> = Result<T, WorkflowError>;

pub fn open_in_cursor(project_path: &str) -> WorkflowResult<()> {
    let path = Path::new(project_path);
    if !path.exists() {
        return Err(WorkflowError::Other(format!(
            "Project path does not exist: {project_path}"
        )));
    }

    let status = Command::new("cursor").arg(project_path).status();

    match status {
        Ok(s) if s.success() => Ok(()),
        Ok(_) => Err(WorkflowError::Other(
            "cursor command exited with non-zero status".to_string(),
        )),
        Err(e) => Err(WorkflowError::Other(format!(
            "Failed to launch cursor: {e}. Ensure the Cursor CLI is on your PATH."
        ))),
    }
}

pub fn export_user_rule_text(db: &Database, preset_id: &str) -> WorkflowResult<String> {
    let preset = db
        .get_preset(preset_id)?
        .ok_or_else(|| WorkflowError::Other(format!("Preset not found: {preset_id}")))?;

    if preset.artifact_type == "skill" {
        return Err(WorkflowError::Other(
            "User Rules export applies to rules only. Deploy skills to a project or cursebook folder.".to_string(),
        ));
    }

    let compiled = compile_preset(db, preset_id)?;
    let artifact = compiled
        .artifacts
        .first()
        .ok_or_else(|| WorkflowError::Other("No compiled artifact".to_string()))?;

    Ok(strip_mdc_frontmatter(&artifact.content))
}

fn strip_mdc_frontmatter(content: &str) -> String {
    if !content.starts_with("---") {
        return content.to_string();
    }
    if let Some(end) = content[3..].find("\n---") {
        let body_start = 3 + end + 4;
        content[body_start..].trim_start_matches('\n').to_string()
    } else {
        content.to_string()
    }
}

pub fn build_mcp_config_snippet(data_dir: &str) -> String {
    let mcp_path = std::env::current_exe()
        .ok()
        .and_then(|exe| {
            exe.parent()
                .and_then(|p| p.parent())
                .and_then(|p| p.parent())
                .map(|p| p.join("mcp/dist/index.js"))
        })
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "/path/to/curse_book/mcp/dist/index.js".to_string());

    serde_json::json!({
        "mcpServers": {
            "curse-book": {
                "command": "node",
                "args": [mcp_path],
                "env": {
                    "CURSE_BOOK_DATA": data_dir
                }
            }
        }
    })
    .to_string()
}
