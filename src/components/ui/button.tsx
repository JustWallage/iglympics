import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      "bg-[var(--color-neon-pink)] text-black font-bold border-2 border-[var(--color-border-bright)] shadow-[var(--shadow-brutal-sm)] hover:brightness-110 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    secondary:
      "bg-[var(--color-bg-elevated)] text-[var(--color-text)] border-2 border-[var(--color-border-bright)] shadow-[var(--shadow-brutal-sm)] hover:bg-[var(--color-border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    ghost:
      "bg-transparent text-[var(--color-text-muted)] border-2 border-transparent hover:border-[var(--color-border)] hover:text-[var(--color-text)]",
    danger:
      "bg-[var(--color-loss)] text-black font-bold border-2 border-[var(--color-border-bright)] shadow-[var(--shadow-brutal-sm)] hover:brightness-110 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  };

  const sizes = {
    sm: "px-2 py-1 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      className={cn(
        "font-body font-bold uppercase tracking-wider transition-all rounded-md disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:active:shadow-[var(--shadow-brutal-sm)]",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
