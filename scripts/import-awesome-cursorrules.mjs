#!/usr/bin/env node
/**
 * Ingest templates from awesome-cursorrules GitHub repo.
 * Supports legacy subfolder .cursorrules files and modern rules/*.mdc layouts.
 *
 * Usage: node scripts/import-awesome-cursorrules.mjs [output-dir]
 */
import { mkdir, writeFile, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const OUTPUT_DIR = process.argv[2] ?? "catalog/imported";
const CLONE_DIR = "/tmp/awesome-cursorrules-import";
const MAX_TEMPLATES = 20;

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

function normalize(id, name, content, globs, description) {
  return {
    id,
    name,
    description: description ?? `Imported from awesome-cursorrules: ${name}`,
    category: inferCategory(name),
    artifactType: "rule",
    tags: ["imported", "awesome-cursorrules"],
    parameters: [],
    ruleFrontmatter: {
      description: description ?? `Conventions for ${name}`,
      globs: globs ?? "**/*",
      alwaysApply: false,
    },
    skillFrontmatter: null,
    bodyTemplate: content.trim(),
    source: "awesome-cursorrules",
  };
}

async function cloneRepo() {
  try {
    await execFileAsync("git", [
      "clone",
      "--depth",
      "1",
      "https://github.com/PatrickJS/awesome-cursorrules.git",
      CLONE_DIR,
    ]);
  } catch {
    console.log("Using existing clone at", CLONE_DIR);
  }
}

async function main() {
  await cloneRepo();
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
      const template = normalize(id, name, content, "**/*");
      await writeFile(
        join(OUTPUT_DIR, `${id}.json`),
        JSON.stringify(template, null, 2),
      );
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
      const template = normalize(
        id,
        name || baseName,
        body,
        frontmatter.globs,
        frontmatter.description,
      );
      await writeFile(
        join(OUTPUT_DIR, `${id}.json`),
        JSON.stringify(template, null, 2),
      );
      console.log(`Imported (mdc): ${id} (${name})`);
      count++;
    }
  }

  console.log(`\nDone. Imported ${count} templates to ${OUTPUT_DIR}`);
}

main().catch(console.error);
