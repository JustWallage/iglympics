import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ArrowLeft, Users, Loader2, Trophy, Dice1, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MexenPlayerState {
  id: number;
  name: string;
  score: number;
  throwsLeft: number;
  keptDice: number[];
  currentRoll: number[];
  finished: boolean;
  connected: boolean;
}

interface MexenGameState {
  players: MexenPlayerState[];
  status: "waiting" | "playing" | "finished";
  currentPlayerIndex: number;
  round: number;
  maxRounds: number;
  scores: Record<number, number>;
  winner: { id: number; name: string } | null;
  lastAction: string;
  createdBy: string;
}

interface MexenListEntry {
  id: string;
  createdBy: string;
  status: string;
  players: { id: number; name: string }[];
  createdAt: number;
}

// ─── Dice Face Component ─────────────────────────────────────────────────────

function DiceFace({ value, size = "lg", rolling = false, highlight = false }: {
  value: number;
  size?: "sm" | "lg";
  rolling?: boolean;
  highlight?: boolean;
}) {
  const sizeClass = size === "lg" ? "w-16 h-16 text-2xl" : "w-10 h-10 text-lg";
  const dots: Record<number, string> = {
    1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅",
  };

  return (
    <div className={`
      ${sizeClass} flex items-center justify-center rounded-xl font-bold
      ${rolling ? "animate-bounce" : ""}
      ${highlight ? "bg-yellow-400/30 border-yellow-400 ring-2 ring-yellow-400" : "bg-white/10 border-white/20"}
      border-2 shadow-lg transition-all duration-300
    `}>
      <span className={`${rolling ? "animate-spin" : ""}`}>
        {dots[value] || "?"}
      </span>
    </div>
  );
}

// ─── Score Display ───────────────────────────────────────────────────────────

function ScoreBoard({ players, scores, round, maxRounds }: {
  players: MexenPlayerState[];
  scores: Record<number, number>;
  round: number;
  maxRounds: number;
}) {
  return (
    <div className="flex items-center justify-center gap-6 mb-4">
      {players.map((p, i) => (
        <div key={p.id} className="flex flex-col items-center">
          <span className="text-sm text-white/60">{p.name}</span>
          <span className="text-2xl font-bold text-white">{scores[p.id] || 0}</span>
          {i < players.length - 1 && (
            <span className="absolute text-white/40 text-sm">vs</span>
          )}
        </div>
      ))}
      <Badge variant="default" className="ml-2">
        Round {round}/{maxRounds}
      </Badge>
    </div>
  );
}

// ─── Main Mexen Component ────────────────────────────────────────────────────

