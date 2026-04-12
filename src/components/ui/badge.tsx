import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "pink" | "green" | "cyan" | "yellow" | "muted";
}

export function Badge({
  className,
  variant = "muted",
  ...props
}: BadgeProps) {
  const variants = {
    pink: "border-[var(--color-neon-pink)] text-[var(--color-neon-pink)]",
    green: "border-[var(--color-neon-green)] text-[var(--color-neon-green)]",
    cyan: "border-[var(--color-neon-cyan)] text-[var(--color-neon-cyan)]",
    yellow: "border-[var(--color-neon-yellow)] text-[var(--color-neon-yellow)]",
    muted: "border-[var(--color-border)] text-[var(--color-text-muted)]",
  };

  return (
    <span
      className={cn(
        "inline-block border-2 px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded-sm",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
