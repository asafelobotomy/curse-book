import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Badge } from "../ui";

interface SyncBadgeProps {
  projectPath: string;
  className?: string;
}

export function SyncBadge({ projectPath, className }: SyncBadgeProps) {
  const [inSync, setInSync] = useState<boolean | null>(null);
  const [driftCount, setDriftCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .checkSyncStatus(projectPath)
      .then((status) => {
        if (!cancelled) {
          setInSync(status.inSync);
          setDriftCount(status.driftedFiles.length);
        }
      })
      .catch(() => {
        if (!cancelled) setInSync(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectPath]);

  if (inSync === null) {
    return (
      <Badge className={className}>Sync unknown</Badge>
    );
  }

  if (inSync) {
    return (
      <Badge
        className={`bg-[var(--color-success)]/20 text-[var(--color-success)] ${className ?? ""}`}
      >
        In sync
      </Badge>
    );
  }

  return (
    <Badge
      className={`bg-[var(--color-warning)]/20 text-[var(--color-warning)] ${className ?? ""}`}
    >
      Drifted ({driftCount})
    </Badge>
  );
}

export function GlobalSyncBadge({ className }: { className?: string }) {
  const [inSync, setInSync] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .checkGlobalSyncStatus()
      .then((status) => {
        if (!cancelled) setInSync(status.inSync);
      })
      .catch(() => {
        if (!cancelled) setInSync(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (inSync === null) return null;

  return (
    <Badge
      className={
        inSync
          ? `bg-[var(--color-success)]/20 text-[var(--color-success)] ${className ?? ""}`
          : `bg-[var(--color-warning)]/20 text-[var(--color-warning)] ${className ?? ""}`
      }
    >
      {inSync ? "Global deploys in sync" : "Global deploys drifted"}
    </Badge>
  );
}
