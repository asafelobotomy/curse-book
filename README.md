# Curse Book

A desktop GUI for creating, customizing, and deploying Cursor rules, skills, and behaviors.

Curse Book treats rules/skills as **parameterized presets** that compile to Cursor-native artifacts (`.mdc`, `SKILL.md`, manifests) — no manual markdown editing required.

## Features

- **Template Catalog** — 85+ curated templates (native parameterized presets, imported rules, and official plugins)
- **Preset Editor** — Sliders, toggles, dropdowns with live markdown preview
- **Project Deploy** — Scan projects, preview diffs, deploy to `.cursor/`
- **Benchmark Lab** — Token footprint charts and benchmark history
- **Local AI** — Ollama integration for NL → preset wizard
- **Preset Packs** — Export/import `.zip` packs, team library sync
- **MCP Bridge** — Deploy presets from Cursor Agent chat

## Quick start

### Prerequisites

- Node.js 20+
- Rust (for Tauri)
- Linux: `webkit2gtk` and Tauri prerequisites — see [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)

### Development

```bash
npm install
npm run tauri:dev
```

### Build

```bash
npm run tauri:build
```

### MCP server

```bash
cd mcp && npm install && npm run build
```

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "curse-book": {
      "command": "node",
      "args": ["/absolute/path/to/curse_book/mcp/dist/index.js"]
    }
  }
}
```

## Architecture

```
Preset (JSON + UI) → Compiler (Handlebars) → .mdc / SKILL.md → Deploy → .cursor/
```

Data is stored in `~/.local/share/curse-book/curse-book.db`.

## Catalog templates

Templates live in `catalog/*.json`. Each defines:

- Parameter schema (sliders, toggles, selects)
- Handlebars body template
- Rule or skill frontmatter

## License

MIT
