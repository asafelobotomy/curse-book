import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { api } from "../lib/api";
import type { TemplateDefinition } from "../lib/types";
import { artifactBadge } from "../lib/utils";
import { Badge, Button, Card } from "../components/ui";

export function CatalogPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateDefinition[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .initApp()
      .then(() => api.listTemplates())
      .then(setTemplates)
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(templates.map((t) => t.category));
    return ["all", ...Array.from(cats).sort()];
  }, [templates]);

  const filtered = templates.filter((t) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q));
    const matchesCategory = category === "all" || t.category === category;
    return matchesSearch && matchesCategory;
  });

  const addToLibrary = async (template: TemplateDefinition) => {
    try {
      const preset = await api.createPresetFromTemplate(template.id);
      toast.success(`Added "${preset.name}" to your presets`);
      navigate(`/presets/${preset.id}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <div className="p-6 max-w-6xl">
      <header className="mb-6">
        <h2 className="text-2xl font-bold">Template Catalog</h2>
        <p className="text-[var(--color-text-muted)] mt-1">
          Pick from curated rules and skills inspired by awesome-cursorrules
        </p>
      </header>

      <div className="flex gap-3 mb-6">
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

      {loading ? (
        <p className="text-[var(--color-text-muted)]">Loading catalog...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template) => (
            <Card key={template.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold">{template.name}</h3>
                <Badge>{artifactBadge(template.artifactType)}</Badge>
              </div>
              <p className="text-sm text-[var(--color-text-muted)] flex-1 mb-3">
                {template.description}
              </p>
              <div className="flex flex-wrap gap-1 mb-3">
                {template.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-muted)]">
                  {template.parameters.length} parameters
                </span>
                <Button size="sm" onClick={() => addToLibrary(template)}>
                  Add to library
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
