use crate::types::{GitResultPayload, GitStatusSummary};
use std::path::Path;
use std::process::Command;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GitError {
    #[error("Not a git repository: {0}")]
    NotARepo(String),
    #[error("Git command failed: {0}")]
    CommandFailed(String),
    #[error("Dirty worktree: unrelated files modified")]
    DirtyWorktree { unrelated_files: Vec<String> },
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub type GitResult<T> = Result<T, GitError>;

const DEFAULT_COMMIT_MESSAGE: &str = "chore(cursor): update rules from Curse Book";

fn run_git(project_path: &Path, args: &[&str]) -> GitResult<String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(project_path)
        .output()?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(GitError::CommandFailed(if stderr.is_empty() {
            format!("git {} failed", args.join(" "))
        } else {
            stderr
        }))
    }
}

pub fn is_git_repo(path: &str) -> bool {
    run_git(Path::new(path), &["rev-parse", "--is-inside-work-tree"])
        .map(|s| s == "true")
        .unwrap_or(false)
}

pub fn status_summary(path: &str, force: bool) -> GitResult<GitStatusSummary> {
    let project_path = Path::new(path);
    if !is_git_repo(path) {
        return Ok(GitStatusSummary {
            is_repo: false,
            dirty: false,
            unrelated_files: Vec::new(),
        });
    }

    let porcelain = run_git(project_path, &["status", "--porcelain"])?;
    let mut unrelated = Vec::new();
    for line in porcelain.lines() {
        if line.len() < 4 {
            continue;
        }
        let file_path = line[3..].trim();
        if file_path.starts_with(".cursor/") || file_path.starts_with(".curse/") {
            continue;
        }
        unrelated.push(file_path.to_string());
    }

    if !force && !unrelated.is_empty() {
        return Err(GitError::DirtyWorktree {
            unrelated_files: unrelated.clone(),
        });
    }

    Ok(GitStatusSummary {
        is_repo: true,
        dirty: !porcelain.is_empty(),
        unrelated_files: unrelated,
    })
}

pub fn stage_cursor_files(path: &str) -> GitResult<Vec<String>> {
    let project_path = Path::new(path);
    if !is_git_repo(path) {
        return Err(GitError::NotARepo(path.to_string()));
    }

    run_git(project_path, &["add", ".cursor/", ".curse/"])?;

    let staged = run_git(
        project_path,
        &["diff", "--cached", "--name-only", "--", ".cursor/", ".curse/"],
    )?;
    Ok(staged
        .lines()
        .filter(|l| !l.is_empty())
        .map(str::to_string)
        .collect())
}

pub fn commit(path: &str, message: Option<&str>) -> GitResult<GitResultPayload> {
    let project_path = Path::new(path);
    if !is_git_repo(path) {
        return Err(GitError::NotARepo(path.to_string()));
    }

    let msg = message.unwrap_or(DEFAULT_COMMIT_MESSAGE);
    run_git(project_path, &["commit", "-m", msg])?;
    let sha = run_git(project_path, &["rev-parse", "--short", "HEAD"]).ok();

    Ok(GitResultPayload {
        staged_files: Vec::new(),
        commit_sha: sha,
        message: msg.to_string(),
    })
}

pub fn push(path: &str) -> GitResult<GitResultPayload> {
    let project_path = Path::new(path);
    if !is_git_repo(path) {
        return Err(GitError::NotARepo(path.to_string()));
    }

    run_git(project_path, &["push"])?;
    Ok(GitResultPayload {
        staged_files: Vec::new(),
        commit_sha: None,
        message: "Pushed to remote".to_string(),
    })
}

pub fn ship(path: &str, message: Option<&str>, push_remote: bool, force: bool) -> GitResult<GitResultPayload> {
    let _ = status_summary(path, force)?;
    let staged = stage_cursor_files(path)?;
    if staged.is_empty() {
        return Ok(GitResultPayload {
            staged_files: staged,
            commit_sha: None,
            message: "Nothing to commit".to_string(),
        });
    }

    let commit_result = commit(path, message)?;
    if push_remote {
        push(path)?;
    }

    Ok(GitResultPayload {
        staged_files: staged,
        commit_sha: commit_result.commit_sha,
        message: if push_remote {
            "Staged, committed, and pushed".to_string()
        } else {
            "Staged and committed".to_string()
        },
    })
}
