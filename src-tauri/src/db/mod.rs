mod migrations;

use crate::types::{BenchmarkRun, Preset, ProjectProfile, TemplateDefinition};
use rusqlite::{params, Connection};
use std::path::PathBuf;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DbError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub type DbResult<T> = Result<T, DbError>;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn open() -> DbResult<Self> {
        let data_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("curse-book");
        std::fs::create_dir_all(&data_dir)?;
        let db_path = data_dir.join("curse-book.db");
        let conn = Connection::open(db_path)?;
        migrations::run(&conn)?;
        Ok(Self { conn })
    }

    pub fn upsert_template(&self, template: &TemplateDefinition) -> DbResult<()> {
        let parameters = serde_json::to_string(&template.parameters)?;
        let tags = serde_json::to_string(&template.tags)?;
        let rule_fm = template
            .rule_frontmatter
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;
        let skill_fm = template
            .skill_frontmatter
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;
        let highlights = serde_json::to_string(&template.highlights)?;

        self.conn.execute(
            "INSERT INTO templates (id, name, description, category, artifact_type, tags, parameters, rule_frontmatter, skill_frontmatter, body_template, source, source_url, source_repo, source_path, highlights, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
             ON CONFLICT(id) DO UPDATE SET
               name=excluded.name, description=excluded.description, category=excluded.category,
               artifact_type=excluded.artifact_type, tags=excluded.tags, parameters=excluded.parameters,
               rule_frontmatter=excluded.rule_frontmatter, skill_frontmatter=excluded.skill_frontmatter,
               body_template=excluded.body_template, source=excluded.source,
               source_url=excluded.source_url, source_repo=excluded.source_repo,
               source_path=excluded.source_path, highlights=excluded.highlights, updated_at=excluded.updated_at",
            params![
                template.id,
                template.name,
                template.description,
                template.category,
                template.artifact_type,
                tags,
                parameters,
                rule_fm,
                skill_fm,
                template.body_template,
                template.source,
                template.source_url,
                template.source_repo,
                template.source_path,
                highlights,
                template.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn list_templates(&self) -> DbResult<Vec<TemplateDefinition>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, category, artifact_type, tags, parameters, rule_frontmatter, skill_frontmatter, body_template, source, source_url, source_repo, source_path, highlights, updated_at FROM templates ORDER BY category, name",
        )?;
        let rows = stmt.query_map([], |row| {
            let tags: String = row.get(5)?;
            let parameters: String = row.get(6)?;
            let rule_fm: Option<String> = row.get(7)?;
            let skill_fm: Option<String> = row.get(8)?;
            let highlights: String = row.get(14).unwrap_or_else(|_| "[]".to_string());
            Ok(TemplateDefinition {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                category: row.get(3)?,
                artifact_type: row.get(4)?,
                tags: serde_json::from_str(&tags).unwrap_or_default(),
                parameters: serde_json::from_str(&parameters).unwrap_or_default(),
                rule_frontmatter: rule_fm
                    .map(|s| serde_json::from_str(&s))
                    .transpose()
                    .ok()
                    .flatten(),
                skill_frontmatter: skill_fm
                    .map(|s| serde_json::from_str(&s))
                    .transpose()
                    .ok()
                    .flatten(),
                body_template: row.get(9)?,
                source: row.get(10)?,
                source_url: row.get(11).ok(),
                source_repo: row.get(12).ok(),
                source_path: row.get(13).ok(),
                highlights: serde_json::from_str(&highlights).unwrap_or_default(),
                updated_at: row.get(15).ok(),
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
    }

    pub fn get_template(&self, id: &str) -> DbResult<Option<TemplateDefinition>> {
        Ok(self
            .list_templates()?
            .into_iter()
            .find(|t| t.id == id))
    }

    pub fn upsert_preset(&self, preset: &Preset) -> DbResult<()> {
        let parameters = serde_json::to_string(&preset.parameters)?;
        self.conn.execute(
            "INSERT INTO presets (id, template_id, name, description, artifact_type, parameters, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET
               template_id=excluded.template_id, name=excluded.name, description=excluded.description,
               artifact_type=excluded.artifact_type, parameters=excluded.parameters, updated_at=excluded.updated_at",
            params![
                preset.id,
                preset.template_id,
                preset.name,
                preset.description,
                preset.artifact_type,
                parameters,
                preset.created_at,
                preset.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn list_presets(&self) -> DbResult<Vec<Preset>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, template_id, name, description, artifact_type, parameters, created_at, updated_at FROM presets ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            let parameters: String = row.get(5)?;
            Ok(Preset {
                id: row.get(0)?,
                template_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                artifact_type: row.get(4)?,
                parameters: serde_json::from_str(&parameters).unwrap_or_default(),
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
    }

    pub fn get_preset(&self, id: &str) -> DbResult<Option<Preset>> {
        Ok(self.list_presets()?.into_iter().find(|p| p.id == id))
    }

    pub fn delete_preset(&self, id: &str) -> DbResult<()> {
        self.conn
            .execute("DELETE FROM presets WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn upsert_project(&self, project: &ProjectProfile) -> DbResult<()> {
        let preset_ids = serde_json::to_string(&project.preset_ids)?;
        self.conn.execute(
            "INSERT INTO projects (id, name, path, preset_ids, last_deployed_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET
               name=excluded.name, path=excluded.path, preset_ids=excluded.preset_ids,
               last_deployed_at=excluded.last_deployed_at",
            params![
                project.id,
                project.name,
                project.path,
                preset_ids,
                project.last_deployed_at,
            ],
        )?;
        Ok(())
    }

    pub fn list_projects(&self) -> DbResult<Vec<ProjectProfile>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, name, path, preset_ids, last_deployed_at FROM projects ORDER BY name")?;
        let rows = stmt.query_map([], |row| {
            let preset_ids: String = row.get(3)?;
            Ok(ProjectProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                preset_ids: serde_json::from_str(&preset_ids).unwrap_or_default(),
                last_deployed_at: row.get(4)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
    }

    pub fn delete_project(&self, id: &str) -> DbResult<()> {
        self.conn
            .execute("DELETE FROM projects WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn insert_benchmark(&self, run: &BenchmarkRun) -> DbResult<()> {
        self.conn.execute(
            "INSERT INTO benchmarks (id, preset_id, preset_name, token_estimate, line_count, glob_match_count, adherence_score, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                run.id,
                run.preset_id,
                run.preset_name,
                run.token_estimate,
                run.line_count,
                run.glob_match_count,
                run.adherence_score,
                run.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn list_benchmarks(&self, preset_id: Option<&str>) -> DbResult<Vec<BenchmarkRun>> {
        let mut results = Vec::new();
        if let Some(pid) = preset_id {
            let mut stmt = self.conn.prepare(
                "SELECT id, preset_id, preset_name, token_estimate, line_count, glob_match_count, adherence_score, created_at
                 FROM benchmarks WHERE preset_id = ?1 ORDER BY created_at DESC LIMIT 50",
            )?;
            let rows = stmt.query_map(params![pid], |row| map_benchmark(row))?;
            for row in rows {
                results.push(row?);
            }
        } else {
            let mut stmt = self.conn.prepare(
                "SELECT id, preset_id, preset_name, token_estimate, line_count, glob_match_count, adherence_score, created_at
                 FROM benchmarks ORDER BY created_at DESC LIMIT 100",
            )?;
            let rows = stmt.query_map([], |row| map_benchmark(row))?;
            for row in rows {
                results.push(row?);
            }
        }
        Ok(results)
    }

    pub fn get_setting(&self, key: &str) -> DbResult<Option<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> DbResult<()> {
        self.conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params![key, value],
        )?;
        Ok(())
    }
}

fn map_benchmark(row: &rusqlite::Row) -> rusqlite::Result<BenchmarkRun> {
    Ok(BenchmarkRun {
        id: row.get(0)?,
        preset_id: row.get(1)?,
        preset_name: row.get(2)?,
        token_estimate: row.get(3)?,
        line_count: row.get(4)?,
        glob_match_count: row.get(5)?,
        adherence_score: row.get(6)?,
        created_at: row.get(7)?,
    })
}
