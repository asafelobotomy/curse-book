import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { CatalogCard } from "../components/catalog/CatalogCard";
import { CatalogDetailPanel } from "../components/catalog/CatalogDetailPanel";
import {
  CatalogFilterBar,
  type CatalogLayout,
} from "../components/catalog/CatalogFilterBar";
import { CatalogListRow } from "../components/catalog/CatalogListRow";
import { AddToLibrarySheet } from "../components/library/AddToLibrarySheet";
import { DeploySheet } from "../components/library/DeploySheet";
import { buildDefaultParameters, sortTemplates, type SortOption } from "../lib/catalog";
import {
  buildSourceFilterOptions,
  matchesCatalogSourceFilter,
  resolveCatalogSourceEntry,
} from "../lib/catalogSources";
import { CatalogRegistrySourceProvider } from "../lib/CatalogRegistrySourceContext";
import { organizeCatalogTags, registrySourceIds } from "../lib/tags";
import { api } from "../lib/api";
import type { CatalogArtifactFilter, CatalogSourceEntry, CatalogSourceFilter, Preset, TemplateDefinition } from "../lib/types";

const LAYOUT_STORAGE_KEY = "catalog-layout";

function loadLayout(): CatalogLayout {
  const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
  return stored === "list" ? "list" : "card";
}

