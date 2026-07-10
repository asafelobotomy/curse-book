use crate::db::Database;
use crate::types::{
    CompileResult, CompiledArtifact, Preset, RuleFrontmatter, SkillFrontmatter, TemplateDefinition,
};
use handlebars::Handlebars;
use std::collections::HashMap;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CompilerError {
    #[error("Template not found: {0}")]
    TemplateNotFound(String),
    #[error("Preset not found: {0}")]
    PresetNotFound(String),
    #[error("Handlebars error: {0}")]
    Handlebars(#[from] handlebars::RenderError),
    #[error("Database error: {0}")]
    Database(#[from] crate::db::DbError),
}

pub type CompilerResult<T> = Result<T, CompilerError>;

pub fn compile_preset(db: &Database, preset_id: &str) -> CompilerResult<CompileResult> {
    let preset = db
        .get_preset(preset_id)?
        .ok_or_else(|| CompilerError::PresetNotFound(preset_id.to_string()))?;
    let template = db
        .get_template(&preset.template_id)?
        .ok_or_else(|| CompilerError::TemplateNotFound(preset.template_id.clone()))?;
    compile_from_parts(&preset, &template)
}

pub fn compile_preview(
    template: &TemplateDefinition,
    parameters: &HashMap<String, serde_json::Value>,
) -> CompilerResult<CompileResult> {
    let preset = Preset {
        id: "preview".to_string(),
        template_id: template.id.clone(),
        name: template.name.clone(),
        description: template.description.clone(),
        artifact_type: template.artifact_type.clone(),
        parameters: parameters.clone(),
        created_at: String::new(),
        updated_at: String::new(),
    };
    compile_from_parts(&preset, template)
}

fn compile_from_parts(preset: &Preset, template: &TemplateDefinition) -> CompilerResult<CompileResult> {
    let mut reg = Handlebars::new();
    reg.set_strict_mode(false);

    let mut ctx = serde_json::Map::new();
    let mut params_map = serde_json::Map::new();
    for field in &template.parameters {
        let value = preset
            .parameters
            .get(&field.key)
            .cloned()
            .unwrap_or_else(|| field.default.clone());
        params_map.insert(field.key.clone(), value);
    }
    ctx.insert("parameters".to_string(), serde_json::Value::Object(params_map));
    ctx.insert("preset".to_string(), serde_json::to_value(preset).unwrap_or_default());

    let body = reg.render_template(&template.body_template, &serde_json::Value::Object(ctx))?;

    let mut artifacts = Vec::new();

    match template.artifact_type.as_str() {
        "skill" => {
            let fm = template.skill_frontmatter.as_ref().ok_or_else(|| {
                CompilerError::TemplateNotFound("Missing skill frontmatter".to_string())
            })?;
            let skill_name = fm.name.clone();
            let content = format_skill_md(fm, &body);
            artifacts.push(CompiledArtifact {
                artifact_type: "skill".to_string(),
                relative_path: format!(".cursor/skills/{skill_name}/SKILL.md"),
                content,
            });
        }
        _ => {
            let fm = template.rule_frontmatter.as_ref().ok_or_else(|| {
                CompilerError::TemplateNotFound("Missing rule frontmatter".to_string())
            })?;
            let slug = slugify(&preset.name);
            let content = format_rule_mdc(fm, &body);
            artifacts.push(CompiledArtifact {
                artifact_type: "rule".to_string(),
                relative_path: format!(".cursor/rules/{slug}.mdc"),
                content,
            });
        }
    }

    let line_count: u32 = artifacts
        .iter()
        .map(|a| a.content.lines().count() as u32)
        .sum();
    let char_count: u32 = artifacts.iter().map(|a| a.content.len() as u32).sum();
    let token_estimate = char_count / 4;

    Ok(CompileResult {
        artifacts,
        token_estimate,
        line_count,
    })
}

fn format_rule_mdc(fm: &RuleFrontmatter, body: &str) -> String {
    let mut yaml = String::from("---\n");
    yaml.push_str(&format!("description: \"{}\"\n", escape_yaml(&fm.description)));
    if let Some(globs) = &fm.globs {
        yaml.push_str(&format!("globs: {globs}\n"));
    }
    yaml.push_str(&format!("alwaysApply: {}\n", fm.always_apply));
    yaml.push_str("---\n\n");
    yaml.push_str(body);
    if !body.ends_with('\n') {
        yaml.push('\n');
    }
    yaml
}

fn format_skill_md(fm: &SkillFrontmatter, body: &str) -> String {
    let mut yaml = String::from("---\n");
    yaml.push_str(&format!("name: {}\n", fm.name));
    yaml.push_str(&format!(
        "description: >-\n  {}\n",
        fm.description.replace('\n', " ")
    ));
    if fm.disable_model_invocation {
        yaml.push_str("disable-model-invocation: true\n");
    }
    yaml.push_str("---\n\n");
    yaml.push_str(body);
    if !body.ends_with('\n') {
        yaml.push('\n');
    }
    yaml
}

fn escape_yaml(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

fn slugify(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|p| !p.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

pub fn estimate_tokens(content: &str) -> u32 {
    (content.len() as u32) / 4
}
