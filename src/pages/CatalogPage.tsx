import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { CatalogCard } from "../components/catalog/CatalogCard";
import { CatalogDetailDrawer } from "../components/catalog/CatalogDetailDrawer";
import { CatalogFilterBar } from "../components/catalog/CatalogFilterBar";
import { api } from "../lib/api";
import {
  collectUniqueTags,
  sortTemplates,
  type SortOption,
} from "../lib/catalog";
import type { TemplateDefinition } from "../lib/types";

export function CatalogPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateDefinition[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [artifactFilter, setArtifactFilter] = useState<"all" | "rule" | "skill">("all");
  const [sort, setSort] = useState<SortOption>("name-asc");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition | null>(null);
  const [tokenStats, setTokenStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .initApp()
      .then(() => api.listTemplates())
      .then(setTemplates)
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false));
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

  const categories = useMemo(() => {
    const cats = new Set(templates.map((t) => t.category));
    return ["all", ...Array.from(cats).sort()];
  }, [templates]);

  const allTags = useMemo(() => collectUniqueTags(templates), [templates]);

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
      const matchesTags =
        activeTags.size === 0 ||
        Array.from(activeTags).every((tag) => t.tags.includes(tag));
      return matchesSearch && matchesCategory && matchesArtifact && matchesTags;
    });
    return sortTemplates(base, sort, tokenStats);
  }, [templates, search, category, artifactFilter, activeTags, sort, tokenStats]);

  const toggleTag = useCallback((tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const addToLibrary = async (template: TemplateDefinition) => {
    try {
      const preset = await api.createPresetFromTemplate(template.id);
      toast.success(`Added "${preset.name}" to your presets`);
      navigate(`/presets/${preset.id}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const drawerOpen = selectedTemplate !== null;

  return (
    <div className={`p-6 max-w-7xl transition-all ${drawerOpen ? "pr-[50%]" : ""}`}>
      <header className="mb-6">
        <h2 className="text-2xl font-bold">Template Catalog</h2>
        <p className="text-[var(--color-text-muted)] mt-1">
          Pick from curated rules and skills inspired by awesome-cursorrules
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
        tags={allTags}
        activeTags={activeTags}
        artifactFilter={artifactFilter}
        sort={sort}
        onTagClick={toggleTag}
        onArtifactFilterChange={setArtifactFilter}
        onSortChange={setSort}
        onClearTags={() => setActiveTags(new Set())}
      />

      {loading ? (
        <p className="text-[var(--color-text-muted)]">Loading catalog...</p>
      ) : filtered.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">No templates match your filters.</p>
      ) : (
        <div
          className={`grid gap-4 ${
            drawerOpen
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {filtered.map((template) => (
            <CatalogCard
              key={template.id}
              template={template}
              activeTags={activeTags}
              tokenEstimate={tokenStats[template.id]}
              onSelect={setSelectedTemplate}
              onTagClick={toggleTag}
              onAddToLibrary={addToLibrary}
            />
          ))}
        </div>
      )}

      <CatalogDetailDrawer
        template={selectedTemplate}
        searchQuery={search}
        activeTags={activeTags}
        onClose={() => setSelectedTemplate(null)}
        onTagClick={toggleTag}
        onAddToLibrary={addToLibrary}
      />
    </div>
  );
}
