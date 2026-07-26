import type { CatalogSourceEntry, CatalogSourceFilter } from "./types";

const SOURCE_LABELS: Record<string, string> = {
  "awesome-cursorrules": "awesome-cursorrules",
  "cursor/plugins": "cursor/plugins",
};

export function sourceFilterLabel(id: CatalogSourceFilter): string {
  if (id === "all") return "All sources";
  if (id === "curse-book") return "Curse Book";
  return SOURCE_LABELS[id] ?? id;
}

export function buildSourceFilterOptions(
  catalogSources: CatalogSourceEntry[],
): { value: CatalogSourceFilter; label: string }[] {
  const opts: { value: CatalogSourceFilter; label: string }[] = [
    { value: "all", label: sourceFilterLabel("all") },
    { value: "curse-book", label: sourceFilterLabel("curse-book") },
  ];
  for (const src of catalogSources) {
    if (src.shipped) {
      opts.push({ value: src.id, label: sourceFilterLabel(src.id) });
    }
  }
  return opts;
}

export function matchesCatalogSourceFilter(
  template: { source?: string | null; tags: string[] },
  sourceFilter: CatalogSourceFilter,
): boolean {
  if (sourceFilter === "all") return true;
  if (sourceFilter === "curse-book") {
    return template.tags.includes("curse-book") || template.source === "curse-book";
  }
  return template.source === sourceFilter;
}

export function resolveCatalogSourceEntry(
  template: { source?: string | null },
  catalogSources: CatalogSourceEntry[],
): CatalogSourceEntry | null {
  if (!template.source || template.source === "curse-book") {
    return null;
  }
  return catalogSources.find((s) => s.id === template.source) ?? null;
}
