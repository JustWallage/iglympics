import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
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

const GAMES: GameDef[] = [{ id: "snake", name: "Snake", emoji: "🐍" }];

// ─── Snake Game ──────────────────────────────────────────────────────────────

const GRID = 16;
const CELL = 0; // calculated dynamically
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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Minigames() {
  const { user } = useAuth();

  // Leaderboard state
  const [globalLeaderboard, setGlobalLeaderboard] = useState<
    LeaderboardEntry[]
  >([]);
  const [gameScores, setGameScores] = useState<
    Record<string, GameScore[]>
  >({});
  const [leaderboardExpanded, setLeaderboardExpanded] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [loading, setLoading] = useState(true);

  // Game modal
  const [selectedGame, setSelectedGame] = useState<GameDef | null>(null);
  const [playing, setPlaying] = useState(false);

  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch("/api/minigame-scores");
      if (res.ok) {
        const data = (await res.json()) as {
          global_leaderboard: LeaderboardEntry[];
          game_scores: Record<string, GameScore[]>;
        };
        setGlobalLeaderboard(data.global_leaderboard);
        setGameScores(data.game_scores);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

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

  const startGame = () => {
    setPlaying(true);
    snakeGame.reset();
  };

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
                  {snakeGame.gameOver ? "Play Again" : "Start Game"}
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
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">
                      Score: {snakeGame.score}
                    </Badge>
                  </div>
                  <button
                    onClick={() => {
                      setPlaying(false);
                    }}
                    className="text-white/30 hover:text-white/60 transition-colors p-1"
                  >
                    <X size={20} />
                  </button>
                </div>

                <SnakeBoard snake={snakeGame.snake} food={snakeGame.food} />

                {snakeGame.gameOver && (
                  <div className="mt-3 text-center">
                    <p className="text-sm text-white/70 mb-2">
                      Game Over! Score:{" "}
                      <span className="font-bold text-white/90">
                        {snakeGame.score}
                      </span>
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={startGame}
                        className="flex-1"
                      >
                        Play Again
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setPlaying(false)}
                        className="flex-1"
                      >
                        Back
                      </Button>
                    </div>
                  </div>
                )}

                {/* D-pad controls for mobile */}
                {!snakeGame.gameOver && (
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
