import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { useTheme } from "../components/ThemeProvider";
import { api } from "../lib/api";
import { copyToClipboard } from "../lib/cursorExport";
import type { CatalogSourceEntry, InstalledPlugin, PluginSource } from "../lib/types";
import { formatRelativeDate } from "../lib/utils";
import { Button, Card } from "../components/ui";

export function SettingsPage() {
  const { themeId, themes, setThemeId } = useTheme();
  const [mcpSnippet, setMcpSnippet] = useState("");
  const [scanRoots, setScanRoots] = useState<string[]>([]);
  const [rootsText, setRootsText] = useState("");
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [catalogSources, setCatalogSources] = useState<CatalogSourceEntry[]>([]);
  const [catalogPathsText, setCatalogPathsText] = useState("");
  const [catalogPaths, setCatalogPaths] = useState<string[]>([]);
  const [importMeta, setImportMeta] = useState<PluginSource[]>([]);

  useEffect(() => {
    api
      .getMcpConfigSnippet()
      .then(setMcpSnippet)
      .catch(() => {});
    api
      .getScanRoots()
      .then((roots) => {
        setScanRoots(roots);
        setRootsText(roots.join("\n"));
      })
      .catch(() => {});
    api
      .listInstalledPlugins()
      .then(setInstalledPlugins)
      .catch(() => {});
    api
      .listCatalogSources()
      .then(setCatalogSources)
      .catch(() => {});
    api
      .getCustomCatalogPaths()
      .then((paths) => {
        setCatalogPaths(paths);
        setCatalogPathsText(paths.join("\n"));
      })
      .catch(() => {});
    api
      .listCatalogImportMeta()
      .then(setImportMeta)
      .catch(() => {});
  }, []);

  const saveScanRoots = async () => {
    const roots = rootsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    try {
      await api.setScanRoots(roots);
      setScanRoots(roots);
      toast.success("Scan roots saved");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const saveCatalogPaths = async () => {
    const paths = catalogPathsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    try {
      const count = await api.setCustomCatalogPaths(paths);
      setCatalogPaths(paths);
      const meta = await api.listCatalogImportMeta();
      setImportMeta(meta);
      toast.success(`Catalog reloaded (${count} templates)`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const importMetaFor = (sourceId: string) =>
    importMeta.find((m) => m.id === sourceId);

  return (
    <div className="p-6 max-w-2xl">
      <header className="mb-6">
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-[var(--color-text-muted)] mt-1">
          Configuration and Cursor integration
        </p>
      </header>

      <Card className="mb-4">
        <h3 className="font-semibold mb-2">Appearance</h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Choose a color theme for the application.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {themes.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => setThemeId(theme.id)}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                themeId === theme.id
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                  : "border-[var(--color-border)] hover:border-[var(--color-accent)]/50"
              }`}
            >
              <span className="flex gap-1 shrink-0">
                {Object.values(theme.colors)
                  .slice(0, 4)
                  .map((color, i) => (
                    <span
                      key={`${theme.id}-${i}`}
                      className="w-4 h-4 rounded-full border border-black/20"
                      style={{ backgroundColor: color }}
                    />
                  ))}
              </span>
              <span className="text-sm font-medium">{theme.label}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <h3 className="font-semibold mb-2">Cursor integration</h3>
        <div className="text-sm text-[var(--color-text-muted)] space-y-3">
          <p>
            <strong className="text-[var(--color-text)]">Project deploy</strong>{" "}
            writes to <code className="font-mono">.cursor/</code> in your repo.
            Use Stage &amp; commit / Ship on the Projects page so teammates get
            rules via git.
          </p>
          <p>
            <strong className="text-[var(--color-text)]">Subagents</strong> deploy
            to <code className="font-mono">.cursor/agents/</code> (project) or{" "}
            <code className="font-mono">~/.cursor/agents/cursebook/</code> (global).
          </p>
          <p>
            <strong className="text-[var(--color-text)]">Hooks</strong> write{" "}
            <code className="font-mono">hooks.json</code> plus scripts under{" "}
            <code className="font-mono">.cursor/hooks/</code> (project) or{" "}
            <code className="font-mono">~/.cursor/hooks/</code> (user). Command
            paths are normalized per target.
          </p>
          <p>
            <strong className="text-[var(--color-text)]">MCP configs</strong> merge
            into <code className="font-mono">.cursor/mcp.json</code> or{" "}
            <code className="font-mono">~/.cursor/mcp.json</code>. Set env vars
            (e.g. <code className="font-mono">GITHUB_TOKEN</code>) in your shell
            before using stdio servers — no OAuth or API keys are stored by Curse
            Book.
          </p>
          <p>
            <strong className="text-[var(--color-text)]">Plugins</strong> install to{" "}
            <code className="font-mono">~/.cursor/plugins/local/</code>. Reload
            Cursor after install. Never write to{" "}
            <code className="font-mono">plugins/cache/</code> (Cursor-managed).
          </p>
          <p>
            <strong className="text-[var(--color-text)]">Cursebook skills</strong>{" "}
            deploy to{" "}
            <code className="font-mono">~/.cursor/skills/cursebook/</code> on
            this machine only — not synced via your Cursor account. Use dotfiles
            or rsync to copy between machines.
          </p>
          <p>
            <strong className="text-[var(--color-text)]">User Rules</strong> are
            account-synced in Cursor Settings. Use &quot;Copy for User Rules&quot;
            in the library editor, then paste manually in Cursor → Customize →
            Rules. There is no API to push rules automatically.
          </p>
          <p>
            Do not deploy to{" "}
            <code className="font-mono">~/.cursor/skills-cursor/</code> — that
            directory is managed by Cursor for built-in skills.
          </p>
        </div>
      </Card>

      <Card className="mb-4">
        <h3 className="font-semibold mb-2">Installed plugins</h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-3">
          Plugins installed via Curse Book to{" "}
          <code className="font-mono">~/.cursor/plugins/local/</code>
        </p>
        {installedPlugins.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No plugins installed yet.</p>
        ) : (
          <ul className="space-y-2">
            {installedPlugins.map((plugin) => (
              <li
                key={plugin.id}
                className="flex items-center justify-between gap-2 text-sm border border-[var(--color-border)] rounded-lg px-3 py-2"
              >
                <div>
                  <span className="font-medium">{plugin.name}</span>
                  <p className="text-xs text-[var(--color-text-muted)] font-mono truncate">
                    {plugin.path}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      await api.uninstallPlugin(plugin.name);
                      setInstalledPlugins((prev) =>
                        prev.filter((p) => p.id !== plugin.id),
                      );
                      toast.success(`Uninstalled ${plugin.name}`);
                    } catch (e) {
                      toast.error(String(e));
                    }
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-[var(--color-text-muted)] mt-3">
          Refresh imports:{" "}
          <code className="font-mono">node scripts/validate-sources-registry.mjs</code>
          {" · "}
          <code className="font-mono">node scripts/import-awesome-cursorrules.mjs</code>
          {" · "}
          <code className="font-mono">node scripts/import-cursor-plugins.mjs</code>
        </p>
      </Card>

      <Card className="mb-4">
        <h3 className="font-semibold mb-2">Curated catalog sources</h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-3">
          Shipped registry requires ≥1,000 GitHub stars. See{" "}
          <code className="font-mono">docs/curated-sources.md</code> for policy and BYO guide.
        </p>
        {catalogSources.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Loading sources…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                  <th className="py-2 pr-3 font-medium">ID</th>
                  <th className="py-2 pr-3 font-medium">Repository</th>
                  <th className="py-2 pr-3 font-medium">Stars</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Last import</th>
                </tr>
              </thead>
              <tbody>
                {catalogSources.map((src) => {
                  const meta = importMetaFor(src.id);
                  return (
                  <tr key={src.id} className="border-b border-[var(--color-border)]/60">
                    <td className="py-2 pr-3 font-mono text-xs">{src.id}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{src.repo}</td>
                    <td className="py-2 pr-3">
                      {src.starsAtReview?.toLocaleString() ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {src.referenceOnly ? (
                        <span>
                          Reference only
                          {src.referenceUrl && (
                            <>
                              {" · "}
                              <a
                                href={src.referenceUrl}
                                className="text-[var(--color-accent)] hover:underline"
                                target="_blank"
                                rel="noreferrer"
                              >
                                {src.referenceUrl}
                              </a>
                            </>
                          )}
                        </span>
                      ) : src.shipped ? (
                        "Bulk import"
                      ) : (
                        "—"
                      )}
                      {src.notes && (
                        <p className="text-[var(--color-text-muted)] mt-1 max-w-xs">
                          {src.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-2 text-xs">
                      {meta ? (
                        <div className="space-y-0.5">
                          <p>{formatRelativeDate(meta.importedAt)}</p>
                          <p className="text-[var(--color-text-muted)] font-mono">
                            {meta.commitSha?.slice(0, 8) ?? "—"}
                            {" · "}
                            {meta.pluginCount} item{meta.pluginCount === 1 ? "" : "s"}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">Not imported yet</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-[var(--color-text-muted)] mt-3">
          Skills ecosystem (not mirrored):{" "}
          <a
            href="https://skills.sh"
            className="text-[var(--color-accent)] hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            skills.sh
          </a>{" "}
          / <code className="font-mono">npx skills</code>
        </p>
      </Card>

      <Card className="mb-4">
        <h3 className="font-semibold mb-2">Custom catalog paths</h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-3">
          One directory per line. JSON templates here merge with the built-in catalog when
          you save (BYO sources — not curated or auto-updated).
        </p>
        <textarea
          value={catalogPathsText}
          onChange={(e) => setCatalogPathsText(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-mono mb-2"
          placeholder="~/.curse/catalog"
        />
        <Button size="sm" onClick={saveCatalogPaths}>
          Save &amp; reload catalog
        </Button>
        {catalogPaths.length > 0 && (
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            Active: {catalogPaths.join(", ")}
          </p>
        )}
      </Card>

      <Card className="mb-4">
        <h3 className="font-semibold mb-2">Project scan roots</h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-3">
          One directory per line. Projects page Scan searches these paths for
          repos.
        </p>
        <textarea
          value={rootsText}
          onChange={(e) => setRootsText(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-mono mb-2"
          placeholder="~/Documents/git&#10;~/Projects"
        />
        <Button size="sm" onClick={saveScanRoots}>
          Save scan roots
        </Button>
        {scanRoots.length > 0 && (
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            Active: {scanRoots.join(", ")}
          </p>
        )}
      </Card>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">MCP Bridge</h3>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              copyToClipboard(mcpSnippet, "MCP config copied to clipboard")
            }
          >
            <Copy size={14} />
            Copy
          </Button>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mb-3">
          Add the curse-book MCP server to Cursor (manifest sync only — no CLI
          required):
        </p>
        <pre className="text-xs font-mono p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] overflow-auto">
          {mcpSnippet || "Loading..."}
        </pre>
      </Card>

      <Card>
        <h3 className="font-semibold mb-2">Data location</h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          Your library and benchmarks are stored in{" "}
          <code className="font-mono">~/.local/share/curse-book/curse-book.db</code>
        </p>
      </Card>
    </div>
  );
}
