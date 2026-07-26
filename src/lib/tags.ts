import type { TemplateDefinition } from "./types";

const STATIC_FILTER_BAR_HIDDEN = new Set([
  "curse-book",
  "imported",
  "subagent",
  "hooks",
  "mcp",
  "plugin",
]);

const FALLBACK_REGISTRY_SOURCE_IDS = ["awesome-cursorrules", "cursor/plugins"];

export function registrySourceIds(sourceIds?: string[]): string[] {
  return sourceIds?.length ? sourceIds : FALLBACK_REGISTRY_SOURCE_IDS;
}

function hiddenFilterBarTags(sourceIds?: string[]): Set<string> {
  return new Set([...STATIC_FILTER_BAR_HIDDEN, ...registrySourceIds(sourceIds)]);
}

export function isSourceTag(tag: string, sourceIds?: string[]): boolean {
  if (tag === "curse-book") return true;
  return registrySourceIds(sourceIds).includes(tag);
}

export interface TagInfo {
  tag: string;
  count: number;
}

export interface TagGroup {
  id: TagGroupId;
  label: string;
  tags: TagInfo[];
}

export type TagGroupId = "languages" | "stack" | "workflow" | "topics";

export interface OrganizedTags {
  groups: TagGroup[];
  secondary: TagInfo[];
  hiddenCount: number;
}

const LANGUAGE_TAGS = new Set([
  "typescript",
  "javascript",
  "python",
  "rust",
  "go",
  "golang",
  "java",
  "kotlin",
  "vue",
  "react",
  "angular",
  "svelte",
  "nextjs",
  "django",
  "fastapi",
  "tailwind",
  "css",
]);

const STACK_TAGS = new Set([
  "frontend",
  "backend",
  "monorepo",
  "api",
  "rest",
  "database",
  "postgres",
  "systems",
  "architecture",
  "devops",
  "github",
  "ai",
]);

const WORKFLOW_TAGS = new Set([
  "workflow",
  "git",
  "testing",
  "documentation",
  "docs",
  "review",
  "pr",
  "quality",
  "security",
  "debug",
  "formatting",
  "search",
  "team",
  "commits",
  "standards",
  "a11y",
  "accessibility",
]);

const GROUP_LABELS: Record<TagGroupId, string> = {
  languages: "Languages & frameworks",
  stack: "Stack & platform",
  workflow: "Workflow & quality",
  topics: "Topics",
};

const PRIMARY_MIN_COUNT = 2;

export function isFilterBarTag(tag: string, sourceIds?: string[]): boolean {
  return !hiddenFilterBarTags(sourceIds).has(tag) && !isSourceTag(tag, sourceIds);
}

/** Tags worth showing on template cards (drops source/meta noise). */
export function displayTemplateTags(
  tags: string[],
  sourceIds?: string[],
): string[] {
  return tags.filter((tag) => isFilterBarTag(tag, sourceIds));
}

function tagGroupId(tag: string): TagGroupId {
  if (LANGUAGE_TAGS.has(tag)) return "languages";
  if (STACK_TAGS.has(tag)) return "stack";
  if (WORKFLOW_TAGS.has(tag)) return "workflow";
  return "topics";
}

function countTags(templates: TemplateDefinition[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const template of templates) {
    for (const tag of template.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}

function sortTagInfos(tags: TagInfo[]): TagInfo[] {
  return [...tags].sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag),
  );
}

export function organizeCatalogTags(
  templates: TemplateDefinition[],
  activeTags: Set<string>,
  sourceIds?: string[],
): OrganizedTags {
  const counts = countTags(templates);
  const primary: TagInfo[] = [];
  const secondary: TagInfo[] = [];
  let hiddenCount = 0;

  for (const [tag, count] of counts) {
    if (!isFilterBarTag(tag, sourceIds)) {
      hiddenCount += 1;
      continue;
    }
    const info = { tag, count };
    if (count >= PRIMARY_MIN_COUNT || activeTags.has(tag)) {
      primary.push(info);
    } else {
      secondary.push(info);
    }
  }

  for (const tag of activeTags) {
    if (!primary.some((p) => p.tag === tag)) {
      const fromSecondary = secondary.find((s) => s.tag === tag);
      if (fromSecondary) {
        primary.push(fromSecondary);
        secondary.splice(secondary.indexOf(fromSecondary), 1);
      }
    }
  }

  const grouped = new Map<TagGroupId, TagInfo[]>();
  for (const info of sortTagInfos(primary)) {
    const groupId = tagGroupId(info.tag);
    const list = grouped.get(groupId) ?? [];
    list.push(info);
    grouped.set(groupId, list);
  }

  const groupOrder: TagGroupId[] = [
    "languages",
    "stack",
    "workflow",
    "topics",
  ];

  const groups: TagGroup[] = groupOrder
    .map((id) => ({
      id,
      label: GROUP_LABELS[id],
      tags: grouped.get(id) ?? [],
    }))
    .filter((g) => g.tags.length > 0);

  return {
    groups,
    secondary: sortTagInfos(secondary),
    hiddenCount,
  };
}

export function getTagStyleGroup(
  tag: string,
  sourceIds?: string[],
): "source" | "language" | "workflow" | "default" {
  if (isSourceTag(tag, sourceIds)) return "source";
  if (LANGUAGE_TAGS.has(tag)) return "language";
  if (WORKFLOW_TAGS.has(tag) || STACK_TAGS.has(tag)) return "workflow";
  return "default";
}
