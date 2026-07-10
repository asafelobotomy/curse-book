mod benchmark;
mod catalog;
mod compiler;
mod db;
mod deploy;
mod ollama;
mod pack;
mod scanner;
mod types;

use chrono::Utc;
use db::Database;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;
use types::*;
use uuid::Uuid;

struct AppState {
    db: Mutex<Database>,
}

fn with_db<F, T>(state: &State<AppState>, f: F) -> Result<T, String>
where
    F: FnOnce(&Database) -> Result<T, String>,
{
    let db = state.db.lock().map_err(|e| e.to_string())?;
    f(&db)
}

#[tauri::command]
fn init_app(state: State<AppState>) -> Result<usize, String> {
    with_db(&state, |db| {
        catalog::import_catalog_to_db(db).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_templates(state: State<AppState>) -> Result<Vec<TemplateDefinition>, String> {
    with_db(&state, |db| db.list_templates().map_err(|e| e.to_string()))
}

#[tauri::command]
fn list_presets(state: State<AppState>) -> Result<Vec<Preset>, String> {
    with_db(&state, |db| db.list_presets().map_err(|e| e.to_string()))
}

#[tauri::command]
fn get_preset(state: State<AppState>, id: String) -> Result<Option<Preset>, String> {
    with_db(&state, |db| db.get_preset(&id).map_err(|e| e.to_string()))
}

#[tauri::command]
fn create_preset_from_template(
    state: State<AppState>,
    template_id: String,
    name: Option<String>,
) -> Result<Preset, String> {
    with_db(&state, |db| {
        let template = db
            .get_template(&template_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Template not found: {template_id}"))?;

        let mut parameters = HashMap::new();
        for field in &template.parameters {
            parameters.insert(field.key.clone(), field.default.clone());
        }

        let now = Utc::now().to_rfc3339();
        let preset = Preset {
            id: Uuid::new_v4().to_string(),
            template_id: template.id.clone(),
            name: name.unwrap_or_else(|| template.name.clone()),
            description: template.description.clone(),
            artifact_type: template.artifact_type.clone(),
            parameters,
            created_at: now.clone(),
            updated_at: now,
        };
        db.upsert_preset(&preset).map_err(|e| e.to_string())?;
        Ok(preset)
    })
}

#[tauri::command]
fn save_preset(state: State<AppState>, preset: Preset) -> Result<Preset, String> {
    with_db(&state, |db| {
        let mut updated = preset;
        updated.updated_at = Utc::now().to_rfc3339();
        db.upsert_preset(&updated).map_err(|e| e.to_string())?;
        Ok(updated)
    })
}

#[tauri::command]
fn delete_preset(state: State<AppState>, id: String) -> Result<(), String> {
    with_db(&state, |db| db.delete_preset(&id).map_err(|e| e.to_string()))
}

#[tauri::command]
fn compile_preset_cmd(state: State<AppState>, preset_id: String) -> Result<CompileResult, String> {
    with_db(&state, |db| {
        compiler::compile_preset(db, &preset_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn compile_preview_cmd(
    template: TemplateDefinition,
    parameters: HashMap<String, serde_json::Value>,
) -> Result<CompileResult, String> {
    compiler::compile_preview(&template, &parameters).map_err(|e| e.to_string())
}

#[tauri::command]
fn scan_projects(state: State<AppState>, roots: Option<Vec<String>>) -> Result<Vec<ProjectProfile>, String> {
    let scan_roots = roots.unwrap_or_else(scanner::default_scan_roots);
    let discovered = scanner::scan_directories(&scan_roots, 4);

    with_db(&state, |db| {
        let existing = db.list_projects().map_err(|e| e.to_string())?;
        let existing_paths: HashMap<String, ProjectProfile> =
            existing.into_iter().map(|p| (p.path.clone(), p)).collect();

        let mut merged = Vec::new();
        for mut project in discovered {
            if let Some(existing) = existing_paths.get(&project.path) {
                project.id = existing.id.clone();
                project.preset_ids = existing.preset_ids.clone();
                project.last_deployed_at = existing.last_deployed_at.clone();
            }
            db.upsert_project(&project).map_err(|e| e.to_string())?;
            merged.push(project);
        }
        Ok(merged)
    })
}

#[tauri::command]
fn list_projects(state: State<AppState>) -> Result<Vec<ProjectProfile>, String> {
    with_db(&state, |db| db.list_projects().map_err(|e| e.to_string()))
}

#[tauri::command]
fn save_project(state: State<AppState>, project: ProjectProfile) -> Result<ProjectProfile, String> {
    with_db(&state, |db| {
        db.upsert_project(&project).map_err(|e| e.to_string())?;
        Ok(project)
    })
}

#[tauri::command]
fn delete_project(state: State<AppState>, id: String) -> Result<(), String> {
    with_db(&state, |db| db.delete_project(&id).map_err(|e| e.to_string()))
}

#[tauri::command]
fn preview_deploy(
    state: State<AppState>,
    preset_id: String,
    project_path: String,
) -> Result<Vec<DeployDiff>, String> {
    with_db(&state, |db| {
        deploy::preview_deploy(db, &preset_id, &project_path).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn deploy_preset(
    state: State<AppState>,
    preset_id: String,
    project_path: String,
) -> Result<DeployResult, String> {
    with_db(&state, |db| {
        let result = deploy::deploy_preset(db, &preset_id, &project_path).map_err(|e| e.to_string())?;
        if let Ok(mut projects) = db.list_projects() {
            if let Some(project) = projects.iter_mut().find(|p| p.path == project_path) {
                project.last_deployed_at = Some(Utc::now().to_rfc3339());
                let _ = db.upsert_project(project);
            }
        }
        Ok(result)
    })
}

#[tauri::command]
fn check_sync_status(project_path: String) -> Result<SyncStatus, String> {
    deploy::check_sync(&project_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn run_benchmark(
    state: State<AppState>,
    preset_id: String,
    project_path: Option<String>,
) -> Result<BenchmarkRun, String> {
    with_db(&state, |db| {
        benchmark::run_benchmark(db, &preset_id, project_path.as_deref())
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_benchmarks(
    state: State<AppState>,
    preset_id: Option<String>,
) -> Result<Vec<BenchmarkRun>, String> {
    with_db(&state, |db| {
        db.list_benchmarks(preset_id.as_deref())
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn ollama_status(state: State<AppState>) -> Result<OllamaStatus, String> {
    with_db(&state, |db| ollama::check_status(db).map_err(|e| e.to_string()))
}

#[tauri::command]
fn ollama_set_model(state: State<AppState>, model: String) -> Result<(), String> {
    with_db(&state, |db| {
        db.set_setting("ollama_model", &model)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn ollama_generate(
    state: State<AppState>,
    prompt: String,
    json_mode: Option<bool>,
) -> Result<OllamaGenerateResult, String> {
    with_db(&state, |db| {
        ollama::generate(db, &prompt, json_mode.unwrap_or(false)).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn ollama_nl_to_parameters(
    state: State<AppState>,
    description: String,
    parameter_schema: String,
) -> Result<HashMap<String, serde_json::Value>, String> {
    with_db(&state, |db| {
        ollama::nl_to_parameters(db, &description, &parameter_schema).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn ollama_generate_rule_body(
    state: State<AppState>,
    description: String,
) -> Result<String, String> {
    with_db(&state, |db| {
        ollama::generate_rule_body(db, &description).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn export_pack(
    state: State<AppState>,
    preset_ids: Vec<String>,
    output_path: String,
    pack_meta: CursePackManifest,
) -> Result<String, String> {
    with_db(&state, |db| {
        pack::export_pack(db, &preset_ids, &output_path, &pack_meta).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn import_pack(state: State<AppState>, pack_path: String) -> Result<CursePackManifest, String> {
    with_db(&state, |db| {
        let (manifest, presets, templates) = pack::import_pack(db, &pack_path).map_err(|e| e.to_string())?;
        eprintln!("Imported {presets} presets and {templates} templates");
        Ok(manifest)
    })
}

#[tauri::command]
fn init_team_library(path: String) -> Result<String, String> {
    pack::init_git_sync(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_team_packs(path: String) -> Result<Vec<String>, String> {
    pack::list_pack_directory(&path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = Database::open().expect("Failed to open database");
    if let Ok(count) = catalog::import_catalog_to_db(&db) {
        eprintln!("Loaded {count} catalog templates");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            db: Mutex::new(db),
        })
        .invoke_handler(tauri::generate_handler![
            init_app,
            list_templates,
            list_presets,
            get_preset,
            create_preset_from_template,
            save_preset,
            delete_preset,
            compile_preset_cmd,
            compile_preview_cmd,
            scan_projects,
            list_projects,
            save_project,
            delete_project,
            preview_deploy,
            deploy_preset,
            check_sync_status,
            run_benchmark,
            list_benchmarks,
            ollama_status,
            ollama_set_model,
            ollama_generate,
            ollama_nl_to_parameters,
            ollama_generate_rule_body,
            export_pack,
            import_pack,
            init_team_library,
            list_team_packs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
