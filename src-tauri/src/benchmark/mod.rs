use crate::compiler::{compile_preset, estimate_tokens};
use crate::db::Database;
use crate::scanner::collect_sample_files;
use crate::types::BenchmarkRun;
use chrono::Utc;
use uuid::Uuid;

pub fn run_benchmark(
    db: &Database,
    preset_id: &str,
    project_path: Option<&str>,
) -> Result<BenchmarkRun, Box<dyn std::error::Error>> {
    let preset = db
        .get_preset(preset_id)?
        .ok_or("Preset not found")?;
    let template = db
        .get_template(&preset.template_id)?
        .ok_or("Template not found")?;
    let compiled = compile_preset(db, preset_id)?;

    let globs = template
        .rule_frontmatter
        .as_ref()
        .and_then(|f| f.globs.as_deref());

    let glob_match_count = if let Some(path) = project_path {
        collect_sample_files(path, globs).len() as u32
    } else {
        0
    };

    let run = BenchmarkRun {
        id: Uuid::new_v4().to_string(),
        preset_id: preset.id.clone(),
        preset_name: preset.name.clone(),
        token_estimate: compiled.token_estimate,
        line_count: compiled.line_count,
        glob_match_count,
        adherence_score: None,
        created_at: Utc::now().to_rfc3339(),
    };

    db.insert_benchmark(&run)?;
    Ok(run)
}

pub fn score_adherence(
    db: &Database,
    benchmark_id: &str,
    compiled_content: &str,
    model_response: &str,
) -> Result<f64, Box<dyn std::error::Error>> {
    let benchmarks = db.list_benchmarks(None)?;
    let _run = benchmarks
        .iter()
        .find(|b| b.id == benchmark_id)
        .ok_or("Benchmark not found")?;

    let rules: Vec<&str> = compiled_content
        .lines()
        .filter(|l| l.starts_with("- "))
        .collect();

    if rules.is_empty() {
        return Ok(1.0);
    }

    let response_lower = model_response.to_lowercase();
    let matched = rules
        .iter()
        .filter(|rule| {
            let keywords: Vec<&str> = rule
                .split_whitespace()
                .filter(|w| w.len() > 4)
                .collect();
            keywords
                .iter()
                .any(|kw| response_lower.contains(&kw.to_lowercase()))
        })
        .count();

    let score = matched as f64 / rules.len() as f64;
    Ok(score)
}

pub fn estimate_token_footprint(content: &str) -> u32 {
    estimate_tokens(content)
}
