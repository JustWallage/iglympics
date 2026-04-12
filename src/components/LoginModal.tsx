import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { X } from "lucide-react";

export default function LoginModal() {
  const { showLoginModal, closeLoginModal, login } = useAuth();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!showLoginModal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(name, password);
      setName("");
      setPassword("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={closeLoginModal}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-white/[0.06] backdrop-blur-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white/90">Sign in</h2>
          <button
            onClick={closeLoginModal}
            className="text-white/30 hover:text-white/60 transition-colors p-1"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-500/15 text-red-400 text-sm p-3">
              {error}
            </div>
          )}
          <div>
            <label
              htmlFor="modal-name"
              className="block text-sm font-medium text-white/60 mb-1.5"
            >
              Name
            </label>
            <Input
              id="modal-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your name"
            />
          </div>
          <div>
            <label
              htmlFor="modal-password"
              className="block text-sm font-medium text-white/60 mb-1.5"
            >
              Password
            </label>
            <Input
              id="modal-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
