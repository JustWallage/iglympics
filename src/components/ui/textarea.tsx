import { cn } from "../../lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/90 resize-none",
        "placeholder:text-white/30 outline-none transition-all duration-150",
        "focus:border-accent/50 focus:ring-1 focus:ring-accent/30",
        "backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}
