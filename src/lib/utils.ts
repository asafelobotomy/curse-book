import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

export function formatRelativeDate(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function artifactBadge(type: string): string {
  switch (type) {
    case "skill":
      return "Skill";
    case "rule":
      return "Rule";
    case "subagent":
      return "Subagent";
    case "hook":
      return "Hook";
    case "mcp":
      return "MCP";
    case "plugin":
      return "Plugin";
    default: {
      const _unknown: string = type;
      return _unknown;
    }
  }
}

export function artifactBadgeClass(type: string): string {
  switch (type) {
    case "rule":
      return "bg-[var(--color-accent)]/20 text-[var(--color-accent-hover)]";
    case "skill":
      return "bg-teal-500/20 text-teal-300";
    case "subagent":
      return "bg-violet-500/20 text-violet-300";
    case "hook":
      return "bg-amber-500/20 text-amber-300";
    case "mcp":
      return "bg-sky-500/20 text-sky-300";
    case "plugin":
      return "bg-rose-500/20 text-rose-300";
    default:
      return "";
  }
}
