import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import { useCachedFetch } from "../lib/useCachedFetch";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { LogOut } from "lucide-react";

interface UserProfile {
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

interface Rating {
  id: number;
  rating: number;
  note: string;
  created_at: string;
  rater_name: string;
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
  const { user, logout, openLoginModal } = useAuth();
  const { subscribe } = useWebSocket();
  const navigate = useNavigate();

  const profileUrl = userId ? `/api/users/${userId}` : null;
  const { data, loading, mutate: fetchProfile } = useCachedFetch<{
    user: UserProfile;
    ratings: Rating[];
    matches: MatchHistory[];
  }>(profileUrl);
  const profile = data?.user ?? null;
  const ratings = data?.ratings ?? [];
  const matches = data?.matches ?? [];

  const [newRating, setNewRating] = useState(0);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub1 = subscribe("match_created", () => fetchProfile());
    const unsub2 = subscribe("rating_updated", () => fetchProfile());
    return () => {
      unsub1();
      unsub2();
    };
  }, [subscribe, fetchProfile]);

  const submitRating = async () => {
    if (newRating < 1 || newRating > 5 || !note.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`/api/users/${userId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: newRating, note: note.trim() }),
      });
      setNewRating(0);
      setNote("");
      await fetchProfile();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-white/35 text-sm">Loading...</div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12 text-red-400 text-sm">
        User not found
      </div>
    );
  }

  const isSelf = user?.id === profile.id;

  return (
    <div className="space-y-4">
      {/* Player header */}
      <Card>
        <h1 className="text-xl font-bold text-white/90 mb-4">
          {profile.name}
        </h1>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center rounded-xl bg-white/[0.04] py-3">
            <div className="text-xl font-bold text-white/90">
              {profile.points}
            </div>
            <div className="text-[11px] text-white/35 mt-0.5">Points</div>
          </div>
          <div className="text-center rounded-xl bg-white/[0.04] py-3">
            <div className="text-xl font-bold text-emerald-400">
              {profile.wins}
            </div>
            <div className="text-[11px] text-white/35 mt-0.5">Wins</div>
          </div>
          <div className="text-center rounded-xl bg-white/[0.04] py-3">
            <div className="text-xl font-bold text-red-400">
              {profile.losses}
            </div>
            <div className="text-[11px] text-white/35 mt-0.5">Losses</div>
          </div>
          <div className="text-center rounded-xl bg-white/[0.04] py-3">
            <div className="text-xl font-bold text-amber-400">
              {profile.avg_rating}
            </div>
            <div className="text-[11px] text-white/35 mt-0.5">Avg Rating</div>
          </div>
          <div className="text-center rounded-xl bg-white/[0.04] py-3">
            <div className="text-xl font-bold text-white/60">
              {profile.rating_count}
            </div>
            <div className="text-[11px] text-white/35 mt-0.5">Ratings</div>
          </div>
          <div className="text-center rounded-xl bg-white/[0.04] py-3">
            <div className="text-xl font-bold text-sky-400">
              {profile.matches_played}
            </div>
            <div className="text-[11px] text-white/35 mt-0.5">Played</div>
          </div>
        </div>
        {isSelf && (
          <Button
            variant="danger"
            size="sm"
            className="mt-4 w-full gap-2"
            onClick={async () => {
              await logout();
              navigate("/");
            }}
          >
            <LogOut size={16} />
            Logout
          </Button>
        )}
      </Card>

      {/* Rate this player */}
      {!isSelf && (
        <Card>
          <CardHeader>
            <CardTitle>Rate this player</CardTitle>
          </CardHeader>
          <CardContent>
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setNewRating(star)}
                      className={`text-2xl transition-colors p-1 ${
                        star <= newRating
                          ? "text-amber-400"
                          : "text-white/15 hover:text-amber-400/50"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Write a note (required)"
                  required
                  rows={2}
                />
                <Button
                  onClick={submitRating}
                  disabled={submitting || newRating === 0 || !note.trim()}
                  className="w-full"
                >
                  {submitting ? "Saving..." : "Submit Rating"}
                </Button>
              </div>
            ) : (
              <Button onClick={openLoginModal} className="w-full">
                Login to rate
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ratings list */}
      {ratings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ratings ({ratings.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ratings.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-accent-light">
                      {r.rater_name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 text-sm">
                        {"★".repeat(r.rating)}
                        <span className="text-white/15">
                          {"★".repeat(5 - r.rating)}
                        </span>
                      </span>
                      <span className="text-[11px] text-white/30">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-white/60">{r.note}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Match History */}
      <Card>
        <CardHeader>
          <CardTitle>Match History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {matches.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium text-sm text-white/80">
                    {m.game_name}
                  </div>
                  <div className="text-[11px] text-white/30 mt-0.5">
                    {new Date(m.played_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      m.outcome === "win"
                        ? "success"
                        : m.outcome === "loss"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {m.outcome}
                  </Badge>
                  <span className="text-sm font-medium text-white/60 tabular-nums">
                    +{m.points_earned}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {matches.length === 0 && (
            <div className="text-center py-8 text-white/30 text-sm">
              No matches yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
