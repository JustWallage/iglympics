import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  points: number;
  wins: number;
  losses: number;
  ties: number;
  matches_played: number;
  avg_rating: string;
  my_rating: number | null;
}

interface MatchHistory {
  id: number;
  game_name: string;
  played_at: string;
  outcome: string;
  points_earned: number;
}

export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const { subscribe } = useWebSocket();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [matches, setMatches] = useState<MatchHistory[]>([]);
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${userId}`);
      if (res.ok) {
        const data = (await res.json()) as { user: UserProfile; matches: MatchHistory[] };
        setProfile(data.user);
        setMatches(data.matches);
        if (data.user.my_rating) setRating(data.user.my_rating);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const unsub1 = subscribe("match_created", () => fetchProfile());
    const unsub2 = subscribe("rating_updated", () => fetchProfile());
    return () => {
      unsub1();
      unsub2();
    };
  }, [subscribe, fetchProfile]);

  const submitRating = async () => {
    if (rating < 1 || rating > 5) return;
    setSubmitting(true);
    try {
      await fetch(`/api/users/${userId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      await fetchProfile();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  if (!profile) {
    return <div className="text-center py-8 text-red-500">User not found</div>;
  }

  const isSelf = user?.id === profile.id;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold">{profile.name}</h1>
        <p className="text-gray-500 text-sm">{profile.email}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{profile.points}</div>
            <div className="text-xs text-gray-500">Points</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {profile.wins}
            </div>
            <div className="text-xs text-gray-500">Wins</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {profile.losses}
            </div>
            <div className="text-xs text-gray-500">Losses</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {profile.avg_rating}
            </div>
            <div className="text-xs text-gray-500">Avg Rating</div>
          </div>
        </div>
      </div>

      {!isSelf && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-3">Rate this player</h2>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`text-2xl ${
                  star <= rating ? "text-yellow-400" : "text-gray-300"
                } hover:text-yellow-400`}
              >
                ★
              </button>
            ))}
            <button
              onClick={submitRating}
              disabled={submitting || rating === 0}
              className="ml-4 bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Submit"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <h2 className="text-lg font-semibold p-6 pb-3">Match History</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Game</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Result</th>
              <th className="text-right px-4 py-3 font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-4 py-3">{m.game_name}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(m.played_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      m.outcome === "win"
                        ? "text-green-600"
                        : m.outcome === "loss"
                          ? "text-red-600"
                          : "text-yellow-600"
                    }
                  >
                    {m.outcome.charAt(0).toUpperCase() + m.outcome.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{m.points_earned}</td>
              </tr>
            ))}
            {matches.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  No matches yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
