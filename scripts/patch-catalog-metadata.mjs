#!/usr/bin/env node
/**
 * Add sourceUrl, highlights, and updatedAt to built-in catalog/*.json templates.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CATALOG_DIR = "catalog";
const REPO = "asafelobotomy/curse-book";
const BASE = `https://github.com/${REPO}/blob/main/catalog`;

const HIGHLIGHT_MAP = {
  "typescript-standards": ["TypeScript", "strict null checks", "interfaces"],
  "react-typescript": ["React", "TypeScript", "hooks"],
  "python-fastapi": ["Python", "FastAPI", "Pydantic"],
  "rust-standards": ["Rust", "error handling", "clippy"],
  "git-commit-helper": ["Git", "conventional commits"],
  "code-review": ["code review", "pull requests"],
  "nextjs-app-router": ["Next.js", "App Router", "React"],
  "django-rest": ["Django", "REST", "Python"],
  "go-standards": ["Go", "error handling", "idioms"],
  "vue-typescript": ["Vue", "TypeScript", "Composition API"],
  "testing-standards": ["testing", "TDD", "coverage"],
  "security-review": ["security", "OWASP", "vulnerabilities"],
  "api-design": ["REST", "API design", "OpenAPI"],
  "tailwind-css": ["Tailwind", "CSS", "utility-first"],
  "pr-workflow": ["pull requests", "GitHub", "workflow"],
  documentation: ["documentation", "README", "comments"],
  monorepo: ["monorepo", "workspaces", "Nx"],
  accessibility: ["accessibility", "a11y", "WCAG"],
};

async function main() {
  const files = (await readdir(CATALOG_DIR)).filter((f) => f.endsWith(".json"));
  const today = new Date().toISOString().slice(0, 10);

  for (const file of files) {
    const path = join(CATALOG_DIR, file);
    const template = JSON.parse(await readFile(path, "utf-8"));
    const id = template.id ?? file.replace(".json", "");

    template.source = template.source ?? "curse-book";
    template.sourceUrl = `${BASE}/${file}`;
    template.sourceRepo = REPO;
    template.sourcePath = file;
    template.highlights = template.highlights ?? HIGHLIGHT_MAP[id] ?? template.tags?.slice(0, 3) ?? [];
    template.updatedAt = template.updatedAt ?? today;

    if (!template.tags?.includes("curse-book")) {
      template.tags = [...(template.tags ?? []), "curse-book"];
    }

    await writeFile(path, JSON.stringify(template, null, 2) + "\n");
    console.log(`Patched ${file}`);
  }
}

main().catch(console.error);
