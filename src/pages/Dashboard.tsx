import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import { useCachedFetch } from "../lib/useCachedFetch";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import MusicPlayer from "../components/MusicPlayer";
import { Trophy, MessageCircle, Swords, Gamepad2, Volume2, Loader2 } from "lucide-react";
import StoriesBar from "../components/Stories/StoriesBar";

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

interface MinigameLeaderEntry {
  user_id: number;
  user_name: string;
  points: number;
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
  const { user } = useAuth();
  const { subscribe } = useWebSocket();

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [briefingText, setBriefingText] = useState<string | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const LOADING_MESSAGES = [
    "Thinking deeply...",
    "Creating your special briefing...",
    "Any moment now...",
    "Just give me a bit more time...",
    "Consulting the Belgian archives...",
    "Polishing the microphone...",
    "Asking the moules-frites oracle...",
    "Almost ready to broadcast...",
    "Calculating your disappointment score...",
    "Summoning dry wit...",
  ];

  const playDailySummary = async () => {
    setAiLoading(true);
    setAiError(null);
    setBriefingText(null);
    setLoadingMsgIdx(0);
    loadingIntervalRef.current = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2500);
    try {
      const res = await fetch("/api/daily-summary");
      if (!res.ok) throw new Error("Failed to generate summary");
      const rawText = res.headers.get("X-Briefing-Text");
      if (rawText) setBriefingText(decodeURIComponent(rawText));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play();
    } catch {
      setAiError("Something went wrong, try again.");
    } finally {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
      setAiLoading(false);
    }
  };

  const { data: scoreData, loading: scoreLoading, mutate: mutateScores } =
    useCachedFetch<{ scores: PlayerScore[] }>("/api/scoreboard");
  const { data: msgData, loading: msgLoading, mutate: mutateMessages } =
    useCachedFetch<{ messages: ChatMessage[] }>("/api/messages?limit=5");
  const { data: matchData, loading: matchLoading, mutate: mutateMatches } =
    useCachedFetch<{ matches: Match[] }>("/api/matches");
  const { data: mgData, mutate: mutateMg } =
    useCachedFetch<{ global_leaderboard: MinigameLeaderEntry[] }>("/api/minigame-scores");

  const scores = scoreData?.scores ?? [];
  const messages = msgData?.messages ?? [];
  const lastMatch = matchData?.matches?.[0] ?? null;
  const minigameTop = (mgData?.global_leaderboard ?? []).slice(0, 3);
  const loading = scoreLoading || msgLoading || matchLoading;

  useEffect(() => {
    const unsub1 = subscribe("match_created", () => {
      mutateScores();
      mutateMatches();
    });
    const unsub2 = subscribe("rating_updated", () => mutateScores());
    const unsub3 = subscribe("chat_message", () => mutateMessages());
    const unsub4 = subscribe("minigame_score", () => mutateMg());
    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, [subscribe, mutateScores, mutateMatches, mutateMessages, mutateMg]);

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

      {/* Stories / Snaps bar */}
      <StoriesBar />

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
                <span className="text-amber-400" style={{ fontSize: 14 }}>🍆</span>
                <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                  Highest Rated
                </span>
              </div>
              <div className="text-sm font-semibold text-accent-light">
                {highestRated.name}
              </div>
              <div className="text-lg font-bold text-white/90 tabular-nums">
                {highestRated.avg_rating} 🍆
              </div>
            </Card>
          )}
          {lowestRated && lowestRated.id !== highestRated?.id && (
            <Card
              className="cursor-pointer active:bg-white/[0.06] transition-colors"
              onClick={() => navigate(`/profile/${lowestRated.id}`)}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-red-400" style={{ fontSize: 14 }}>🍆</span>
                <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                  Lowest Rated
                </span>
              </div>
              <div className="text-sm font-semibold text-accent-light">
                {lowestRated.name}
              </div>
              <div className="text-lg font-bold text-white/90 tabular-nums">
                {lowestRated.avg_rating} 🍆
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

      {/* Minigame Champions */}
      {minigameTop.length > 0 && (
        <Card
          className="cursor-pointer active:bg-white/[0.06] transition-colors"
          onClick={() => navigate("/games")}
        >
          <div className="flex items-center gap-2 mb-3">
            <Gamepad2 size={16} className="text-fuchsia-400" />
            <span className="text-sm font-semibold text-white/80">Minigame Champions</span>
          </div>
          <div className="space-y-2">
            {minigameTop.map((entry, i) => (
              <div
                key={entry.user_id}
                className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{["🥇", "🥈", "🥉"][i]}</span>
                  <span className="text-sm text-white/80">{entry.user_name}</span>
                </div>
                <span className="text-sm font-semibold text-white/70 tabular-nums">
                  {entry.points} pts
                </span>
              </div>
            ))}
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

      {/* Daily Briefing */}
      {user && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Volume2 size={16} className="text-indigo-400" />
            <span className="text-sm font-semibold text-white/80">Daily Briefing</span>
          </div>
          <p className="text-xs text-white/40 mb-3">
            AI-generated spoken summary of today's highlights.
          </p>
          {aiLoading && (
            <p className="shimmer-text text-sm font-medium mb-3 min-h-5">
              {LOADING_MESSAGES[loadingMsgIdx]}
            </p>
          )}
          {aiError && (
            <p className="text-xs text-red-400 mb-3">{aiError}</p>
          )}
          {briefingText && !aiLoading && (
            <p className="text-xs text-white/55 leading-relaxed mb-3 italic">
              {briefingText}
            </p>
          )}
          <button
            onClick={playDailySummary}
            disabled={aiLoading}
            className="flex items-center gap-2 h-10 px-4 w-full justify-center rounded-xl bg-accent/15 text-accent-light text-sm font-medium hover:bg-accent/25 transition-colors disabled:opacity-50"
          >
            {aiLoading ? (
              <><Loader2 size={14} className="animate-spin" /> Generating...</>
            ) : (
              <><Volume2 size={14} /> Play today's briefing</>
            )}
          </button>
        </Card>
      )}

      {/* Music Player */}
      <MusicPlayer />
    </div>
  );
}
