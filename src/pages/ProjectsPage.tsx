import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Rocket, X, Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import type { DeployDiff, Preset, ProjectProfile } from "../lib/types";
import { formatDate } from "../lib/utils";
import { SyncBadge } from "../components/projects/SyncBadge";
import { PostDeployActions } from "../components/workflow/PostDeployActions";
import { Badge, Button, Card } from "../components/ui";

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectProfile[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<DeployDiff[]>([]);
  const [previewPreset, setPreviewPreset] = useState<string>("");
  const [previewProject, setPreviewProject] = useState<string>("");
  const [deploying, setDeploying] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [addPresetFor, setAddPresetFor] = useState<string | null>(null);

  const load = async () => {
    const [p, pr] = await Promise.all([api.listPresets(), api.listProjects()]);
    setPresets(p);
    setProjects(pr);
    if (p.length > 0 && !previewPreset) setPreviewPreset(p[0].id);
  };

  useEffect(() => {
    load().catch((e) => toast.error(String(e)));
  }, []);

  const scan = async () => {
    setScanning(true);
    try {
      const roots = await api.getScanRoots();
      const found = await api.scanProjects(roots);
      setProjects(found);
      toast.success(`Found ${found.length} projects`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setScanning(false);
    }
  };

  const presetName = (id: string) =>
    presets.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  const assignPreset = async (projectId: string, presetId: string) => {
    try {
      const updated = await api.assignPresetToProject(projectId, presetId);
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? updated : p)),
      );
      setAddPresetFor(null);
      toast.success("Assigned to project");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const unassignPreset = async (projectId: string, presetId: string) => {
    try {
      const updated = await api.unassignPresetFromProject(projectId, presetId);
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? updated : p)),
      );
    } catch (e) {
      toast.error(String(e));
    }
  };

  const deployAll = async (project: ProjectProfile) => {
    if (project.presetIds.length === 0) {
      toast.info("Assign library items first");
      return;
    }
    setDeploying(true);
    try {
      const results = await api.deployProjectPresets(project.id);
      const total = results.reduce((n, r) => n + r.deployedFiles.length, 0);
      toast.success(`Deployed ${total} files across ${results.length} items`);
      load();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDeploying(false);
    }
  };

  const removeProject = async (project: ProjectProfile) => {
    if (!window.confirm(`Remove ${project.name} from the list?`)) return;
    try {
      await api.deleteProject(project.id);
      toast.success("Project removed");
      load();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const preview = async () => {
    if (!previewProject || !previewPreset) return;
    try {
      const d = await api.previewDeploy(previewPreset, previewProject);
      setDiffs(d);
      if (d.length === 0) toast.info("No changes to deploy");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const deployOne = async () => {
    if (!previewProject || !previewPreset) return;
    setDeploying(true);
    try {
      const result = await api.deployPreset(previewPreset, previewProject);
      toast.success(`Deployed ${result.deployedFiles.length} files`);
      setDiffs([]);
      load();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDeploying(false);
    }
  };

  const unassignedPresets = (project: ProjectProfile) =>
    presets.filter((p) => !project.presetIds.includes(p.id));

  return (
    <div className="p-6 max-w-5xl">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Projects</h2>
          <p className="text-[var(--color-text-muted)] mt-1">
            Assign library items, deploy to .cursor/, and sync via git
          </p>
        </div>
        <Button variant="secondary" onClick={scan} disabled={scanning}>
          <RefreshCw size={14} className={scanning ? "animate-spin" : ""} />
          Scan
        </Button>
      </header>

      {projects.length === 0 ? (
        <Card>
          <p className="text-[var(--color-text-muted)]">
            No projects found. Click Scan to discover repos under your scan roots
            (configure in Settings).
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <Card key={project.id} className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{project.name}</h3>
                    <SyncBadge projectPath={project.path} />
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] font-mono truncate mt-1">
                    {project.path}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {project.lastDeployedAt
                      ? `Last deployed ${formatDate(project.lastDeployedAt)}`
                      : "Not deployed yet"}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => deployAll(project)}
                    disabled={deploying || project.presetIds.length === 0}
                  >
                    <Rocket size={14} />
                    Deploy all
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setExpandedProject(
                        expandedProject === project.id ? null : project.id,
                      )
                    }
                  >
                    Workflow
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeProject(project)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Assigned library items</p>
                <div className="flex flex-wrap gap-2">
                  {project.presetIds.length === 0 ? (
                    <span className="text-sm text-[var(--color-text-muted)]">
                      None assigned
                    </span>
                  ) : (
                    project.presetIds.map((pid) => (
                      <Badge
                        key={pid}
                        className="flex items-center gap-1 pr-1 bg-[var(--color-surface-overlay)] text-[var(--color-text)]"
                      >
                        {presetName(pid)}
                        <button
                          type="button"
                          onClick={() => unassignPreset(project.id, pid)}
                          className="hover:text-[var(--color-danger)]"
                        >
                          <X size={12} />
                        </button>
                      </Badge>
                    ))
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setAddPresetFor(
                        addPresetFor === project.id ? null : project.id,
                      )
                    }
                  >
                    <Plus size={14} />
                    Add
                  </Button>
                </div>

                {addPresetFor === project.id && (
                  <div className="mt-2 flex gap-2">
                    <select
                      className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                      onChange={(e) => {
                        if (e.target.value) {
                          assignPreset(project.id, e.target.value);
                          e.target.value = "";
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Select library item...
                      </option>
                      {unassignedPresets(project).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {expandedProject === project.id && (
                <PostDeployActions projectPath={project.path} />
              )}
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-8 space-y-4">
        <h3 className="font-semibold">Quick deploy</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Project</label>
            <select
              value={previewProject}
              onChange={(e) => setPreviewProject(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            >
              <option value="">Select project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.path}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Library item</label>
            <select
              value={previewPreset}
              onChange={(e) => setPreviewPreset(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={preview}>
            Preview diff
          </Button>
          <Button onClick={deployOne} disabled={deploying}>
            <Rocket size={14} />
            {deploying ? "Deploying..." : "Deploy"}
          </Button>
        </div>
      </Card>

      {diffs.length > 0 && (
        <div className="mt-6 space-y-3">
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
              <pre className="text-xs font-mono overflow-auto max-h-64 text-[var(--color-text-muted)] whitespace-pre-wrap">
                {d.newContent}
              </pre>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
