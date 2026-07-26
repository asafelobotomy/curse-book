use crate::db::Database;
use crate::mcp;
use crate::types::{
    CompileResult, CompiledArtifact, HookBundle, PluginManifest, Preset, RuleFrontmatter,
    SkillFrontmatter, SubagentFrontmatter, TemplateDefinition,
};
use handlebars::Handlebars;
use serde_json::json;
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
    #[error("MCP error: {0}")]
    Mcp(#[from] mcp::McpError),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Unsupported artifact type: {0}")]
    UnsupportedArtifact(String),
}

pub type CompilerResult<T> = Result<T, CompilerError>;

pub fn compile_preset(db: &Database, preset_id: &str) -> CompilerResult<CompileResult> {
    let preset = db
        .get_preset(preset_id)?
        .ok_or_else(|| CompilerError::PresetNotFound(preset_id.to_string()))?;
    let template = db
        .get_template(&preset.template_id)?
        .ok_or_else(|| CompilerError::TemplateNotFound(preset.template_id.clone()))?;
    compile_from_parts(Some(db), &preset, &template)
}

pub fn compile_preview(
    db: &Database,
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
    compile_from_parts(Some(db), &preset, template)
}

fn compile_from_parts(
    db: Option<&Database>,
    preset: &Preset,
    template: &TemplateDefinition,
) -> CompilerResult<CompileResult> {
    let body = render_body(template, preset)?;
    let mut artifacts = Vec::new();

    match template.artifact_type.as_str() {
        "skill" => {
            let fm = template.skill_frontmatter.as_ref().ok_or_else(|| {
                CompilerError::TemplateNotFound("Missing skill frontmatter".to_string())
            })?;
            let skill_name = stable_slug(&preset.id);
            let mut skill_fm = fm.clone();
            skill_fm.name = skill_name.clone();
            let content = format_skill_md(&skill_fm, &body);
            artifacts.push(CompiledArtifact {
                artifact_type: "skill".to_string(),
                relative_path: format!(".cursor/skills/{skill_name}/SKILL.md"),
                content,
                executable: false,
            });
        }
        "subagent" => {
            let fm = template.subagent_frontmatter.as_ref().ok_or_else(|| {
                CompilerError::TemplateNotFound("Missing subagent frontmatter".to_string())
            })?;
            let slug = stable_slug(&preset.id);
            let mut sub_fm = fm.clone();
            sub_fm.name = slug.clone();
            let content = format_subagent_md(&sub_fm, &body);
            artifacts.push(CompiledArtifact {
                artifact_type: "subagent".to_string(),
                relative_path: format!(".cursor/agents/{slug}.md"),
                content,
                executable: false,
            });
        }
        "hook" => {
            let bundle = template.hook_bundle.as_ref().ok_or_else(|| {
                CompilerError::TemplateNotFound("Missing hook bundle".to_string())
            })?;
            artifacts.extend(compile_hook_bundle(bundle, template, preset)?);
        }
        "mcp" => {
            let (server_key, fragment) = mcp::compile_mcp_fragment(template, &preset.parameters)?;
            let content = serde_json::to_string_pretty(&json!({
                "mcpServers": {
                    server_key: fragment
                }
            }))?;
            artifacts.push(CompiledArtifact {
                artifact_type: "mcp".to_string(),
                relative_path: ".cursor/mcp.json".to_string(),
                content,
                executable: false,
            });
        }
        "plugin" => {
            if let Some(bundle) = &template.plugin_bundle {
                for file in &bundle.files {
                    let content = if file.content.contains("{{") {
                        render_string(&file.content, template, preset)?
                    } else {
                        file.content.clone()
                    };
                    artifacts.push(CompiledArtifact {
                        artifact_type: "plugin".to_string(),
                        relative_path: file.path.clone(),
                        content,
                        executable: file.executable,
                    });
                }
            } else if let Some(pm) = &template.plugin_manifest {
                let db = db.ok_or_else(|| {
                    CompilerError::TemplateNotFound(
                        "Database required for composite plugin compile".to_string(),
                    )
                })?;
                artifacts.extend(compile_plugin_composite(db, preset, pm)?);
            } else {
                return Err(CompilerError::TemplateNotFound(
                    "Missing plugin manifest or bundle".to_string(),
                ));
            }
        }
        "rule" => {
            let fm = template.rule_frontmatter.as_ref().ok_or_else(|| {
                CompilerError::TemplateNotFound("Missing rule frontmatter".to_string())
            })?;
            let slug = stable_slug(&preset.id);
            let content = format_rule_mdc(fm, &body);
            artifacts.push(CompiledArtifact {
                artifact_type: "rule".to_string(),
                relative_path: format!(".cursor/rules/{slug}.mdc"),
                content,
                executable: false,
            });
        }
        other => return Err(CompilerError::UnsupportedArtifact(other.to_string())),
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

fn compile_plugin_composite(
    db: &Database,
    preset: &Preset,
    manifest: &PluginManifest,
) -> CompilerResult<Vec<CompiledArtifact>> {
    let mut artifacts = Vec::new();

    let plugin_json = json!({
        "name": manifest.name,
        "version": manifest.version,
        "description": manifest.description,
        "author": manifest.author,
    });
    artifacts.push(CompiledArtifact {
        artifact_type: "plugin".to_string(),
        relative_path: ".cursor-plugin/plugin.json".to_string(),
        content: serde_json::to_string_pretty(&plugin_json)?,
        executable: false,
    });

    for child_id in &manifest.child_template_ids {
        let child_template = db
            .get_template(child_id)?
            .ok_or_else(|| CompilerError::TemplateNotFound(child_id.clone()))?;

        let child_preset = Preset {
            id: format!("{}-{}", preset.id, child_id),
            template_id: child_template.id.clone(),
            name: child_template.name.clone(),
            description: child_template.description.clone(),
            artifact_type: child_template.artifact_type.clone(),
            parameters: default_parameters(&child_template),
            created_at: String::new(),
            updated_at: String::new(),
        };

        let child_result = compile_from_parts(Some(db), &child_preset, &child_template)?;
        for artifact in child_result.artifacts {
            artifacts.push(remap_for_plugin_layout(artifact));
        }
    }

    Ok(artifacts)
}

fn compile_hook_bundle(
    bundle: &HookBundle,
    template: &TemplateDefinition,
    preset: &Preset,
) -> CompilerResult<Vec<CompiledArtifact>> {
    let hooks_json = render_string(&bundle.hooks_json, template, preset)?;

    let mut artifacts = vec![CompiledArtifact {
        artifact_type: "hook".to_string(),
        relative_path: ".cursor/hooks.json".to_string(),
        content: hooks_json,
        executable: false,
    }];

    for script in &bundle.scripts {
        let content = render_string(&script.content, template, preset)?;
        artifacts.push(CompiledArtifact {
            artifact_type: "hook".to_string(),
            relative_path: format!(".cursor/hooks/{}", script.path),
            content,
            executable: script.executable,
        });
    }

    Ok(artifacts)
}

fn remap_for_plugin_layout(mut artifact: CompiledArtifact) -> CompiledArtifact {
    artifact.relative_path = if artifact.relative_path.starts_with(".cursor/rules/") {
        artifact
            .relative_path
            .replacen(".cursor/rules/", "rules/", 1)
    } else if artifact.relative_path.starts_with(".cursor/skills/") {
        artifact
            .relative_path
            .replacen(".cursor/skills/", "skills/", 1)
    } else if artifact.relative_path.starts_with(".cursor/agents/") {
        artifact
            .relative_path
            .replacen(".cursor/agents/", "agents/", 1)
    } else if artifact.relative_path == ".cursor/hooks.json" {
        "hooks/hooks.json".to_string()
    } else if artifact.relative_path.starts_with(".cursor/hooks/") {
        artifact
            .relative_path
            .replacen(".cursor/hooks/", "hooks/", 1)
    } else if artifact.relative_path == ".cursor/mcp.json" {
        "mcp.json".to_string()
    } else {
        artifact.relative_path
    };
    artifact
}

fn default_parameters(template: &TemplateDefinition) -> HashMap<String, serde_json::Value> {
    let mut params = HashMap::new();
    for field in &template.parameters {
        params.insert(field.key.clone(), field.default.clone());
    }
    params
}

fn render_body(template: &TemplateDefinition, preset: &Preset) -> CompilerResult<String> {
    render_string(&template.body_template, template, preset)
}

fn render_string(
    template_str: &str,
    template: &TemplateDefinition,
    preset: &Preset,
) -> CompilerResult<String> {
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

    Ok(reg.render_template(template_str, &serde_json::Value::Object(ctx))?)
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

fn format_subagent_md(fm: &SubagentFrontmatter, body: &str) -> String {
    let mut yaml = String::from("---\n");
    yaml.push_str(&format!("name: {}\n", fm.name));
    yaml.push_str(&format!(
        "description: >-\n  {}\n",
        fm.description.replace('\n', " ")
    ));
    if let Some(model) = &fm.model {
        yaml.push_str(&format!("model: {model}\n"));
    }
    if fm.is_background == Some(true) {
        yaml.push_str("is_background: true\n");
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

fn stable_slug(id: &str) -> String {
    id.chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .to_lowercase()
}

pub fn estimate_tokens(content: &str) -> u32 {
    (content.len() as u32) / 4
}