export function CatalogPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateDefinition[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [artifactFilter, setArtifactFilter] = useState<CatalogArtifactFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<CatalogSourceFilter>("all");
  const [sort, setSort] = useState<SortOption>("name-asc");
  const [layout, setLayout] = useState<CatalogLayout>(loadLayout);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition | null>(null);
  const [addedPreset, setAddedPreset] = useState<Preset | null>(null);
  const [deployPreset, setDeployPreset] = useState<Preset | null>(null);
  const [tokenStats, setTokenStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [catalogSources, setCatalogSources] = useState<CatalogSourceEntry[]>([]);

  useEffect(() => {
    api
      .initApp()
      .then(() => api.listTemplates())
      .then(setTemplates)
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false));
    api.listCatalogSources().then(setCatalogSources).catch((e) => {
      console.warn("Failed to load catalog sources", e);
    });
  }, []);

  useEffect(() => {
    if (templates.length === 0) return;
    const ids = templates.map((t) => t.id);
    api
      .getTemplateStats(ids)
      .then((stats) => {
        const map: Record<string, number> = {};
        for (const s of stats) map[s.templateId] = s.tokenEstimate;
        setTokenStats(map);
      })
      .catch(() => {});
  }, [templates]);

  useEffect(() => {
    if (!selectedTemplate) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedTemplate(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedTemplate]);

  const categories = useMemo(() => {
    const cats = new Set(templates.map((t) => t.category));
    return ["all", ...Array.from(cats).sort()];
  }, [templates]);

  const registryIds = useMemo(
    () => registrySourceIds(catalogSources.map((s) => s.id)),
    [catalogSources],
  );

  const organizedTags = useMemo(
    () => organizeCatalogTags(templates, activeTags, registryIds),
    [templates, activeTags, registryIds],
  );

  const sourceOptions = useMemo(
    () => buildSourceFilterOptions(catalogSources),
    [catalogSources],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const base = templates.filter((t) => {
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        (t.highlights ?? []).some((h) => h.toLowerCase().includes(q));
      const matchesCategory = category === "all" || t.category === category;
      const matchesArtifact =
        artifactFilter === "all" || t.artifactType === artifactFilter;
      const matchesSource = matchesCatalogSourceFilter(t, sourceFilter);
      const matchesTags =
        activeTags.size === 0 ||
        Array.from(activeTags).every((tag) => t.tags.includes(tag));
      return matchesSearch && matchesCategory && matchesArtifact && matchesSource && matchesTags;
    });
    return sortTemplates(base, sort, tokenStats);
  }, [templates, search, category, artifactFilter, sourceFilter, activeTags, sort, tokenStats]);

  const toggleTag = useCallback((tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const handleLayoutChange = (next: CatalogLayout) => {
    setLayout(next);
    localStorage.setItem(LAYOUT_STORAGE_KEY, next);
  };

  const openDetails = (template: TemplateDefinition) => {
    setSelectedTemplate(template);
  };

  const addToLibrary = async (
    template: TemplateDefinition,
    parameters?: Record<string, unknown>,
  ) => {
    try {
      const params = parameters ?? buildDefaultParameters(template.parameters);
      const preset = await api.createPresetFromTemplate(
        template.id,
        undefined,
        params,
      );
      toast.success(`Added "${preset.name}" to your library`);
      setAddedPreset(preset);
      setSelectedTemplate(null);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleAssign = async () => {
    if (!addedPreset) return;
    const projects = await api.listProjects();
    if (projects.length === 0) {
      toast.info("Scan for projects first on the Projects page");
      navigate("/projects");
      return;
    }
    try {
      await api.assignPresetToProject(projects[0].id, addedPreset.id);
      toast.success(`Assigned to ${projects[0].name}`);
      setAddedPreset(null);
      navigate("/projects");
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <CatalogRegistrySourceProvider sourceIds={registryIds}>
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h2 className="text-2xl font-bold">Template Catalog</h2>
        <p className="text-[var(--color-text-muted)] mt-1">
          Pick from curated rules, skills, hooks, MCP configs, and plugins
        </p>
      </header>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="search"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-sm"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All categories" : c}
            </option>
          ))}
        </select>
      </div>

      <CatalogFilterBar
        organizedTags={organizedTags}
        activeTags={activeTags}
        artifactFilter={artifactFilter}
        sourceFilter={sourceFilter}
        sourceOptions={sourceOptions}
        sort={sort}
        layout={layout}
        onTagClick={toggleTag}
        onArtifactFilterChange={setArtifactFilter}
        onSourceFilterChange={setSourceFilter}
        onSortChange={setSort}
        onLayoutChange={handleLayoutChange}
        onClearTags={() => setActiveTags(new Set())}
      />

      {loading ? (
        <p className="text-[var(--color-text-muted)]">Loading catalog...</p>
      ) : filtered.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">
          No templates match your filters.
        </p>
      ) : layout === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((template) => (
            <CatalogCard
              key={template.id}
              template={template}
              activeTags={activeTags}
              selected={selectedTemplate?.id === template.id}
              tokenEstimate={tokenStats[template.id]}
              onSelect={openDetails}
              onTagClick={toggleTag}
              onAddToLibrary={(t) =>
                addToLibrary(t, buildDefaultParameters(t.parameters))
              }
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((template) => (
            <CatalogListRow
              key={template.id}
              template={template}
              selected={selectedTemplate?.id === template.id}
              tokenEstimate={tokenStats[template.id]}
              onSelect={openDetails}
              onAddToLibrary={(t) =>
                addToLibrary(t, buildDefaultParameters(t.parameters))
              }
            />
          ))}
        </div>
      )}

      {selectedTemplate && (
        <CatalogDetailPanel
          template={selectedTemplate}
          sourceEntry={resolveCatalogSourceEntry(selectedTemplate, catalogSources)}
          activeTags={activeTags}
          onClose={() => setSelectedTemplate(null)}
          onTagClick={toggleTag}
          onAddToLibrary={addToLibrary}
        />
      )}

      {addedPreset && (
        <AddToLibrarySheet
          preset={addedPreset}
          onClose={() => setAddedPreset(null)}
          onDeployProject={() => setDeployPreset(addedPreset)}
          onDeployGlobal={
            addedPreset.artifactType === "skill"
              ? async () => {
                  try {
                    await api.deployPresetToUser(addedPreset.id);
                    toast.success("Deployed to cursebook");
                    setAddedPreset(null);
                  } catch (e) {
                    toast.error(String(e));
                  }
                }
              : undefined
          }
          onAssign={handleAssign}
          onAddAnother={() => setAddedPreset(null)}
        />
      )}

      {deployPreset && (
        <DeploySheet
          preset={deployPreset}
          onClose={() => setDeployPreset(null)}
          onDeployed={() => setAddedPreset(null)}
        />
      )}
    </div>
    </CatalogRegistrySourceProvider>
  );
}
