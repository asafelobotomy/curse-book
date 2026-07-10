import type { SortOption } from "../../lib/catalog";
import { TagChip } from "./TagChip";

interface CatalogFilterBarProps {
  tags: string[];
  activeTags: Set<string>;
  artifactFilter: "all" | "rule" | "skill";
  sort: SortOption;
  onTagClick: (tag: string) => void;
  onArtifactFilterChange: (value: "all" | "rule" | "skill") => void;
  onSortChange: (value: SortOption) => void;
  onClearTags: () => void;
}

const ARTIFACT_OPTIONS: { value: "all" | "rule" | "skill"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "rule", label: "Rules" },
  { value: "skill", label: "Skills" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "name-asc", label: "Name A–Z" },
  { value: "category", label: "Category" },
  { value: "params-desc", label: "Most parameters" },
  { value: "tokens-asc", label: "Lowest tokens" },
];

export function CatalogFilterBar({
  tags,
  activeTags,
  artifactFilter,
  sort,
  onTagClick,
  onArtifactFilterChange,
  onSortChange,
  onClearTags,
}: CatalogFilterBarProps) {
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

        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="ml-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-1.5 text-xs"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {tags.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              Tags:
            </span>
            {activeTags.size > 0 && (
              <button
                type="button"
                onClick={onClearTags}
                className="text-xs text-[var(--color-accent-hover)] hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <TagChip
                key={tag}
                tag={tag}
                active={activeTags.has(tag)}
                onClick={onTagClick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
