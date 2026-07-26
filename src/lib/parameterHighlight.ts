/**
 * Derive line numbers in compiled output that differ from the default-parameter baseline.
 */
export function diffHighlightLines(baseline: string, current: string): number[] {
  const baseLines = baseline.split("\n");
  const currLines = current.split("\n");
  const lines = new Set<number>();

  const maxLen = Math.max(baseLines.length, currLines.length);
  for (let i = 0; i < maxLen; i++) {
    const base = baseLines[i] ?? "";
    const curr = currLines[i] ?? "";
    if (base !== curr && curr.trim().length > 0) {
      lines.add(i + 1);
    }
  }

  return Array.from(lines).sort((a, b) => a - b);
}

export function parseFilterTerms(input: string): string[] {
  return input
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}
