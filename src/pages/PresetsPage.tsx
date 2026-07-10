import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { api } from "../lib/api";
import type { Preset } from "../lib/types";
import { artifactBadge, formatDate } from "../lib/utils";
import { Badge, Button, Card } from "../components/ui";

export function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api
      .listPresets()
      .then(setPresets)
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string) => {
    try {
      await api.deletePreset(id);
      toast.success("Preset deleted");
      load();
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      <header className="mb-6">
        <h2 className="text-2xl font-bold">My Presets</h2>
        <p className="text-[var(--color-text-muted)] mt-1">
          Customized rules and skills ready to deploy
        </p>
      </header>

      {loading ? (
        <p className="text-[var(--color-text-muted)]">Loading...</p>
      ) : presets.length === 0 ? (
        <Card>
          <p className="text-[var(--color-text-muted)]">
            No presets yet. Browse the{" "}
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
                    to={`/presets/${preset.id}`}
                    className="font-semibold hover:text-[var(--color-accent)]"
                  >
                    {preset.name}
                  </Link>
                  <Badge>{artifactBadge(preset.artifactType)}</Badge>
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Updated {formatDate(preset.updatedAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <Link to={`/presets/${preset.id}`}>
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
    </div>
  );
}
