import { ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { cn } from "../../lib/utils";
import { isSourceTag } from "../../lib/catalog";

interface TagChipProps {
  tag: string;
  active?: boolean;
  sourceUrl?: string;
  onClick?: (tag: string) => void;
  onSourceClick?: (url: string) => void;
}

const LANGUAGE_TAGS = new Set([
  "typescript",
  "javascript",
  "python",
  "rust",
  "go",
  "java",
  "kotlin",
  "vue",
  "react",
  "angular",
  "svelte",
]);

const WORKFLOW_TAGS = new Set([
  "git",
  "workflow",
  "testing",
  "documentation",
  "security",
]);

function tagColor(tag: string, active: boolean): string {
  if (active) {
    return "bg-[var(--color-accent)] text-white border-[var(--color-accent)]";
  }
  if (isSourceTag(tag)) {
    return "bg-transparent text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-accent)]";
  }
  if (LANGUAGE_TAGS.has(tag)) {
    return "bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25";
  }
  if (WORKFLOW_TAGS.has(tag)) {
    return "bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/25";
  }
  return "bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-accent)]";
}

export function TagChip({
  tag,
  active = false,
  sourceUrl,
  onClick,
  onSourceClick,
}: TagChipProps) {
  const showSourceLink = isSourceTag(tag) && sourceUrl;

  const openSource = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sourceUrl) return;
    if (onSourceClick) {
      onSourceClick(sourceUrl);
      return;
    }
    await openUrl(sourceUrl);
  };

  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(tag);
        }}
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs border transition-colors",
          tagColor(tag, active),
        )}
      >
        {tag}
      </button>
      {showSourceLink && (
        <button
          type="button"
          onClick={openSource}
          className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent-hover)]"
          title="Open source"
        >
          <ExternalLink size={12} />
        </button>
      )}
    </span>
  );
}
