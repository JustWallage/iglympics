import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

interface Song {
  file: string;
  artist: string;
  title: string;
}

interface MusicContextValue {
  songs: Song[];
  currentIndex: number;
  playing: boolean;
  progress: number;
  duration: number;
  current: Song | null;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seek: (fraction: number) => void;
}

const MusicContext = createContext<MusicContextValue | null>(null);

export function useMusicPlayer() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusicPlayer must be inside MusicProvider");
  return ctx;
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create audio element once
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "metadata";
    }
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  // Fetch song list
  useEffect(() => {
    fetch("/music/index.json")
      .then((r) => r.json() as Promise<Song[]>)
      .then((data) => {
        if (data.length > 0) setSongs(data);
      })
      .catch(() => {});
  }, []);

  const next = useCallback(() => {
    if (songs.length === 0) return;
    if (songs.length === 1 && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      return;
    }
    setCurrentIndex((i) => (i + 1) % songs.length);
  }, [songs.length]);

  const prev = useCallback(() => {
    if (songs.length === 0) return;
    if (songs.length === 1 && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      return;
    }
    setCurrentIndex((i) => (i - 1 + songs.length) % songs.length);
  }, [songs.length]);

  const play = useCallback(() => {
    if (!audioRef.current || songs.length === 0) return;
    audioRef.current.play().catch(() => {});
    setPlaying(true);
  }, [songs.length]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const seek = useCallback((fraction: number) => {
    if (!audioRef.current || !audioRef.current.duration) return;
    audioRef.current.currentTime = fraction * audioRef.current.duration;
  }, []);

  // Load track when index changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || songs.length === 0) return;

    audio.src = `/music/${encodeURIComponent(songs[currentIndex].file)}`;
    audio.load();

    if (playing) {
      audio.play().catch(() => {});
    }
  }, [currentIndex, songs]); // intentionally omit `playing`

  // Track ended → next
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => next();
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [next]);

  // Progress updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setProgress(audio.currentTime);
      setDuration(audio.duration || 0);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onTime);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onTime);
    };
  }, []);

  const current = songs.length > 0 ? songs[currentIndex] : null;

  return (
    <MusicContext.Provider
      value={{
        songs,
        currentIndex,
        playing,
        progress,
        duration,
        current,
        play,
        pause,
        next,
        prev,
        seek,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}
