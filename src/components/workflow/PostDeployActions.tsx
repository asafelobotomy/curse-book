import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, GitCommit, Upload, Package } from "lucide-react";
import { api } from "../../lib/api";
import type { GitResultPayload } from "../../lib/types";
import { Button } from "../ui";

interface PostDeployActionsProps {
  projectPath: string;
}

export function PostDeployActions({ projectPath }: PostDeployActionsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<GitResultPayload | null>(null);

  const run = async (action: string, fn: () => Promise<GitResultPayload | string[] | void>) => {
    setBusy(action);
    try {
      const result = await fn();
      if (result && typeof result === "object" && "message" in result) {
        setLastResult(result as GitResultPayload);
        const sha = (result as GitResultPayload).commitSha;
        toast.success(sha ? `${result.message} · ${sha}` : result.message);
      } else if (Array.isArray(result)) {
        toast.success(`Staged ${result.length} files`);
      } else {
        toast.success("Done");
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!!busy}
          title="Stages .cursor/ and .curse/, commits on current branch"
          onClick={() =>
            run("commit", async () => {
              await api.gitStageProject(projectPath);
              return api.gitCommitProject(projectPath);
            })
          }
        >
          <GitCommit size={14} />
          {busy === "commit" ? "Committing..." : "Stage & commit"}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          disabled={!!busy}
          title="Opens project in Cursor IDE"
          onClick={() => run("open", () => api.openInCursor(projectPath))}
        >
          <ExternalLink size={14} />
          {busy === "open" ? "Opening..." : "Open in Cursor"}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          disabled={!!busy}
          title="Pushes current branch — shares rules via git"
          onClick={() => {
            if (!window.confirm("Push current branch to remote?")) return;
            run("push", () => api.gitPushProject(projectPath));
          }}
        >
          <Upload size={14} />
          {busy === "push" ? "Pushing..." : "Push"}
        </Button>

        <Button
          size="sm"
          disabled={!!busy}
          title="Stage, commit, and push in one step"
          onClick={() => {
            if (!window.confirm("Stage, commit, and push .cursor/ changes?")) return;
            run("ship", () => api.gitShipProject(projectPath, undefined, true));
          }}
        >
          <Package size={14} />
          {busy === "ship" ? "Shipping..." : "Ship"}
        </Button>
      </div>

      {lastResult?.commitSha && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Committed {lastResult.commitSha}
          {lastResult.stagedFiles.length > 0 &&
            ` · ${lastResult.stagedFiles.length} files`}
        </p>
      )}
    </div>
  );
}
