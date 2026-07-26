#!/usr/bin/env node
/**
 * Import plugin bundles from cursor/plugins into catalog/imported/plugins/.
 * Reads allowlist and bulkCap from catalog/sources.json.
 *
 * Usage: node scripts/import-cursor-plugins.mjs [output-dir] [--max N]
 */
import { mkdir, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getSourceById } from "./load-sources-registry.mjs";

const execFileAsync = promisify(execFile);
const OUTPUT_DIR = process.argv[2] ?? "catalog/imported/plugins";
const CLI_MAX = (() => {
  const idx = process.argv.indexOf("--max");
  return idx >= 0 ? Number(process.argv[idx + 1]) : undefined;
})();
const CLONE_DIR = "/tmp/cursor-plugins-import";
const SOURCE_ID = "cursor/plugins";

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{10,}/g,
  /Bearer\s+[A-Za-z0-9._-]{10,}/g,
  /"api[_-]?key"\s*:\s*"[^{$][^"]{8,}"/gi,
];

const TEXT_EXTENSIONS = new Set([
  ".md", ".json", ".mdc", ".txt", ".sh", ".js", ".mjs", ".ts", ".yaml", ".yml",
]);

async function shallowClone(sourceRepo) {
  try {
    await execFileAsync("git", [
      "clone",
      "--depth",
      "1",
      `https://github.com/${sourceRepo}.git`,
      CLONE_DIR,
    ]);
  } catch {
    await execFileAsync("git", ["-C", CLONE_DIR, "pull", "--ff-only"]);
  }
  const { stdout } = await execFileAsync("git", ["-C", CLONE_DIR, "rev-parse", "HEAD"]);
  return stdout.trim();
}

function redactSecrets(content) {
  let out = content;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match) => {
      if (match.includes("env:")) return match;
      return '"REDACTED"';
    });
  }
  return out.replace(
    /"(GITHUB_PERSONAL_ACCESS_TOKEN|TAVILY_API_KEY|OPENAI_API_KEY|API_KEY)"\s*:\s*"[^${][^"]*"/g,
    '"$1": "${env:$1}"',
  );
}

async function walkFiles(dir, root) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full, root)));
    } else {
      const rel = relative(root, full);
      const ext = rel.slice(rel.lastIndexOf("."));
      if (!TEXT_EXTENSIONS.has(ext)) continue;
      let content = await readFile(full, "utf8");
      if (rel.endsWith("mcp.json") || rel.includes("mcp")) {
        content = redactSecrets(content);
      }
      files.push({ path: rel, content });
    }
  }
  return files;
}

async function importPlugin(pluginRoot, marketplaceEntry, commitSha, sourceRepo) {
  const SOURCE_BASE = `https://github.com/${sourceRepo}/tree/main`;
  const pluginJsonPath = join(pluginRoot, ".cursor-plugin", "plugin.json");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(pluginJsonPath, "utf8"));
  } catch {
    return null;
  }

  const name = manifest.name ?? marketplaceEntry.name;
  const files = await walkFiles(pluginRoot, pluginRoot);
  if (files.length === 0) return null;

  const id = `imported-plugin-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  return {
    id,
    artifactType: "plugin",
    name: manifest.name ?? name,
    description:
      manifest.description ??
      marketplaceEntry.description ??
      `Imported from ${sourceRepo}`,
    category: "Imported",
    tags: ["plugin", "cursor/plugins", "imported"],
    parameters: [],
    pluginBundle: { manifest, files },
    bodyTemplate: "",
    source: SOURCE_ID,
    sourceUrl: `${SOURCE_BASE}/${marketplaceEntry.source ?? name}`,
    sourceRepo,
    sourcePath: marketplaceEntry.source ?? name,
    highlights: [name, "official plugin"],
    updatedAt: new Date().toISOString().slice(0, 10),
    _importMeta: { commitSha },
  };
}

function pluginKey(entry) {
  const source = entry.source ?? entry.name ?? "";
  return source.split("/").filter(Boolean).pop()?.toLowerCase() ?? "";
}

async function main() {
  const { source } = await getSourceById(SOURCE_ID);
  const SOURCE_REPO = source.repo;
  const MAX_PLUGINS = CLI_MAX ?? source.bulkCap ?? 10;
  const allowlist = source.allowlist?.length
    ? new Set(source.allowlist.map((n) => n.toLowerCase()))
    : null;

  console.log(`Cloning ${SOURCE_REPO}...`);
  const commitSha = await shallowClone(SOURCE_REPO);
  const marketplacePath = join(CLONE_DIR, ".cursor-plugin", "marketplace.json");
  const marketplace = JSON.parse(await readFile(marketplacePath, "utf8"));
  let plugins = marketplace.plugins ?? [];

  if (allowlist) {
    plugins = plugins.filter((entry) => allowlist.has(pluginKey(entry)));
    console.log(`Allowlist: ${[...allowlist].join(", ")} (${plugins.length} matched)`);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  let count = 0;
  for (const entry of plugins.slice(0, MAX_PLUGINS)) {
    const sourcePath = entry.source ?? entry.name;
    const pluginRoot = join(CLONE_DIR, sourcePath);
    try {
      await stat(pluginRoot);
    } catch {
      console.warn(`Skipping missing plugin path: ${sourcePath}`);
      continue;
    }

    const template = await importPlugin(pluginRoot, entry, commitSha, SOURCE_REPO);
    if (!template) {
      console.warn(`Skipping ${sourcePath}: no plugin.json or files`);
      continue;
    }

    const outPath = join(OUTPUT_DIR, `${template.id}.json`);
    const { _importMeta, ...publicTemplate } = template;
    await writeFile(outPath, JSON.stringify(publicTemplate, null, 2) + "\n");
    console.log(`Wrote ${outPath} (${template.pluginBundle.files.length} files)`);
    count += 1;
  }

  const metaPath = join(OUTPUT_DIR, "..", "plugin-import-meta.json");
  await writeFile(
    metaPath,
    JSON.stringify(
      {
        id: SOURCE_ID,
        repo: SOURCE_REPO,
        commitSha,
        importedAt: new Date().toISOString(),
        pluginCount: count,
      },
      null,
      2,
    ) + "\n",
  );

  console.log(`Imported ${count} plugins (commit ${commitSha.slice(0, 8)})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
