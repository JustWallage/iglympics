import { useState } from "react";
import { X, Send } from "lucide-react";

const BG_OPTIONS = [
  { name: "violet", class: "bg-violet-600" },
  { name: "sky", class: "bg-sky-500" },
  { name: "rose", class: "bg-rose-500" },
  { name: "amber", class: "bg-amber-500" },
  { name: "emerald", class: "bg-emerald-500" },
  { name: "fuchsia", class: "bg-fuchsia-500" },
  { name: "orange", class: "bg-orange-500" },
  { name: "cyan", class: "bg-cyan-500" },
];

const BG_GRADIENTS: Record<string, string> = {
  violet: "from-violet-600 to-purple-900",
  sky: "from-sky-500 to-blue-900",
  rose: "from-rose-500 to-pink-900",
  amber: "from-amber-500 to-orange-900",
  emerald: "from-emerald-500 to-teal-900",
  fuchsia: "from-fuchsia-500 to-purple-900",
  orange: "from-orange-500 to-red-900",
  cyan: "from-cyan-500 to-blue-900",
};

const EMOJI_OPTIONS = [null, "🔥", "💪", "🏆", "😂", "🎉", "⚡", "👀", "💀", "🤝"];

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateStory({ onClose, onCreated }: Props) {
  const [content, setContent] = useState("");
  const [bgColor, setBgColor] = useState("violet");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gradient = BG_GRADIENTS[bgColor] ?? BG_GRADIENTS.violet;

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          bg_color: bgColor,
          emoji,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || "Failed to post snap");
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 z-10">
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
        >
          <X size={18} />
        </button>
        <span className="text-sm font-semibold text-white/80">New Snap</span>
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || sending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent text-white text-sm font-medium disabled:opacity-40 transition-opacity"
        >
          <Send size={14} />
          {sending ? "Posting..." : "Post"}
        </button>
      </div>

      {/* Preview */}
      <div
        className={`flex-1 flex items-center justify-center bg-gradient-to-br ${gradient} mx-4 rounded-2xl mb-4 p-8 relative`}
      >
        <div className="text-center max-w-sm w-full">
          {emoji && <div className="text-5xl mb-4">{emoji}</div>}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 200))}
            placeholder="What's happening? 📸"
            maxLength={200}
            autoFocus
            className="w-full bg-transparent text-xl font-bold text-white text-center placeholder:text-white/40 resize-none outline-none leading-relaxed"
            rows={4}
          />
          <div className="text-xs text-white/40 mt-2">
            {content.length}/200
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 pb-6 space-y-4">
        {/* Color picker */}
        <div>
          <span className="text-[11px] text-white/40 uppercase tracking-wider font-medium mb-2 block">
            Background
          </span>
          <div className="flex gap-2">
            {BG_OPTIONS.map((opt) => (
              <button
                key={opt.name}
                onClick={() => setBgColor(opt.name)}
                className={`h-8 w-8 rounded-full ${opt.class} transition-all ${
                  bgColor === opt.name
                    ? "ring-2 ring-white ring-offset-2 ring-offset-black scale-110"
                    : "opacity-60 hover:opacity-90"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Emoji picker */}
        <div>
          <span className="text-[11px] text-white/40 uppercase tracking-wider font-medium mb-2 block">
            Emoji
          </span>
          <div className="flex gap-2">
            {EMOJI_OPTIONS.map((e, i) => (
              <button
                key={i}
                onClick={() => setEmoji(e)}
                className={`h-9 w-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                  emoji === e
                    ? "bg-white/20 ring-1 ring-white/40 scale-110"
                    : "bg-white/[0.06] hover:bg-white/10"
                }`}
              >
                {e ?? "✕"}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
