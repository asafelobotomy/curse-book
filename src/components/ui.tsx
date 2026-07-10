import { cn } from "../lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm",
        variant === "primary" &&
          "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white",
        variant === "secondary" &&
          "bg-[var(--color-surface-overlay)] hover:bg-[var(--color-border)] border border-[var(--color-border)]",
        variant === "ghost" && "hover:bg-[var(--color-surface-overlay)]",
        variant === "danger" &&
          "bg-[var(--color-danger)]/20 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/30",
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--color-accent)]/20 text-[var(--color-accent-hover)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
