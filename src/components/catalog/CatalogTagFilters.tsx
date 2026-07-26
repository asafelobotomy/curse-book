import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { OrganizedTags } from "../../lib/tags";
import { TagChip } from "./TagChip";

interface CatalogTagFiltersProps {
  organized: OrganizedTags;
  activeTags: Set<string>;
  onTagClick: (tag: string) => void;
  onClearTags: () => void;
}

export function CatalogTagFilters({
  organized,
  activeTags,
  onTagClick,
  onClearTags,
}: CatalogTagFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  const hasPrimary = organized.groups.some((g) => g.tags.length > 0);
  const hasSecondary = organized.secondary.length > 0;
  const hasAny = hasPrimary || hasSecondary || activeTags.size > 0;

  if (!hasAny) return null;

  return (
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
            Clear filters ({activeTags.size})
          </button>
        )}
      </div>

      <div className="space-y-2">
        {organized.groups.map((group) => (
          <div key={group.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] shrink-0 w-full sm:w-auto sm:min-w-[8.5rem]">
              {group.label}
            </span>
            <div className="flex flex-wrap gap-1">
              {group.tags.map(({ tag, count }) => (
                <TagChip
                  key={tag}
                  tag={tag}
                  count={count}
                  active={activeTags.has(tag)}
                  onClick={onTagClick}
                />
              ))}
            </div>
          </div>
        ))}

        {hasSecondary && (
          <div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-1"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded
                ? "Hide rare tags"
                : `Show ${organized.secondary.length} more tag${organized.secondary.length === 1 ? "" : "s"}`}
            </button>
            {expanded && (
              <div className="flex flex-wrap gap-1 pl-0 sm:pl-[8.5rem]">
                {organized.secondary.map(({ tag, count }) => (
                  <TagChip
                    key={tag}
                    tag={tag}
                    count={count}
                    active={activeTags.has(tag)}
                    onClick={onTagClick}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
