import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ArrowLeft, Users, Loader2, Flag, Crown } from "lucide-react";
import { Link } from "react-router-dom";

// ─── Types ───────────────────────────────────────────────────────────────────

type PieceColor = "w" | "b";
type PieceType = "K" | "Q" | "R" | "B" | "N" | "P";
type ChessPiece = { color: PieceColor; type: PieceType };
type Square = ChessPiece | null;
type Board = Square[][];

interface ChessMove {
  fromR: number;
  fromC: number;
  toR: number;
  toC: number;
  promotion?: PieceType;
}

interface PlayerInfo {
  id: number;
  name: string;
  color: PieceColor;
}

interface GameState {
  board: Board;
  turn: PieceColor;
  players: PlayerInfo[];
  status: "waiting" | "active" | "finished";
  winner: PieceColor | "draw" | null;
  reason: string;
  createdBy: string;
  createdAt: number;
}

interface GameListEntry {
  id: string;
  createdBy: string;
  status: string;
  players: { id: number; name: string; color: string }[];
  createdAt: number;
}

const PIECE_CHARS: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

// ─── Chess logic (client-side for move highlighting) ─────────────────────────

function inBounds(r: number, c: number) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function getRawMoves(board: Board, color: PieceColor): ChessMove[] {
  const moves: ChessMove[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      const add = (tr: number, tc: number) => {
        if (!inBounds(tr, tc)) return false;
        const target = board[tr][tc];
        if (target?.color === color) return false;
        if (p.type === "P" && (tr === 0 || tr === 7)) {
          for (const promo of ["Q", "R", "B", "N"] as PieceType[])
            moves.push({ fromR: r, fromC: c, toR: tr, toC: tc, promotion: promo });
        } else {
          moves.push({ fromR: r, fromC: c, toR: tr, toC: tc });
        }
        return !target;
      };
      const slide = (dr: number, dc: number) => {
        for (let i = 1; i < 8; i++)
          if (!add(r + dr * i, c + dc * i)) break;
      };
      switch (p.type) {
        case "P": {
          const dir = color === "w" ? -1 : 1;
          const startRow = color === "w" ? 6 : 1;
          if (inBounds(r + dir, c) && !board[r + dir][c]) {
            add(r + dir, c);
            if (r === startRow && !board[r + 2 * dir][c])
              add(r + 2 * dir, c);
          }
          for (const dc of [-1, 1])
            if (inBounds(r + dir, c + dc) && board[r + dir][c + dc]?.color === (color === "w" ? "b" : "w"))
              add(r + dir, c + dc);
          break;
        }
        case "N":
          for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]])
            add(r + dr, c + dc);
          break;
        case "B": slide(1, 1); slide(1, -1); slide(-1, 1); slide(-1, -1); break;
        case "R": slide(1, 0); slide(-1, 0); slide(0, 1); slide(0, -1); break;
        case "Q":
          slide(1, 1); slide(1, -1); slide(-1, 1); slide(-1, -1);
          slide(1, 0); slide(-1, 0); slide(0, 1); slide(0, -1);
          break;
        case "K":
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++)
              if (dr || dc) add(r + dr, c + dc);
          break;
      }
    }
  }
  return moves;
}

function applyMove(board: Board, m: ChessMove): Board {
  const b = board.map(row => [...row]);
  const piece = b[m.fromR][m.fromC]!;
  b[m.toR][m.toC] = m.promotion ? { color: piece.color, type: m.promotion } : piece;
  b[m.fromR][m.fromC] = null;
  return b;
}

function isKingInCheck(board: Board, color: PieceColor): boolean {
  let kingR = -1, kingC = -1;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.color === color && board[r][c]?.type === "K") {
        kingR = r; kingC = c;
      }
  if (kingR === -1) return true;
  const enemy = color === "w" ? "b" : "w";
  return getRawMoves(board, enemy).some(m => m.toR === kingR && m.toC === kingC);
}

