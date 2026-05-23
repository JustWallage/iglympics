import { useState, useRef } from "react";
import { X, Send, Camera, ImagePlus } from "lucide-react";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateStory({ onClose, onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB");
      return;
    }

    setFile(selected);
    setError(null);
    const url = URL.createObjectURL(selected);
    setPreview(url);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setSending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      if (caption.trim()) {
        formData.append("caption", caption.trim());
      }

      const res = await fetch("/api/stories", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Failed to post snap");
      }
      if (preview) URL.revokeObjectURL(preview);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

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
          disabled={!file || sending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent text-white text-sm font-medium disabled:opacity-40 transition-opacity"
        >
          <Send size={14} />
          {sending ? "Posting..." : "Post"}
        </button>
      </div>

      {/* Preview or picker */}
      <div className="flex-1 flex items-center justify-center mx-4 mb-4 relative">
        {preview ? (
          <div className="relative w-full h-full rounded-2xl overflow-hidden bg-black">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-contain"
            />
            {/* Change photo button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/50 text-white/80 text-xs font-medium hover:bg-black/70 transition-colors"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div className="text-center">
              <ImagePlus size={48} className="mx-auto text-white/15 mb-3" />
              <p className="text-sm text-white/40">
                Take a photo or choose from gallery
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-accent/15 text-accent-light text-sm font-medium hover:bg-accent/25 transition-colors"
              >
                <Camera size={18} />
                Camera
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/[0.06] text-white/70 text-sm font-medium hover:bg-white/10 transition-colors"
              >
                <ImagePlus size={18} />
                Gallery
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Caption input (only shown when image selected) */}
      {preview && (
        <div className="px-4 pb-6">
          <div className="flex items-center gap-3 bg-white/[0.06] rounded-2xl px-4 py-3">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 200))}
              placeholder="Add a caption..."
              maxLength={200}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
            />
            <span className="text-[10px] text-white/25 shrink-0">
              {caption.length}/200
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 text-center pb-4 px-4">{error}</p>
      )}
    </div>
  );
}
