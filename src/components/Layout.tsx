import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useMusicPlayer } from "../context/MusicContext";
import { Trophy, User, Zap, LogIn, Swords, MessageCircle, Home, CalendarDays, Gamepad2, Camera, Play, Pause, SkipForward, TrendingUp, Hand } from "lucide-react";

export default function Layout() {
  const { user, isAdmin, openLoginModal } = useAuth();
  const music = useMusicPlayer();
  const location = useLocation();
  const isHome = location.pathname === "/";

  const isActive = (path: string) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(path);

  const showMiniPlayer = !isHome && music.songs.length > 0;

  return (
    <div className={`min-h-dvh relative bg-bg ${showMiniPlayer ? "pb-32" : "pb-20"} overflow-hidden`}>
      {/* Background decorative blobs — glass cards float in front */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-violet-500/20 blur-[80px]" />
        <div className="absolute top-1/2 -left-24 h-56 w-56 rounded-full bg-sky-500/15 blur-[70px]" />
        <div className="absolute bottom-40 right-0 h-40 w-40 rounded-full bg-fuchsia-500/15 blur-[60px]" />
      </div>

      <main className="relative px-4 pt-6 pb-4">
        <Outlet />
      </main>

      {/* ── Bottom navigation (glassmorphic) ────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40">
        {/* Mini player - shown when not on dashboard and music has songs */}
        {showMiniPlayer && (
          <div className="border-t border-white/[0.06] bg-white/[0.03] backdrop-blur-xl px-4 py-2">
            <div className="flex items-center gap-3">
              <button
                onClick={music.playing ? music.pause : music.play}
                className="h-8 w-8 rounded-full bg-accent/80 text-white flex items-center justify-center shrink-0"
              >
                {music.playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-white/80 truncate">
                  {music.current?.title}
                </div>
                <div className="text-[10px] text-white/40 truncate">
                  {music.current?.artist}
                </div>
              </div>
              <button
                onClick={music.next}
                className="p-1.5 text-white/40"
              >
                <SkipForward size={16} />
              </button>
            </div>
          </div>
        )}
        <div className="border-t border-white/[0.08] bg-white/[0.04] backdrop-blur-xl">
          <div className="flex items-center py-2">
            <Link
              to="/"
              className={`flex flex-1 min-w-0 flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                isActive("/") && !isActive("/profile") && !isActive("/admin") && !isActive("/matches") && !isActive("/chat") && !isActive("/scoreboard") && !isActive("/schedule") && !isActive("/games") && !isActive("/snaps") && !isActive("/bets") && !isActive("/chwazi")
                  ? "text-accent-light"
                  : "text-white/35 active:text-white/60"
              }`}
            >
              <Home size={22} />
              <span className="text-[10px] font-medium truncate max-w-full px-1">Home</span>
            </Link>

            <Link
              to="/scoreboard"
              className={`flex flex-1 min-w-0 flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                isActive("/scoreboard")
                  ? "text-accent-light"
                  : "text-white/35 active:text-white/60"
              }`}
            >
              <Trophy size={22} />
              <span className="text-[10px] font-medium truncate max-w-full px-1">Board</span>
            </Link>

            <Link
              to="/matches"
              className={`flex flex-1 min-w-0 flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                isActive("/matches")
                  ? "text-accent-light"
                  : "text-white/35 active:text-white/60"
              }`}
            >
              <Swords size={22} />
              <span className="text-[10px] font-medium truncate max-w-full px-1">Matches</span>
            </Link>

            <Link
              to="/chat"
              className={`flex flex-1 min-w-0 flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                isActive("/chat")
                  ? "text-accent-light"
                  : "text-white/35 active:text-white/60"
              }`}
            >
              <MessageCircle size={22} />
              <span className="text-[10px] font-medium truncate max-w-full px-1">Chat</span>
            </Link>

            <Link
              to="/schedule"
              className={`flex flex-1 min-w-0 flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                isActive("/schedule")
                  ? "text-accent-light"
                  : "text-white/35 active:text-white/60"
              }`}
            >
              <CalendarDays size={22} />
              <span className="text-[10px] font-medium truncate max-w-full px-1">Schedule</span>
            </Link>

            <Link
              to="/games"
              className={`flex flex-1 min-w-0 flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                isActive("/games")
                  ? "text-accent-light"
                  : "text-white/35 active:text-white/60"
              }`}
            >
              <Gamepad2 size={22} />
              <span className="text-[10px] font-medium truncate max-w-full px-1">Games</span>
            </Link>

            <Link
              to="/snaps"
              className={`flex flex-1 min-w-0 flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                isActive("/snaps")
                  ? "text-accent-light"
                  : "text-white/35 active:text-white/60"
              }`}
            >
              <Camera size={22} />
              <span className="text-[10px] font-medium truncate max-w-full px-1">Snaps</span>
            </Link>

            <Link
              to="/bets"
              className={`flex flex-1 min-w-0 flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                isActive("/bets")
                  ? "text-accent-light"
                  : "text-white/35 active:text-white/60"
              }`}
            >
              <TrendingUp size={22} />
              <span className="text-[10px] font-medium truncate max-w-full px-1">Bets</span>
            </Link>

            <Link
              to="/chwazi"
              className={`flex flex-1 min-w-0 flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                isActive("/chwazi")
                  ? "text-accent-light"
                  : "text-white/35 active:text-white/60"
              }`}
            >
              <Hand size={22} />
              <span className="text-[10px] font-medium truncate max-w-full px-1">Chwazi</span>
            </Link>

            {user && (
              <Link
                to={`/profile/${user.id}`}
                className={`flex flex-1 min-w-0 flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                  isActive("/profile")
                    ? "text-accent-light"
                    : "text-white/35 active:text-white/60"
                }`}
              >
                <User size={22} />
                <span className="text-[10px] font-medium truncate max-w-full px-1">Profile</span>
              </Link>
            )}

            {isAdmin && (
              <Link
                to="/admin/matches"
                className={`flex flex-1 min-w-0 flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                  isActive("/admin")
                    ? "text-accent-light"
                    : "text-white/35 active:text-white/60"
                }`}
              >
                <Zap size={22} />
                <span className="text-[10px] font-medium truncate max-w-full px-1">Admin</span>
              </Link>
            )}

            {!user && (
              <button
                onClick={openLoginModal}
                className="flex flex-1 min-w-0 flex-col items-center gap-1 py-2 rounded-xl text-accent-light transition-colors"
              >
                <LogIn size={22} />
                <span className="text-[10px] font-medium truncate max-w-full px-1">Login</span>
              </button>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}
