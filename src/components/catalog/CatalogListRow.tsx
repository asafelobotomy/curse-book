import { artifactBadge, artifactBadgeClass } from "../../lib/utils";
import type { TemplateDefinition } from "../../lib/types";
import { getGlobPattern } from "../../lib/catalog";
import { useRegistrySourceIds } from "../../lib/CatalogRegistrySourceContext";
import { displayTemplateTags } from "../../lib/tags";
import { Badge, Button } from "../ui";

interface CatalogListRowProps {
  template: TemplateDefinition;
  selected?: boolean;
  tokenEstimate?: number;
  onSelect: (template: TemplateDefinition) => void;
  onAddToLibrary: (template: TemplateDefinition) => void;
}

export function CatalogListRow({
  template,
  selected = false,
  tokenEstimate,
  onSelect,
  onAddToLibrary,
}: CatalogListRowProps) {
  const registrySourceIds = useRegistrySourceIds();
  const globs = getGlobPattern(template);
  const displayTags = displayTemplateTags(template.tags, registrySourceIds);
  const tagSummary =
    displayTags.length > 3
      ? `${displayTags.slice(0, 3).join(", ")} +${displayTags.length - 3}`
      : displayTags.join(", ");

  return (
    <div
      className={`catalog-list-row grid grid-cols-[1fr_auto] lg:grid-cols-[minmax(160px,1.2fr)_100px_72px_minmax(100px,0.8fr)_64px_72px_minmax(120px,1fr)_auto] gap-3 items-center px-4 py-3 rounded-lg border transition-colors ${
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
          : "border-[var(--color-border)] bg-[var(--color-surface-raised)]"
      }`}
    >
      <div className="min-w-0">
        <p className="font-medium truncate">{template.name}</p>
        <p className="text-xs text-[var(--color-text-muted)] truncate lg:hidden">
          {template.category}
        </p>
      </div>

      <span className="hidden lg:block text-xs text-[var(--color-text-muted)] truncate">
        {template.category}
      </span>

      <Badge className={`hidden lg:inline-flex ${artifactBadgeClass(template.artifactType)}`}>
        {artifactBadge(template.artifactType)}
      </Badge>

      <span
        className="hidden lg:block text-xs font-mono text-[var(--color-text-muted)] truncate"
        title={globs}
      >
        {globs ?? "—"}
      </span>

      <span className="hidden lg:block text-xs text-[var(--color-text-muted)]">
        {template.parameters.length} params
      </span>

      <span className="hidden lg:block text-xs text-[var(--color-text-muted)]">
        {tokenEstimate !== undefined ? `~${tokenEstimate}` : "—"}
      </span>

      <span
        className="hidden lg:block text-xs text-[var(--color-text-muted)] truncate"
        title={displayTags.join(", ")}
      >
        {tagSummary || "—"}
      </span>

      <div
        className="flex gap-2 justify-end"
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
    </div>
  );
}
