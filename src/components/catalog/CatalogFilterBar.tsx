import { LayoutGrid, List } from "lucide-react";
import type { SortOption } from "../../lib/catalog";
import type { CatalogArtifactFilter, CatalogSourceFilter } from "../../lib/types";
import type { OrganizedTags } from "../../lib/tags";
import { CatalogTagFilters } from "./CatalogTagFilters";

export type CatalogLayout = "card" | "list";

interface CatalogFilterBarProps {
  organizedTags: OrganizedTags;
  activeTags: Set<string>;
  artifactFilter: CatalogArtifactFilter;
  sourceFilter: CatalogSourceFilter;
  sourceOptions: { value: CatalogSourceFilter; label: string }[];
  sort: SortOption;
  layout: CatalogLayout;
  onTagClick: (tag: string) => void;
  onArtifactFilterChange: (value: CatalogArtifactFilter) => void;
  onSourceFilterChange: (value: CatalogSourceFilter) => void;
  onSortChange: (value: SortOption) => void;
  onLayoutChange: (layout: CatalogLayout) => void;
  onClearTags: () => void;
}

const ARTIFACT_OPTIONS: { value: CatalogArtifactFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "rule", label: "Rules" },
  { value: "skill", label: "Skills" },
  { value: "subagent", label: "Subagents" },
  { value: "hook", label: "Hooks" },
  { value: "mcp", label: "MCP" },
  { value: "plugin", label: "Plugins" },
];

const SOURCE_OPTIONS_DEFAULT: { value: CatalogSourceFilter; label: string }[] = [
  { value: "all", label: "All sources" },
  { value: "curse-book", label: "Curse Book" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "name-asc", label: "Name A–Z" },
  { value: "category", label: "Category" },
  { value: "params-desc", label: "Most parameters" },
  { value: "tokens-asc", label: "Lowest tokens" },
];

export function CatalogFilterBar({
  organizedTags,
  activeTags,
  artifactFilter,
  sourceFilter,
  sourceOptions,
  sort,
  layout,
  onTagClick,
  onArtifactFilterChange,
  onSourceFilterChange,
  onSortChange,
  onLayoutChange,
  onClearTags,
}: CatalogFilterBarProps) {
  const options =
    sourceOptions.length > 0 ? sourceOptions : SOURCE_OPTIONS_DEFAULT;
  return (
    <div className="space-y-3 mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[var(--color-text-muted)] mr-1">
          Type:
        </span>
        {ARTIFACT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onArtifactFilterChange(opt.value)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              artifactFilter === opt.value
                ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[var(--color-text-muted)] mr-1">
          Source:
        </span>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSourceFilterChange(opt.value)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              sourceFilter === opt.value
                ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]"
            }`}
          >
            {opt.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
            <button
              type="button"
              title="Card view"
              onClick={() => onLayoutChange("card")}
              className={`p-2 transition-colors ${
                layout === "card"
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              title="List view"
              onClick={() => onLayoutChange("list")}
              className={`p-2 transition-colors border-l border-[var(--color-border)] ${
                layout === "list"
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              <List size={16} />
            </button>
          </div>

          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-1.5 text-xs"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(organizedTags.groups.length > 0 ||
        organizedTags.secondary.length > 0 ||
        activeTags.size > 0) && (
        <CatalogTagFilters
          organized={organizedTags}
          activeTags={activeTags}
          onTagClick={onTagClick}
          onClearTags={onClearTags}
        />
      )}
    </div>
  );
}
