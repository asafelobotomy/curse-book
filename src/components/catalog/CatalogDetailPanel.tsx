import { ExternalLink, X } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useMemo, useState } from "react";
import { ParameterForm } from "../ParameterForm";
import { api } from "../../lib/api";
import {
  buildDefaultParameters,
  getActivationLabel,
  getPluginComponentSummary,
  resolveSourceUrl,
} from "../../lib/catalog";
import {
  diffHighlightLines,
  parseFilterTerms,
} from "../../lib/parameterHighlight";
import type { CompiledArtifact, CatalogSourceEntry, TemplateDefinition } from "../../lib/types";
import { artifactBadge, formatRelativeDate } from "../../lib/utils";
import { displayTemplateTags } from "../../lib/tags";
import { useRegistrySourceIds } from "../../lib/CatalogRegistrySourceContext";
import { Badge, Button } from "../ui";
import { MonacoPreview } from "./MonacoPreview";
import { TagChip } from "./TagChip";

type PanelTab = "overview" | "preview" | "parameters";
type PreviewMode = "compiled" | "raw";

interface CatalogDetailPanelProps {
  template: TemplateDefinition;
  sourceEntry?: CatalogSourceEntry | null;
  activeTags: Set<string>;
  onClose: () => void;
  onTagClick: (tag: string) => void;
  onAddToLibrary: (
    template: TemplateDefinition,
    parameters: Record<string, unknown>,
  ) => void;
}

