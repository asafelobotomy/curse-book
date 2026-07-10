import { X, ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import {
  buildDefaultParameters,
  getActivationLabel,
  resolveSourceUrl,
} from "../../lib/catalog";
import type { TemplateDefinition } from "../../lib/types";
import { artifactBadge } from "../../lib/utils";
import { Badge, Button } from "../ui";
import { MonacoPreview } from "./MonacoPreview";
import { TagChip } from "./TagChip";

type DrawerTab = "overview" | "preview" | "parameters";
type PreviewMode = "compiled" | "raw";

interface CatalogDetailDrawerProps {
  template: TemplateDefinition | null;
  searchQuery: string;
  activeTags: Set<string>;
  onClose: () => void;
  onTagClick: (tag: string) => void;
  onAddToLibrary: (template: TemplateDefinition) => void;
}

export function CatalogDetailDrawer({
  template,
  searchQuery,
  activeTags,
  onClose,
  onTagClick,
  onAddToLibrary,
}: CatalogDetailDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>("overview");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("compiled");
  const [compiledContent, setCompiledContent] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);

  useEffect(() => {
    if (!template) return;
    setTab("overview");
    setPreviewMode("compiled");
    setCompiledContent("");
  }, [template?.id]);

  useEffect(() => {
    if (!template || tab !== "preview" || previewMode !== "compiled") return;
    if (compiledContent) return;

    setLoadingPreview(true);
    api
      .compilePreview(template, buildDefaultParameters(template.parameters))
      .then((result) => {
        const text = result.artifacts.map((a) => a.content).join("\n\n");
        setCompiledContent(text);
      })
      .catch(() => setCompiledContent("// Failed to compile preview"))
      .finally(() => setLoadingPreview(false));
  }, [template, tab, previewMode, compiledContent]);

  if (!template) return null;

  const sourceUrl = resolveSourceUrl(template);
  const searchTerms = [
    ...searchQuery.split(/\s+/).filter(Boolean),
    ...(template.highlights ?? []),
  ];

  const previewContent =
    previewMode === "raw" ? template.bodyTemplate : compiledContent;

  const tabs: { id: DrawerTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "preview", label: "Preview" },
    { id: "parameters", label: "Parameters" },
  ];

  return (
    <>
      <div
        className="catalog-drawer-backdrop fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      <aside className="catalog-drawer fixed top-0 right-0 h-full w-full max-w-2xl z-50 bg-[var(--color-surface-raised)] border-l border-[var(--color-border)] flex flex-col shadow-2xl">
        <header className="flex items-start justify-between gap-4 p-5 border-b border-[var(--color-border)]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold">{template.name}</h2>
              <Badge>{artifactBadge(template.artifactType)}</Badge>
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              {template.category}
              {template.updatedAt ? ` · Updated ${template.updatedAt}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-surface-overlay)]"
          >
            <X size={20} />
          </button>
        </header>

        <nav className="flex gap-1 px-5 pt-3 border-b border-[var(--color-border)]">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm rounded-t-lg border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-[var(--color-accent)] text-[var(--color-text)]"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "overview" && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed">{template.description}</p>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
                  Activation
                </h4>
                <p className="text-sm">{getActivationLabel(template)}</p>
              </div>

              {template.highlights && template.highlights.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
                    Highlights
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {template.highlights.map((h) => (
                      <span
                        key={h}
                        className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent-hover)]"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
                  Tags
                </h4>
                <div className="flex flex-wrap gap-1">
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
              </div>

              {sourceUrl && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openUrl(sourceUrl)}
                >
                  <ExternalLink size={14} className="mr-1.5" />
                  View source
                  {template.sourcePath ? ` (${template.sourcePath})` : ""}
                </Button>
              )}
            </div>
          )}

          {tab === "preview" && (
            <div className="h-full flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={previewMode === "compiled" ? "primary" : "ghost"}
                    onClick={() => setPreviewMode("compiled")}
                  >
                    Compiled
                  </Button>
                  <Button
                    size="sm"
                    variant={previewMode === "raw" ? "primary" : "ghost"}
                    onClick={() => setPreviewMode("raw")}
                  >
                    Raw template
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  <input
                    type="checkbox"
                    checked={wordWrap}
                    onChange={(e) => setWordWrap(e.target.checked)}
                  />
                  Word wrap
                </label>
              </div>

              {loadingPreview && previewMode === "compiled" ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Compiling preview...
                </p>
              ) : (
                <div className="flex-1 min-h-[400px]">
                  <MonacoPreview
                    content={previewContent}
                    searchTerms={searchTerms}
                    highlights={template.highlights ?? []}
                    highlightHandlebars={previewMode === "raw"}
                    wordWrap={wordWrap}
                  />
                </div>
              )}
            </div>
          )}

          {tab === "parameters" && (
            <div className="space-y-3">
              {template.parameters.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  No configurable parameters.
                </p>
              ) : (
                template.parameters.map((field) => (
                  <div
                    key={field.key}
                    className="rounded-lg border border-[var(--color-border)] p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{field.label}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {field.fieldType}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mb-1">
                      Key: <code>{field.key}</code>
                    </p>
                    {field.description && (
                      <p className="text-xs text-[var(--color-text-muted)] mb-1">
                        {field.description}
                      </p>
                    )}
                    <p className="text-xs">
                      Default:{" "}
                      <code className="text-[var(--color-accent-hover)]">
                        {JSON.stringify(field.default)}
                      </code>
                    </p>
                    {(field.min !== undefined || field.max !== undefined) && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Range: {field.min ?? "—"} – {field.max ?? "—"}
                        {field.step ? ` (step ${field.step})` : ""}
                      </p>
                    )}
                    {field.options && field.options.length > 0 && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Options: {field.options.join(", ")}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <footer className="p-5 border-t border-[var(--color-border)] flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => onAddToLibrary(template)}>Add to library</Button>
        </footer>
      </aside>
    </>
  );
}
