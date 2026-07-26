import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Rocket, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";
import type { DeployTargetKind, McpMergePreview, Preset, ProjectProfile } from "../../lib/types";
import { Button, Card } from "../ui";

interface DeploySheetProps {
  preset: Preset;
  onClose: () => void;
  onDeployed?: () => void;
}

function defaultPluginName(preset: Preset): string {
  return preset.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function DeploySheet({ preset, onClose, onDeployed }: DeploySheetProps) {
  const [projects, setProjects] = useState<ProjectProfile[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [pluginName, setPluginName] = useState(defaultPluginName(preset));
  const [deploying, setDeploying] = useState(false);
  const [mcpPreview, setMcpPreview] = useState<McpMergePreview | null>(null);
  const [mcpEnvVars, setMcpEnvVars] = useState<string[]>([]);

  const artifactType = preset.artifactType;
  const isPlugin = artifactType === "plugin";
  const isMcp = artifactType === "mcp";
  const canDeployProject = artifactType !== "plugin";
  const canDeployGlobalSkill = artifactType === "skill";
  const canDeployGlobalAgents = artifactType === "subagent";
  const canDeployGlobalHooks = artifactType === "hook";
  const canDeployGlobalMcp = artifactType === "mcp";

  useEffect(() => {
    api
      .listProjects()
      .then((p) => {
        setProjects(p);
        if (p.length > 0) setSelectedProject(p[0].path);
      })
      .catch((e) => toast.error(String(e)));
  }, []);

  useEffect(() => {
    if (!isMcp) return;
    api
      .getMcpEnvVars(preset.id)
      .then(setMcpEnvVars)
      .catch(() => {});
  }, [preset.id, isMcp]);

  const loadMcpPreview = async (targetKind: DeployTargetKind) => {
    try {
      const preview = await api.mergePreviewMcp(
        preset.id,
        targetKind,
        targetKind === "project" ? selectedProject : undefined,
      );
      setMcpPreview(preview);
      return preview;
    } catch (e) {
      toast.error(String(e));
      return null;
    }
  };

  const deployWithTarget = async (
    targetKind: DeployTargetKind,
    opts?: { skipMcpConfirm?: boolean },
  ) => {
    if (isMcp && !opts?.skipMcpConfirm) {
      const preview = await loadMcpPreview(targetKind);
      if (preview?.keyExists) {
        const ok = window.confirm(
          `MCP server "${preview.serverKey}" already exists. Overwrite?`,
        );
        if (!ok) return;
      }
    }

    setDeploying(true);
    try {
      const result = await api.deployPresetWithTarget(
        preset.id,
        targetKind,
        targetKind === "project" ? selectedProject : undefined,
        targetKind === "plugin_local" ? pluginName : undefined,
      );
      toast.success(`Deployed ${result.deployedFiles.length} files`);
      if (isPlugin) {
        toast.info("Restart Cursor or run Developer: Reload Window to activate the plugin.");
      }
      onDeployed?.();
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Deploy {preset.name}</h3>
          <button type="button" onClick={onClose} className="text-[var(--color-text-muted)]">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          {canDeployProject && (
            <div>
              <label className="block text-sm font-medium mb-1.5">This project</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm mb-2"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.path}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Button
                className="w-full gap-2"
                onClick={() => deployWithTarget("project")}
                disabled={deploying || projects.length === 0}
              >
                <Rocket size={14} />
                Deploy to project
              </Button>
            </div>
          )}

          {canDeployGlobalSkill && (
            <GlobalDeploySection
              label="All projects (cursebook skills)"
              description="Writes to ~/.cursor/skills/cursebook/"
              deploying={deploying}
              onDeploy={() => deployWithTarget("user_cursebook")}
            />
          )}

          {canDeployGlobalAgents && (
            <GlobalDeploySection
              label="User subagents (cursebook)"
              description="Writes to ~/.cursor/agents/cursebook/"
              deploying={deploying}
              onDeploy={() => deployWithTarget("user_agents")}
            />
          )}

          {canDeployGlobalHooks && (
            <GlobalDeploySection
              label="User hooks"
              description="Writes to ~/.cursor/hooks.json and ~/.cursor/hooks/"
              deploying={deploying}
              onDeploy={() => deployWithTarget("user_hooks")}
            />
          )}

          {canDeployGlobalMcp && (
            <div>
              <GlobalDeploySection
                label="User MCP config"
                description="Merges into ~/.cursor/mcp.json"
                deploying={deploying}
                onDeploy={() => deployWithTarget("user_mcp")}
              />
              {mcpEnvVars.length > 0 && (
                <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                  <p className="font-medium mb-1">Required environment variables:</p>
                  <ul className="list-disc list-inside">
                    {mcpEnvVars.map((v) => (
                      <li key={v}>
                        <code>{v}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {mcpPreview?.keyExists && (
                <p className="mt-2 text-xs text-amber-400 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  Server &quot;{mcpPreview.serverKey}&quot; already exists in target config
                </p>
              )}
            </div>
          )}

          {isPlugin && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Install plugin</label>
              <input
                type="text"
                value={pluginName}
                onChange={(e) => setPluginName(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm mb-2"
                placeholder="plugin-name"
              />
              <p className="text-xs text-[var(--color-text-muted)] mb-2">
                Installs to ~/.cursor/plugins/local/{pluginName || "…"}/
              </p>
              <Button
                className="w-full gap-2"
                onClick={() => deployWithTarget("plugin_local")}
                disabled={deploying || !pluginName.trim()}
              >
                <Rocket size={14} />
                Install plugin
              </Button>
            </div>
          )}

          {!isPlugin && artifactType !== "rule" && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Install as plugin</label>
              <input
                type="text"
                value={pluginName}
                onChange={(e) => setPluginName(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm mb-2"
              />
              <Button
                variant="secondary"
                className="w-full gap-2"
                onClick={() => deployWithTarget("plugin_local")}
                disabled={deploying || !pluginName.trim()}
              >
                <Rocket size={14} />
                Install to plugins/local
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function GlobalDeploySection({
  label,
  description,
  deploying,
  onDeploy,
}: {
  label: string;
  description: string;
  deploying: boolean;
  onDeploy: () => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <p className="text-xs text-[var(--color-text-muted)] mb-2">{description}</p>
      <Button
        variant="secondary"
        className="w-full gap-2"
        onClick={onDeploy}
        disabled={deploying}
      >
        <Rocket size={14} />
        Deploy globally
      </Button>
    </div>
  );
}
