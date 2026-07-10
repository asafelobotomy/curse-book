use crate::types::ProjectProfile;
use std::path::{Path, PathBuf};
use uuid::Uuid;
use walkdir::WalkDir;

pub fn scan_directories(roots: &[String], max_depth: usize) -> Vec<ProjectProfile> {
    let mut projects = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for root in roots {
        let root_path = Path::new(root);
        if !root_path.exists() {
            continue;
        }

        if is_cursor_project(root_path) {
            let path_str = root_path.to_string_lossy().to_string();
            if seen.insert(path_str.clone()) {
                projects.push(make_profile(root_path));
            }
        }

        for entry in WalkDir::new(root_path)
            .max_depth(max_depth)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.is_dir() && is_cursor_project(path) {
                let path_str = path.to_string_lossy().to_string();
                if seen.insert(path_str.clone()) {
                    projects.push(make_profile(path));
                }
            }
        }
    }

    projects.sort_by(|a, b| a.name.cmp(&b.name));
    projects
}

fn is_cursor_project(path: &Path) -> bool {
    path.join(".git").exists()
        || path.join(".cursor").exists()
        || path.join("package.json").exists()
        || path.join("Cargo.toml").exists()
        || path.join("pyproject.toml").exists()
}

fn make_profile(path: &Path) -> ProjectProfile {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "project".to_string());

    ProjectProfile {
        id: Uuid::new_v4().to_string(),
        name,
        path: path.to_string_lossy().to_string(),
        preset_ids: Vec::new(),
        last_deployed_at: None,
    }
}

pub fn default_scan_roots() -> Vec<String> {
    let mut roots = Vec::new();
    if let Some(home) = dirs::home_dir() {
        roots.push(home.join("Documents").join("git").to_string_lossy().to_string());
        roots.push(home.join("Documents").to_string_lossy().to_string());
        roots.push(home.join("Projects").to_string_lossy().to_string());
    }
    roots
}

pub fn collect_sample_files(project_path: &str, globs: Option<&str>) -> Vec<String> {
    let root = PathBuf::from(project_path);
    if !root.exists() {
        return Vec::new();
    }

    let patterns: Vec<String> = globs
        .map(|g| g.split(',').map(|s| s.trim().to_string()).collect())
        .unwrap_or_else(|| vec!["**/*".to_string()]);

    let mut files = Vec::new();
    for entry in WalkDir::new(&root).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let rel = path
            .strip_prefix(&root)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();

        for pattern in &patterns {
            if glob::Pattern::new(pattern)
                .map(|p| p.matches(&rel))
                .unwrap_or(false)
            {
                files.push(rel.clone());
                break;
            }
        }
        if files.len() >= 200 {
            break;
        }
    }
    files
}