function getLegalMoves(board: Board, color: PieceColor): ChessMove[] {
  return getRawMoves(board, color).filter(m => {
    const newBoard = applyMove(board, m);
    return !isKingInCheck(newBoard, color);
  });
}

// ─── PvP Chess Board Component ──────────────────────────────────────────────

function PvPChessBoard({
  board,
  myColor,
  selected,
  legalMoves,
  lastMove,
  inCheck,
  turn,
  onSelect,
}: {
  board: Board;
  myColor: PieceColor;
  selected: [number, number] | null;
  legalMoves: ChessMove[];
  lastMove: ChessMove | null;
  inCheck: boolean;
  turn: PieceColor;
  onSelect: (r: number, c: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(0);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        setCellSize(Math.floor(w / 8));
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const size = cellSize * 8;
  const flipped = myColor === "b";

  return (
    <div ref={containerRef} className="w-full">
      <div
        className="relative mx-auto rounded-lg border border-white/[0.1] overflow-hidden"
        style={{ width: size, height: size }}
      >
        {Array.from({ length: 8 }, (_, rawR) =>
          Array.from({ length: 8 }, (_, rawC) => {
            const r = flipped ? 7 - rawR : rawR;
            const c = flipped ? 7 - rawC : rawC;
            const piece = board[r]?.[c];
            const isLight = (r + c) % 2 === 0;
            const isSelected = selected?.[0] === r && selected?.[1] === c;
            const isLegalTarget = legalMoves.some(m => m.toR === r && m.toC === c);
            const isLastMove = lastMove && ((lastMove.fromR === r && lastMove.fromC === c) || (lastMove.toR === r && lastMove.toC === c));
            const isKingCheck = inCheck && piece?.color === turn && piece?.type === "K";
            const isMyTurn = turn === myColor;
            const isClickable = isMyTurn && (piece?.color === myColor || isLegalTarget);

            let bg = isLight ? "bg-amber-100" : "bg-amber-800";
            if (isSelected) bg = "bg-sky-400/70";
            else if (isLastMove) bg = isLight ? "bg-yellow-200" : "bg-yellow-600";
            if (isKingCheck) bg = "bg-red-500/60";

            return (
              <div
                key={`${r}-${c}`}
                className={`absolute flex items-center justify-center ${bg} ${isClickable ? "cursor-pointer" : ""}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  left: rawC * cellSize,
                  top: rawR * cellSize,
                  fontSize: cellSize * 0.7,
                  lineHeight: 1,
                }}
                onClick={() => onSelect(r, c)}
              >
                {piece && (
                  <span className={`select-none ${piece.color === "w" ? "drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]" : "drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]"}`}>
                    {PIECE_CHARS[`${piece.color}${piece.type}`]}
                  </span>
                )}
                {isLegalTarget && !piece && (
                  <div
                    className="rounded-full bg-black/20"
                    style={{ width: cellSize * 0.25, height: cellSize * 0.25 }}
                  />
                )}
                {isLegalTarget && piece && (
                  <div className="absolute inset-0 rounded-sm border-2 border-red-500/50" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Game View ───────────────────────────────────────────────────────────────

function GameView({
  gameId,
  userId,
  userName,
  onBack,
}: {
  gameId: string;
  userId: number;
  userName: string;
  onBack: () => void;
}) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [legalMoves, setLegalMoves] = useState<ChessMove[]>([]);
  const [lastMove, setLastMove] = useState<ChessMove | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const myColor = gameState?.players.find(p => p.id === userId)?.color || "w";

  const connectWs = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/api/chess/game/ws?gameId=${gameId}&userId=${userId}&userName=${encodeURIComponent(userName)}`
    );

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "game_state") {
          setGameState(data.payload);
          if (data.lastMove) {
            setLastMove(data.lastMove);
          }
          // Clear selection when state updates
          setSelected(null);
          setLegalMoves([]);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect after delay
      setTimeout(connectWs, 3000);
    };

    ws.onerror = () => ws.close();
    wsRef.current = ws;
  }, [gameId, userId, userName]);

  useEffect(() => {
    connectWs();
    return () => {
      wsRef.current?.close();
    };
  }, [connectWs]);

  const selectSquare = useCallback((r: number, c: number) => {
    if (!gameState || gameState.status !== "active") return;
    if (gameState.turn !== myColor) return;

    const board = gameState.board;
    const piece = board[r]?.[c];

    if (selected) {
      // Try to find a matching legal move
      const move = legalMoves.find(
        m => m.fromR === selected[0] && m.fromC === selected[1] && m.toR === r && m.toC === c
      );

      if (move) {
        // Send move to server
        wsRef.current?.send(JSON.stringify({ type: "move", move }));
        setSelected(null);
        setLegalMoves([]);
        return;
      }

      // Reselect own piece
      if (piece?.color === myColor) {
        setSelected([r, c]);
        setLegalMoves(getLegalMoves(board, myColor).filter(m => m.fromR === r && m.fromC === c));
        return;
      }

      // Deselect
      setSelected(null);
      setLegalMoves([]);
      return;
    }

    // Select own piece
    if (piece?.color === myColor) {
      setSelected([r, c]);
      setLegalMoves(getLegalMoves(board, myColor).filter(m => m.fromR === r && m.fromC === c));
    }
  }, [gameState, myColor, selected, legalMoves]);

  const resign = () => {
    wsRef.current?.send(JSON.stringify({ type: "resign" }));
  };

  const inCheck = gameState ? isKingInCheck(gameState.board, gameState.turn) : false;
  const opponent = gameState?.players.find(p => p.id !== userId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-white/40 hover:text-white/70 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-semibold text-white/90">♟️ Chess Match</h2>
        {!connected && (
          <Badge variant="info" className="ml-auto">
            <Loader2 size={12} className="animate-spin mr-1" />
            Connecting...
          </Badge>
        )}
      </div>

      {/* Player info */}
      {gameState && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-white/70">
            <span className="font-medium text-white/90">You</span>
            <span className="ml-1 text-white/40">({myColor === "w" ? "White" : "Black"})</span>
          </div>
          {opponent && (
            <div className="text-sm text-white/70">
              <span className="font-medium text-white/90">{opponent.name}</span>
              <span className="ml-1 text-white/40">({opponent.color === "w" ? "White" : "Black"})</span>
            </div>
          )}
        </div>
      )}

      {/* Waiting for opponent */}
      {gameState?.status === "waiting" && (
        <Card className="text-center py-6">
          <Loader2 size={24} className="animate-spin mx-auto mb-2 text-white/40" />
          <p className="text-sm text-white/60">Waiting for opponent to join...</p>
          <p className="text-xs text-white/30 mt-1">Share the game link with a friend</p>
        </Card>
      )}

      {/* Game board */}
      {gameState && gameState.status !== "waiting" && (
        <>
          {/* Turn indicator */}
          <div className="text-center">
            {gameState.status === "active" && (
              <Badge variant={gameState.turn === myColor ? "default" : "info"}>
                {gameState.turn === myColor ? "Your turn" : `${opponent?.name || "Opponent"}'s turn`}
                {inCheck && gameState.turn === myColor && " — Check!"}
              </Badge>
            )}
            {gameState.status === "finished" && (
              <div className="space-y-1">
                <Badge variant="default" className="text-base px-3 py-1">
                  <Crown size={14} className="mr-1" />
                  {gameState.reason}
                </Badge>
              </div>
            )}
          </div>

          <PvPChessBoard
            board={gameState.board}
            myColor={myColor}
            selected={selected}
            legalMoves={legalMoves}
            lastMove={lastMove}
            inCheck={inCheck && gameState.turn === myColor}
            turn={gameState.turn}
            onSelect={selectSquare}
          />

          {/* Resign button */}
          {gameState.status === "active" && (
            <div className="flex justify-center">
              <Button
                variant="danger"
                onClick={resign}
                className="text-red-400 border-red-400/30 hover:bg-red-400/10"
              >
                <Flag size={14} className="mr-1" />
                Resign
              </Button>
            </div>
          )}

          {/* Play again / back */}
          {gameState.status === "finished" && (
            <div className="flex justify-center gap-2">
              <Button onClick={onBack}>Back to Lobby</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Lobby ───────────────────────────────────────────────────────────────────

function Lobby({
  user,
  onJoinGame,
  onCreateGame,
}: {
  user: { id: number; name: string };
  onJoinGame: (gameId: string) => void;
  onCreateGame: () => void;
}) {
  const [games, setGames] = useState<GameListEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGames = useCallback(async () => {
    try {
      const res = await fetch("/api/chess/games");
      if (res.ok) {
        const data = await res.json() as { games: GameListEntry[] };
        setGames(data.games);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 5000);
    return () => clearInterval(interval);
  }, [fetchGames]);

  const handleJoin = async (gameId: string) => {
    const res = await fetch(`/api/chess/game/join?gameId=${gameId}`, {
      method: "POST",
    });
    if (res.ok) {
      onJoinGame(gameId);
    }
  };

  const waitingGames = games.filter(g => g.status === "waiting" && !g.players.some(p => p.id === user.id));
  const myGames = games.filter(g => g.players.some(p => p.id === user.id));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/games" className="text-white/40 hover:text-white/70 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-white/90">♟️ Chess PvP</h1>
        </div>
        <Button onClick={onCreateGame}>New Game</Button>
      </div>

      {/* My active games */}
      {myGames.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Your Games</h2>
          {myGames.map(game => (
            <Card
              key={game.id}
              className="cursor-pointer active:bg-white/[0.06] transition-colors"
              onClick={() => onJoinGame(game.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white/80">
                    vs {game.players.find(p => p.id !== user.id)?.name || "Waiting..."}
                  </div>
                  <div className="text-xs text-white/40">
                    {game.status === "waiting" ? "Waiting for opponent" : "In progress"}
                  </div>
                </div>
                <Badge variant={game.status === "active" ? "default" : "info"}>
                  {game.status === "active" ? "Active" : "Waiting"}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Available games to join */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Open Games</h2>
        {loading ? (
          <div className="text-center py-6 text-white/35 text-sm">Loading...</div>
        ) : waitingGames.length === 0 ? (
          <Card>
            <div className="text-center py-4">
              <Users size={24} className="mx-auto mb-2 text-white/30" />
              <p className="text-sm text-white/50">No open games</p>
              <p className="text-xs text-white/30 mt-1">Create a new game and wait for someone to join!</p>
            </div>
          </Card>
        ) : (
          waitingGames.map(game => (
            <Card key={game.id}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white/80">{game.createdBy}&apos;s game</div>
                  <div className="text-xs text-white/40">Waiting for opponent</div>
                </div>
                <Button onClick={() => handleJoin(game.id)} size="sm">
                  Join
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ChessPvP() {
  const { user, openLoginModal } = useAuth();
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  const handleCreateGame = async () => {
    const res = await fetch("/api/chess/games", { method: "POST" });
    if (res.ok) {
      const data = await res.json() as { gameId: string };
      setActiveGameId(data.gameId);
    }
  };

  if (!user) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Link to="/games" className="text-white/40 hover:text-white/70 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-white/90">♟️ Chess PvP</h1>
        </div>
        <Card className="text-center py-8">
          <p className="text-sm text-white/60 mb-3">Log in to play chess against other players</p>
          <Button onClick={openLoginModal}>Log In</Button>
        </Card>
      </div>
    );
  }

  if (activeGameId) {
    return (
      <GameView
        gameId={activeGameId}
        userId={user.id}
        userName={user.name}
        onBack={() => setActiveGameId(null)}
      />
    );
  }

  return (
    <Lobby
      user={user}
      onJoinGame={(id) => setActiveGameId(id)}
      onCreateGame={handleCreateGame}
    />
  );
}
