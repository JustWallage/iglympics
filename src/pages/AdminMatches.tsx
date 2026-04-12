import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

interface User {
  id: number;
  name: string;
}

interface TeamEntry {
  userId: number;
  team: "A" | "B";
}

export default function AdminMatches() {
  const [users, setUsers] = useState<User[]>([]);
  const [gameName, setGameName] = useState("");
  const [participants, setParticipants] = useState<TeamEntry[]>([]);
  const [outcome, setOutcome] = useState<"team_a" | "team_b" | "tie">(
    "team_a"
  );
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json() as Promise<{ users: User[] }>)
      .then((data) => setUsers(data.users));
  }, []);

  const togglePlayer = (userId: number, team: "A" | "B") => {
    setParticipants((prev) => {
      const existing = prev.find((p) => p.userId === userId);
      if (existing) {
        if (existing.team === team) {
          return prev.filter((p) => p.userId !== userId);
        }
        return prev.map((p) => (p.userId === userId ? { ...p, team } : p));
      }
      return [...prev, { userId, team }];
    });
  };

  const getTeam = (userId: number) =>
    participants.find((p) => p.userId === userId)?.team;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    const teamA = participants
      .filter((p) => p.team === "A")
      .map((p) => p.userId);
    const teamB = participants
      .filter((p) => p.team === "B")
      .map((p) => p.userId);

    if (teamA.length === 0 || teamB.length === 0) {
      setMessage("Both teams need at least 1 player");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_name: gameName,
          team_a: teamA,
          team_b: teamB,
          outcome,
        }),
      });

      if (res.ok) {
        setMessage("Match created!");
        setGameName("");
        setParticipants([]);
      } else {
        const err = await res.json();
        setMessage(
          (err as { error?: string }).error || "Failed to create match"
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-white/90 mb-4">Submit Match</h1>
      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="space-y-5">
            {message && (
              <div
                className={`text-sm p-3 rounded-xl ${
                  message.includes("created")
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-red-500/15 text-red-400"
                }`}
              >
                {message}
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
                Tap A or B to assign each player to a team
              </p>
              <div className="space-y-2">
                {users.map((u) => {
                  const team = getTeam(u.id);
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3"
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
              {submitting ? "Submitting..." : "Submit Match"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
