import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useCachedFetch } from "../lib/useCachedFetch";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { X, HelpCircle } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: number;
  name: string;
}

interface ChwaziResult {
  id: number;
  winner_name: string;
  participant_names: string;
  created_at: string;
}

interface Touch {
  id: number;
  x: number;
  y: number;
  color: string;
  assignedUser?: User;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // indigo
  "#84cc16", // lime
];

const COUNTDOWN_SECONDS = 3;
const MIN_PLAYERS = 2;

// ─── Component ───────────────────────────────────────────────────────────────

export default function Chwazi() {
  const { user, openLoginModal } = useAuth();
  const { data: historyData, mutate: fetchHistory } = useCachedFetch<{
    results: ChwaziResult[];
  }>("/api/chwazi");

  const [showHelp, setShowHelp] = useState(false);
  const [phase, setPhase] = useState<
    "idle" | "assign" | "waiting" | "countdown" | "selecting" | "done"
  >("idle");
  const [touches, setTouches] = useState<Touch[]>([]);
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [users, setUsers] = useState<User[]>([]);
  const [participants, setParticipants] = useState<User[]>([]);
  const [message, setMessage] = useState("");
  const touchAreaRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch users on mount
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json() as Promise<{ users: User[] }>)
      .then((data) => setUsers(data.users));
  }, []);

  const history = historyData?.results ?? [];

  // ─── Assignment-based Chwazi ─────────────────────────────────────────────

  const addParticipant = (u: User) => {
    if (participants.find((p) => p.id === u.id)) return;
    setParticipants((prev) => [...prev, u]);
  };

  const removeParticipant = (userId: number) => {
    setParticipants((prev) => prev.filter((p) => p.id !== userId));
  };

  const startSelection = useCallback(() => {
    if (participants.length < MIN_PLAYERS) {
      setMessage(`Need at least ${MIN_PLAYERS} players`);
      return;
    }
    setPhase("countdown");
    setCountdown(COUNTDOWN_SECONDS);
    setWinnerId(null);
    setMessage("");

    // Create touch circles for each participant
    const area = touchAreaRef.current;
    const w = area?.clientWidth ?? 300;
    const h = area?.clientHeight ?? 300;
    const newTouches: Touch[] = participants.map((p, i) => {
      const angle = (2 * Math.PI * i) / participants.length;
      const radius = Math.min(w, h) * 0.3;
      return {
        id: i,
        x: w / 2 + radius * Math.cos(angle),
        y: h / 2 + radius * Math.sin(angle),
        color: COLORS[i % COLORS.length],
        assignedUser: p,
      };
    });
    setTouches(newTouches);
  }, [participants]);

  // Countdown logic
  useEffect(() => {
    if (phase !== "countdown") return;

    if (countdown <= 0) {
      setPhase("selecting");
      // Animate selection
      const selectionTime = 1500;
      const flickerInterval = setInterval(() => {
        setWinnerId(Math.floor(Math.random() * touches.length));
      }, 100);

      setTimeout(() => {
        clearInterval(flickerInterval);
        const winnerIndex = Math.floor(Math.random() * touches.length);
        setWinnerId(winnerIndex);
        setPhase("done");
        // Submit result
        const winner = touches[winnerIndex].assignedUser;
        if (winner && user) {
          submitResult(winner.id);
        }
      }, selectionTime);
      return;
    }

    countdownRef.current = setTimeout(() => {
      setCountdown((c) => c - 1);
    }, 1000);

    return () => {
      if (countdownRef.current) clearTimeout(countdownRef.current);
    };
  }, [phase, countdown, touches, user]);

  const submitResult = async (winnerUserId: number) => {
    const participantIds = participants.map((p) => p.id);
    try {
      const res = await fetch("/api/chwazi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winner_id: winnerUserId,
          participant_ids: participantIds,
        }),
      });
      if (res.ok) {
        await fetchHistory();
      }
    } catch {
      // silent fail
    }
  };

  const reset = () => {
    setPhase("idle");
    setTouches([]);
    setWinnerId(null);
    setCountdown(COUNTDOWN_SECONDS);
    setMessage("");
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-white/90">🖐️ Chwazi</h1>
        <button
          onClick={() => setShowHelp(true)}
          className="text-white hover:text-white/60 transition-colors p-1"
          aria-label="How Chwazi works"
        >
          <HelpCircle size={18} />
        </button>
      </div>

      {/* Help modal */}
      {showHelp && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-white/[0.06] backdrop-blur-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white/90">
                How Chwazi Works
              </h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-white/30 hover:text-white/60 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 text-sm text-white/60">
              <p>Chwazi randomly selects a winner from a group of players!</p>
              <p>
                <strong className="text-white/80">How to play:</strong>
              </p>
              <ol className="list-decimal list-inside space-y-1 pl-2">
                <li>Add at least 2 players to the selection</li>
                <li>Press &quot;Start Selection&quot;</li>
                <li>After a countdown, one player is randomly chosen</li>
              </ol>
              <p className="mt-2">
                <strong className="text-white/80">Scoring:</strong> The winner
                gets <span className="text-emerald-400 font-medium">3 points</span>{" "}
                added to the main scoreboard, and all others get 0. This counts as
                a confirmed match!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main game area */}
      <Card className="p-5">
        {phase === "idle" && (
          <div className="space-y-4">
            <div className="text-sm font-medium text-white/60 mb-2">
              Select participants ({participants.length} selected)
            </div>

            {/* Selected participants */}
            {participants.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {participants.map((p, i) => (
                  <Badge
                    key={p.id}
                    className="flex items-center gap-1 px-3 py-1.5"
                    style={{
                      backgroundColor: `${COLORS[i % COLORS.length]}30`,
                      borderColor: COLORS[i % COLORS.length],
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-white/90">{p.name}</span>
                    <button
                      onClick={() => removeParticipant(p.id)}
                      className="ml-1 text-white/40 hover:text-white/80"
                    >
                      <X size={12} />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Available users */}
            <div className="flex flex-wrap gap-2">
              {users
                .filter((u) => !participants.find((p) => p.id === u.id))
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => addParticipant(u)}
                    className="px-3 py-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] text-sm text-white/60 hover:bg-white/[0.08] hover:text-white/80 transition-colors"
                  >
                    + {u.name}
                  </button>
                ))}
            </div>

            {message && (
              <p className="text-xs text-red-400 mt-2">{message}</p>
            )}

            <Button
              onClick={() => {
                if (!user) {
                  openLoginModal();
                  return;
                }
                startSelection();
              }}
              className="w-full mt-4"
              disabled={participants.length < MIN_PLAYERS}
            >
              Start Selection ({participants.length}/{MIN_PLAYERS} min)
            </Button>
          </div>
        )}

        {(phase === "countdown" ||
          phase === "selecting" ||
          phase === "done") && (
          <div className="space-y-4">
            {/* Touch area */}
            <div
              ref={touchAreaRef}
              className="relative w-full h-64 rounded-xl bg-black/30 border border-white/[0.06] overflow-hidden select-none"
            >
              {/* Countdown overlay */}
              {phase === "countdown" && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="text-6xl font-bold text-white/90 animate-pulse">
                    {countdown}
                  </div>
                </div>
              )}

              {/* Touch circles */}
              {touches.map((touch, i) => {
                const isWinner = winnerId === i;
                const isDone = phase === "done";
                const isSelecting = phase === "selecting";
                return (
                  <div
                    key={touch.id}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isDone && !isWinner
                        ? "opacity-20 scale-75"
                        : isDone && isWinner
                          ? "scale-125 ring-4 ring-white/50"
                          : isSelecting && isWinner
                            ? "scale-110 ring-2 ring-white/30"
                            : ""
                    }`}
                    style={{
                      left: touch.x,
                      top: touch.y,
                      width: 70,
                      height: 70,
                      backgroundColor: touch.color,
                      boxShadow: isWinner
                        ? `0 0 30px ${touch.color}`
                        : `0 0 10px ${touch.color}50`,
                    }}
                  >
                    <span className="text-white text-xs font-bold text-center px-1 leading-tight">
                      {touch.assignedUser?.name}
                    </span>
                  </div>
                );
              })}

              {/* Winner announcement */}
              {phase === "done" && winnerId !== null && (
                <div className="absolute bottom-3 left-0 right-0 text-center">
                  <div className="inline-block bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
                    <span className="text-white/90 font-semibold text-sm">
                      🎉 {touches[winnerId]?.assignedUser?.name} wins!
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Done state actions */}
            {phase === "done" && (
              <div className="flex gap-3">
                <Button onClick={reset} className="flex-1">
                  New Round
                </Button>
                <Button
                  onClick={() => {
                    setPhase("idle");
                    setTouches([]);
                    setWinnerId(null);
                    setCountdown(COUNTDOWN_SECONDS);
                    setParticipants([]);
                    setMessage("");
                  }}
                  className="flex-1 bg-white/[0.06] hover:bg-white/[0.1]"
                >
                  Reset All
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Recent results */}
      <Card>
        <h2 className="text-sm font-semibold text-white/60 mb-3">
          Recent Results
        </h2>
        {history.length === 0 ? (
          <p className="text-xs text-white/30">No results yet</p>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 10).map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2"
              >
                <div>
                  <span className="text-sm text-emerald-400 font-medium">
                    🏆 {result.winner_name}
                  </span>
                  <span className="text-xs text-white/30 ml-2">
                    vs {result.participant_names}
                  </span>
                </div>
                <span className="text-xs text-white/20">
                  {new Date(result.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
