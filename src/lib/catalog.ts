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

export { isSourceTag } from "./tags";

export function getGlobPattern(template: TemplateDefinition): string | undefined {
  return template.ruleFrontmatter?.globs;
}

export function getActivationLabel(template: TemplateDefinition): string {
  if (template.ruleFrontmatter?.alwaysApply) return "Always apply";
  if (template.ruleFrontmatter?.globs) {
    return `Globs: ${template.ruleFrontmatter.globs}`;
  }
  switch (template.artifactType) {
    case "skill":
      return "On demand (skill)";
    case "subagent":
      return "On demand (subagent)";
    case "hook":
      return "Event-driven (hook)";
    case "mcp":
      return "MCP server config";
    case "plugin":
      return "Plugin install";
    case "rule":
      return "Intelligent";
    default: {
      const _exhaustive: never = template.artifactType as never;
      return _exhaustive;
    }
  }
}

export function getPluginComponentSummary(template: TemplateDefinition): string | undefined {
  if (template.artifactType !== "plugin") return undefined;
  if (template.pluginManifest?.childTemplateIds?.length) {
    const count = template.pluginManifest.childTemplateIds.length;
    return `${count} component${count === 1 ? "" : "s"}`;
  }
  if (template.pluginBundle?.files?.length) {
    const count = template.pluginBundle.files.length;
    return `${count} file${count === 1 ? "" : "s"}`;
  }
  return undefined;
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
