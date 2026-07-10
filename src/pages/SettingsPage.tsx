import { Card } from "../components/ui";

export function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl">
      <header className="mb-6">
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-[var(--color-text-muted)] mt-1">
          Configuration and MCP bridge setup
        </p>
      </header>

      <Card className="mb-4">
        <h3 className="font-semibold mb-2">MCP Bridge</h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-3">
          Add the curse-book MCP server to Cursor to deploy presets from chat:
        </p>
        <pre className="text-xs font-mono p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] overflow-auto">
{`{
  "mcpServers": {
    "curse-book": {
      "command": "node",
      "args": ["/path/to/curse_book/mcp/dist/index.js"],
      "env": {
        "CURSE_BOOK_DATA": "~/.local/share/curse-book"
      }
    }
  }
}`}
        </pre>
      </Card>

      <Card>
        <h3 className="font-semibold mb-2">Data location</h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          Presets and benchmarks are stored in{" "}
          <code className="font-mono">~/.local/share/curse-book/curse-book.db</code>
        </p>
      </Card>
    </div>
  );
}
