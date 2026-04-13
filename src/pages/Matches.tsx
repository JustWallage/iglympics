import { useEffect, useState, useCallback } from "react";
import { useWebSocket } from "../context/WebSocketContext";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { X } from "lucide-react";

interface Match {
  id: number;
  game_name: string;
  outcome: string;
  played_at: string;
  created_by_name: string;
  team_a: string[];
  team_b: string[];
}

export default function Matches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Match | null>(null);
  const { subscribe } = useWebSocket();

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch("/api/matches");
      if (res.ok) {
        const data = await res.json();
        setMatches((data as { matches: Match[] }).matches);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  useEffect(() => {
    const unsub = subscribe("match_created", () => fetchMatches());
    return unsub;
  }, [subscribe, fetchMatches]);

  if (loading) {
    return (
      <div className="text-center py-12 text-white/35 text-sm">Loading...</div>
    );
  }

  const outcomeLabel = (m: Match) =>
    m.outcome === "team_a"
      ? `${m.team_a.join(", ")} won`
      : m.outcome === "team_b"
        ? `${m.team_b.join(", ")} won`
        : "Draw";

  const outcomeBadge = (m: Match) =>
    m.outcome === "tie" ? "warning" : "success";

  return (
    <div>
      <h1 className="text-xl font-bold text-white/90 mb-4">Matches</h1>

      {matches.length === 0 ? (
        <div className="text-center py-12 text-white/30 text-sm">
          No matches yet
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <Card
              key={m.id}
              className="cursor-pointer transition-colors hover:bg-white/[0.06] active:bg-white/[0.08]"
              onClick={() => setSelected(m)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-white/90 text-sm">
                    {m.game_name}
                  </div>
                  <div className="text-xs text-white/40 mt-0.5">
                    {new Date(m.played_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    · {new Date(m.played_at).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <Badge variant={outcomeBadge(m)} className="shrink-0">
                  {m.outcome === "tie" ? "Draw" : "Result"}
                </Badge>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs">
                <div
                  className={`flex-1 text-right ${m.outcome === "team_a" ? "text-emerald-400 font-medium" : "text-white/50"}`}
                >
                  {m.team_a.join(", ")}
                </div>
                <span className="text-white/20 text-[10px] font-medium px-1">
                  vs
                </span>
                <div
                  className={`flex-1 ${m.outcome === "team_b" ? "text-emerald-400 font-medium" : "text-white/50"}`}
                >
                  {m.team_b.join(", ")}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-white/[0.06] backdrop-blur-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white/90">
                {selected.game_name}
              </h2>
              <button
                onClick={() => setSelected(null)}
                className="text-white/30 hover:text-white/60 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-xs text-white/40">
                {new Date(selected.played_at).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                at {new Date(selected.played_at).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="text-center mb-3">
                  <Badge variant={outcomeBadge(selected)}>
                    {outcomeLabel(selected)}
                  </Badge>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <div
                      className={`text-[10px] font-medium uppercase tracking-wider mb-2 ${selected.outcome === "team_a" ? "text-emerald-400" : "text-white/40"}`}
                    >
                      Team A {selected.outcome === "team_a" && "★"}
                    </div>
                    <div className="space-y-1">
                      {selected.team_a.map((name) => (
                        <div key={name} className="text-sm text-white/80">
                          {name}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="w-px bg-white/[0.08]" />
                  <div className="flex-1">
                    <div
                      className={`text-[10px] font-medium uppercase tracking-wider mb-2 ${selected.outcome === "team_b" ? "text-emerald-400" : "text-white/40"}`}
                    >
                      Team B {selected.outcome === "team_b" && "★"}
                    </div>
                    <div className="space-y-1">
                      {selected.team_b.map((name) => (
                        <div key={name} className="text-sm text-white/80">
                          {name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-white/30">
                Created by {selected.created_by_name}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
