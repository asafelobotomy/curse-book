import { LayoutGrid, FolderOpen, Pencil, FlaskConical, Sparkles, Package, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils";

const links = [
  { to: "/", icon: LayoutGrid, label: "Catalog" },
  { to: "/presets", icon: Pencil, label: "Presets" },
  { to: "/projects", icon: FolderOpen, label: "Projects" },
  { to: "/benchmarks", icon: FlaskConical, label: "Benchmarks" },
  { to: "/ai", icon: Sparkles, label: "Local AI" },
  { to: "/packs", icon: Package, label: "Packs" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface-raised)] flex flex-col">
      <div className="p-4 border-b border-[var(--color-border)]">
        <h1 className="text-lg font-bold tracking-tight">Curse Book</h1>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          Cursor rules studio
        </p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-[var(--color-accent)]/20 text-[var(--color-accent-hover)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text)]",
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
