import { Play, Pause, SkipForward, SkipBack, Music } from "lucide-react";
import { useMusicPlayer } from "../context/MusicContext";

export default function MusicPlayer() {
  const {
    songs,
    playing,
    progress,
    duration,
    current,
    play,
    pause,
    next,
    prev,
    seek,
  } = useMusicPlayer();

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seek((e.clientX - rect.left) / rect.width);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (songs.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-lg p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
          <Music size={18} className="text-accent-light" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-white/90 truncate">
            {current?.title || "No track"}
          </div>
          <div className="text-xs text-white/40 truncate">
            {current?.artist}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 rounded-full bg-white/[0.08] mb-2 cursor-pointer"
        onClick={handleSeek}
      >
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: duration ? `${(progress / duration) * 100}%` : "0%" }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-white/30 tabular-nums mb-3">
        <span>{formatTime(progress)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={prev}
          className="p-2 rounded-xl text-white/50 active:text-white/80 transition-colors"
        >
          <SkipBack size={20} />
        </button>
        <button
          onClick={playing ? pause : play}
          className="h-12 w-12 rounded-full bg-accent text-white flex items-center justify-center shadow-[0_0_20px_var(--color-accent-glow)] active:scale-95 transition-transform"
        >
          {playing ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
        </button>
        <button
          onClick={next}
          className="p-2 rounded-xl text-white/50 active:text-white/80 transition-colors"
        >
          <SkipForward size={20} />
        </button>
      </div>
    </div>
  );
}
