# Curse Book Architecture

## Overview

Curse Book is a Tauri desktop app that manages Cursor AI configuration as **parameterized presets**, compiling them to native artifacts.

## Data flow

```
Catalog JSON templates
        ↓
  Preset (SQLite) ← GUI sliders/toggles
        ↓
  Handlebars compiler
        ↓
  .mdc / SKILL.md / manifest
        ↓
  Deploy → project/.cursor/
```

## Components

| Module | Path | Role |
|--------|------|------|
| Frontend | `src/` | React UI: catalog, editor, projects, benchmarks, AI |
| Backend | `src-tauri/src/` | SQLite, compiler, deploy, Ollama client |
| Catalog | `catalog/` | Built-in template definitions |
| MCP | `mcp/` | Cursor Agent bridge tools |
| Scripts | `scripts/` | awesome-cursorrules ingestion |

## Storage

- **SQLite**: `~/.local/share/curse-book/curse-book.db`
- **Manifest**: `.curse/book.manifest.json` per deployed project

## Cursor artifact mapping

| Preset type | Output path |
|-------------|-------------|
| rule | `.cursor/rules/{slug}.mdc` |
| skill | `.cursor/skills/{name}/SKILL.md` |

## MCP tools

- `curse_list_presets`
- `curse_apply_preset`
- `curse_sync_status`
- `curse_export_pack`
