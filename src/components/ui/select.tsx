import { cn } from "@/lib/utils";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "w-full bg-[var(--color-bg-input)] text-[var(--color-text)] border-2 border-[var(--color-border)] px-3 py-2 text-sm font-body rounded-md",
        "focus:border-[var(--color-neon-cyan)] focus:outline-none focus:shadow-[var(--shadow-brutal-cyan)]",
        "transition-all",
        className,
      )}
      {...props}
    />
  );
}
