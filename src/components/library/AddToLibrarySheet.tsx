import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Rocket, Pencil, FolderPlus, Plus } from "lucide-react";
import type { Preset } from "../../lib/types";
import { Button, Card } from "../ui";

interface AddToLibrarySheetProps {
  preset: Preset;
  onClose: () => void;
  onDeployProject: () => void;
  onDeployGlobal?: () => void;
  onAssign: () => void;
  onAddAnother: () => void;
}

export function AddToLibrarySheet({
  preset,
  onClose,
  onDeployProject,
  onDeployGlobal,
  onAssign,
  onAddAnother,
}: AddToLibrarySheetProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const isSkill = preset.artifactType === "skill";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-1">Added to library</h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          <strong>{preset.name}</strong> is saved. What next?
        </p>

        <div className="space-y-2">
          <Link to={`/library/${preset.id}`} className="block">
            <Button variant="secondary" className="w-full justify-start gap-2">
              <Pencil size={14} />
              Edit parameters
            </Button>
          </Link>

          <Button
            className="w-full justify-start gap-2"
            onClick={onDeployProject}
          >
            <Rocket size={14} />
            Deploy to project
          </Button>

          {isSkill && onDeployGlobal && (
            <Button
              variant="secondary"
              className="w-full justify-start gap-2"
              onClick={onDeployGlobal}
            >
              <Rocket size={14} />
              Deploy to all projects (cursebook)
            </Button>
          )}

          <Button
            variant="secondary"
            className="w-full justify-start gap-2"
            onClick={onAssign}
          >
            <FolderPlus size={14} />
            Assign to project
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={onAddAnother}
          >
            <Plus size={14} />
            Add another from catalog
          </Button>
        </div>

        <p className="text-xs text-[var(--color-text-muted)] mt-4">
          {isSkill
            ? "Global cursebook deploy is local to this machine only — not synced via Cursor account."
            : "Rules deploy to project .cursor/rules/ or copy text for Cursor User Rules."}
        </p>
      </Card>
    </div>
  );
}
