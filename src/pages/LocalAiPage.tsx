import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { api } from "../lib/api";
import type { OllamaStatus, TemplateDefinition } from "../lib/types";
import { Button, Card } from "../components/ui";

export function LocalAiPage() {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [description, setDescription] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<TemplateDefinition[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  useEffect(() => {
    api.ollamaStatus().then(setStatus).catch(() => setStatus(null));
    api.listTemplates().then((t) => {
      setTemplates(t);
      if (t.length > 0) setSelectedTemplate(t[0].id);
    });
  }, []);

  const refreshStatus = () => {
    api.ollamaStatus().then(setStatus).catch(() => setStatus(null));
  };

  const setModel = async (model: string) => {
    await api.ollamaSetModel(model);
    refreshStatus();
    toast.success(`Model set to ${model}`);
  };

  const generateRule = async () => {
    if (!description.trim()) return;
    setLoading(true);
    try {
      const body = await api.ollamaGenerateRuleBody(description);
      setResult(body);
      toast.success("Rule body generated");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  };

  const wizardToPreset = async () => {
    if (!description.trim() || !selectedTemplate) return;
    const template = templates.find((t) => t.id === selectedTemplate);
    if (!template) return;

    setLoading(true);
    try {
      const params = await api.ollamaNlToParameters(
        description,
        JSON.stringify(template.parameters),
      );
      const preset = await api.createPresetFromTemplate(template.id, undefined);
      const updated = { ...preset, parameters: { ...preset.parameters, ...params } };
      await api.savePreset(updated);
      toast.success(`Added "${updated.name}" to your library`);
      setResult(JSON.stringify(params, null, 2));
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <header className="mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles size={22} className="text-[var(--color-accent)]" />
          Local AI Assistant
        </h2>
        <p className="text-[var(--color-text-muted)] mt-1">
          Use Ollama for offline library item generation and tuning
        </p>
      </header>

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Ollama status</h3>
          <Button variant="ghost" size="sm" onClick={refreshStatus}>
            Refresh
          </Button>
        </div>
        {status ? (
          <div className="space-y-2 text-sm">
            <p>
              Status:{" "}
              <span
                className={
                  status.available
                    ? "text-[var(--color-success)]"
                    : "text-[var(--color-danger)]"
                }
              >
                {status.available ? "Connected" : "Not running"}
              </span>
            </p>
            {status.available && (
              <>
                <p className="text-[var(--color-text-muted)]">
                  Models: {status.models.join(", ") || "none"}
                </p>
                {status.models.length > 0 && (
                  <select
                    value={status.selectedModel ?? status.models[0]}
                    onChange={(e) => setModel(e.target.value)}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                  >
                    {status.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
            {!status.available && (
              <p className="text-[var(--color-text-muted)]">
                Start Ollama with <code className="font-mono">ollama serve</code> then
                pull a model: <code className="font-mono">ollama pull qwen2.5:3b</code>
              </p>
            )}
          </div>
        ) : (
          <p className="text-[var(--color-text-muted)]">Checking...</p>
        )}
      </Card>

      <Card className="mb-6 space-y-4">
        <h3 className="font-semibold">Describe your behavior</h3>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Be stricter about error handling in TypeScript, require tests for all new functions..."
          rows={4}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm resize-none"
        />
        <div>
          <label className="block text-sm font-medium mb-1.5">Base template</label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button onClick={wizardToPreset} disabled={loading || !status?.available}>
            Add to library from description
          </Button>
          <Button
            variant="secondary"
            onClick={generateRule}
            disabled={loading || !status?.available}
          >
            Generate rule body only
          </Button>
        </div>
      </Card>

      {result && (
        <Card>
          <h3 className="font-semibold mb-3">Result</h3>
          <pre className="text-xs font-mono whitespace-pre-wrap overflow-auto max-h-64">
            {result}
          </pre>
        </Card>
      )}
    </div>
  );
}
