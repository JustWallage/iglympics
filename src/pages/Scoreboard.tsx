import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useWebSocket } from "../context/WebSocketContext";

interface PlayerScore {
  id: number;
  name: string;
  points: number;
  wins: number;
  losses: number;
  ties: number;
  matches_played: number;
  avg_rating: string;
}

export default function Scoreboard() {
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [loading, setLoading] = useState(true);
  const { subscribe } = useWebSocket();

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
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Scoreboard</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium">#</th>
              <th className="text-left px-4 py-3 font-medium">Player</th>
              <th className="text-right px-4 py-3 font-medium">Points</th>
              <th className="text-right px-4 py-3 font-medium">W</th>
              <th className="text-right px-4 py-3 font-medium">L</th>
              <th className="text-right px-4 py-3 font-medium">T</th>
              <th className="text-right px-4 py-3 font-medium">Played</th>
              <th className="text-right px-4 py-3 font-medium">Rating</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((player, i) => (
              <tr key={player.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                <td className="px-4 py-3">
                  <Link
                    to={`/profile/${player.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {player.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {player.points}
                </td>
                <td className="px-4 py-3 text-right text-green-600">
                  {player.wins}
                </td>
                <td className="px-4 py-3 text-right text-red-600">
                  {player.losses}
                </td>
                <td className="px-4 py-3 text-right text-yellow-600">
                  {player.ties}
                </td>
                <td className="px-4 py-3 text-right">{player.matches_played}</td>
                <td className="px-4 py-3 text-right">{player.avg_rating}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
