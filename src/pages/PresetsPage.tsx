import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Trash2, Rocket } from "lucide-react";
import { api } from "../lib/api";
import type { Preset } from "../lib/types";
import { artifactBadge, formatDate } from "../lib/utils";
import { DeploySheet } from "../components/library/DeploySheet";
import { GlobalSyncBadge } from "../components/projects/SyncBadge";
import { Badge, Button, Card } from "../components/ui";

export function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});
  const [deployPreset, setDeployPreset] = useState<Preset | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const p = await api.listPresets();
    setPresets(p);
    const counts: Record<string, number> = {};
    await Promise.all(
      p.map(async (preset) => {
        const projects = await api.listProjectsForPreset(preset.id);
        counts[preset.id] = projects.length;
      }),
    );
    setProjectCounts(counts);
  };

  useEffect(() => {
    load()
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const remove = async (id: string) => {
    try {
      await api.deletePreset(id);
      toast.success("Removed from library");
      load();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const hasSkills = presets.some((p) => p.artifactType === "skill");

  return (
    <div className="p-6 max-w-4xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Library</h2>
          <p className="text-[var(--color-text-muted)] mt-1">
            Your saved rules and skills, ready to deploy
          </p>
        </div>
        {hasSkills && <GlobalSyncBadge />}
      </header>

      {loading ? (
        <p className="text-[var(--color-text-muted)]">Loading...</p>
      ) : presets.length === 0 ? (
        <Card>
          <p className="text-[var(--color-text-muted)]">
            No items in your library yet. Browse the{" "}
            <Link to="/" className="text-[var(--color-accent)] hover:underline">
              catalog
            </Link>{" "}
            to get started.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {presets.map((preset) => (
            <Card key={preset.id} className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Link
                    to={`/library/${preset.id}`}
                    className="font-semibold hover:text-[var(--color-accent)]"
                  >
                    {preset.name}
                  </Link>
                  <Badge>{artifactBadge(preset.artifactType)}</Badge>
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Updated {formatDate(preset.updatedAt)}
                  {projectCounts[preset.id] !== undefined && (
                    <> · Used in {projectCounts[preset.id]} project(s)</>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDeployPreset(preset)}
                  title="Deploy to project or cursebook"
                >
                  <Rocket size={14} />
                </Button>
                <Link to={`/library/${preset.id}`}>
                  <Button variant="secondary" size="sm">
                    Edit
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(preset.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {deployPreset && (
        <DeploySheet
          preset={deployPreset}
          onClose={() => setDeployPreset(null)}
        />
      )}
    </div>
  );
}
