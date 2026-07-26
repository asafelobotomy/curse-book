import { artifactBadge, artifactBadgeClass } from "../../lib/utils";
import type { TemplateDefinition } from "../../lib/types";
import { getGlobPattern, getPluginComponentSummary } from "../../lib/catalog";
import { useRegistrySourceIds } from "../../lib/CatalogRegistrySourceContext";
import { displayTemplateTags } from "../../lib/tags";
import { TagChip } from "./TagChip";
import { Badge, Button, Card } from "../ui";

const VISIBLE_TAGS = 4;

interface CatalogCardProps {
  template: TemplateDefinition;
  activeTags: Set<string>;
  selected?: boolean;
  tokenEstimate?: number;
  onSelect: (template: TemplateDefinition) => void;
  onTagClick: (tag: string) => void;
  onAddToLibrary: (template: TemplateDefinition) => void;
}

export function CatalogCard({
  template,
  activeTags,
  selected = false,
  tokenEstimate,
  onSelect,
  onTagClick,
  onAddToLibrary,
}: CatalogCardProps) {
  const registrySourceIds = useRegistrySourceIds();
  const globs = getGlobPattern(template);
  const pluginSummary = getPluginComponentSummary(template);
  const displayTags = displayTemplateTags(template.tags, registrySourceIds);
  const visibleTags = displayTags.slice(0, VISIBLE_TAGS);
  const overflowCount = displayTags.length - VISIBLE_TAGS;

  return (
    <Card
      className={`catalog-card flex flex-col min-h-[220px] p-5 gap-3 transition-colors ${
        selected
          ? "border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/40"
          : "hover:border-[var(--color-accent)]/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge className={artifactBadgeClass(template.artifactType)}>
          {artifactBadge(template.artifactType)}
        </Badge>
        <span className="text-xs text-[var(--color-text-muted)]">
          {template.category}
        </span>
      </div>

      <h3 className="font-semibold text-base leading-snug">{template.name}</h3>

      <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 flex-1">
        {template.description}
      </p>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {globs && (
          <span
            className="font-mono px-2 py-0.5 rounded bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)] break-all"
            title={globs}
          >
            {globs}
          </span>
        )}
        <span className="px-2 py-0.5 rounded bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)]">
          {template.parameters.length} params
        </span>
        {pluginSummary && (
          <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300">
            {pluginSummary}
          </span>
        )}
        {tokenEstimate !== undefined && (
          <span className="px-2 py-0.5 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent-hover)]">
            ~{tokenEstimate} tokens
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
        {visibleTags.map((tag) => (
          <TagChip
            key={tag}
            tag={tag}
            active={activeTags.has(tag)}
            sourceUrl={template.sourceUrl}
            onClick={onTagClick}
          />
        ))}
        {overflowCount > 0 && (
          <span
            className="text-xs px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)]"
            title={displayTags.slice(VISIBLE_TAGS).join(", ")}
          >
            +{overflowCount}
          </span>
        )}
      </div>

      <div
        className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <Button size="sm" variant="ghost" onClick={() => onSelect(template)}>
          Details
        </Button>
        <Button
          size="sm"
          onClick={() => onAddToLibrary(template)}
          title="Quick add with default parameters — use Details to customize first"
        >
          Add +
        </Button>
      </div>
    </Card>
  );
}
