import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import { useCachedFetch } from "../lib/useCachedFetch";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { X, Plus, Check, XCircle, HelpCircle, Trash2 } from "lucide-react";

interface Match {
  id: number;
  game_name: string;
  outcome: string;
  played_at: string;
  created_by_name: string;
  team_a: string[];
  team_b: string[];
  confirms: number;
  rejects: number;
  status: "pending" | "confirmed" | "rejected";
  my_vote: string | null;
}

interface MatchesResponse {
  matches: Match[];
  confirm_threshold: number;
  reject_threshold: number;
}

interface User {
  id: number;
  name: string;
}

interface TeamEntry {
  userId: number;
  team: "A" | "B";
}

export default function Matches() {
  const { user, isAdmin, openLoginModal } = useAuth();
  const { subscribe } = useWebSocket();
  const { data, loading, mutate: fetchMatches } = useCachedFetch<MatchesResponse>("/api/matches");
  const matches = data?.matches ?? [];
  const confirmThreshold = data?.confirm_threshold ?? 4;
  const rejectThreshold = data?.reject_threshold ?? 8;

  const [selected, setSelected] = useState<Match | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create match form state
  const [users, setUsers] = useState<User[]>([]);
  const [gameName, setGameName] = useState("");
  const [participants, setParticipants] = useState<TeamEntry[]>([]);
  const [outcome, setOutcome] = useState<"team_a" | "team_b" | "tie">("team_a");
  const [submitting, setSubmitting] = useState(false);
  const [createMessage, setCreateMessage] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [deleteMatchId, setDeleteMatchId] = useState<number | null>(null);

  useEffect(() => {
    const unsub = subscribe("match_created", () => fetchMatches());
    return unsub;
  }, [subscribe, fetchMatches]);

  // Fetch users when create modal opens
  useEffect(() => {
    if (showCreate && users.length === 0) {
      fetch("/api/users")
        .then((r) => r.json() as Promise<{ users: User[] }>)
        .then((data) => setUsers(data.users));
    }
  }, [showCreate, users.length]);

  const deleteMatch = async (matchId: number) => {
    await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
    setDeleteMatchId(null);
    if (selected?.id === matchId) setSelected(null);
    await fetchMatches();
  };

  const vote = async (matchId: number, voteType: "confirm" | "reject") => {
    await fetch(`/api/matches/${matchId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote: voteType }),
    });
    await fetchMatches();
  };

  const togglePlayer = (userId: number, team: "A" | "B") => {
    setParticipants((prev) => {
      const existing = prev.find((p) => p.userId === userId);
      if (existing) {
        if (existing.team === team) return prev.filter((p) => p.userId !== userId);
        return prev.map((p) => (p.userId === userId ? { ...p, team } : p));
      }
      return [...prev, { userId, team }];
    });
  };

  const getTeam = (userId: number) =>
    participants.find((p) => p.userId === userId)?.team;

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMessage("");

    const teamA = participants.filter((p) => p.team === "A").map((p) => p.userId);
    const teamB = participants.filter((p) => p.team === "B").map((p) => p.userId);

    if (teamA.length === 0 || teamB.length === 0) {
      setCreateMessage("Both teams need at least 1 player");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_name: gameName, team_a: teamA, team_b: teamB, outcome }),
      });
      if (res.ok) {
        setShowCreate(false);
        setGameName("");
        setParticipants([]);
        setCreateMessage("");
        await fetchMatches();
      } else {
        const err = await res.json();
        setCreateMessage((err as { error?: string }).error || "Failed to create match");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (m: Match) => {
    if (m.status === "confirmed") return <Badge variant="success">Confirmed</Badge>;
    if (m.status === "rejected") return <Badge variant="danger">Rejected</Badge>;
    return (
      <Badge variant="default">
        {m.confirms}/{confirmThreshold}
      </Badge>
    );
  };

  // Sort: unvoted matches first, then voted matches
  const sortedMatches = [...matches].sort((a, b) => {
    const aVoted = a.my_vote ? 1 : 0;
    const bVoted = b.my_vote ? 1 : 0;
    return aVoted - bVoted;
  });

  if (loading) {
    return (
      <div className="text-center py-12 text-white/35 text-sm">Loading...</div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-white/90">Matches</h1>
          <button
            onClick={() => setShowHelp(true)}
            className="text-white hover:text-white/60 transition-colors p-1"
            aria-label="How matches work"
          >
            <HelpCircle size={18} />
          </button>
        </div>
        {user ? (
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus size={16} />
            New Match
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={openLoginModal}>
            Login to add
          </Button>
        )}
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-12 text-white/30 text-sm">
          No matches yet
        </div>
      ) : (
        <div className="space-y-3">
          {sortedMatches.map((m) => (
            <Card key={m.id}>
              <div
                className="cursor-pointer"
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
                      })}{" "}
                      · {new Date(m.played_at).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  {statusBadge(m)}
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
              </div>

              {/* Vote buttons */}
              {user && m.status !== "rejected" && (
                <div className="mt-3 pt-3 border-t border-white/[0.06] flex gap-2">
                  <button
                    onClick={() => vote(m.id, "confirm")}
                    className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-xs font-medium transition-all ${
                      m.my_vote === "confirm"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-white/[0.04] text-white/40 border border-white/[0.06] active:bg-white/[0.08]"
                    }`}
                  >
                    <Check size={14} />
                    Confirm ({m.confirms})
                  </button>
                  <button
                    onClick={() => vote(m.id, "reject")}
                    className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-xs font-medium transition-all ${
                      m.my_vote === "reject"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-white/[0.04] text-white/40 border border-white/[0.06] active:bg-white/[0.08]"
                    }`}
                  >
                    <XCircle size={14} />
                    Reject ({m.rejects})
                  </button>
                </div>
              )}

              {/* Admin delete */}
              {isAdmin && (
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteMatchId(m.id); }}
                    className="flex items-center gap-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                    Delete match
                  </button>
                </div>
              )}

            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteMatchId !== null && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setDeleteMatchId(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-white/[0.1] bg-white/[0.06] backdrop-blur-xl p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white/90 mb-2">Delete Match</h2>
            <p className="text-sm text-white/55 mb-6">
              Are you sure? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button className="flex-1" variant="secondary" onClick={() => setDeleteMatchId(null)}>
                Cancel
              </Button>
              <Button className="flex-1" variant="danger" onClick={() => deleteMatch(deleteMatchId)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
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
              <div className="flex items-center gap-2">
                {statusBadge(selected)}
                <span className="text-xs text-white/40">
                  {selected.confirms} confirms · {selected.rejects} rejects
                </span>
              </div>

              <div className="text-xs text-white/40">
                {new Date(selected.played_at).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                at{" "}
                {new Date(selected.played_at).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="text-center mb-3">
                  <Badge
                    variant={
                      selected.outcome === "tie" ? "warning" : "success"
                    }
                  >
                    {selected.outcome === "team_a"
                      ? `${selected.team_a.join(", ")} won`
                      : selected.outcome === "team_b"
                        ? `${selected.team_b.join(", ")} won`
                        : "Draw"}
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
                How matches work
              </h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-white/30 hover:text-white/60 transition-colors p-1"
                data-testid="help-close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 text-sm text-white/60">
              <p>Anyone can submit a new match result.</p>
              <p>
                Once a match receives{" "}
                <span className="text-white/90 font-medium" data-testid="confirm-threshold">
                  {confirmThreshold}
                </span>{" "}
                or more confirmations, it is counted towards the scoreboard.
              </p>
              <p>
                However, if a match is rejected by{" "}
                <span className="text-white/90 font-medium" data-testid="reject-threshold">
                  {rejectThreshold}
                </span>{" "}
                or more people, it is always rejected regardless of how many
                people confirmed it.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create match modal */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl border border-white/[0.1] bg-white/[0.06] backdrop-blur-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white/90">
                New Match
              </h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-white/30 hover:text-white/60 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateMatch} className="space-y-4">
              {createMessage && (
                <div className="rounded-xl bg-red-500/15 text-red-400 text-sm p-3">
                  {createMessage}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">
                  Game Name
                </label>
                <Input
                  type="text"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  required
                  placeholder="e.g. Chess, Mario Kart"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">
                  Players
                </label>
                <p className="text-xs text-white/30 mb-2">
                  Tap A or B to assign to a team
                </p>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {users.map((u) => {
                    const team = getTeam(u.id);
                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5"
                      >
                        <span className="text-sm text-white/80">{u.name}</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => togglePlayer(u.id, "A")}
                            className={`h-8 w-8 rounded-lg text-xs font-medium transition-all ${
                              team === "A"
                                ? "bg-accent text-white shadow-[0_0_12px_var(--color-accent-glow)]"
                                : "bg-white/[0.06] text-white/40 active:bg-white/[0.1]"
                            }`}
                          >
                            A
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePlayer(u.id, "B")}
                            className={`h-8 w-8 rounded-lg text-xs font-medium transition-all ${
                              team === "B"
                                ? "bg-red-500/80 text-white shadow-[0_0_12px_rgba(239,68,68,0.25)]"
                                : "bg-white/[0.06] text-white/40 active:bg-white/[0.1]"
                            }`}
                          >
                            B
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">
                  Outcome
                </label>
                <Select
                  value={outcome}
                  onChange={(e) =>
                    setOutcome(e.target.value as "team_a" | "team_b" | "tie")
                  }
                >
                  <option value="team_a">Team A wins</option>
                  <option value="team_b">Team B wins</option>
                  <option value="tie">Tie</option>
                </Select>
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Creating..." : "Create Match"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
