import { useEffect, useState } from "react";
import { toast } from "sonner";
import { save, open } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/api";
import type { CursePackManifest, Preset } from "../lib/types";
import { Button, Card } from "../components/ui";

export function PacksPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [teamPath, setTeamPath] = useState("");
  const [teamPacks, setTeamPacks] = useState<string[]>([]);

  useEffect(() => {
    api.listPresets().then(setPresets).catch((e) => toast.error(String(e)));
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportPack = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one library item");
      return;
    }
    const path = await save({
      filters: [{ name: "Curse Pack", extensions: ["zip"] }],
      defaultPath: "my-curse-pack.zip",
    });
    if (!path) return;

    const meta: CursePackManifest = {
      id: "custom-pack",
      name: "Custom Pack",
      version: "1.0.0",
      description: "Exported from Curse Book",
      author: "user",
      templates: [],
    };

    try {
      await api.exportPack(Array.from(selected), path, meta);
      toast.success(`Exported to ${path}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const importPack = async () => {
    const path = await open({
      filters: [{ name: "Curse Pack", extensions: ["zip"] }],
    });
    if (!path || typeof path !== "string") return;

    try {
      const manifest = await api.importPack(path);
      toast.success(`Imported pack: ${manifest.name}`);
      const p = await api.listPresets();
      setPresets(p);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const initTeam = async () => {
    if (!teamPath.trim()) return;
    try {
      await api.initTeamLibrary(teamPath);
      toast.success("Team library initialized");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const listTeam = async () => {
    if (!teamPath.trim()) return;
    try {
      const packs = await api.listTeamPacks(teamPath);
      setTeamPacks(packs);
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <header className="mb-6">
        <h2 className="text-2xl font-bold">Library Packs</h2>
        <p className="text-[var(--color-text-muted)] mt-1">
          Export, import, and share .curse-pack bundles
        </p>
      </header>

      <Card className="mb-6">
        <h3 className="font-semibold mb-3">Export pack</h3>
        <div className="space-y-2 mb-4 max-h-48 overflow-auto">
          {presets.map((p) => (
            <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
                className="accent-[var(--color-accent)]"
              />
              {p.name}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={exportPack}>Export selected</Button>
          <Button variant="secondary" onClick={importPack}>
            Import pack
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">Team library (Git sync)</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={teamPath}
            onChange={(e) => setTeamPath(e.target.value)}
            placeholder="/path/to/team-library"
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-mono"
          />
          <Button variant="secondary" onClick={initTeam}>
            Init
          </Button>
          <Button variant="secondary" onClick={listTeam}>
            List packs
          </Button>
        </div>
        {teamPacks.length > 0 && (
          <ul className="text-sm space-y-1">
            {teamPacks.map((p) => (
              <li key={p} className="font-mono text-[var(--color-text-muted)]">
                {p}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
