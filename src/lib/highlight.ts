import type { editor } from "monaco-editor";

export interface HighlightDecoration {
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  options: editor.IModelDecorationOptions;
}

const SEARCH_STYLE: editor.IModelDecorationOptions = {
  className: "monaco-highlight-search",
  inlineClassName: "monaco-highlight-search-inline",
};

const TERM_STYLE: editor.IModelDecorationOptions = {
  className: "monaco-highlight-term",
  inlineClassName: "monaco-highlight-term-inline",
};

const HANDLEBARS_STYLE: editor.IModelDecorationOptions = {
  className: "monaco-highlight-handlebars",
  inlineClassName: "monaco-highlight-handlebars-inline",
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatches(
  content: string,
  pattern: RegExp,
): Array<{ start: number; end: number }> {
  const matches: Array<{ start: number; end: number }> = [];
  let match: RegExpExecArray | null;
  const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  while ((match = global.exec(content)) !== null) {
    matches.push({ start: match.index, end: match.index + match[0].length });
    if (match[0].length === 0) global.lastIndex++;
  }
  return matches;
}

function offsetToPosition(
  content: string,
  offset: number,
): { line: number; column: number } {
  const before = content.slice(0, offset);
  const lines = before.split("\n");
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

function matchToRange(content: string, start: number, end: number) {
  const startPos = offsetToPosition(content, start);
  const endPos = offsetToPosition(content, end);
  return {
    startLineNumber: startPos.line,
    startColumn: startPos.column,
    endLineNumber: endPos.line,
    endColumn: endPos.column,
  };
}

export function buildHighlightDecorations(
  content: string,
  terms: string[],
  options?: { highlightHandlebars?: boolean },
): HighlightDecoration[] {
  const decorations: HighlightDecoration[] = [];
  const seen = new Set<string>();

  for (const term of terms) {
    const trimmed = term.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());

    const pattern = new RegExp(`\\b${escapeRegex(trimmed)}\\b`, "gi");
    for (const m of findMatches(content, pattern)) {
      decorations.push({
        range: matchToRange(content, m.start, m.end),
        options: SEARCH_STYLE,
      });
    }
  }

  if (options?.highlightHandlebars) {
    const hb = /\{\{[^}]+\}\}/g;
    for (const m of findMatches(content, hb)) {
      decorations.push({
        range: matchToRange(content, m.start, m.end),
        options: HANDLEBARS_STYLE,
      });
    }
  }

  return decorations;
}

export function buildTermDecorations(
  content: string,
  highlights: string[],
): HighlightDecoration[] {
  const decorations: HighlightDecoration[] = [];

  for (const term of highlights) {
    const trimmed = term.trim();
    if (!trimmed) continue;
    const pattern = new RegExp(`\\b${escapeRegex(trimmed)}\\b`, "gi");
    for (const m of findMatches(content, pattern)) {
      decorations.push({
        range: matchToRange(content, m.start, m.end),
        options: TERM_STYLE,
      });
    }
  }

  return decorations;
}

const PARAM_DIFF_STYLE: editor.IModelDecorationOptions = {
  className: "monaco-highlight-param",
  inlineClassName: "monaco-highlight-param-inline",
  isWholeLine: true,
};

export function buildLineDecorations(
  lineNumbers: number[],
): HighlightDecoration[] {
  return lineNumbers.map((lineNumber) => ({
    range: {
      startLineNumber: lineNumber,
      startColumn: 1,
      endLineNumber: lineNumber,
      endColumn: 1,
    },
    options: PARAM_DIFF_STYLE,
  }));
}
export function mergeDecorations(
  ...groups: HighlightDecoration[][]
): HighlightDecoration[] {
  return groups.flat();
}
