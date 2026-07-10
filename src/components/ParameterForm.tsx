import type { ParameterField } from "../lib/types";

interface ParameterFormProps {
  fields: ParameterField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export function ParameterForm({ fields, values, onChange }: ParameterFormProps) {
  if (fields.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        No configurable parameters for this template.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {fields.map((field) => (
        <div key={field.key}>
          <label className="block text-sm font-medium mb-1.5">{field.label}</label>
          {field.description && (
            <p className="text-xs text-[var(--color-text-muted)] mb-2">
              {field.description}
            </p>
          )}
          {field.fieldType === "toggle" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(values[field.key] ?? field.default)}
                onChange={(e) => onChange(field.key, e.target.checked)}
                className="rounded accent-[var(--color-accent)]"
              />
              <span className="text-sm text-[var(--color-text-muted)]">
                {values[field.key] ? "Enabled" : "Disabled"}
              </span>
            </label>
          )}
          {field.fieldType === "slider" && (
            <div className="space-y-1">
              <input
                type="range"
                min={field.min ?? 0}
                max={field.max ?? 100}
                step={field.step ?? 1}
                value={Number(values[field.key] ?? field.default)}
                onChange={(e) => onChange(field.key, Number(e.target.value))}
                className="w-full accent-[var(--color-accent)]"
              />
              <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                <span>{field.min ?? 0}</span>
                <span className="font-mono text-[var(--color-accent)]">
                  {String(values[field.key] ?? field.default)}
                </span>
                <span>{field.max ?? 100}</span>
              </div>
            </div>
          )}
          {field.fieldType === "select" && (
            <select
              value={String(values[field.key] ?? field.default)}
              onChange={(e) => onChange(field.key, e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            >
              {(field.options ?? []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )}
          {(field.fieldType === "text" || field.fieldType === "globs") && (
            <input
              type="text"
              value={String(values[field.key] ?? field.default ?? "")}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.fieldType === "globs" ? "**/*.ts" : ""}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-mono"
            />
          )}
        </div>
      ))}
    </div>
  );
}
