use crate::db::Database;
use crate::types::{OllamaGenerateResult, OllamaStatus};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const OLLAMA_BASE: &str = "http://localhost:11434";

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModelInfo>,
}

#[derive(Debug, Deserialize)]
struct OllamaModelInfo {
    name: String,
}

#[derive(Debug, Serialize)]
struct OllamaGenerateRequest {
    model: String,
    prompt: String,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    format: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaGenerateResponse {
    response: String,
}

pub fn check_status(db: &Database) -> Result<OllamaStatus, Box<dyn std::error::Error>> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()?;

    let available = client.get(format!("{OLLAMA_BASE}/api/tags")).send().is_ok();
    let models = if available {
        client
            .get(format!("{OLLAMA_BASE}/api/tags"))
            .send()?
            .json::<OllamaTagsResponse>()?
            .models
            .into_iter()
            .map(|m| m.name)
            .collect()
    } else {
        Vec::new()
    };

    let selected_model = db.get_setting("ollama_model")?;

    Ok(OllamaStatus {
        available,
        models,
        selected_model,
    })
}

pub fn generate(
    db: &Database,
    prompt: &str,
    json_mode: bool,
) -> Result<OllamaGenerateResult, Box<dyn std::error::Error>> {
    let status = check_status(db)?;
    if !status.available {
        return Err("Ollama is not running. Start it with: ollama serve".into());
    }

    let model = status
        .selected_model
        .or_else(|| status.models.first().cloned())
        .ok_or("No Ollama models installed. Run: ollama pull qwen2.5:3b")?;

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()?;

    let request = OllamaGenerateRequest {
        model: model.clone(),
        prompt: prompt.to_string(),
        stream: false,
        format: if json_mode {
            Some("json".to_string())
        } else {
            None
        },
    };

    let response = client
        .post(format!("{OLLAMA_BASE}/api/generate"))
        .json(&request)
        .send()?
        .json::<OllamaGenerateResponse>()?;

    Ok(OllamaGenerateResult {
        response: response.response,
        model,
    })
}

pub fn nl_to_parameters(
    db: &Database,
    description: &str,
    parameter_schema: &str,
) -> Result<HashMap<String, serde_json::Value>, Box<dyn std::error::Error>> {
    let prompt = format!(
        "Given this user request for Cursor AI behavior: \"{description}\"\n\
         And this parameter schema (JSON array of fields with key, fieldType, default):\n{parameter_schema}\n\
         Return ONLY a JSON object mapping parameter keys to values. No explanation."
    );

    let result = generate(db, &prompt, true)?;
    let params: HashMap<String, serde_json::Value> = serde_json::from_str(&result.response)?;
    Ok(params)
}

pub fn generate_rule_body(
    db: &Database,
    description: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    let prompt = format!(
        "Write concise Cursor rule markdown body (bullet points only, no frontmatter) for:\n\"{description}\"\n\
         Keep under 30 lines. Be specific and actionable."
    );
    let result = generate(db, &prompt, false)?;
    Ok(result.response)
}

pub fn judge_adherence(
    db: &Database,
    rules: &str,
    sample_output: &str,
) -> Result<f64, Box<dyn std::error::Error>> {
    let prompt = format!(
        "Score 0.0 to 1.0 how well this output follows the rules.\n\
         Rules:\n{rules}\n\nOutput:\n{sample_output}\n\n\
         Reply with ONLY a decimal number between 0 and 1."
    );
    let result = generate(db, &prompt, false)?;
    let score: f64 = result.response.trim().parse().unwrap_or(0.5);
    Ok(score.clamp(0.0, 1.0))
}
