import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../lib/api";
import type { CompileResult, Preset, TemplateDefinition } from "../lib/types";
import { ParameterForm } from "../components/ParameterForm";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { Button, Card } from "../components/ui";

export function PresetEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [preset, setPreset] = useState<Preset | null>(null);
  const [template, setTemplate] = useState<TemplateDefinition | null>(null);
  const [preview, setPreview] = useState<CompileResult | null>(null);
  const [showRaw, setShowRaw] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const p = await api.getPreset(id);
    if (!p) {
      toast.error("Preset not found");
      navigate("/presets");
      return;
    }
    setPreset(p);
    const templates = await api.listTemplates();
    const t = templates.find((tm) => tm.id === p.templateId);
    setTemplate(t ?? null);
  }, [id, navigate]);

  useEffect(() => {
    load().catch((e) => toast.error(String(e)));
  }, [load]);

  useEffect(() => {
    if (!preset || !template) return;
    const timer = setTimeout(() => {
      api
        .compilePreview(template, preset.parameters)
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [preset, template]);

  const updateParam = (key: string, value: unknown) => {
    if (!preset) return;
    setPreset({
      ...preset,
      parameters: { ...preset.parameters, [key]: value },
    });
  };

  const save = async () => {
    if (!preset) return;
    setSaving(true);
    try {
      const saved = await api.savePreset(preset);
      setPreset(saved);
      toast.success("Preset saved");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!preset || !template) {
    return <div className="p-6 text-[var(--color-text-muted)]">Loading...</div>;
  }

  const previewContent = preview?.artifacts[0]?.content ?? "";

  return (
    <div className="p-6 flex flex-col h-full">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{preset.name}</h2>
          <p className="text-[var(--color-text-muted)] mt-1">{preset.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate("/presets")}>
            Back
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        <Card className="overflow-auto">
          <h3 className="font-semibold mb-4">Parameters</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5">Preset name</label>
            <input
              type="text"
              value={preset.name}
              onChange={(e) => setPreset({ ...preset, name: e.target.value })}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            />
          </div>
          <ParameterForm
            fields={template.parameters}
            values={preset.parameters}
            onChange={updateParam}
          />
        </Card>

        <Card className="flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Live Preview</h3>
            <div className="flex items-center gap-3">
              {preview && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  ~{preview.tokenEstimate} tokens · {preview.lineCount} lines
                </span>
              )}
              <button
                onClick={() => setShowRaw(!showRaw)}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                {showRaw ? "Rendered" : "Raw"}
              </button>
            </div>
          </div>
          <MarkdownPreview content={previewContent} raw={showRaw} />
        </Card>
      </div>
    </div>
  );
}
