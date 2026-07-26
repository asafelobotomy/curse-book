import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = join(__dirname, "..", "catalog", "sources.json");

export async function loadSourcesRegistry() {
  const raw = await readFile(REGISTRY_PATH, "utf8");
  return JSON.parse(raw);
}

export async function getSourceById(id) {
  const registry = await loadSourcesRegistry();
  const source = registry.sources.find((s) => s.id === id);
  if (!source) {
    throw new Error(`Source not found in registry: ${id}`);
  }
  return { registry, source };
}

export async function listShippedSources() {
  const registry = await loadSourcesRegistry();
  return registry.sources.filter((s) => s.shipped);
}
