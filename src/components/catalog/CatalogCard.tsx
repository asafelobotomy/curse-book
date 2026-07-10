import { artifactBadge } from "../../lib/utils";
import type { TemplateDefinition } from "../../lib/types";
import { getGlobPattern } from "../../lib/catalog";
import { TagChip } from "./TagChip";
import { Badge, Button, Card } from "../ui";

interface CatalogCardProps {
  template: TemplateDefinition;
  activeTags: Set<string>;
  tokenEstimate?: number;
  onSelect: (template: TemplateDefinition) => void;
  onTagClick: (tag: string) => void;
  onAddToLibrary: (template: TemplateDefinition) => void;
}

function artifactBadgeClass(type: string): string {
  switch (type) {
    case "rule":
      return "bg-[var(--color-accent)]/20 text-[var(--color-accent-hover)]";
    case "skill":
      return "bg-teal-500/20 text-teal-300";
    default:
      return "";
  }
}

export function CatalogCard({
  template,
  activeTags,
  tokenEstimate,
  onSelect,
  onTagClick,
  onAddToLibrary,
}: CatalogCardProps) {
  const globs = getGlobPattern(template);

  return (
    <Card
      className="catalog-card flex flex-col cursor-pointer hover:border-[var(--color-accent)]/50 transition-colors"
      onClick={() => onSelect(template)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold leading-snug">{template.name}</h3>
        <Badge className={artifactBadgeClass(template.artifactType)}>
          {artifactBadge(template.artifactType)}
        </Badge>
      </div>

      <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 mb-3">
        {template.description}
      </p>

      <div className="text-xs text-[var(--color-text-muted)] mb-3 flex flex-wrap gap-x-2 gap-y-1">
        <span className="px-1.5 py-0.5 rounded bg-[var(--color-surface-overlay)]">
          {template.category}
        </span>
        {globs && (
          <span className="truncate max-w-[140px]" title={globs}>
            {globs}
          </span>
        )}
        <span>{template.parameters.length} params</span>
      </div>

      <div className="flex flex-wrap gap-1 mb-3" onClick={(e) => e.stopPropagation()}>
        {template.tags.map((tag) => (
          <TagChip
            key={tag}
            tag={tag}
            active={activeTags.has(tag)}
            sourceUrl={template.sourceUrl}
            onClick={onTagClick}
          />
        ))}
      </div>

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-[var(--color-border)]">
        <span className="text-xs text-[var(--color-text-muted)]">
          {tokenEstimate !== undefined ? `~${tokenEstimate} tokens` : "\u00a0"}
        </span>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onSelect(template)}
          >
            Details
          </Button>
          <Button size="sm" onClick={() => onAddToLibrary(template)}>
            Add +
          </Button>
        </div>
      </div>
    </Card>
  );
}
