import { toast } from "sonner";

export async function copyUserRuleText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
  toast.success("Copied for Cursor User Rules — paste in Settings → Rules");
}

export async function copyToClipboard(text: string, successMessage: string): Promise<void> {
  await navigator.clipboard.writeText(text);
  toast.success(successMessage);
}
