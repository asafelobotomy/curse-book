# Curated external sources

Curse Book ships a **strict curated list** of external repositories. Only repos with **≥1,000 GitHub stars** are included in the default registry.

Users who want other repos (including high-quality projects below 1k stars) can add them via [Bring your own sources](#bring-your-own-sources).

## Policy

| Rule | Detail |
|------|--------|
| Star gate | ≥1,000 GitHub stars at review time |
| Shipped bulk import | Only `awesome-cursorrules` and `cursor/plugins` |
| Reference only | `vercel-labs/skills` (skills CLI ecosystem, not mirrored) |
| Native catalog | `catalog/*.json` — Curse Book parameterized templates (`curse-book` tag) |
| Validation | `node scripts/validate-sources-registry.mjs` |

Registry file: [`catalog/sources.json`](../catalog/sources.json)

## Approved sources

### Shipped (bulk import)

| ID | Repository | Stars (at review) | Content |
|----|------------|-------------------|---------|
| `awesome-cursorrules` | [PatrickJS/awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules) | ~40k | Rules (`.mdc`) → `catalog/imported/acr-*.json` |
| `cursor/plugins` | [cursor/plugins](https://github.com/cursor/plugins) | ~2.2k | Official plugin bundles → `catalog/imported/plugins/` (3 marketplace plugins; github/tavily/postgres covered by native MCP templates) |

### Reference only

| ID | Repository | Notes |
|----|------------|-------|
| `vercel-labs/skills` | [vercel-labs/skills](https://github.com/vercel-labs/skills) | Skills installer CLI — use [skills.sh](https://skills.sh) / `npx skills`. Not bulk-imported. |

## Overlap pruning

Native parameterized templates take precedence over verbatim imports. `catalog/sources.json` lists `pruneImportedIds` for acr templates that duplicate native coverage (e.g. Flutter, Android, Next.js). The importer deletes these on each run.

## Refresh imports

```bash
# Validate star counts
node scripts/validate-sources-registry.mjs

# Rules from awesome-cursorrules (reads caps/excludes from sources.json)
node scripts/import-awesome-cursorrules.mjs

# Plugins from cursor/plugins (reads allowlist from sources.json)
node scripts/import-cursor-plugins.mjs
```

## Bring your own sources

Curse Book does **not** ship or auto-update custom sources.

### 1. Custom catalog directory

Add JSON template files to extra scan paths (Settings → Custom catalog paths), defaulting to `~/.curse/catalog/`. Files must match the `TemplateDefinition` shape used in `catalog/*.json`.

### 2. Preset packs

Export/import `.zip` packs from the Packs page to share templates between machines or teams.

### 3. Import scripts (power users)

Scripts are layout-specific — they only work with repos that match the upstream structure:

```bash
node scripts/import-awesome-cursorrules.mjs ~/.curse/imported
node scripts/import-cursor-plugins.mjs ~/.curse/plugins --max 20
```

Point output at a custom catalog path in Settings so templates load on next app start.

## Excluded examples (<1k stars)

These are **not** in the shipped registry. Users may add them via BYO:

- d-padmanabhan/agent-engineering-handbook
- aussiegingersnap/cursor-skills
- veniceai/skills
- Personal dotfiles / orchestration bundles

## Adding a new curated source

1. Confirm ≥1,000 stars and Cursor-native layout
2. Add entry to `catalog/sources.json` with `starsAtReview`, license, import script
3. Run `validate-sources-registry.mjs`
4. Implement or extend an import script
5. Document in this file
