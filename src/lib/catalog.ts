import type { ParameterField, TemplateDefinition } from "./types";

export function buildDefaultParameters(
  parameters: ParameterField[],
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const field of parameters) {
    defaults[field.key] = field.default;
  }
  return defaults;
}

export function resolveSourceUrl(template: TemplateDefinition): string | undefined {
  return template.sourceUrl;
}

export function isSourceTag(tag: string): boolean {
  return tag === "awesome-cursorrules" || tag === "curse-book";
}

export function getGlobPattern(template: TemplateDefinition): string | undefined {
  return template.ruleFrontmatter?.globs;
}

export function getActivationLabel(template: TemplateDefinition): string {
  if (template.ruleFrontmatter?.alwaysApply) return "Always apply";
  if (template.ruleFrontmatter?.globs) {
    return `Globs: ${template.ruleFrontmatter.globs}`;
  }
  if (template.artifactType === "skill") return "On demand (skill)";
  return "Intelligent";
}

export type SortOption =
  | "name-asc"
  | "category"
  | "params-desc"
  | "tokens-asc";

export function sortTemplates(
  templates: TemplateDefinition[],
  sort: SortOption,
  tokenStats: Record<string, number>,
): TemplateDefinition[] {
  const sorted = [...templates];
  switch (sort) {
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "category":
      return sorted.sort(
        (a, b) =>
          a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
      );
    case "params-desc":
      return sorted.sort(
        (a, b) => b.parameters.length - a.parameters.length,
      );
    case "tokens-asc":
      return sorted.sort((a, b) => {
        const ta = tokenStats[a.id] ?? Number.MAX_SAFE_INTEGER;
        const tb = tokenStats[b.id] ?? Number.MAX_SAFE_INTEGER;
        return ta - tb || a.name.localeCompare(b.name);
      });
    default: {
      const _exhaustive: never = sort;
      return _exhaustive;
    }
  }
}

export function collectUniqueTags(templates: TemplateDefinition[]): string[] {
  const tags = new Set<string>();
  for (const t of templates) {
    for (const tag of t.tags) tags.add(tag);
  }
  return Array.from(tags).sort();
}
