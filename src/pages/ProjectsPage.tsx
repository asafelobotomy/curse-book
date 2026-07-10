import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Rocket } from "lucide-react";
import { api } from "../lib/api";
import type { DeployDiff, Preset, ProjectProfile } from "../lib/types";
import { formatDate } from "../lib/utils";
import { Badge, Button, Card } from "../components/ui";

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectProfile[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [diffs, setDiffs] = useState<DeployDiff[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [scanning, setScanning] = useState(false);

  const load = async () => {
    const [p, pr] = await Promise.all([api.listPresets(), api.listProjects()]);
    setPresets(p);
    setProjects(pr);
    if (pr.length > 0 && !selectedProject) setSelectedProject(pr[0].path);
    if (p.length > 0 && !selectedPreset) setSelectedPreset(p[0].id);
  };

  useEffect(() => {
    load().catch((e) => toast.error(String(e)));
  }, []);

  const scan = async () => {
    setScanning(true);
    try {
      const found = await api.scanProjects();
      setProjects(found);
      toast.success(`Found ${found.length} projects`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setScanning(false);
    }
  };

  const preview = async () => {
    if (!selectedProject || !selectedPreset) return;
    try {
      const d = await api.previewDeploy(selectedPreset, selectedProject);
      setDiffs(d);
      if (d.length === 0) toast.info("No changes to deploy");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const deploy = async () => {
    if (!selectedProject || !selectedPreset) return;
    setDeploying(true);
    try {
      const result = await api.deployPreset(selectedPreset, selectedProject);
      toast.success(`Deployed ${result.deployedFiles.length} files`);
      setDiffs([]);
      load();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Projects</h2>
          <p className="text-[var(--color-text-muted)] mt-1">
            Deploy presets to Cursor project directories
          </p>
        </div>
        <Button variant="secondary" onClick={scan} disabled={scanning}>
          <RefreshCw size={14} className={scanning ? "animate-spin" : ""} />
          Scan
        </Button>
      </header>

      <Card className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Project</label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.path}>
                {p.name} — {p.path}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Preset to deploy</label>
          <select
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={preview}>
            Preview diff
          </Button>
          <Button onClick={deploy} disabled={deploying}>
            <Rocket size={14} />
            {deploying ? "Deploying..." : "Deploy"}
          </Button>
        </div>
      </Card>

      {diffs.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Pending changes</h3>
          {diffs.map((d) => (
            <Card key={d.path}>
              <div className="flex items-center gap-2 mb-2">
                <code className="text-sm">{d.path}</code>
                <Badge
                  className={
                    d.action === "create"
                      ? "bg-[var(--color-success)]/20 text-[var(--color-success)]"
                      : "bg-[var(--color-warning)]/20 text-[var(--color-warning)]"
                  }
                >
                  {d.action}
                </Badge>
              </div>
              <pre className="text-xs font-mono overflow-auto max-h-32 text-[var(--color-text-muted)]">
                {d.newContent.slice(0, 500)}
                {d.newContent.length > 500 ? "..." : ""}
              </pre>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8">
        <h3 className="font-semibold mb-3">Known projects</h3>
        <div className="space-y-2">
          {projects.map((p) => (
            <Card key={p.id} className="flex justify-between items-center py-3">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-[var(--color-text-muted)] font-mono">{p.path}</p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">
                {p.lastDeployedAt
                  ? `Deployed ${formatDate(p.lastDeployedAt)}`
                  : "Not deployed"}
              </span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
