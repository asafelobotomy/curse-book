mod benchmark;
mod catalog;
mod compiler;
mod db;
mod deploy;
mod git;
mod mcp;
mod ollama;
mod pack;
mod scanner;
mod types;
mod workflow;

use chrono::Utc;
use db::Database;
use deploy::DeployTarget;
use std::collections::HashMap;
use std::path::PathBuf;
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
    parameters: Option<HashMap<String, serde_json::Value>>,
) -> Result<Preset, String> {
    with_db(&state, |db| {
        let template = db
            .get_template(&template_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Template not found: {template_id}"))?;

        let mut preset_parameters = HashMap::new();
        for field in &template.parameters {
            let value = parameters
                .as_ref()
                .and_then(|p| p.get(&field.key))
                .cloned()
                .unwrap_or_else(|| field.default.clone());
            preset_parameters.insert(field.key.clone(), value);
        }

        let now = Utc::now().to_rfc3339();
        let preset = Preset {
            id: Uuid::new_v4().to_string(),
            template_id: template.id.clone(),
            name: name.unwrap_or_else(|| template.name.clone()),
            description: template.description.clone(),
            artifact_type: template.artifact_type.clone(),
            parameters: preset_parameters,
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
    state: State<AppState>,
    template: TemplateDefinition,
    parameters: HashMap<String, serde_json::Value>,
) -> Result<CompileResult, String> {
    with_db(&state, |db| {
        compiler::compile_preview(db, &template, &parameters).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn get_template_stats(
    state: State<AppState>,
    template_ids: Vec<String>,
) -> Result<Vec<TemplateStats>, String> {
    with_db(&state, |db| {
        let mut stats = Vec::new();
        for id in template_ids {
            let template = db
                .get_template(&id)
                .map_err(|e| e.to_string())?
                .ok_or_else(|| format!("Template not found: {id}"))?;

            let mut parameters = HashMap::new();
            for field in &template.parameters {
                parameters.insert(field.key.clone(), field.default.clone());
            }

            let result = compiler::compile_preview(db, &template, &parameters)
                .map_err(|e| e.to_string())?;

            stats.push(TemplateStats {
                template_id: id,
                token_estimate: result.token_estimate,
                line_count: result.line_count,
            });
        }
        Ok(stats)
    })
}

#[tauri::command]
fn scan_projects(state: State<AppState>, roots: Option<Vec<String>>) -> Result<Vec<ProjectProfile>, String> {
    let scan_roots = if let Some(r) = roots {
        r
    } else {
        with_db(&state, |db| {
            match db.get_setting("scan_roots") {
                Ok(Some(json)) => serde_json::from_str(&json).map_err(|e| e.to_string()),
                Ok(None) => Ok(scanner::default_scan_roots()),
                Err(e) => Err(e.to_string()),
            }
        })?
    };
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
        let target = DeployTarget::Project {
            path: project_path.clone(),
        };
        deploy::preview_deploy(db, &preset_id, &target).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn deploy_preset(
    state: State<AppState>,
    preset_id: String,
    project_path: String,
) -> Result<DeployResult, String> {
    with_db(&state, |db| {
        let target = DeployTarget::Project {
            path: project_path.clone(),
        };
        let result = deploy::deploy_preset(db, &preset_id, &target).map_err(|e| e.to_string())?;
        auto_assign_and_touch(db, &project_path, &preset_id)?;
        Ok(result)
    })
}

#[tauri::command]
fn preview_deploy_to_user(
    state: State<AppState>,
    preset_id: String,
) -> Result<Vec<DeployDiff>, String> {
    with_db(&state, |db| {
        deploy::preview_deploy(db, &preset_id, &DeployTarget::UserCursebook)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn deploy_preset_to_user(
    state: State<AppState>,
    preset_id: String,
) -> Result<DeployResult, String> {
    with_db(&state, |db| {
        deploy::deploy_preset(db, &preset_id, &DeployTarget::UserCursebook)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn preview_deploy_with_target(
    state: State<AppState>,
    preset_id: String,
    target_kind: String,
    project_path: Option<String>,
    plugin_name: Option<String>,
) -> Result<Vec<DeployDiff>, String> {
    with_db(&state, |db| {
        let target = deploy::parse_deploy_target(
            &target_kind,
            project_path.as_deref(),
            plugin_name.as_deref(),
        )
        .map_err(|e| e.to_string())?;
        deploy::preview_deploy(db, &preset_id, &target).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn deploy_preset_with_target(
    state: State<AppState>,
    preset_id: String,
    target_kind: String,
    project_path: Option<String>,
    plugin_name: Option<String>,
) -> Result<DeployResult, String> {
    with_db(&state, |db| {
        let target = deploy::parse_deploy_target(
            &target_kind,
            project_path.as_deref(),
            plugin_name.as_deref(),
        )
        .map_err(|e| e.to_string())?;
        let result = deploy::deploy_preset(db, &preset_id, &target).map_err(|e| e.to_string())?;
        if let DeployTarget::Project { path } = &target {
            auto_assign_and_touch(db, path, &preset_id)?;
        }
        Ok(result)
    })
}

#[tauri::command]
fn merge_preview_mcp(
    state: State<AppState>,
    preset_id: String,
    target_kind: String,
    project_path: Option<String>,
) -> Result<McpMergePreview, String> {
    with_db(&state, |db| {
        let target = deploy::parse_deploy_target(
            &target_kind,
            project_path.as_deref(),
            None,
        )
        .map_err(|e| e.to_string())?;
        deploy::merge_preview_mcp(db, &preset_id, &target).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_installed_plugins(state: State<AppState>) -> Result<Vec<InstalledPlugin>, String> {
    with_db(&state, |db| {
        db.list_installed_plugins().map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn uninstall_plugin(state: State<AppState>, name: String) -> Result<(), String> {
    with_db(&state, |db| deploy::uninstall_plugin(db, &name).map_err(|e| e.to_string()))
}

#[tauri::command]
fn check_plugin_sync(state: State<AppState>, name: String) -> Result<SyncStatus, String> {
    with_db(&state, |db| {
        deploy::check_plugin_sync(db, &name).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn get_mcp_env_vars(state: State<AppState>, preset_id: String) -> Result<Vec<String>, String> {
    with_db(&state, |db| {
        let preset = db
            .get_preset(&preset_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Preset not found: {preset_id}"))?;
        let template = db
            .get_template(&preset.template_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Template not found: {}", preset.template_id))?;
        Ok(mcp::env_vars_for_template(&template))
    })
}

#[tauri::command]
fn get_template_mcp_env_vars(
    state: State<AppState>,
    template_id: String,
) -> Result<Vec<String>, String> {
    with_db(&state, |db| {
        let template = db
            .get_template(&template_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Template not found: {template_id}"))?;
        Ok(mcp::env_vars_for_template(&template))
    })
}

#[tauri::command]
fn check_sync_status(project_path: String) -> Result<SyncStatus, String> {
    deploy::check_sync(&project_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn check_global_sync_status() -> Result<SyncStatus, String> {
    deploy::check_global_sync().map_err(|e| e.to_string())
}

#[tauri::command]
fn assign_preset_to_project(
    state: State<AppState>,
    project_id: String,
    preset_id: String,
) -> Result<ProjectProfile, String> {
    with_db(&state, |db| {
        db.assign_preset_to_project(&project_id, &preset_id)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn unassign_preset_from_project(
    state: State<AppState>,
    project_id: String,
    preset_id: String,
) -> Result<ProjectProfile, String> {
    with_db(&state, |db| {
        db.unassign_preset_from_project(&project_id, &preset_id)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn deploy_project_presets(
    state: State<AppState>,
    project_id: String,
) -> Result<Vec<DeployResult>, String> {
    with_db(&state, |db| {
        let project = db
            .get_project(&project_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Project not found: {project_id}"))?;
        let results =
            deploy::deploy_project_presets(db, &project.path, &project.preset_ids)
                .map_err(|e| e.to_string())?;
        let mut updated = project.clone();
        updated.last_deployed_at = Some(Utc::now().to_rfc3339());
        db.upsert_project(&updated).map_err(|e| e.to_string())?;
        Ok(results)
    })
}

#[tauri::command]
fn list_projects_for_preset(
    state: State<AppState>,
    preset_id: String,
) -> Result<Vec<ProjectProfile>, String> {
    with_db(&state, |db| {
        db.list_projects_for_preset(&preset_id)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn git_status_project(project_path: String, force: Option<bool>) -> Result<GitStatusSummary, String> {
    git::status_summary(&project_path, force.unwrap_or(false)).map_err(|e| e.to_string())
}

#[tauri::command]
fn git_stage_project(project_path: String) -> Result<Vec<String>, String> {
    git::stage_cursor_files(&project_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn git_commit_project(
    project_path: String,
    message: Option<String>,
) -> Result<GitResultPayload, String> {
    git::commit(&project_path, message.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn git_push_project(project_path: String) -> Result<GitResultPayload, String> {
    git::push(&project_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn git_ship_project(
    project_path: String,
    message: Option<String>,
    push: bool,
    force: Option<bool>,
) -> Result<GitResultPayload, String> {
    git::ship(
        &project_path,
        message.as_deref(),
        push,
        force.unwrap_or(false),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_in_cursor(project_path: String) -> Result<(), String> {
    workflow::open_in_cursor(&project_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn export_user_rule_text(state: State<AppState>, preset_id: String) -> Result<String, String> {
    with_db(&state, |db| {
        workflow::export_user_rule_text(db, &preset_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn get_mcp_config_snippet() -> Result<String, String> {
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("curse-book")
        .to_string_lossy()
        .to_string();
    Ok(workflow::build_mcp_config_snippet(&data_dir))
}

#[tauri::command]
fn get_scan_roots(state: State<AppState>) -> Result<Vec<String>, String> {
    with_db(&state, |db| {
        match db.get_setting("scan_roots").map_err(|e| e.to_string())? {
            Some(json) => serde_json::from_str(&json).map_err(|e| e.to_string()),
            None => Ok(scanner::default_scan_roots()),
        }
    })
}

#[tauri::command]
fn set_scan_roots(state: State<AppState>, roots: Vec<String>) -> Result<(), String> {
    with_db(&state, |db| {
        let json = serde_json::to_string(&roots).map_err(|e| e.to_string())?;
        db.set_setting("scan_roots", &json)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn get_custom_catalog_paths(state: State<AppState>) -> Result<Vec<String>, String> {
    with_db(&state, |db| {
        catalog::load_custom_catalog_paths(db).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn set_custom_catalog_paths(state: State<AppState>, paths: Vec<String>) -> Result<usize, String> {
    with_db(&state, |db| {
        let json = serde_json::to_string(&paths).map_err(|e| e.to_string())?;
        db.set_setting("custom_catalog_paths", &json)
            .map_err(|e| e.to_string())?;
        catalog::import_catalog_to_db(db).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_catalog_import_meta(state: State<AppState>) -> Result<Vec<crate::types::PluginSource>, String> {
    with_db(&state, |db| {
        db.list_plugin_sources().map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_catalog_sources() -> Result<Vec<crate::types::CatalogSourceEntry>, String> {
    catalog::load_sources_registry()
        .map(|r| r.sources)
        .map_err(|e| e.to_string())
}

fn auto_assign_and_touch(db: &Database, project_path: &str, preset_id: &str) -> Result<(), String> {
    if let Ok(projects) = db.list_projects() {
        if let Some(mut project) = projects.into_iter().find(|p| p.path == project_path) {
            if !project.preset_ids.contains(&preset_id.to_string()) {
                project.preset_ids.push(preset_id.to_string());
            }
            project.last_deployed_at = Some(Utc::now().to_rfc3339());
            db.upsert_project(&project).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
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

#[tauri::command]
fn get_setting_cmd(state: State<AppState>, key: String) -> Result<Option<String>, String> {
    with_db(&state, |db| db.get_setting(&key).map_err(|e| e.to_string()))
}

#[tauri::command]
fn set_setting_cmd(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    with_db(&state, |db| db.set_setting(&key, &value).map_err(|e| e.to_string()))
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
            get_template_stats,
            scan_projects,
            list_projects,
            save_project,
            delete_project,
            preview_deploy,
            deploy_preset,
            preview_deploy_to_user,
            deploy_preset_to_user,
            preview_deploy_with_target,
            deploy_preset_with_target,
            merge_preview_mcp,
            list_installed_plugins,
            uninstall_plugin,
            check_plugin_sync,
            get_mcp_env_vars,
            get_template_mcp_env_vars,
            check_sync_status,
            check_global_sync_status,
            assign_preset_to_project,
            unassign_preset_from_project,
            deploy_project_presets,
            list_projects_for_preset,
            git_status_project,
            git_stage_project,
            git_commit_project,
            git_push_project,
            git_ship_project,
            open_in_cursor,
            export_user_rule_text,
            get_mcp_config_snippet,
            get_scan_roots,
            set_scan_roots,
            get_custom_catalog_paths,
            set_custom_catalog_paths,
            list_catalog_sources,
            list_catalog_import_meta,
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
            get_setting_cmd,
            set_setting_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
