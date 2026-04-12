import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";

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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [matches, setMatches] = useState<MatchHistory[]>([]);
  const [newRating, setNewRating] = useState(0);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${userId}`);
      if (res.ok) {
        const data = (await res.json()) as {
          user: UserProfile;
          ratings: Rating[];
          matches: MatchHistory[];
        };
        setProfile(data.user);
        setRatings(data.ratings);
        setMatches(data.matches);
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
      <div className="text-center py-8 text-[var(--color-text-muted)] font-heading text-xs">
        LOADING...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-8 text-[var(--color-loss)] font-heading text-xs">
        USER NOT FOUND
      </div>
    );
  }

  const isSelf = user?.id === profile.id;

  return (
    <div className="space-y-4">
      {/* Player header */}
      <Card variant="cyan">
        <h1 className="font-heading text-base text-[var(--color-neon-cyan)] mb-4">
          {profile.name}
        </h1>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="font-heading text-lg text-[var(--color-neon-green)]">
              {profile.points}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
              Points
            </div>
          </div>
          <div className="text-center">
            <div className="font-heading text-lg text-[var(--color-win)]">
              {profile.wins}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
              Wins
            </div>
          </div>
          <div className="text-center">
            <div className="font-heading text-lg text-[var(--color-loss)]">
              {profile.losses}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
              Losses
            </div>
          </div>
          <div className="text-center">
            <div className="font-heading text-lg text-[var(--color-neon-yellow)]">
              {profile.avg_rating}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
              Avg Rating
            </div>
          </div>
          <div className="text-center">
            <div className="font-heading text-lg text-[var(--color-text)]">
              {profile.rating_count}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
              Ratings
            </div>
          </div>
        </div>
        {isSelf && (
          <div className="mt-4">
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                await logout();
                navigate("/");
              }}
            >
              Logout
            </Button>
          </div>
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
                      className={`text-2xl transition-colors ${
                        star <= newRating
                          ? "text-[var(--color-neon-yellow)]"
                          : "text-[var(--color-border)]"
                      } hover:text-[var(--color-neon-yellow)]`}
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
                  size="sm"
                >
                  {submitting ? "Saving..." : "Submit Rating"}
                </Button>
              </div>
            ) : (
              <Button onClick={openLoginModal}>Login to rate</Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ratings list */}
      {ratings.length > 0 && (
        <Card variant="yellow">
          <CardHeader>
            <CardTitle>Ratings ({ratings.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ratings.map((r) => (
                <div
                  key={r.id}
                  className="border-2 border-[var(--color-border)] p-3 bg-[var(--color-bg)]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-[var(--color-neon-cyan)] uppercase tracking-wider">
                      {r.rater_name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-neon-yellow)] text-sm">
                        {"★".repeat(r.rating)}
                        <span className="text-[var(--color-border)]">
                          {"★".repeat(5 - r.rating)}
                        </span>
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--color-text)]">{r.note}</p>
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
                className="border-2 border-[var(--color-border)] p-3 bg-[var(--color-bg)] flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-sm text-[var(--color-text-heading)]">
                    {m.game_name}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">
                    {new Date(m.played_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      m.outcome === "win"
                        ? "green"
                        : m.outcome === "loss"
                          ? "pink"
                          : "yellow"
                    }
                  >
                    {m.outcome}
                  </Badge>
                  <span className="font-heading text-xs text-[var(--color-neon-green)]">
                    +{m.points_earned}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {matches.length === 0 && (
            <div className="text-center py-6 text-[var(--color-text-muted)] text-sm">
              No matches yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
