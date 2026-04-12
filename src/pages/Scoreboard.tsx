import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWebSocket } from "../context/WebSocketContext";
import { Card } from "../components/ui/card";

interface PlayerScore {
  id: number;
  name: string;
  points: number;
  wins: number;
  losses: number;
  ties: number;
  matches_played: number;
  avg_rating: string;
  rating_count: number;
}

export default function Scoreboard() {
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [loading, setLoading] = useState(true);
  const { subscribe } = useWebSocket();
  const navigate = useNavigate();

  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch("/api/scoreboard");
      if (res.ok) {
        const data = await res.json();
        setScores((data as { scores: PlayerScore[] }).scores);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  useEffect(() => {
    const unsub1 = subscribe("match_created", () => fetchScores());
    const unsub2 = subscribe("rating_updated", () => fetchScores());
    return () => {
      unsub1();
      unsub2();
    };
  }, [subscribe, fetchScores]);

  if (loading) {
    return (
      <div className="text-center py-12 text-white/35 text-sm">Loading...</div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white/90 mb-4">Scoreboard</h1>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left px-4 py-3 text-xs font-medium text-white/35">
                #
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white/35">
                Player
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-white/35">
                Pts
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-white/35">
                W
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-white/35">
                L
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-white/35">
                T
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-white/35">
                ★
              </th>
            </tr>
          </thead>
          <tbody>
            {scores.map((player, i) => (
              <tr
                key={player.id}
                onClick={() => navigate(`/profile/${player.id}`)}
                className="border-b border-white/[0.04] cursor-pointer transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
              >
                <td className="px-4 py-3.5 text-white/30 text-xs">
                  {i + 1}
                </td>
                <td className="px-4 py-3.5 text-accent-light font-medium">
                  {player.name}
                </td>
                <td className="px-4 py-3.5 text-right font-semibold text-white/90 tabular-nums">
                  {player.points}
                </td>
                <td className="px-4 py-3.5 text-right text-emerald-400 tabular-nums">
                  {player.wins}
                </td>
                <td className="px-4 py-3.5 text-right text-red-400 tabular-nums">
                  {player.losses}
                </td>
                <td className="px-4 py-3.5 text-right text-amber-400 tabular-nums">
                  {player.ties}
                </td>
                <td className="px-4 py-3.5 text-right text-sky-400 tabular-nums">
                  {player.avg_rating}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
