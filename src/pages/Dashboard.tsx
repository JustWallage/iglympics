import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWebSocket } from "../context/WebSocketContext";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Trophy, Star, MessageCircle, Swords } from "lucide-react";

interface PlayerScore {
  id: number;
  name: string;
  points: number;
  wins: number;
  losses: number;
  avg_rating: string;
}

interface ChatMessage {
  id: number;
  content: string;
  created_at: string;
  user_name: string;
}

interface Match {
  id: number;
  game_name: string;
  outcome: string;
  played_at: string;
  team_a: string[];
  team_b: string[];
  status: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { subscribe } = useWebSocket();
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastMatch, setLastMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [scoreRes, msgRes, matchRes] = await Promise.all([
        fetch("/api/scoreboard"),
        fetch("/api/messages?limit=5"),
        fetch("/api/matches"),
      ]);

      if (scoreRes.ok) {
        const data = (await scoreRes.json()) as { scores: PlayerScore[] };
        setScores(data.scores);
      }
      if (msgRes.ok) {
        const data = (await msgRes.json()) as { messages: ChatMessage[] };
        setMessages(data.messages);
      }
      if (matchRes.ok) {
        const data = (await matchRes.json()) as { matches: Match[] };
        if (data.matches.length > 0) {
          setLastMatch(data.matches[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const unsub1 = subscribe("match_created", () => fetchAll());
    const unsub2 = subscribe("rating_updated", () => fetchAll());
    const unsub3 = subscribe("chat_message", () => fetchAll());
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [subscribe, fetchAll]);

  if (loading) {
    return (
      <div className="text-center py-12 text-white/35 text-sm">Loading...</div>
    );
  }

  const top3 = scores.slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];

  // Highest and lowest rated (with at least 1 rating)
  const rated = scores.filter((s) => parseFloat(s.avg_rating) > 0);
  const highestRated = rated.length > 0
    ? rated.reduce((a, b) =>
        parseFloat(a.avg_rating) >= parseFloat(b.avg_rating) ? a : b,
      )
    : null;
  const lowestRated = rated.length > 1
    ? rated.reduce((a, b) =>
        parseFloat(a.avg_rating) <= parseFloat(b.avg_rating) ? a : b,
      )
    : null;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-white/90">Dashboard</h1>

      {/* Top 3 */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={16} className="text-amber-400" />
          <span className="text-sm font-semibold text-white/80">Top Players</span>
        </div>
        <div className="space-y-2">
          {top3.map((p, i) => (
            <div
              key={p.id}
              onClick={() => navigate(`/profile/${p.id}`)}
              className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5 cursor-pointer active:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{medals[i]}</span>
                <span className="text-sm font-medium text-accent-light">
                  {p.name}
                </span>
              </div>
              <div className="text-sm font-semibold text-white/80 tabular-nums">
                {p.points} pts
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Ratings highlight */}
      {(highestRated || lowestRated) && (
        <div className="grid grid-cols-2 gap-3">
          {highestRated && (
            <Card
              className="cursor-pointer active:bg-white/[0.06] transition-colors"
              onClick={() => navigate(`/profile/${highestRated.id}`)}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Star size={14} className="text-amber-400" />
                <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                  Highest Rated
                </span>
              </div>
              <div className="text-sm font-semibold text-accent-light">
                {highestRated.name}
              </div>
              <div className="text-lg font-bold text-white/90 tabular-nums">
                {highestRated.avg_rating} ★
              </div>
            </Card>
          )}
          {lowestRated && lowestRated.id !== highestRated?.id && (
            <Card
              className="cursor-pointer active:bg-white/[0.06] transition-colors"
              onClick={() => navigate(`/profile/${lowestRated.id}`)}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Star size={14} className="text-red-400" />
                <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                  Lowest Rated
                </span>
              </div>
              <div className="text-sm font-semibold text-accent-light">
                {lowestRated.name}
              </div>
              <div className="text-lg font-bold text-white/90 tabular-nums">
                {lowestRated.avg_rating} ★
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Last Match */}
      {lastMatch && (
        <Card
          className="cursor-pointer active:bg-white/[0.06] transition-colors"
          onClick={() => navigate("/matches")}
        >
          <div className="flex items-center gap-2 mb-3">
            <Swords size={16} className="text-accent-light" />
            <span className="text-sm font-semibold text-white/80">Latest Match</span>
            <Badge
              variant={lastMatch.status === "confirmed" ? "success" : "default"}
              className="ml-auto"
            >
              {lastMatch.status === "confirmed" ? "Confirmed" : "Pending"}
            </Badge>
          </div>
          <div className="text-sm font-medium text-white/90 mb-1">
            {lastMatch.game_name}
          </div>
          <div className="text-xs text-white/40 mb-2">
            {new Date(lastMatch.played_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}{" "}
            · {new Date(lastMatch.played_at).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={
                lastMatch.outcome === "team_a"
                  ? "text-emerald-400 font-medium"
                  : "text-white/50"
              }
            >
              {lastMatch.team_a.join(", ")}
            </span>
            <span className="text-white/20 text-[10px]">vs</span>
            <span
              className={
                lastMatch.outcome === "team_b"
                  ? "text-emerald-400 font-medium"
                  : "text-white/50"
              }
            >
              {lastMatch.team_b.join(", ")}
            </span>
          </div>
        </Card>
      )}

      {/* Recent Chat */}
      <Card
        className="cursor-pointer active:bg-white/[0.06] transition-colors"
        onClick={() => navigate("/chat")}
      >
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle size={16} className="text-sky-400" />
          <span className="text-sm font-semibold text-white/80">Recent Chat</span>
        </div>
        {messages.length === 0 ? (
          <p className="text-xs text-white/30">No messages yet</p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-2 text-xs">
                <span className="text-accent-light font-medium shrink-0">
                  {msg.user_name}
                </span>
                <span className="text-white/60 truncate">{msg.content}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
