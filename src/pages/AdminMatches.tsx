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
          (err as { error?: string }).error || "Failed to create match",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-heading text-lg sm:text-2xl text-[var(--color-neon-pink)] mb-6">
        Submit Match
      </h1>
      <Card>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {message && (
              <div
                className={`text-sm p-3 border-2 font-bold uppercase tracking-wider ${
                  message.includes("created")
                    ? "border-[var(--color-neon-green)] text-[var(--color-neon-green)] bg-[var(--color-neon-green)]/10"
                    : "border-[var(--color-loss)] text-[var(--color-loss)] bg-[var(--color-loss)]/10"
                }`}
              >
                {message}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
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
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Players
              </label>
              <p className="text-xs text-[var(--color-text-muted)] mb-2">
                Click A or B to assign each player to a team
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {users.map((u) => {
                  const team = getTeam(u.id);
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between border-2 border-[var(--color-border)] px-3 py-2 bg-[var(--color-bg)]"
                    >
                      <span className="text-sm font-bold uppercase tracking-wider text-[var(--color-text)]">
                        {u.name}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          onClick={() => togglePlayer(u.id, "A")}
                          variant={team === "A" ? "primary" : "secondary"}
                          size="sm"
                        >
                          A
                        </Button>
                        <Button
                          type="button"
                          onClick={() => togglePlayer(u.id, "B")}
                          variant={team === "B" ? "danger" : "secondary"}
                          size="sm"
                        >
                          B
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
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
        </form>
      </Card>
    </div>
  );
}
