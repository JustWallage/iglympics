import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

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
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={closeLoginModal}
    >
      <div
        className="bg-[var(--color-bg-card)] border-2 border-[var(--color-neon-cyan)] shadow-[var(--shadow-brutal-cyan)] p-6 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-xs text-[var(--color-neon-cyan)]">
            SIGN IN
          </h2>
          <button
            onClick={closeLoginModal}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-neon-pink)] text-xl leading-none font-bold transition-colors"
          >
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-[var(--color-loss)]/10 text-[var(--color-loss)] text-sm p-2 border-2 border-[var(--color-loss)] font-bold">
              {error}
            </div>
          )}
          <div>
            <label
              htmlFor="modal-name"
              className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2"
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
              className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2"
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
