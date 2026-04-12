import { cn } from "../../lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const variantStyles: Record<string, string> = {
  primary:
    "bg-accent hover:bg-accent-light text-white shadow-[0_0_20px_var(--color-accent-glow)]",
  secondary:
    "bg-white/[0.06] hover:bg-white/[0.1] text-white/80 border border-white/[0.1]",
  ghost: "bg-transparent hover:bg-white/[0.06] text-white/60 hover:text-white/80",
  danger:
    "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/20",
};

const sizeStyles: Record<string, string> = {
  sm: "h-10 px-4 text-sm rounded-xl",
  md: "h-12 px-5 text-sm rounded-xl",
  lg: "h-14 px-6 text-base rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.97]",
        variantStyles[variant],
        sizeStyles[size],
        disabled && "opacity-40 pointer-events-none",
        className,
      )}
      disabled={disabled}
      {...props}
    />
  );
}
