use rusqlite::Connection;

pub fn run(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            artifact_type TEXT NOT NULL,
            tags TEXT NOT NULL DEFAULT '[]',
            parameters TEXT NOT NULL DEFAULT '[]',
            rule_frontmatter TEXT,
            skill_frontmatter TEXT,
            body_template TEXT NOT NULL,
            source TEXT
        );

        CREATE TABLE IF NOT EXISTS presets (
            id TEXT PRIMARY KEY,
            template_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            artifact_type TEXT NOT NULL,
            parameters TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            preset_ids TEXT NOT NULL DEFAULT '[]',
            last_deployed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS benchmarks (
            id TEXT PRIMARY KEY,
            preset_id TEXT NOT NULL,
            preset_name TEXT NOT NULL,
            token_estimate INTEGER NOT NULL,
            line_count INTEGER NOT NULL,
            glob_match_count INTEGER NOT NULL DEFAULT 0,
            adherence_score REAL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        ",
    )?;
    Ok(())
}
