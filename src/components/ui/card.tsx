import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "cyan" | "green" | "yellow";
}

export function Card({
  className,
  variant = "default",
  ...props
}: CardProps) {
  const shadowMap = {
    default: "shadow-[var(--shadow-brutal)]",
    cyan: "shadow-[var(--shadow-brutal-cyan)]",
    green: "shadow-[var(--shadow-brutal-green)]",
    yellow: "shadow-[var(--shadow-brutal-yellow)]",
  };

  return (
    <div
      className={cn(
        "bg-[var(--color-bg-card)] border-2 border-[var(--color-border-bright)] p-4 sm:p-6 rounded-lg",
        shadowMap[variant],
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "font-heading text-xs sm:text-sm text-[var(--color-text-heading)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("", className)} {...props} />;
}
