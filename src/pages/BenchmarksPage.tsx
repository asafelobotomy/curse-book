import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { api } from "../lib/api";
import type { BenchmarkRun, Preset } from "../lib/types";
import { Button, Card } from "../components/ui";

export function BenchmarksPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    Promise.all([api.listPresets(), api.listBenchmarks()])
      .then(([p, r]) => {
        setPresets(p);
        setRuns(r);
        if (p.length > 0) setSelectedPreset(p[0].id);
      })
      .catch((e) => toast.error(String(e)));
  }, []);

  const runBenchmark = async () => {
    if (!selectedPreset) return;
    setRunning(true);
    try {
      const run = await api.runBenchmark(selectedPreset);
      const all = await api.listBenchmarks();
      setRuns(all);
      toast.success(
        `Benchmark complete: ~${run.tokenEstimate} tokens, ${run.globMatchCount} glob matches`,
      );
    } catch (e) {
      toast.error(String(e));
    } finally {
      setRunning(false);
    }
  };

  const chartData = useMemo(() => {
    const byPreset = new Map<string, BenchmarkRun[]>();
    for (const run of runs) {
      const list = byPreset.get(run.presetName) ?? [];
      list.push(run);
      byPreset.set(run.presetName, list);
    }
    return Array.from(byPreset.entries()).map(([name, presetRuns]) => ({
      name: name.slice(0, 20),
      tokens: presetRuns[presetRuns.length - 1]?.tokenEstimate ?? 0,
      lines: presetRuns[presetRuns.length - 1]?.lineCount ?? 0,
      globs: presetRuns[presetRuns.length - 1]?.globMatchCount ?? 0,
    }));
  }, [runs]);

  const trendData = useMemo(() => {
    return runs
      .slice()
      .reverse()
      .map((r, i) => ({
        index: i + 1,
        tokens: r.tokenEstimate,
        name: r.presetName.slice(0, 15),
      }));
  }, [runs]);

  return (
    <div className="p-6 max-w-5xl">
      <header className="mb-6">
        <h2 className="text-2xl font-bold">Benchmark Lab</h2>
        <p className="text-[var(--color-text-muted)] mt-1">
          Measure token footprint and trigger precision for your presets
        </p>
      </header>

      <Card className="mb-6 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1.5">Preset</label>
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
        <Button onClick={runBenchmark} disabled={running || !selectedPreset}>
          {running ? "Running..." : "Run benchmark"}
        </Button>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <h3 className="font-semibold mb-4">Token footprint by preset</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fill: "#9aa0b0", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9aa0b0", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#1a1d27",
                    border: "1px solid #2e3345",
                  }}
                />
                <Bar dataKey="tokens" fill="#7c6af7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">
              Run a benchmark to see results
            </p>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold mb-4">Benchmark history</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid stroke="#2e3345" />
                <XAxis dataKey="index" tick={{ fill: "#9aa0b0", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9aa0b0", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#1a1d27",
                    border: "1px solid #2e3345",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="tokens"
                  stroke="#7c6af7"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No history yet</p>
          )}
        </Card>
      </div>

      {runs.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-3">Recent runs</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                  <th className="pb-2 pr-4">Preset</th>
                  <th className="pb-2 pr-4">Tokens</th>
                  <th className="pb-2 pr-4">Lines</th>
                  <th className="pb-2 pr-4">Glob matches</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 10).map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--color-border)]/50"
                  >
                    <td className="py-2 pr-4">{r.presetName}</td>
                    <td className="py-2 pr-4 font-mono">{r.tokenEstimate}</td>
                    <td className="py-2 pr-4 font-mono">{r.lineCount}</td>
                    <td className="py-2 pr-4 font-mono">{r.globMatchCount}</td>
                    <td className="py-2 text-[var(--color-text-muted)]">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
