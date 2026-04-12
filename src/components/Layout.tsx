import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Trophy, User, Zap, LogIn } from "lucide-react";

export default function Layout() {
  const { user, isAdmin, openLoginModal } = useAuth();
  const location = useLocation();

  const isActive = (path: string) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-20">
      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="px-5 py-5">
        <Outlet />
      </main>

      {/* ── Bottom tab nav ───────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 border-t-2 border-[var(--color-border-bright)] bg-[var(--color-bg-card)] z-40">
        <div className="flex items-center justify-around py-3">
          <Link
            to="/"
            className={`flex flex-col items-center gap-1 px-4 py-1 transition-colors ${isActive("/") && !isActive("/profile") && !isActive("/admin") ? "text-[var(--color-neon-cyan)]" : "text-[var(--color-text-muted)]"}`}
          >
            <Trophy size={22} strokeWidth={2.5} />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Board
            </span>
          </Link>
          {user && (
            <Link
              to={`/profile/${user.id}`}
              className={`flex flex-col items-center gap-1 px-4 py-1 transition-colors ${isActive("/profile") ? "text-[var(--color-neon-cyan)]" : "text-[var(--color-text-muted)]"}`}
            >
              <User size={22} strokeWidth={2.5} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Profile
              </span>
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin/matches"
              className={`flex flex-col items-center gap-1 px-4 py-1 transition-colors ${isActive("/admin") ? "text-[var(--color-neon-cyan)]" : "text-[var(--color-text-muted)]"}`}
            >
              <Zap size={22} strokeWidth={2.5} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Admin
              </span>
            </Link>
          )}
          {!user && (
            <button
              onClick={openLoginModal}
              className="flex flex-col items-center gap-1 px-4 py-1 text-[var(--color-neon-pink)] transition-colors"
            >
              <LogIn size={22} strokeWidth={2.5} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Login
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
