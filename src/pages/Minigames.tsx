import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import { useCachedFetch } from "../lib/useCachedFetch";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Trophy,
  X,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  HelpCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GameScore {
  user_id: number;
  user_name: string;
  score: number;
  rank: number;
}

interface LeaderboardEntry {
  user_id: number;
  user_name: string;
  points: number;
}

interface GameDef {
  id: string;
  name: string;
  emoji: string;
}

const GAMES: GameDef[] = [
  { id: "snake", name: "Snake", emoji: "🐍" },
  { id: "flappy", name: "Flappy Bird", emoji: "🐦" },
  { id: "chess", name: "Chess", emoji: "♟️" },
];

// ─── Snake Game ──────────────────────────────────────────────────────────────

const GRID = 16;
const TICK_MS = 140;

type Dir = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Pos = [number, number];

function useSnake(onGameOver: (score: number) => void) {
  const [snake, setSnake] = useState<Pos[]>([[8, 8]]);
  const [food, setFood] = useState<Pos>([4, 4]);
  const [dir, setDir] = useState<Dir>("RIGHT");
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const dirRef = useRef(dir);
  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  const scoreRef = useRef(score);

  dirRef.current = dir;
  snakeRef.current = snake;
  foodRef.current = food;
  scoreRef.current = score;

  const spawnFood = useCallback((occupiedSnake: Pos[]): Pos => {
    const occupied = new Set(occupiedSnake.map(([x, y]) => `${x},${y}`));
    let pos: Pos;
    do {
      pos = [
        Math.floor(Math.random() * GRID),
        Math.floor(Math.random() * GRID),
      ];
    } while (occupied.has(`${pos[0]},${pos[1]}`));
    return pos;
  }, []);

  const reset = useCallback(() => {
    const initial: Pos[] = [[8, 8]];
    setSnake(initial);
    setFood(spawnFood(initial));
    setDir("RIGHT");
    setScore(0);
    setGameOver(false);
    setRunning(true);
  }, [spawnFood]);

  const changeDir = useCallback((newDir: Dir) => {
    const opposites: Record<Dir, Dir> = {
      UP: "DOWN",
      DOWN: "UP",
      LEFT: "RIGHT",
      RIGHT: "LEFT",
    };
    if (opposites[newDir] !== dirRef.current) {
      setDir(newDir);
    }
  }, []);

  useEffect(() => {
    if (!running || gameOver) return;

    const id = setInterval(() => {
      const s = snakeRef.current;
      const d = dirRef.current;
      const head = s[0];

      const moves: Record<Dir, Pos> = {
        UP: [head[0], head[1] - 1],
        DOWN: [head[0], head[1] + 1],
        LEFT: [head[0] - 1, head[1]],
        RIGHT: [head[0] + 1, head[1]],
      };
      const newHead = moves[d];

      // Wall collision
      if (
        newHead[0] < 0 ||
        newHead[0] >= GRID ||
        newHead[1] < 0 ||
        newHead[1] >= GRID
      ) {
        setRunning(false);
        setGameOver(true);
        onGameOver(scoreRef.current);
        return;
      }

      // Self collision
      if (s.some(([x, y]) => x === newHead[0] && y === newHead[1])) {
        setRunning(false);
        setGameOver(true);
        onGameOver(scoreRef.current);
        return;
      }

      const ate =
        newHead[0] === foodRef.current[0] &&
        newHead[1] === foodRef.current[1];
      const newSnake: Pos[] = [newHead, ...s];
      if (!ate) newSnake.pop();

      setSnake(newSnake);
      if (ate) {
        setScore((prev) => prev + 1);
        setFood(spawnFood(newSnake));
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [running, gameOver, onGameOver, spawnFood]);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: "UP",
        ArrowDown: "DOWN",
        ArrowLeft: "LEFT",
        ArrowRight: "RIGHT",
      };
      if (map[e.key]) {
        e.preventDefault();
        changeDir(map[e.key]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [changeDir]);

  return { snake, food, score, running, gameOver, reset, changeDir };
}

function SnakeBoard({
  snake,
  food,
}: {
  snake: Pos[];
  food: Pos;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(0);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        setCellSize(Math.floor(w / GRID));
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const size = cellSize * GRID;

  return (
    <div ref={containerRef} className="w-full">
      <div
        className="relative mx-auto rounded-lg border border-white/[0.1] bg-black/40 overflow-hidden"
        style={{ width: size, height: size }}
      >
        {/* Food */}
        <div
          className="absolute rounded-sm bg-red-500"
          style={{
            width: cellSize - 1,
            height: cellSize - 1,
            left: food[0] * cellSize,
            top: food[1] * cellSize,
          }}
        />
        {/* Snake */}
        {snake.map(([x, y], i) => (
          <div
            key={i}
            className={`absolute rounded-sm ${i === 0 ? "bg-emerald-400" : "bg-emerald-500/70"}`}
            style={{
              width: cellSize - 1,
              height: cellSize - 1,
              left: x * cellSize,
              top: y * cellSize,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Flappy Bird Game ────────────────────────────────────────────────────────

const FLAPPY_W = 288;
const FLAPPY_H = 400;
const BIRD_SIZE = 20;
const PIPE_WIDTH = 44;
const PIPE_GAP = 135;
const GRAVITY = 0.3;
const JUMP_VEL = -5.5;
const PIPE_SPEED = 1.8;

interface Pipe {
  x: number;
  topH: number;
  scored: boolean;
}

function useFlappyBird(onGameOver: (score: number) => void) {
  const [birdY, setBirdY] = useState(FLAPPY_H / 2);
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const velRef = useRef(0);
  const birdRef = useRef(FLAPPY_H / 2);
  const pipesRef = useRef<Pipe[]>([]);
  const scoreRef = useRef(0);
  const runningRef = useRef(false);
  const frameRef = useRef(0);

  const reset = useCallback(() => {
    birdRef.current = FLAPPY_H / 2;
    velRef.current = 0;
    pipesRef.current = [];
    scoreRef.current = 0;
    setBirdY(FLAPPY_H / 2);
    setPipes([]);
    setScore(0);
    setGameOver(false);
    setRunning(false);
    runningRef.current = false;
    setCountdown(3);
  }, []);

  const flap = useCallback(() => {
    if (runningRef.current) {
      velRef.current = JUMP_VEL;
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => {
      const next = countdown - 1;
      setCountdown(next);
      if (next === 0) {
        setRunning(true);
        runningRef.current = true;
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  useEffect(() => {
    if (!running || gameOver) return;

    const tick = () => {
      if (!runningRef.current) return;

      // Bird physics
      velRef.current += GRAVITY;
      birdRef.current += velRef.current;

      // Floor / ceiling
      if (birdRef.current < 0) birdRef.current = 0;
      if (birdRef.current + BIRD_SIZE > FLAPPY_H) {
        runningRef.current = false;
        setRunning(false);
        setGameOver(true);
        setBirdY(birdRef.current);
        onGameOver(scoreRef.current);
        return;
      }

      // Move pipes
      const updated = pipesRef.current.map((p) => ({ ...p, x: p.x - PIPE_SPEED }));

      // Remove off-screen
      const filtered = updated.filter((p) => p.x + PIPE_WIDTH > 0);

      // Score
      for (const p of filtered) {
        if (!p.scored && p.x + PIPE_WIDTH < 50) {
          p.scored = true;
          scoreRef.current += 1;
          setScore(scoreRef.current);
        }
      }

      // Spawn new pipe
      const last = filtered[filtered.length - 1];
      if (!last || last.x < FLAPPY_W - 180) {
        const topH = 40 + Math.random() * (FLAPPY_H - PIPE_GAP - 80);
        filtered.push({ x: FLAPPY_W, topH, scored: false });
      }

      // Collision
      const bx = 50;
      const by = birdRef.current;
      for (const p of filtered) {
        if (bx + BIRD_SIZE > p.x && bx < p.x + PIPE_WIDTH) {
          if (by < p.topH || by + BIRD_SIZE > p.topH + PIPE_GAP) {
            runningRef.current = false;
            setRunning(false);
            setGameOver(true);
            setPipes(filtered);
            setBirdY(birdRef.current);
            onGameOver(scoreRef.current);
            return;
          }
        }
      }

      pipesRef.current = filtered;
      setPipes([...filtered]);
      setBirdY(birdRef.current);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [running, gameOver, onGameOver]);

  // Keyboard + touch
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === "ArrowUp") {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flap]);

  return { birdY, pipes, score, running, gameOver, countdown, reset, flap };
}

function FlappyBoard({
  birdY,
  pipes,
  onTap,
}: {
  birdY: number;
  pipes: Pipe[];
  onTap: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        setScale(w / FLAPPY_W);
      }
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      <div
        className="relative mx-auto rounded-lg border border-white/[0.1] overflow-hidden"
        style={{
          width: FLAPPY_W * scale,
          height: FLAPPY_H * scale,
          background: "linear-gradient(to bottom, #1a1a2e 0%, #16213e 60%, #0f3460 100%)",
        }}
        onPointerDown={onTap}
      >
        {/* Bird */}
        <div
          className="absolute rounded-full bg-yellow-400"
          style={{
            width: BIRD_SIZE * scale,
            height: BIRD_SIZE * scale,
            left: 50 * scale,
            top: birdY * scale,
          }}
        />
        {/* Pipes */}
        {pipes.map((p, i) => (
          <div key={i}>
            {/* Top pipe */}
            <div
              className="absolute bg-emerald-600 rounded-b-sm"
              style={{
                width: PIPE_WIDTH * scale,
                height: p.topH * scale,
                left: p.x * scale,
                top: 0,
              }}
            />
            {/* Bottom pipe */}
            <div
              className="absolute bg-emerald-600 rounded-t-sm"
              style={{
                width: PIPE_WIDTH * scale,
                left: p.x * scale,
                top: (p.topH + PIPE_GAP) * scale,
                height: (FLAPPY_H - p.topH - PIPE_GAP) * scale,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chess Game ──────────────────────────────────────────────────────────────

type PieceColor = "w" | "b";
type PieceType = "K" | "Q" | "R" | "B" | "N" | "P";
type ChessPiece = { color: PieceColor; type: PieceType };
type Square = ChessPiece | null;
type Board = Square[][];

const PIECE_VALUES: Record<PieceType, number> = {
  P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0,
};

const PIECE_CHARS: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

function initialBoard(): Board {
  const backRank: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = { color: "b", type: backRank[c] };
    board[1][c] = { color: "b", type: "P" };
    board[6][c] = { color: "w", type: "P" };
    board[7][c] = { color: "w", type: backRank[c] };
  }
  return board;
}

function inBounds(r: number, c: number) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
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

interface ChessMove {
  fromR: number; fromC: number;
  toR: number; toC: number;
  promotion?: PieceType;
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
        return !target; // continue sliding if empty
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
          for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
            add(r + dr, c + dc);
          break;
        case "B": slide(1,1); slide(1,-1); slide(-1,1); slide(-1,-1); break;
        case "R": slide(1,0); slide(-1,0); slide(0,1); slide(0,-1); break;
        case "Q":
          slide(1,1); slide(1,-1); slide(-1,1); slide(-1,-1);
          slide(1,0); slide(-1,0); slide(0,1); slide(0,-1);
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

function getLegalMoves(board: Board, color: PieceColor): ChessMove[] {
  return getRawMoves(board, color).filter(m => {
    const newBoard = applyMove(board, m);
    return !isKingInCheck(newBoard, color);
  });
}

function evaluateBoard(board: Board): number {
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const val = PIECE_VALUES[p.type];
      // Add small positional bonus for center control
      const centerBonus = (p.type !== "K") ? (3.5 - Math.abs(c - 3.5)) * 0.05 + (3.5 - Math.abs(r - 3.5)) * 0.05 : 0;
      score += (p.color === "b" ? 1 : -1) * (val + centerBonus);
    }
  return score;
}

function aiPickMove(board: Board): ChessMove | null {
  const moves = getLegalMoves(board, "b");
  if (moves.length === 0) return null;

  // Simple 1-ply search: evaluate each move and pick the best
  let bestScore = -Infinity;
  const bestMoves: ChessMove[] = [];
  for (const m of moves) {
    const newBoard = applyMove(board, m);
    // Also consider opponent's best response
    const opponentMoves = getLegalMoves(newBoard, "w");
    let worstCase = evaluateBoard(newBoard);
    if (opponentMoves.length > 0) {
      let bestOpponent = Infinity;
      for (const om of opponentMoves) {
        const afterOpponent = applyMove(newBoard, om);
        bestOpponent = Math.min(bestOpponent, evaluateBoard(afterOpponent));
      }
      worstCase = bestOpponent;
    }
    if (worstCase > bestScore) {
      bestScore = worstCase;
      bestMoves.length = 0;
      bestMoves.push(m);
    } else if (worstCase === bestScore) {
      bestMoves.push(m);
    }
  }
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function useChess(onGameOver: (score: number) => void) {
  const [board, setBoard] = useState<Board>(initialBoard);
  const [turn, setTurn] = useState<PieceColor>("w");
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [legalMoves, setLegalMoves] = useState<ChessMove[]>([]);
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState("");
  const [lastMove, setLastMove] = useState<ChessMove | null>(null);
  const [inCheck, setInCheck] = useState(false);

  const scoreRef = useRef(0);
  scoreRef.current = score;

  const reset = useCallback(() => {
    const b = initialBoard();
    setBoard(b);
    setTurn("w");
    setSelected(null);
    setLegalMoves([]);
    setScore(0);
    setGameOver(false);
    setGameOverReason("");
    setRunning(true);
    setLastMove(null);
    setInCheck(false);
  }, []);

  const endGame = useCallback((reason: string) => {
    setRunning(false);
    setGameOver(true);
    setGameOverReason(reason);
    onGameOver(scoreRef.current);
  }, [onGameOver]);

  // Check game end conditions after each move
  const checkGameState = useCallback((newBoard: Board, nextTurn: PieceColor) => {
    const nextMoves = getLegalMoves(newBoard, nextTurn);
    const kingInCheck = isKingInCheck(newBoard, nextTurn);
    setInCheck(kingInCheck && nextTurn === "w");

    if (nextMoves.length === 0) {
      if (kingInCheck) {
        if (nextTurn === "b") {
          return "Checkmate — you win!";
        } else {
          return "Checkmate — you lose!";
        }
      }
      return "Stalemate — draw!";
    }
    return null;
  }, []);

  const selectSquare = useCallback((r: number, c: number) => {
    if (!running || gameOver || turn !== "w") return;

    const piece = board[r][c];

    // If we have a selected piece, try to move
    if (selected) {
      const move = legalMoves.find(
        m => m.fromR === selected[0] && m.fromC === selected[1] && m.toR === r && m.toC === c
      );

      if (move) {
        const captured = board[r][c];
        const newBoard = applyMove(board, move);
        let newScore = scoreRef.current;
        if (captured) {
          newScore += PIECE_VALUES[captured.type];
          setScore(newScore);
          scoreRef.current = newScore;
        }
        setBoard(newBoard);
        setSelected(null);
        setLegalMoves([]);
        setLastMove(move);

        const result = checkGameState(newBoard, "b");
        if (result) {
          endGame(result);
          return;
        }
        setTurn("b");
        return;
      }

      // If clicking own piece, reselect
      if (piece?.color === "w") {
        setSelected([r, c]);
        setLegalMoves(getLegalMoves(board, "w").filter(m => m.fromR === r && m.fromC === c));
        return;
      }

      // Deselect
      setSelected(null);
      setLegalMoves([]);
      return;
    }

    // Select a white piece
    if (piece?.color === "w") {
      setSelected([r, c]);
      setLegalMoves(getLegalMoves(board, "w").filter(m => m.fromR === r && m.fromC === c));
    }
  }, [running, gameOver, turn, board, selected, legalMoves, checkGameState, endGame]);

  // AI move
  useEffect(() => {
    if (!running || gameOver || turn !== "b") return;

    const timeout = setTimeout(() => {
      const move = aiPickMove(board);
      if (!move) {
        // No legal moves for AI
        if (isKingInCheck(board, "b")) {
          endGame("Checkmate — you win!");
        } else {
          endGame("Stalemate — draw!");
        }
        return;
      }

      const captured = board[move.toR][move.toC];
      const newBoard = applyMove(board, move);
      if (captured) {
        // AI captures - subtract from player score
        setScore(prev => Math.max(0, prev - PIECE_VALUES[captured.type]));
      }
      setBoard(newBoard);
      setLastMove(move);

      const result = checkGameState(newBoard, "w");
      if (result) {
        endGame(result);
        return;
      }
      setTurn("w");
    }, 400);

    return () => clearTimeout(timeout);
  }, [running, gameOver, turn, board, checkGameState, endGame]);

  return { board, turn, selected, legalMoves, score, running, gameOver, gameOverReason, lastMove, inCheck, reset, selectSquare };
}

function ChessBoard({
  board,
  selected,
  legalMoves,
  lastMove,
  inCheck,
  turn,
  onSelect,
}: {
  board: Board;
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

  return (
    <div ref={containerRef} className="w-full">
      <div
        className="relative mx-auto rounded-lg border border-white/[0.1] overflow-hidden"
        style={{ width: size, height: size }}
      >
        {Array.from({ length: 8 }, (_, r) =>
          Array.from({ length: 8 }, (_, c) => {
            const piece = board[r][c];
            const isLight = (r + c) % 2 === 0;
            const isSelected = selected?.[0] === r && selected?.[1] === c;
            const isLegalTarget = legalMoves.some(m => m.toR === r && m.toC === c);
            const isLastMove = lastMove && ((lastMove.fromR === r && lastMove.fromC === c) || (lastMove.toR === r && lastMove.toC === c));
            const isKingCheck = inCheck && piece?.color === "w" && piece?.type === "K";
            const isClickable = turn === "w" && (piece?.color === "w" || isLegalTarget);

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
                  left: c * cellSize,
                  top: r * cellSize,
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
                  <div
                    className="absolute inset-0 rounded-sm border-2 border-red-500/50"
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Minigames() {
  const { user } = useAuth();
  const { subscribe } = useWebSocket();

  // Leaderboard state
  const { data, loading, mutate: fetchScores } = useCachedFetch<{
    global_leaderboard: LeaderboardEntry[];
    game_scores: Record<string, GameScore[]>;
  }>("/api/minigame-scores");
  const globalLeaderboard = data?.global_leaderboard ?? [];
  const gameScores = data?.game_scores ?? {};
  const [leaderboardExpanded, setLeaderboardExpanded] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Game modal
  const [selectedGame, setSelectedGame] = useState<GameDef | null>(null);
  const [playing, setPlaying] = useState(false);

  const handleGameOver = useCallback(
    async (score: number) => {
      if (user && score > 0) {
        await fetch("/api/minigame-scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game: selectedGame!.id, score }),
        });
        await fetchScores();
      }
    },
    [user, selectedGame, fetchScores],
  );

  const snakeGame = useSnake(handleGameOver);
  const flappyGame = useFlappyBird(handleGameOver);
  const chessGame = useChess(handleGameOver);
  const [gameOverReady, setGameOverReady] = useState(false);

  const startGame = () => {
    setPlaying(true);
    setGameOverReady(false);
    if (selectedGame?.id === "snake") snakeGame.reset();
    else if (selectedGame?.id === "flappy") flappyGame.reset();
    else if (selectedGame?.id === "chess") chessGame.reset();
  };

  // Delay-enable buttons after game over to prevent accidental taps
  const isGameOverNow =
    (selectedGame?.id === "snake" && snakeGame.gameOver) ||
    (selectedGame?.id === "flappy" && flappyGame.gameOver) ||
    (selectedGame?.id === "chess" && chessGame.gameOver);
  useEffect(() => {
    if (!isGameOverNow) {
      setGameOverReady(false);
      return;
    }
    const id = setTimeout(() => setGameOverReady(true), 1500);
    return () => clearTimeout(id);
  }, [isGameOverNow]);

  // Live updates
  useEffect(() => {
    const unsub = subscribe("minigame_score", () => fetchScores());
    return unsub;
  }, [subscribe, fetchScores]);

  const medals = ["🥇", "🥈", "🥉"];

  if (loading) {
    return (
      <div className="text-center py-12 text-white/35 text-sm">Loading...</div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-white/90">Minigames</h1>
        <button
          onClick={() => setShowHelp(true)}
          className="text-white hover:text-white/60 transition-colors p-1"
          aria-label="How minigames work"
        >
          <HelpCircle size={18} />
        </button>
      </div>

      {/* Help modal */}
      {showHelp && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-white/[0.06] backdrop-blur-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white/90">
                How it works
              </h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-white/30 hover:text-white/60 transition-colors p-1"
                data-testid="games-help-close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 text-sm text-white/60">
              <p>Play minigames and compete for the highest scores!</p>
              <p>
                For each game, the top 3 players earn points towards the overall
                leaderboard:
              </p>
              <div className="space-y-1 pl-2">
                <p>🥇 1st place — <span className="text-white/90 font-medium">3 points</span></p>
                <p>🥈 2nd place — <span className="text-white/90 font-medium">2 points</span></p>
                <p>🥉 3rd place — <span className="text-white/90 font-medium">1 point</span></p>
              </div>
              <p>Only your personal best score per game counts.</p>
            </div>
          </div>
        </div>
      )}

      {/* Global Leaderboard (collapsed by default) */}
      <Card>
        <button
          onClick={() => setLeaderboardExpanded(!leaderboardExpanded)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-amber-400" />
            <span className="text-sm font-semibold text-white/80">
              Minigame Champions
            </span>
          </div>
          {leaderboardExpanded ? (
            <ChevronUp size={16} className="text-white/40" />
          ) : (
            <ChevronDown size={16} className="text-white/40" />
          )}
        </button>
        {globalLeaderboard.length === 0 ? (
          <p className="text-xs text-white/30 mt-3">No scores yet</p>
        ) : (
          <div className="mt-3 space-y-2">
            {(leaderboardExpanded
              ? globalLeaderboard
              : globalLeaderboard.slice(0, 3)
            ).map((entry, i) => (
              <div
                key={entry.user_id}
                className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm w-6">
                    {i < 3 ? medals[i] : `${i + 1}.`}
                  </span>
                  <span className="text-sm text-white/80">
                    {entry.user_name}
                  </span>
                </div>
                <span className="text-sm font-semibold text-white/70 tabular-nums">
                  {entry.points} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Game cards */}
      <div className="space-y-3">
        {GAMES.map((game) => (
          <Card
            key={game.id}
            className="cursor-pointer active:bg-white/[0.06] transition-colors"
            onClick={() => {
              setSelectedGame(game);
              setPlaying(false);
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{game.emoji}</span>
              <div>
                <div className="text-sm font-semibold text-white/90">
                  {game.name}
                </div>
                <div className="text-xs text-white/40">
                  {(gameScores[game.id] || []).length > 0
                    ? `High score: ${gameScores[game.id][0].score} by ${gameScores[game.id][0].user_name}`
                    : "No scores yet"}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Game modal */}
      {selectedGame && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => {
            if (!playing) {
              setSelectedGame(null);
            }
          }}
        >
          <div
            className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.1] bg-white/[0.06] backdrop-blur-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {!playing ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white/90">
                    {selectedGame.emoji} {selectedGame.name}
                  </h2>
                  <button
                    onClick={() => setSelectedGame(null)}
                    className="text-white/30 hover:text-white/60 transition-colors p-1"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Per-game scoreboard */}
                <div className="mb-4">
                  <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                    High Scores
                  </div>
                  {(gameScores[selectedGame.id] || []).length === 0 ? (
                    <p className="text-xs text-white/30">
                      No scores yet — be the first!
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {(gameScores[selectedGame.id] || []).map((entry, i) => (
                        <div
                          key={entry.user_id}
                          className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm w-6">
                              {i < 3 ? medals[i] : `${i + 1}.`}
                            </span>
                            <span className="text-sm text-white/80">
                              {entry.user_name}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-white/70 tabular-nums">
                            {entry.score}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button onClick={startGame} className="w-full">
                  {(selectedGame.id === "snake" ? snakeGame.gameOver : selectedGame.id === "chess" ? chessGame.gameOver : flappyGame.gameOver)
                    ? "Play Again"
                    : "Start Game"}
                </Button>
                {!user && (
                  <p className="text-xs text-white/30 text-center mt-2">
                    Log in to save your scores
                  </p>
                )}
              </>
            ) : (
              <>
                {/* In-game view */}
                {(() => {
                  const currentScore =
                    selectedGame.id === "snake" ? snakeGame.score : selectedGame.id === "chess" ? chessGame.score : flappyGame.score;
                  const isGameOver =
                    selectedGame.id === "snake"
                      ? snakeGame.gameOver
                      : selectedGame.id === "chess"
                        ? chessGame.gameOver
                        : flappyGame.gameOver;

                  return (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="default">Score: {currentScore}</Badge>
                        {selectedGame.id === "chess" && !chessGame.gameOver && (
                          <span className="text-xs text-white/40">
                            {chessGame.turn === "w" ? "Your turn" : "Thinking..."}
                          </span>
                        )}
                        <button
                          onClick={() => setPlaying(false)}
                          className="text-white/30 hover:text-white/60 transition-colors p-1"
                        >
                          <X size={20} />
                        </button>
                      </div>

                      {selectedGame.id === "snake" && (
                        <SnakeBoard snake={snakeGame.snake} food={snakeGame.food} />
                      )}
                      {selectedGame.id === "flappy" && (
                        <div className="relative">
                          <FlappyBoard
                            birdY={flappyGame.birdY}
                            pipes={flappyGame.pipes}
                            onTap={flappyGame.flap}
                          />
                          {flappyGame.countdown > 0 && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                              <span className="text-5xl font-bold text-white/90">
                                {flappyGame.countdown}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {selectedGame.id === "chess" && (
                        <ChessBoard
                          board={chessGame.board}
                          selected={chessGame.selected}
                          legalMoves={chessGame.legalMoves}
                          lastMove={chessGame.lastMove}
                          inCheck={chessGame.inCheck}
                          turn={chessGame.turn}
                          onSelect={chessGame.selectSquare}
                        />
                      )}

                      {isGameOver && (
                        <div className="mt-3 text-center">
                          <p className="text-sm text-white/70 mb-2">
                            {selectedGame.id === "chess" && chessGame.gameOverReason ? (
                              <>{chessGame.gameOverReason} Score:{" "}</>
                            ) : (
                              <>Game Over! Score:{" "}</>
                            )}
                            <span className="font-bold text-white/90">
                              {currentScore}
                            </span>
                          </p>
                          <div className="flex gap-2">
                            <Button
                              onClick={startGame}
                              disabled={!gameOverReady}
                              className="flex-1"
                            >
                              Play Again
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => setPlaying(false)}
                              disabled={!gameOverReady}
                              className="flex-1"
                            >
                              Back
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Snake D-pad controls */}
                      {selectedGame.id === "snake" && !snakeGame.gameOver && (
                        <div className="mt-4 flex justify-center">
                          <div className="grid grid-cols-3 gap-1.5 w-36">
                            <div />
                            <button
                              onPointerDown={() => snakeGame.changeDir("UP")}
                              className="h-11 rounded-xl bg-white/[0.08] active:bg-white/[0.15] flex items-center justify-center text-white/60"
                            >
                              <ArrowUp size={22} />
                            </button>
                            <div />
                            <button
                              onPointerDown={() => snakeGame.changeDir("LEFT")}
                              className="h-11 rounded-xl bg-white/[0.08] active:bg-white/[0.15] flex items-center justify-center text-white/60"
                            >
                              <ArrowLeft size={22} />
                            </button>
                            <div />
                            <button
                              onPointerDown={() => snakeGame.changeDir("RIGHT")}
                              className="h-11 rounded-xl bg-white/[0.08] active:bg-white/[0.15] flex items-center justify-center text-white/60"
                            >
                              <ArrowRight size={22} />
                            </button>
                            <div />
                            <button
                              onPointerDown={() => snakeGame.changeDir("DOWN")}
                              className="h-11 rounded-xl bg-white/[0.08] active:bg-white/[0.15] flex items-center justify-center text-white/60"
                            >
                              <ArrowDown size={22} />
                            </button>
                            <div />
                          </div>
                        </div>
                      )}

                      {/* Flappy Bird tap instruction */}
                      {selectedGame.id === "flappy" && !flappyGame.gameOver && (
                        <div className="mt-3 text-center">
                          <button
                            onPointerDown={flappyGame.flap}
                            className="w-full h-12 rounded-xl bg-white/[0.08] active:bg-white/[0.15] text-white/50 text-sm font-medium"
                          >
                            Tap to flap
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
