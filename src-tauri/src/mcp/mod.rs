use crate::types::TemplateDefinition;
use handlebars::Handlebars;
use regex::Regex;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum McpError {
    #[error("Handlebars error: {0}")]
    Handlebars(#[from] handlebars::RenderError),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Secret value detected in MCP config")]
    SecretDetected,
    #[error("Missing MCP frontmatter")]
    MissingFrontmatter,
}

pub type McpResult<T> = Result<T, McpError>;

pub fn compile_mcp_fragment(
    template: &TemplateDefinition,
    parameters: &HashMap<String, serde_json::Value>,
) -> McpResult<(String, Value)> {
    let fm = template
        .mcp_frontmatter
        .as_ref()
        .ok_or(McpError::MissingFrontmatter)?;

    let rendered = render_template_string(&fm.config_template, parameters)?;
    validate_no_secrets(&rendered)?;

    let config: Value = serde_json::from_str(&rendered)?;
    Ok((fm.server_key.clone(), config))
}

pub fn read_mcp_config(path: &Path) -> McpResult<Value> {
    if path.exists() {
        let content = fs::read_to_string(path)?;
        if content.trim().is_empty() {
            return Ok(json!({ "mcpServers": {} }));
        }
        Ok(serde_json::from_str(&content)?)
    } else {
        Ok(json!({ "mcpServers": {} }))
    }
}

pub fn merge_mcp_config(existing: &Value, server_key: &str, fragment: &Value) -> McpResult<String> {
    let mut root = existing.clone();
    if !root.is_object() {
        root = json!({ "mcpServers": {} });
    }
    let obj = root.as_object_mut().ok_or(McpError::Json(
        serde_json::Error::io(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "root not object",
        )),
    ))?;

    if !obj.contains_key("mcpServers") {
        obj.insert("mcpServers".to_string(), json!({}));
    }

    if let Some(servers) = obj.get_mut("mcpServers").and_then(|v| v.as_object_mut()) {
        servers.insert(server_key.to_string(), fragment.clone());
    }

    let merged = serde_json::to_string_pretty(&root)?;
    validate_no_secrets(&merged)?;
    Ok(merged)
}

pub fn merge_mcp_at_path(
    mcp_path: &Path,
    server_key: &str,
    fragment: &Value,
) -> McpResult<String> {
    let existing = read_mcp_config(mcp_path)?;
    merge_mcp_config(&existing, server_key, fragment)
}

pub fn extract_env_vars(config_template: &str) -> Vec<String> {
    let re = Regex::new(r"\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}").unwrap();
    let mut vars = Vec::new();
    for cap in re.captures_iter(config_template) {
        if let Some(var) = cap.get(1) {
            let name = var.as_str().to_string();
            if !vars.contains(&name) {
                vars.push(name);
            }
        }
    }
    vars
}

pub fn env_vars_for_template(template: &TemplateDefinition) -> Vec<String> {
    template
        .mcp_frontmatter
        .as_ref()
        .map(|fm| extract_env_vars(&fm.config_template))
        .unwrap_or_default()
}

pub fn validate_no_secrets(content: &str) -> McpResult<()> {
    let patterns = [
        r"sk-[A-Za-z0-9]{10,}",
        r"Bearer\s+[A-Za-z0-9._-]{10,}",
        r#""api[_-]?key"\s*:\s*"[^{$][^"]{8,}""#,
    ];
    for pattern in patterns {
        let re = Regex::new(pattern).unwrap();
        if re.is_match(content) {
            return Err(McpError::SecretDetected);
        }
    }
    Ok(())
}

fn render_template_string(
    template_str: &str,
    parameters: &HashMap<String, serde_json::Value>,
) -> McpResult<String> {
    let mut reg = Handlebars::new();
    reg.set_strict_mode(false);
    let mut ctx = serde_json::Map::new();
    let mut params_map = serde_json::Map::new();
    for (k, v) in parameters {
        params_map.insert(k.clone(), v.clone());
    }
    ctx.insert("parameters".to_string(), serde_json::Value::Object(params_map));
    Ok(reg.render_template(template_str, &serde_json::Value::Object(ctx))?)
}

pub fn key_exists_in_config(existing: &Value, server_key: &str) -> bool {
    existing
        .get("mcpServers")
        .and_then(|v| v.as_object())
        .is_some_and(|servers| servers.contains_key(server_key))
}