export function CatalogDetailPanel({
  template,
  sourceEntry,
  activeTags,
  onClose,
  onTagClick,
  onAddToLibrary,
}: CatalogDetailPanelProps) {
  const registrySourceIds = useRegistrySourceIds();
  const [tab, setTab] = useState<PanelTab>("overview");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("compiled");
  const [draftParams, setDraftParams] = useState<Record<string, unknown>>({});
  const [compiledArtifacts, setCompiledArtifacts] = useState<CompiledArtifact[]>([]);
  const [selectedArtifactIdx, setSelectedArtifactIdx] = useState(0);
  const [mcpEnvVars, setMcpEnvVars] = useState<string[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [highlightFilter, setHighlightFilter] = useState("");

  useEffect(() => {
    if (!template) return;
    setTab("overview");
    setPreviewMode("compiled");
    setDraftParams(buildDefaultParameters(template.parameters));
    setCompiledArtifacts([]);
    setSelectedArtifactIdx(0);
    setHighlightFilter("");
    if (template.artifactType === "mcp") {
      api
        .getTemplateMcpEnvVars(template.id)
        .then(setMcpEnvVars)
        .catch(() => setMcpEnvVars([]));
    } else {
      setMcpEnvVars([]);
    }
  }, [template.id]);

  useEffect(() => {
    if (!template) return;

    const defaults = buildDefaultParameters(template.parameters);
    api
      .compilePreview(template, defaults)
      .then((result) => {
        setCompiledArtifacts(result.artifacts);
        setSelectedArtifactIdx(0);
      })
      .catch(() => setCompiledArtifacts([]));
  }, [template]);

  useEffect(() => {
    if (!template || tab !== "preview" || previewMode !== "compiled") return;

    setLoadingPreview(true);
    const timer = setTimeout(() => {
      api
        .compilePreview(template, draftParams)
        .then((result) => {
          setCompiledArtifacts(result.artifacts);
          setSelectedArtifactIdx(0);
        })
        .catch(() => setCompiledArtifacts([]))
        .finally(() => setLoadingPreview(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [template, tab, previewMode, draftParams]);

  const compiledContent = useMemo(() => {
    if (compiledArtifacts.length === 0) return "";
    const artifact = compiledArtifacts[selectedArtifactIdx] ?? compiledArtifacts[0];
    return artifact.content;
  }, [compiledArtifacts, selectedArtifactIdx]);

  const baselineContent = useMemo(() => {
    if (compiledArtifacts.length === 0) return "";
    return compiledArtifacts.map((a) => `// ${a.relativePath}\n${a.content}`).join("\n\n");
  }, [compiledArtifacts]);

  const paramHighlightLines = useMemo(() => {
    if (previewMode !== "compiled" || !compiledContent || !baselineContent) {
      return [];
    }
    return diffHighlightLines(baselineContent, compiledContent);
  }, [previewMode, compiledContent, baselineContent]);

  const userFilterTerms = parseFilterTerms(highlightFilter);

  const sourceUrl = resolveSourceUrl(template);
  const previewContent =
    previewMode === "raw" ? template.bodyTemplate : compiledContent;

  const tabs: { id: PanelTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "preview", label: "Preview" },
    { id: "parameters", label: "Parameters" },
  ];

  const updateParam = (key: string, value: unknown) => {
    setDraftParams((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <>
      <div
        className="catalog-detail-backdrop fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden
      />
      <aside className="catalog-detail-window fixed top-0 right-0 h-full w-full max-w-2xl z-50 flex flex-col border-l border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-2xl">
      <header className="flex items-start justify-between gap-4 p-5 border-b border-[var(--color-border)] shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold">{template.name}</h2>
            <Badge>{artifactBadge(template.artifactType)}</Badge>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            {template.category}
            {template.updatedAt && (
              <span
                title={template.updatedAt}
              >{` · Updated ${formatRelativeDate(template.updatedAt)}`}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--color-surface-overlay)]"
          aria-label="Close details"
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
              {getPluginComponentSummary(template) && (
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  Bundle: {getPluginComponentSummary(template)}
                </p>
              )}
            </div>

            {mcpEnvVars.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
                  MCP environment variables
                </h4>
                <ul className="text-sm list-disc list-inside">
                  {mcpEnvVars.map((v) => (
                    <li key={v}>
                      <code>{v}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(sourceEntry || template.sourceRepo) && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
                  {sourceEntry ? "Source" : "Inspired by"}
                </h4>
                <dl className="text-sm space-y-1">
                  {sourceEntry && template.source && (
                    <div className="flex gap-2">
                      <dt className="text-[var(--color-text-muted)]">Registry:</dt>
                      <dd>{template.source}</dd>
                    </div>
                  )}
                  {(sourceEntry?.repo || template.sourceRepo) && (
                    <div className="flex gap-2">
                      <dt className="text-[var(--color-text-muted)]">
                        {sourceEntry ? "Repository:" : "Upstream:"}
                      </dt>
                      <dd className="font-mono text-xs">
                        {sourceEntry?.repo ?? template.sourceRepo}
                      </dd>
                    </div>
                  )}
                  {sourceEntry?.starsAtReview != null && (
                    <div className="flex gap-2">
                      <dt className="text-[var(--color-text-muted)]">Stars (at review):</dt>
                      <dd>{sourceEntry.starsAtReview.toLocaleString()}</dd>
                    </div>
                  )}
                  {sourceEntry?.license && (
                    <div className="flex gap-2">
                      <dt className="text-[var(--color-text-muted)]">License:</dt>
                      <dd>{sourceEntry.license}</dd>
                    </div>
                  )}
                  {sourceEntry?.referenceOnly && (
                    <div className="mt-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                        Reference only — not bulk-imported
                      </span>
                      {sourceEntry.referenceUrl && (
                        <button
                          type="button"
                          className="block text-xs text-[var(--color-accent)] mt-1 hover:underline"
                          onClick={() => openUrl(sourceEntry.referenceUrl!)}
                        >
                          {sourceEntry.referenceUrl}
                        </button>
                      )}
                    </div>
                  )}
                </dl>
              </div>
            )}

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
                {displayTemplateTags(template.tags, registrySourceIds).map((tag) => (
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
            <div className="flex flex-wrap items-center justify-between gap-2">
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

            {compiledArtifacts.length > 1 && previewMode === "compiled" && (
              <div className="flex flex-wrap gap-1">
                {compiledArtifacts.map((artifact, idx) => (
                  <button
                    key={artifact.relativePath}
                    type="button"
                    onClick={() => setSelectedArtifactIdx(idx)}
                    className={`px-2 py-1 text-xs rounded border ${
                      selectedArtifactIdx === idx
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                        : "border-[var(--color-border)]"
                    }`}
                  >
                    {artifact.relativePath}
                  </button>
                ))}
              </div>
            )}

            <input
              type="text"
              placeholder="Highlight filter (comma or space separated)"
              value={highlightFilter}
              onChange={(e) => setHighlightFilter(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            />

            {loadingPreview && previewMode === "compiled" ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                Compiling preview...
              </p>
            ) : (
              <div className="flex-1 min-h-[400px]">
                <MonacoPreview
                  content={previewContent}
                  paramHighlightLines={
                    previewMode === "compiled" ? paramHighlightLines : []
                  }
                  userFilterTerms={userFilterTerms}
                  highlightHandlebars={previewMode === "raw"}
                  wordWrap={wordWrap}
                />
              </div>
            )}
          </div>
        )}

        {tab === "parameters" && (
          <div className="space-y-4">
            <p className="text-xs text-[var(--color-text-muted)]">
              Adjust parameters to preview changes. Settings are not saved until
              you add to your library.
            </p>
            <ParameterForm
              fields={template.parameters}
              values={draftParams}
              onChange={updateParam}
            />
          </div>
        )}
      </div>

      <footer className="p-5 border-t border-[var(--color-border)] flex justify-end gap-2 shrink-0">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button onClick={() => onAddToLibrary(template, draftParams)}>
          Add to library
        </Button>
      </footer>
      </aside>
    </>
  );
}
