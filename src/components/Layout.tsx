import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Trophy, User, Zap, LogIn, Swords, MessageCircle } from "lucide-react";

export default function Layout() {
  const { user, isAdmin, openLoginModal } = useAuth();
  const location = useLocation();

  const isActive = (path: string) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(path);

  return (
    <div className="min-h-dvh relative bg-bg pb-20 overflow-hidden">
      {/* Background decorative blobs — glass cards float in front */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-violet-500/20 blur-[80px]" />
        <div className="absolute top-1/2 -left-24 h-56 w-56 rounded-full bg-sky-500/15 blur-[70px]" />
        <div className="absolute bottom-40 right-0 h-40 w-40 rounded-full bg-fuchsia-500/15 blur-[60px]" />
      </div>

      <main className="relative z-10 px-4 pt-6 pb-4">
        <Outlet />
      </main>

      {/* ── Bottom navigation (glassmorphic) ────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40">
        <div className="border-t border-white/[0.08] bg-white/[0.04] backdrop-blur-xl">
          <div className="flex items-center justify-around py-2">
            <Link
              to="/"
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                isActive("/") && !isActive("/profile") && !isActive("/admin") && !isActive("/matches") && !isActive("/chat")
                  ? "text-accent-light"
                  : "text-white/35 active:text-white/60"
              }`}
            >
              <Trophy size={22} />
              <span className="text-[10px] font-medium">Board</span>
            </Link>

            <Link
              to="/matches"
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                isActive("/matches")
                  ? "text-accent-light"
                  : "text-white/35 active:text-white/60"
              }`}
            >
              <Swords size={22} />
              <span className="text-[10px] font-medium">Matches</span>
            </Link>

            <Link
              to="/chat"
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                isActive("/chat")
                  ? "text-accent-light"
                  : "text-white/35 active:text-white/60"
              }`}
            >
              <MessageCircle size={22} />
              <span className="text-[10px] font-medium">Chat</span>
            </Link>

            {user && (
              <Link
                to={`/profile/${user.id}`}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                  isActive("/profile")
                    ? "text-accent-light"
                    : "text-white/35 active:text-white/60"
                }`}
              >
                <User size={22} />
                <span className="text-[10px] font-medium">Profile</span>
              </Link>
            )}

            {isAdmin && (
              <Link
                to="/admin/matches"
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                  isActive("/admin")
                    ? "text-accent-light"
                    : "text-white/35 active:text-white/60"
                }`}
              >
                <Zap size={22} />
                <span className="text-[10px] font-medium">Admin</span>
              </Link>
            )}

            {!user && (
              <button
                onClick={openLoginModal}
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-accent-light transition-colors"
              >
                <LogIn size={22} />
                <span className="text-[10px] font-medium">Login</span>
              </button>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}
