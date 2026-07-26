#!/usr/bin/env node
/**
 * Ingest templates from awesome-cursorrules GitHub repo.
 * Reads caps and excludeIds from catalog/sources.json.
 *
 * Usage: node scripts/import-awesome-cursorrules.mjs [output-dir]
 */
import { mkdir, writeFile, readdir, readFile, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getSourceById } from "./load-sources-registry.mjs";

const execFileAsync = promisify(execFile);
const OUTPUT_DIR = process.argv[2] ?? "catalog/imported";
const CLONE_DIR = "/tmp/awesome-cursorrules-import";
const SOURCE_ID = "awesome-cursorrules";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_CATALOG = join(__dirname, "..", "catalog");

const CATEGORY_MAP = {
  react: "Frontend",
  vue: "Frontend",
  next: "Frontend",
  angular: "Frontend",
  svelte: "Frontend",
  tailwind: "Frontend",
  android: "Mobile",
  ios: "Mobile",
  python: "Backend",
  django: "Backend",
  fastapi: "Backend",
  flask: "Backend",
  go: "Languages",
  rust: "Languages",
  typescript: "Languages",
  javascript: "Languages",
  java: "Backend",
  kotlin: "Backend",
  test: "Quality",
  git: "Workflow",
  docker: "DevOps",
  ai: "AI",
};

const TAG_KEYWORDS = [
  "react", "vue", "next", "angular", "svelte", "tailwind",
  "typescript", "javascript", "python", "django", "fastapi", "flask",
  "go", "rust", "java", "kotlin", "docker", "git", "test", "ai",
  "node", "express", "graphql", "postgres", "mongodb",
];

const TECH_TERMS = [
  "TypeScript", "JavaScript", "React", "Vue", "Next.js", "Angular",
  "Python", "Rust", "Go", "Docker", "GraphQL", "PostgreSQL", "MongoDB",
  "Zod", "Tailwind", "FastAPI", "Django", "Clean Architecture", "SOLID", "TDD",
];

function inferCategory(name) {
  const lower = name.toLowerCase();
  for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return cat;
  }
  return "General";
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function extractTags(name, body) {
  const lower = name.toLowerCase();
  const tags = new Set(["imported", "awesome-cursorrules"]);
  for (const kw of TAG_KEYWORDS) {
    if (lower.includes(kw)) tags.add(kw);
  }
  const parts = lower.split(/[-_]+/).filter((p) => p.length > 2 && p !== "acr");
  for (const part of parts.slice(0, 4)) {
    tags.add(part);
  }
  return Array.from(tags).slice(0, 8);
}

function extractHighlights(body) {
  const found = new Set();
  for (const term of TECH_TERMS) {
    if (body.includes(term)) found.add(term);
    if (found.size >= 6) break;
  }
  if (found.size < 3) {
    const caps = body.match(/\b[A-Z][a-z]+(?:\.[A-Z][a-z]+)?\b/g) ?? [];
    for (const word of caps) {
      if (word.length > 3 && !["The", "This", "When", "Always", "Never"].includes(word)) {
        found.add(word);
      }
      if (found.size >= 6) break;
    }
  }
  return Array.from(found).slice(0, 6);
}

function parseMdc(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  const yaml = match[1];
  const body = match[2].trim();
  const description =
    yaml.match(/description:\s*"?([^"\n]+)"?/)?.[1] ?? "Imported rule";
  const globs = yaml.match(/globs:\s*(.+)/)?.[1]?.trim();
  const alwaysApply = /alwaysApply:\s*true/.test(yaml);
  return { frontmatter: { description, globs, alwaysApply }, body };
}

function normalize(id, name, content, globs, description, sourcePath, updatedAt, sourceRepo) {
  const SOURCE_BASE = `https://github.com/${sourceRepo}/blob/main`;
  const tags = extractTags(name, content);
  const highlights = extractHighlights(content);
  const template = {
    id,
    name,
    description: description ?? `Imported from awesome-cursorrules: ${name}`,
    category: inferCategory(name),
    artifactType: "rule",
    tags,
    parameters: [],
    ruleFrontmatter: {
      description: description ?? `Conventions for ${name}`,
      globs: globs ?? "**/*",
      alwaysApply: false,
    },
    skillFrontmatter: null,
    bodyTemplate: content.trim(),
    source: SOURCE_ID,
    sourceUrl: `${SOURCE_BASE}/${sourcePath}`,
    sourceRepo,
    sourcePath,
    highlights,
  };
  if (updatedAt) template.updatedAt = updatedAt;
  return template;
}

async function getSourceUpdatedAt(repoDir, sourcePath) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["log", "-1", "--format=%aI", "--", sourcePath],
      { cwd: repoDir },
    );
    const iso = stdout.trim();
    if (!iso) return undefined;
    return iso.slice(0, 10);
  } catch {
    return undefined;
  }
}

