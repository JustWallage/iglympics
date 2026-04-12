import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full bg-[var(--color-bg-input)] text-[var(--color-text)] border-2 border-[var(--color-border)] px-3 py-2 text-sm font-body rounded-md",
        "placeholder:text-[var(--color-text-muted)]",
        "focus:border-[var(--color-neon-cyan)] focus:outline-none focus:shadow-[var(--shadow-brutal-cyan)]",
        "transition-all",
        className,
      )}
      {...props}
    />
  );
}
