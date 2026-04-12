import { cn } from "../../lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white/90",
        "placeholder:text-white/30 outline-none transition-all duration-150",
        "focus:border-accent/50 focus:ring-1 focus:ring-accent/30",
        "backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}