async function loadRootCatalogIds() {
  const ids = new Set();
  try {
    const files = await readdir(ROOT_CATALOG);
    for (const f of files) {
      if (f.endsWith(".json") && f !== "sources.json") {
        ids.add(f.replace(/\.json$/, ""));
      }
    }
  } catch {
    /* ignore */
  }
  return ids;
}

function isExcluded(id, baseName, excludeIds, rootIds, pruneIds) {
  if (excludeIds.has(id) || pruneIds.has(id)) return true;
  const slug = slugify(baseName);
  const acrSlug = id.startsWith("acr-") ? id.slice(4) : slug;
  for (const rootId of rootIds) {
    if (acrSlug === rootId || slug === rootId || id === `acr-${rootId}`) {
      return true;
    }
    const rootPrefix = rootId.split("-")[0];
    if (acrSlug === rootPrefix && rootId.includes("-")) {
      return true;
    }
  }
  for (const ex of excludeIds) {
    if (id === `acr-${ex}` || acrSlug === ex || slug === ex) return true;
  }
  return false;
}

async function cloneRepo(sourceRepo) {
  try {
    await execFileAsync("git", [
      "clone",
      "--filter=blob:none",
      `https://github.com/${sourceRepo}.git`,
      CLONE_DIR,
    ]);
  } catch {
    console.log("Using existing clone at", CLONE_DIR);
  }
  const { stdout } = await execFileAsync("git", ["-C", CLONE_DIR, "rev-parse", "HEAD"]);
  return stdout.trim();
}

async function pruneOverlappingImports(outputDir, pruneIds) {
  for (const id of pruneIds) {
    const path = join(outputDir, `${id}.json`);
    try {
      await unlink(path);
      console.log(`Pruned overlap: ${id}`);
    } catch {
      /* already absent */
    }
  }
}

async function main() {
  const { source } = await getSourceById(SOURCE_ID);
  const MAX_TEMPLATES = source.bulkCap ?? 50;
  const excludeIds = new Set(source.excludeIds ?? []);
  const pruneIds = new Set(source.pruneImportedIds ?? []);
  const rootIds = await loadRootCatalogIds();
  for (const id of rootIds) excludeIds.add(id);
  for (const id of pruneIds) excludeIds.add(id);

  await pruneOverlappingImports(OUTPUT_DIR, pruneIds);

  const commitSha = await cloneRepo(source.repo);
  await mkdir(OUTPUT_DIR, { recursive: true });

  const rulesDir = join(CLONE_DIR, "rules");
  const entries = await readdir(rulesDir, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    if (count >= MAX_TEMPLATES) break;

    if (entry.isDirectory()) {
      const dirPath = join(rulesDir, entry.name);
      const files = await readdir(dirPath);
      const cursorrules = files.find((f) => f === ".cursorrules");
      if (!cursorrules) continue;

      const content = await readFile(join(dirPath, cursorrules), "utf-8");
      const name = entry.name
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      const id = `acr-${slugify(entry.name)}`;
      if (isExcluded(id, entry.name, excludeIds, rootIds, pruneIds)) {
        console.log(`Skip (excluded): ${id}`);
        continue;
      }
      const sourcePath = `rules/${entry.name}/.cursorrules`;
      const updatedAt = await getSourceUpdatedAt(CLONE_DIR, sourcePath);
      const template = normalize(
        id, name, content, "**/*", undefined, sourcePath, updatedAt, source.repo,
      );
      await writeFile(join(OUTPUT_DIR, `${id}.json`), JSON.stringify(template, null, 2) + "\n");
      console.log(`Imported (legacy): ${id}`);
      count++;
      continue;
    }

    if (entry.name.endsWith(".mdc")) {
      const raw = await readFile(join(rulesDir, entry.name), "utf-8");
      const { frontmatter, body } = parseMdc(raw);
      const baseName = entry.name.replace(/-cursorrules.*\.mdc$/, "").replace(/\.mdc$/, "");
      const name = baseName
        .split("-")
        .slice(0, 4)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      const id = `acr-${slugify(baseName)}`;
      if (isExcluded(id, baseName, excludeIds, rootIds, pruneIds)) {
        console.log(`Skip (excluded): ${id}`);
        continue;
      }
      const sourcePath = `rules/${entry.name}`;
      const updatedAt = await getSourceUpdatedAt(CLONE_DIR, sourcePath);
      const template = normalize(
        id,
        name || baseName,
        body,
        frontmatter.globs,
        frontmatter.description,
        sourcePath,
        updatedAt,
        source.repo,
      );
      await writeFile(join(OUTPUT_DIR, `${id}.json`), JSON.stringify(template, null, 2) + "\n");
      console.log(`Imported (mdc): ${id} (${name})`);
      count++;
    }
  }

  const metaPath = join(OUTPUT_DIR, "acr-import-meta.json");
  await writeFile(
    metaPath,
    JSON.stringify(
      {
        id: SOURCE_ID,
        repo: source.repo,
        commitSha,
        importedAt: new Date().toISOString(),
        templateCount: count,
      },
      null,
      2,
    ) + "\n",
  );

  console.log(`\nDone. Imported ${count} templates to ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
