import { useState, useEffect } from "react";

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
        setMessage((err as { error?: string }).error || "Failed to create match");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Submit Match</h1>
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow p-6 space-y-4"
      >
        {message && (
          <div
            className={`text-sm p-3 rounded ${message.includes("created") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}
          >
            {message}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Game Name</label>
          <input
            type="text"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            required
            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="e.g. Chess, Mario Kart"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Players</label>
          <p className="text-xs text-gray-500 mb-2">
            Click A or B to assign each player to a team
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {users.map((u) => {
              const team = getTeam(u.id);
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between border rounded-md px-3 py-2"
                >
                  <span className="text-sm">{u.name}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => togglePlayer(u.id, "A")}
                      className={`px-2 py-0.5 text-xs rounded ${team === "A" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    >
                      A
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePlayer(u.id, "B")}
                      className={`px-2 py-0.5 text-xs rounded ${team === "B" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
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
          <label className="block text-sm font-medium mb-1">Outcome</label>
          <select
            value={outcome}
            onChange={(e) =>
              setOutcome(e.target.value as "team_a" | "team_b" | "tie")
            }
            className="w-full border rounded-md px-3 py-2 text-sm"
          >
            <option value="team_a">Team A wins</option>
            <option value="team_b">Team B wins</option>
            <option value="tie">Tie</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Match"}
        </button>
      </form>
    </div>
  );
}
