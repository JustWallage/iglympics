import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useCachedFetch } from "../lib/useCachedFetch";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Plus, TrendingUp, Clock, CheckCircle, XCircle } from "lucide-react";

interface Market {
  id: number;
  question: string;
  description: string | null;
  closes_at: string;
  resolved_outcome: string | null;
  resolved_at: string | null;
  created_at: string;
  created_by_name: string;
  yes_total: number;
  no_total: number;
  yes_percent: number;
  no_percent: number;
  participant_count: number;
  is_open: boolean;
  my_position: { position: string; amount: number } | null;
}

interface MarketsResponse {
  markets: Market[];
}

export default function Bets() {
  const { user, openLoginModal } = useAuth();
  const {
    data,
    loading,
    mutate: fetchMarkets,
  } = useCachedFetch<MarketsResponse>("/api/bets");
  const markets = data?.markets ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const handleCreate = async () => {
    if (!question || !closesAt) return;
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, description: description || undefined, closes_at: closesAt }),
      });
      if (res.ok) {
        setQuestion("");
        setDescription("");
        setClosesAt("");
        setShowCreate(false);
        fetchMarkets();
      } else {
        const err = await res.json();
        setMessage((err as { error: string }).error || "Failed to create");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBet = async (marketId: number, position: "yes" | "no") => {
    if (!user) {
      openLoginModal();
      return;
    }
    const res = await fetch(`/api/bets/${marketId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position, amount: 1 }),
    });
    if (res.ok) {
      fetchMarkets();
    }
  };

  const handleResolve = async (marketId: number, outcome: "yes" | "no") => {
    const res = await fetch(`/api/bets/${marketId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    if (res.ok) {
      fetchMarkets();
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white/90 flex items-center gap-2">
          <TrendingUp size={24} />
          Predictions
        </h1>
        {user && (
          <Button
            size="sm"
            onClick={() => setShowCreate(!showCreate)}
            variant={showCreate ? "secondary" : "primary"}
          >
            <Plus size={16} className="mr-1" />
            New Bet
          </Button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <Card>
          <h2 className="text-sm font-semibold text-white/80 mb-3">
            Create a prediction market
          </h2>
          <div className="space-y-3">
            <Input
              placeholder="Will X happen? (yes/no question)"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <Textarea
              placeholder="Optional description or context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
            <div>
              <label className="text-xs text-white/50 mb-1 block">
                Closes at
              </label>
              <Input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
              />
            </div>
            {message && (
              <p className="text-xs text-red-400">{message}</p>
            )}
            <Button
              onClick={handleCreate}
              disabled={submitting || !question || !closesAt}
              className="w-full"
            >
              {submitting ? "Creating..." : "Create Market"}
            </Button>
          </div>
        </Card>
      )}

      {/* Markets list */}
      {markets.length === 0 && (
        <Card>
          <p className="text-center text-white/50 text-sm py-4">
            No predictions yet. Be the first to create one!
          </p>
        </Card>
      )}

      {markets.map((market) => (
        <MarketCard
          key={market.id}
          market={market}
          currentUser={user}
          onBet={handleBet}
          onResolve={handleResolve}
          formatDate={formatDate}
        />
      ))}
    </div>
  );
}

function MarketCard({
  market,
  currentUser,
  onBet,
  onResolve,
  formatDate,
}: {
  market: Market;
  currentUser: { id: number; name: string } | null;
  onBet: (id: number, position: "yes" | "no") => void;
  onResolve: (id: number, outcome: "yes" | "no") => void;
  formatDate: (s: string) => string;
}) {
  const isResolved = !!market.resolved_outcome;
  const isClosed = !market.is_open && !isResolved;
  const isCreator = currentUser?.name === market.created_by_name;

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-white/90 leading-tight">
          {market.question}
        </h3>
        {isResolved ? (
          <Badge
            className={
              market.resolved_outcome === "yes"
                ? "bg-green-500/20 text-green-400 border-green-500/30"
                : "bg-red-500/20 text-red-400 border-red-500/30"
            }
          >
            {market.resolved_outcome === "yes" ? "Yes" : "No"}
          </Badge>
        ) : isClosed ? (
          <Badge className="bg-white/10 text-white/50 border-white/10">
            Closed
          </Badge>
        ) : (
          <Badge className="bg-accent/20 text-accent-light border-accent/30">
            Open
          </Badge>
        )}
      </div>

      {market.description && (
        <p className="text-xs text-white/50">{market.description}</p>
      )}

      {/* Probability bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-white/60">
          <span className="text-green-400">Yes {market.yes_percent}%</span>
          <span className="text-red-400">No {market.no_percent}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden flex">
          <div
            className="bg-green-500/60 transition-all duration-300"
            style={{ width: `${market.yes_percent}%` }}
          />
          <div
            className="bg-red-500/60 transition-all duration-300"
            style={{ width: `${market.no_percent}%` }}
          />
        </div>
      </div>

      {/* Bet buttons */}
      {market.is_open && !isResolved && (
        <div className="flex gap-2">
          <button
            onClick={() => onBet(market.id, "yes")}
            className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
              market.my_position?.position === "yes"
                ? "bg-green-500/30 text-green-300 border border-green-500/40"
                : "bg-white/[0.04] text-white/60 border border-white/[0.08] hover:bg-green-500/10 hover:text-green-400"
            }`}
          >
            <CheckCircle size={14} className="inline mr-1" />
            Yes
          </button>
          <button
            onClick={() => onBet(market.id, "no")}
            className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
              market.my_position?.position === "no"
                ? "bg-red-500/30 text-red-300 border border-red-500/40"
                : "bg-white/[0.04] text-white/60 border border-white/[0.08] hover:bg-red-500/10 hover:text-red-400"
            }`}
          >
            <XCircle size={14} className="inline mr-1" />
            No
          </button>
        </div>
      )}

      {/* Resolve buttons for creator */}
      {!isResolved && isClosed && isCreator && (
        <div className="space-y-2">
          <p className="text-xs text-white/50">
            Resolve this market:
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 !text-green-400"
              onClick={() => onResolve(market.id, "yes")}
            >
              Resolve Yes
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 !text-red-400"
              onClick={() => onResolve(market.id, "no")}
            >
              Resolve No
            </Button>
          </div>
        </div>
      )}

      {/* Meta info */}
      <div className="flex items-center justify-between text-[10px] text-white/40">
        <span>by {market.created_by_name}</span>
        <span className="flex items-center gap-1">
          <Clock size={10} />
          {isResolved
            ? `Resolved ${formatDate(market.resolved_at!)}`
            : `Closes ${formatDate(market.closes_at)}`}
        </span>
        <span>{market.participant_count} bets</span>
      </div>
    </Card>
  );
}
