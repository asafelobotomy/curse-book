use crate::db::Database;
use crate::types::{CursePackManifest, Preset, TemplateDefinition};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

pub fn export_pack(
    db: &Database,
    preset_ids: &[String],
    output_path: &str,
    pack_meta: &CursePackManifest,
) -> Result<String, Box<dyn std::error::Error>> {
    let file = File::create(output_path)?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let manifest_json = serde_json::to_string_pretty(pack_meta)?;
    zip.start_file("curse-pack.json", options)?;
    zip.write_all(manifest_json.as_bytes())?;

    let mut template_ids = Vec::new();
    for preset_id in preset_ids {
        let preset = db
            .get_preset(preset_id)?
            .ok_or_else(|| format!("Preset not found: {preset_id}"))?;
        template_ids.push(preset.template_id.clone());

        let preset_json = serde_json::to_string_pretty(&preset)?;
        zip.start_file(format!("presets/{preset_id}.json"), options)?;
        zip.write_all(preset_json.as_bytes())?;
    }

    for template_id in template_ids {
        if let Some(template) = db.get_template(&template_id)? {
            let template_json = serde_json::to_string_pretty(&template)?;
            zip.start_file(format!("templates/{template_id}.json"), options)?;
            zip.write_all(template_json.as_bytes())?;
        }
    }

    zip.finish()?;
    Ok(output_path.to_string())
}

pub fn import_pack(
    db: &Database,
    pack_path: &str,
) -> Result<(CursePackManifest, usize, usize), Box<dyn std::error::Error>> {
    let file = File::open(pack_path)?;
    let mut archive = zip::ZipArchive::new(file)?;

    let mut manifest: Option<CursePackManifest> = None;
    let mut preset_count = 0;
    let mut template_count = 0;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let name = file.name().to_string();
        let mut content = String::new();
        file.read_to_string(&mut content)?;

        if name == "curse-pack.json" {
            manifest = Some(serde_json::from_str(&content)?);
        } else if name.starts_with("presets/") && name.ends_with(".json") {
            let preset: Preset = serde_json::from_str(&content)?;
            db.upsert_preset(&preset)?;
            preset_count += 1;
        } else if name.starts_with("templates/") && name.ends_with(".json") {
            let template: TemplateDefinition = serde_json::from_str(&content)?;
            db.upsert_template(&template)?;
            template_count += 1;
        }
    }

    let manifest = manifest.ok_or("Missing curse-pack.json in archive")?;
    Ok((manifest, preset_count, template_count))
}

pub fn init_git_sync(repo_path: &str) -> Result<String, Box<dyn std::error::Error>> {
    let path = PathBuf::from(repo_path);
    fs::create_dir_all(&path)?;

    let readme = format!(
        "# Curse Book Team Library\n\nShared preset packs for Cursor rules and skills.\n\nPlace `.curse-pack.zip` files here or use Curse Book to export directly.\n"
    );
    fs::write(path.join("README.md"), readme)?;

    Ok(path.to_string_lossy().to_string())
}

pub fn list_pack_directory(dir: &str) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let path = Path::new(dir);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let mut packs = Vec::new();
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let p = entry.path();
        if p.extension().and_then(|e| e.to_str()) == Some("zip") {
            packs.push(p.to_string_lossy().to_string());
        }
    }
    packs.sort();
    Ok(packs)
}
