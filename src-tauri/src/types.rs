use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParameterField {
    pub key: String,
    pub label: String,
    pub field_type: String,
    pub default: serde_json::Value,
    #[serde(default)]
    pub options: Vec<String>,
    #[serde(default)]
    pub min: Option<f64>,
    #[serde(default)]
    pub max: Option<f64>,
    #[serde(default)]
    pub step: Option<f64>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub artifact_type: String,
    pub tags: Vec<String>,
    pub parameters: Vec<ParameterField>,
    pub rule_frontmatter: Option<RuleFrontmatter>,
    pub skill_frontmatter: Option<SkillFrontmatter>,
    #[serde(default)]
    pub subagent_frontmatter: Option<SubagentFrontmatter>,
    #[serde(default)]
    pub hook_bundle: Option<HookBundle>,
    #[serde(default)]
    pub mcp_frontmatter: Option<McpFrontmatter>,
    #[serde(default)]
    pub plugin_manifest: Option<PluginManifest>,
    #[serde(default)]
    pub plugin_bundle: Option<PluginBundle>,
    pub body_template: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub source_url: Option<String>,
    #[serde(default)]
    pub source_repo: Option<String>,
    #[serde(default)]
    pub source_path: Option<String>,
    #[serde(default)]
    pub highlights: Vec<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleFrontmatter {
    pub description: String,
    #[serde(default)]
    pub globs: Option<String>,
    #[serde(default)]
    pub always_apply: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillFrontmatter {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub disable_model_invocation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubagentFrontmatter {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub is_background: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HookBundle {
    pub hooks_json: String,
    #[serde(default)]
    pub scripts: Vec<HookScript>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HookScript {
    pub path: String,
    pub content: String,
    #[serde(default)]
    pub executable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpFrontmatter {
    pub server_key: String,
    pub config_template: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub name: String,
    pub version: String,
    pub description: String,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub child_template_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginBundle {
    #[serde(default)]
    pub manifest: Option<serde_json::Value>,
    pub files: Vec<PluginBundleFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginBundleFile {
    pub path: String,
    pub content: String,
    #[serde(default)]
    pub executable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preset {
    pub id: String,
    pub template_id: String,
    pub name: String,
    pub description: String,
    pub artifact_type: String,
    pub parameters: HashMap<String, serde_json::Value>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectProfile {
    pub id: String,
    pub name: String,
    pub path: String,
    pub preset_ids: Vec<String>,
    pub last_deployed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompiledArtifact {
    pub artifact_type: String,
    pub relative_path: String,
    pub content: String,
    #[serde(default)]
    pub executable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompileResult {
    pub artifacts: Vec<CompiledArtifact>,
    pub token_estimate: u32,
    pub line_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeployDiff {
    pub path: String,
    pub action: String,
    pub old_content: Option<String>,
    pub new_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeployResult {
    pub project_path: String,
    pub deployed_files: Vec<String>,
    pub manifest_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookManifest {
    pub version: u32,
    pub preset_id: String,
    pub preset_name: String,
    pub deployed_at: String,
    pub artifacts: Vec<ManifestArtifact>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestArtifact {
    pub relative_path: String,
    pub checksum: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalManifestEntry {
    pub preset_id: String,
    pub preset_name: String,
    pub deployed_at: String,
    pub artifacts: Vec<ManifestArtifact>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalBookManifest {
    pub version: u32,
    pub entries: HashMap<String, GlobalManifestEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPlugin {
    pub id: String,
    pub name: String,
    pub version: Option<String>,
    pub path: String,
    pub checksum: Option<String>,
    pub installed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginSource {
    pub id: String,
    pub repo: String,
    pub commit_sha: Option<String>,
    pub imported_at: String,
    pub plugin_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogSourceEntry {
    pub id: String,
    pub repo: String,
    #[serde(default)]
    pub stars_at_review: Option<u64>,
    pub license: Option<String>,
    #[serde(default)]
    pub artifact_types: Vec<String>,
    pub import_script: Option<String>,
    #[serde(default)]
    pub shipped: bool,
    #[serde(default)]
    pub reference_only: Option<bool>,
    pub reference_url: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourcesRegistry {
    pub version: u32,
    pub min_stars_policy: u64,
    pub sources: Vec<CatalogSourceEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpMergePreview {
    pub path: String,
    pub server_key: String,
    pub key_exists: bool,
    pub old_content: Option<String>,
    pub new_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusSummary {
    pub is_repo: bool,
    pub dirty: bool,
    pub unrelated_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitResultPayload {
    pub staged_files: Vec<String>,
    pub commit_sha: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BenchmarkRun {
    pub id: String,
    pub preset_id: String,
    pub preset_name: String,
    pub token_estimate: u32,
    pub line_count: u32,
    pub glob_match_count: u32,
    pub adherence_score: Option<f64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaStatus {
    pub available: bool,
    pub models: Vec<String>,
    pub selected_model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaGenerateResult {
    pub response: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub project_path: String,
    pub in_sync: bool,
    pub drifted_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CursePackManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub templates: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateStats {
    pub template_id: String,
    pub token_estimate: u32,
    pub line_count: u32,
}

pub fn artifact_type_label(artifact_type: &str) -> String {
    match artifact_type {
        "rule" => "rule".to_string(),
        "skill" => "skill".to_string(),
        "subagent" => "subagent".to_string(),
        "hook" => "hook".to_string(),
        "mcp" => "mcp".to_string(),
        "plugin" => "plugin".to_string(),
        other => other.to_string(),
    }
}