export default function Mexen() {
  const { user } = useAuth();
  const [view, setView] = useState<"lobby" | "game">("lobby");
  const [games, setGames] = useState<MexenListEntry[]>([]);
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<MexenGameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [rolling, setRolling] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const lobbyInterval = useRef<ReturnType<typeof setInterval>>(undefined);

  // ─── Lobby Logic ─────────────────────────────────────────────────────────

  const fetchGames = useCallback(async () => {
    try {
      const res = await fetch("/api/mexen/games");
      const data = await res.json() as { games: MexenListEntry[] };
      setGames(data.games || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (view === "lobby") {
      fetchGames();
      lobbyInterval.current = setInterval(fetchGames, 5000);
      return () => clearInterval(lobbyInterval.current);
    }
  }, [view, fetchGames]);

  const createGame = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch("/api/mexen/games", { method: "POST" });
      const data = await res.json() as { gameId: string };
      if (data.gameId) {
        setGameId(data.gameId);
        setView("game");
        connectWS(data.gameId);
      }
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async (id: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/mexen/game/join?gameId=${id}`, { method: "POST" });
      if (res.ok) {
        setGameId(id);
        setView("game");
        connectWS(id);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── WebSocket Logic ─────────────────────────────────────────────────────

  const connectWS = useCallback((gId: string) => {
    if (!user) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/api/mexen/game/ws?gameId=${gId}&userId=${user.id}&userName=${encodeURIComponent(user.name)}`
    );

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; payload: unknown };
        if (msg.type === "state") {
          setGameState(msg.payload as MexenGameState);
          setRolling(false);
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    wsRef.current = ws;
  }, [user]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  // ─── Game Actions ────────────────────────────────────────────────────────

  const rollDice = () => {
    if (!wsRef.current || rolling) return;
    setRolling(true);
    wsRef.current.send(JSON.stringify({ type: "roll" }));
    // Rolling animation resets when state arrives
    setTimeout(() => setRolling(false), 2000);
  };

  const backToLobby = () => {
    wsRef.current?.close();
    setView("lobby");
    setGameState(null);
    setGameId(null);
  };

  // ─── Determine current player state ──────────────────────────────────────

  const isMyTurn = gameState?.status === "playing" &&
    gameState.players[gameState.currentPlayerIndex]?.id === user?.id;
  const currentPlayer = gameState?.players[gameState?.currentPlayerIndex || 0];
  const myPlayer = gameState?.players.find(p => p.id === user?.id);
  const opponentPlayer = gameState?.players.find(p => p.id !== user?.id);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (view === "lobby") {
    return (
      <div className="min-h-screen p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/games" className="text-white/70 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            🎲 Mexen
          </h1>
        </div>

        {/* Rules Card */}
        <Card className="bg-white/5 border-white/10 p-4 mb-4">
          <h3 className="text-white font-semibold mb-2">📜 Spelregels</h3>
          <ul className="text-white/70 text-sm space-y-1 list-disc list-inside">
            <li>Gooi 2 dobbelstenen, 3 worpen per ronde</li>
            <li>Een 1, 2 of 3 <strong>moet</strong> worden vastgehouden</li>
            <li>De andere dobbelsteen wordt opnieuw gegooid — dit heet <strong className="text-yellow-400">doorjagen</strong></li>
            <li>Als beide dobbelstenen 4+ zijn, worden beide bewaard</li>
            <li>2+1 = <strong className="text-yellow-400">MEX</strong> (21 punten, directe winst!)</li>
            <li>Hoogste score wint de ronde. Best of 3 rondes wint!</li>
          </ul>
        </Card>

        {/* Create Game */}
        {user && (
          <Button
            onClick={createGame}
            disabled={loading}
            className="w-full mb-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-3"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Dice1 className="w-4 h-4 mr-2" />}
            Nieuw spel starten
          </Button>
        )}

        {!user && (
          <p className="text-center text-white/50 mb-4">Log in om te spelen</p>
        )}

        {/* Games List */}
        <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
          <Users className="w-4 h-4" /> Open spellen
        </h3>
        {games.length === 0 ? (
          <p className="text-white/50 text-sm text-center py-4">
            Geen open spellen. Start er een!
          </p>
        ) : (
          <div className="space-y-2">
            {games.map(g => (
              <Card key={g.id} className="bg-white/5 border-white/10 p-3 flex items-center justify-between">
                <div>
                  <span className="text-white font-medium">{g.createdBy}</span>
                  <span className="text-white/50 text-sm ml-2">
                    {g.players.length}/2 spelers
                  </span>
                  <Badge variant="default" className="ml-2 text-xs">
                    {g.status === "waiting" ? "Wacht op tegenstander" : "Bezig"}
                  </Badge>
                </div>
                {g.status === "waiting" && user && !g.players.some(p => p.id === user.id) && (
                  <Button size="sm" onClick={() => joinGame(g.id)} disabled={loading}>
                    Join
                  </Button>
                )}
                {g.players.some(p => p.id === user?.id) && (
                  <Button size="sm" variant="secondary" onClick={() => { setGameId(g.id); setView("game"); connectWS(g.id); }}>
                    Terug
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Game View ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={backToLobby} className="text-white/70 hover:text-white flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Terug
        </button>
        <h1 className="text-xl font-bold text-white">🎲 Mexen</h1>
        <Badge variant="default">{gameId?.slice(0, 6)}</Badge>
      </div>

      {/* Waiting State */}
      {gameState?.status === "waiting" && (
        <Card className="bg-white/5 border-white/10 p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto mb-4" />
          <h2 className="text-white text-lg font-semibold mb-2">Wachten op tegenstander...</h2>
          <p className="text-white/60 text-sm">Deel de link zodat iemand kan joinen!</p>
          <p className="text-white/40 text-xs mt-2">Game ID: {gameId}</p>
        </Card>
      )}

      {/* Playing State */}
      {gameState && gameState.status !== "waiting" && (
        <>
          {/* Scoreboard */}
          <ScoreBoard
            players={gameState.players}
            scores={gameState.scores}
            round={gameState.round}
            maxRounds={gameState.maxRounds}
          />

          {/* Game Area */}
          <Card className="bg-gradient-to-b from-green-900/40 to-green-950/60 border-green-700/30 p-6 mb-4">
            {/* Turn Indicator */}
            <div className="text-center mb-4">
              {gameState.status === "playing" && (
                <Badge className={isMyTurn
                  ? "bg-amber-500/20 text-amber-300 border-amber-500"
                  : "bg-white/10 text-white/60 border-white/20"
                }>
                  {isMyTurn ? "🎯 Jouw beurt!" : `⏳ ${currentPlayer?.name} is aan de beurt...`}
                </Badge>
              )}
              {gameState.status === "finished" && gameState.winner && (
                <div className="flex flex-col items-center gap-2">
                  <Trophy className="w-10 h-10 text-yellow-400" />
                  <span className="text-xl font-bold text-yellow-400">
                    {gameState.winner.id === user?.id ? "🎉 Je hebt gewonnen!" : `${gameState.winner.name} wint!`}
                  </span>
                </div>
              )}
            </div>

            {/* Opponent Area */}
            {opponentPlayer && (
              <div className="mb-6 p-3 rounded-lg bg-black/20 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/70 text-sm font-medium">{opponentPlayer.name}</span>
                  <span className="text-white/50 text-xs">
                    {opponentPlayer.throwsLeft} worpen over
                  </span>
                </div>
                <div className="flex gap-2">
                  {opponentPlayer.keptDice.map((d, i) => (
                    <DiceFace key={i} value={d} size="sm" />
                  ))}
                  {opponentPlayer.currentRoll.map((d, i) => (
                    <DiceFace key={`r${i}`} value={d} size="sm" rolling={!opponentPlayer.finished} />
                  ))}
                  {opponentPlayer.keptDice.length === 0 && opponentPlayer.currentRoll.length === 0 && (
                    <span className="text-white/30 text-sm italic">Nog niet gegooid</span>
                  )}
                </div>
                {opponentPlayer.finished && (
                  <div className="mt-1 text-amber-400 text-sm font-semibold">
                    Score: {opponentPlayer.score}
                  </div>
                )}
              </div>
            )}

            {/* My Area */}
            {myPlayer && (
              <div className="p-4 rounded-lg bg-black/30 border border-amber-500/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-semibold">Jij ({myPlayer.name})</span>
                  <span className="text-white/60 text-sm">
                    {myPlayer.throwsLeft} worpen over
                  </span>
                </div>

                {/* Kept Dice */}
                {myPlayer.keptDice.length > 0 && (
                  <div className="mb-3">
                    <span className="text-white/50 text-xs uppercase tracking-wider">Bewaard:</span>
                    <div className="flex gap-2 mt-1">
                      {myPlayer.keptDice.map((d, i) => (
                        <DiceFace key={i} value={d} size="lg" highlight />
                      ))}
                    </div>
                  </div>
                )}

                {/* Current Roll */}
                {myPlayer.currentRoll.length > 0 && (
                  <div className="mb-3">
                    <span className="text-white/50 text-xs uppercase tracking-wider">Gegooid:</span>
                    <div className="flex gap-2 mt-1">
                      {myPlayer.currentRoll.map((d, i) => (
                        <DiceFace key={i} value={d} size="lg" rolling={rolling} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Roll Button */}
                {isMyTurn && !myPlayer.finished && myPlayer.throwsLeft > 0 && (
                  <Button
                    onClick={rollDice}
                    disabled={rolling}
                    className="w-full mt-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-3 text-lg"
                  >
                    {rolling ? (
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <span className="mr-2">🎲</span>
                    )}
                    {myPlayer.keptDice.length > 0 ? "Doorjagen!" : "Gooi!"}
                  </Button>
                )}

                {myPlayer.finished && (
                  <div className="mt-2 text-center text-amber-400 font-bold text-lg">
                    Score: {myPlayer.score}
                    {myPlayer.score === 21 && " — MEX! 🎯"}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Last Action Log */}
          <Card className="bg-white/5 border-white/10 p-3">
            <p className="text-white/80 text-sm text-center italic">
              {gameState.lastAction}
            </p>
          </Card>

          {/* Doorjagen explanation tooltip */}
          {gameState.status === "playing" && (
            <p className="text-white/40 text-xs text-center mt-3">
              💡 <strong>Doorjagen</strong>: Als je een 1, 2 of 3 gooit, bewaar je die en gooi je de andere dobbelsteen opnieuw — dat telt niet als worp!
            </p>
          )}

          {/* Play Again */}
          {gameState.status === "finished" && (
            <Button
              onClick={backToLobby}
              className="w-full mt-4 bg-white/10 hover:bg-white/20 text-white"
            >
              Terug naar lobby
            </Button>
          )}
        </>
      )}
    </div>
  );
}
