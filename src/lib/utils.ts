import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

export function artifactBadge(type: string): string {
  switch (type) {
    case "skill":
      return "Skill";
    case "rule":
      return "Rule";
    case "hook":
      return "Hook";
    default:
      return type;
  }
}
