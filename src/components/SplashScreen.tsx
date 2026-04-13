import { useState } from "react";
import { useMusicPlayer } from "../context/MusicContext";

export default function SplashScreen({ onEnter }: { onEnter: () => void }) {
  const music = useMusicPlayer();
  const [exiting, setExiting] = useState(false);

  const handleEnter = () => {
    music.play();
    setExiting(true);
    setTimeout(onEnter, 400);
  };

  return (
    <div
      className={`fixed inset-0 z-[100] bg-bg flex flex-col items-center justify-center transition-opacity duration-400 ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-violet-500/25 blur-[100px]" />
        <div className="absolute bottom-1/3 right-1/4 h-60 w-60 rounded-full bg-sky-500/20 blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-40 w-40 rounded-full bg-fuchsia-500/15 blur-[60px]" />
      </div>

      <div className="relative z-10 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-br from-white via-accent-light to-accent bg-clip-text text-transparent mb-4">
          Iglympics
        </h1>
        <p className="text-white/40 text-sm mb-10">Let the games begin</p>
        <button
          onClick={handleEnter}
          className="h-14 px-10 rounded-2xl bg-accent text-white font-semibold text-lg shadow-[0_0_30px_var(--color-accent-glow)] active:scale-95 transition-transform"
        >
          Enter
        </button>
      </div>
    </div>
  );
}
