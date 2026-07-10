import { lazy, Suspense, useEffect, useRef } from "react";
import type { OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import {
  buildHighlightDecorations,
  buildTermDecorations,
  mergeDecorations,
} from "../../lib/highlight";

const Editor = lazy(() => import("@monaco-editor/react"));

interface MonacoPreviewProps {
  content: string;
  searchTerms?: string[];
  highlights?: string[];
  highlightHandlebars?: boolean;
  wordWrap?: boolean;
  language?: string;
}

function applyDecorations(
  instance: editor.IStandaloneCodeEditor,
  content: string,
  searchTerms: string[],
  highlights: string[],
  highlightHandlebars: boolean,
  collectionRef: React.MutableRefObject<editor.IEditorDecorationsCollection | null>,
) {
  const decorations = mergeDecorations(
    buildTermDecorations(content, highlights),
    buildHighlightDecorations(content, searchTerms, { highlightHandlebars }),
  );
  collectionRef.current?.clear();
  collectionRef.current = instance.createDecorationsCollection(decorations);
}

export function MonacoPreview({
  content,
  searchTerms = [],
  highlights = [],
  highlightHandlebars = false,
  wordWrap = true,
  language = "markdown",
}: MonacoPreviewProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);

  useEffect(() => {
    const instance = editorRef.current;
    if (!instance) return;
    applyDecorations(
      instance,
      content,
      searchTerms,
      highlights,
      highlightHandlebars,
      decorationsRef,
    );
  }, [content, searchTerms, highlights, highlightHandlebars]);

  const handleMount: OnMount = (instance) => {
    editorRef.current = instance;
    applyDecorations(
      instance,
      content,
      searchTerms,
      highlights,
      highlightHandlebars,
      decorationsRef,
    );
  };

  return (
    <Suspense
      fallback={
        <div className="h-full min-h-[320px] flex items-center justify-center text-sm text-[var(--color-text-muted)] rounded-lg border border-[var(--color-border)]">
          Loading preview...
        </div>
      }
    >
      <Editor
        height="100%"
        language={language}
        value={content}
        theme="vs-dark"
        onMount={handleMount}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: wordWrap ? "on" : "off",
          fontSize: 13,
          fontFamily: "JetBrains Mono, Fira Code, monospace",
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        }}
        className="monaco-preview min-h-[320px] rounded-lg border border-[var(--color-border)] overflow-hidden"
      />
    </Suspense>
  );
}
