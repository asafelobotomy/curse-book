import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownPreviewProps {
  content: string;
  raw?: boolean;
}

export function MarkdownPreview({ content, raw }: MarkdownPreviewProps) {
  if (raw) {
    return (
      <pre className="text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[60vh] p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
        {content}
      </pre>
    );
  }

  return (
    <div className="prose prose-invert prose-sm max-w-none overflow-auto max-h-[60vh] p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
