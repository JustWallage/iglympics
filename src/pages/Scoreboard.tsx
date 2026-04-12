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
      <div className="text-center py-8 text-[var(--color-text-muted)] font-heading text-xs">
        LOADING...
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-heading text-lg text-[var(--color-neon-pink)] mb-5">
        Scoreboard
      </h1>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[var(--color-border)]">
              <th className="text-left px-3 py-3 font-heading text-[9px] text-[var(--color-text-muted)]">
                #
              </th>
              <th className="text-left px-3 py-3 font-heading text-[9px] text-[var(--color-text-muted)]">
                Player
              </th>
              <th className="text-right px-3 py-3 font-heading text-[9px] text-[var(--color-text-muted)]">
                PTS
              </th>
              <th className="text-right px-3 py-3 font-heading text-[9px] text-[var(--color-text-muted)]">
                W
              </th>
              <th className="text-right px-3 py-3 font-heading text-[9px] text-[var(--color-text-muted)]">
                L
              </th>
              <th className="text-right px-3 py-3 font-heading text-[9px] text-[var(--color-text-muted)]">
                T
              </th>
              <th className="text-right px-3 py-3 font-heading text-[9px] text-[var(--color-text-muted)]">
                ★
              </th>
            </tr>
          </thead>
          <tbody>
            {scores.map((player, i) => (
              <tr
                key={player.id}
                onClick={() => navigate(`/profile/${player.id}`)}
                className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer active:bg-[var(--color-bg-elevated)]"
              >
                <td className="px-3 py-3 font-heading text-xs text-[var(--color-text-muted)]">
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td className="px-3 py-3 text-[var(--color-neon-cyan)] font-bold uppercase tracking-wider">
                  {player.name}
                </td>
                <td className="px-3 py-3 text-right font-heading text-sm text-[var(--color-neon-green)]">
                  {player.points}
                </td>
                <td className="px-3 py-3 text-right text-[var(--color-win)]">
                  {player.wins}
                </td>
                <td className="px-3 py-3 text-right text-[var(--color-loss)]">
                  {player.losses}
                </td>
                <td className="px-3 py-3 text-right text-[var(--color-tie)]">
                  {player.ties}
                </td>
                <td className="px-3 py-3 text-right text-[var(--color-neon-yellow)]">
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
