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
  Heart,
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
  { id: "trivia", name: "Trivia", emoji: "🧠" },
];

// ─── Trivia Game ─────────────────────────────────────────────────────────────

interface TriviaQuestion {
  question: string;
  options: string[];
  correct: number; // index into options
}

const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  // België (land)
  {
    question: "Wat is de hoofdstad van België?",
    options: ["Brussel", "Antwerpen", "Gent", "Luik"],
    correct: 0,
  },
  {
    question: "Hoeveel officiële talen heeft België?",
    options: ["2", "3", "4", "1"],
    correct: 1,
  },
  {
    question: "Welke rivier stroomt door Brussel?",
    options: ["Maas", "Schelde", "Zenne", "Leie"],
    correct: 2,
  },
  {
    question: "Wat is de munteenheid van België?",
    options: ["Belgische frank", "Euro", "Pond", "Gulden"],
    correct: 1,
  },
  {
    question: "In welk jaar werd België onafhankelijk?",
    options: ["1815", "1830", "1848", "1795"],
    correct: 1,
  },
  {
    question: "Welk gerecht is typisch Belgisch?",
    options: ["Moules-frites", "Paella", "Stamppot", "Ratatouille"],
    correct: 0,
  },
  {
    question: "Hoeveel gewesten telt België?",
    options: ["2", "3", "4", "5"],
    correct: 1,
  },
  {
    question: "Wat is het nationale voetbalelftal van België bijnaam?",
    options: ["De Rode Duivels", "De Leewen", "De Vlaamse Leeuwen", "De Zwarte Panters"],
    correct: 0,
  },
  // Het Goede Doel – België
  {
    question: "Door welke band werd het lied 'België' uitgebracht?",
    options: ["Clouseau", "Het Goede Doel", "Gorki", "Ooit"],
    correct: 1,
  },
  {
    question: "In welk jaar verscheen het nummer 'België' van Het Goede Doel?",
    options: ["1981", "1984", "1987", "1990"],
    correct: 1,
  },
  {
    question: "Welk refrein hoort bij 'België' van Het Goede Doel?",
    options: [
      "België, België, ik hou van jou",
      "België, België, wat een land",
      "België, België, waarom doe je zo",
      "België, België, mooi en vrij",
    ],
    correct: 0,
  },
  {
    question: "Wat was de nationaliteit van de leden van Het Goede Doel?",
    options: ["Belgisch", "Nederlands", "Duits", "Frans"],
    correct: 1,
  },
  {
    question: "In welk genre valt 'België' van Het Goede Doel?",
    options: ["Schlager", "Nederpop", "Punk", "Klassiek"],
    correct: 1,
  },
  {
    question: "Wie was de zanger van Het Goede Doel?",
    options: ["Koen Wauters", "Henk Westbroek", "Herman van Veen", "Marco Borsato"],
    correct: 1,
  },
  {
    question: "Welk thema behandelt 'België' van Het Goede Doel?",
    options: ["Oorlog", "Liefde voor het land", "Studentenleven", "Sport"],
    correct: 1,
  },
  // Delftse Studenten Corps
  {
    question: "In welke stad is het Delftse Studenten Corps (DSC) gevestigd?",
    options: ["Amsterdam", "Utrecht", "Delft", "Leiden"],
    correct: 2,
  },
  {
    question: "Aan welke universiteit is het Delftse Studenten Corps verbonden?",
    options: ["Universiteit Leiden", "TU Delft", "Erasmus Universiteit", "Universiteit Utrecht"],
    correct: 1,
  },
  {
    question: "Wat is de gangbare term voor een eerstejaars lid bij een studentencorps?",
    options: ["Aspirant", "Schachter", "Fresher", "Junior"],
    correct: 1,
  },
  {
    question: "Welk woord beschrijft de ontgroening bij een studentencorps?",
    options: ["Introductieprogramma", "Ontgroeningsperiode", "Kennismakingsweek", "Feestweek"],
    correct: 1,
  },
  {
    question: "Hoe heet de jaarlijkse introductieperiode bij het DSC?",
    options: ["Proefjaar", "Introductietijd", "Groentijd", "Welkomstweek"],
    correct: 2,
  },
  {
    question: "Wat staat 'corps' in studentencorpscontext voor?",
    options: ["Een militaire eenheid", "Een studentenvereniging", "Een sportclub", "Een koor"],
    correct: 1,
  },
  {
    question: "Welke kleur heeft de pet die corpsleden traditioneel dragen?",
    options: ["Rood", "Blauw", "Groen", "Zwart"],
    correct: 1,
  },
  {
    question: "Wat is de benaming voor een oud-lid van een studentencorps?",
    options: ["Veteraan", "Senator", "Alumnus", "Prefect"],
    correct: 2,
  },
  // Padel
  {
    question: "Op welk sport lijkt padel het meest?",
    options: ["Badminton", "Tennis", "Squash", "Tafeltennis"],
    correct: 1,
  },
  {
    question: "Hoeveel spelers staan er aan elke kant bij padel?",
    options: ["1", "2", "3", "4"],
    correct: 1,
  },
  {
    question: "Uit welk land stamt padel oorspronkelijk?",
    options: ["Spanje", "Mexico", "Argentinië", "Portugal"],
    correct: 1,
  },
  {
    question: "Wat omgeeft een padelcourt?",
    options: ["Netten", "Glazen wanden", "Hekken van staal", "Houten schotten"],
    correct: 1,
  },
  {
    question: "Met welk type racket wordt padel gespeeld?",
    options: ["Een geveerd racket", "Een massief racket met gaatjes", "Een houten racket", "Een racket met snaren"],
    correct: 1,
  },
  {
    question: "Hoeveel punten levert een game bij padel op bij winst?",
    options: ["15", "1", "2", "4"],
    correct: 1,
  },
  {
    question: "In welk land is padel momenteel het populairst?",
    options: ["Mexico", "Spanje", "België", "Brazilië"],
    correct: 1,
  },
  {
    question: "Mag de bal bij padel na de bouncer tegen de glazen wand gaan?",
    options: ["Nee, nooit", "Ja, dat is toegestaan", "Alleen bij de service", "Alleen in de tiebreak"],
    correct: 1,
  },
  // Gent
  {
    question: "In welke provincie ligt Gent?",
    options: ["West-Vlaanderen", "Oost-Vlaanderen", "Antwerpen", "Vlaams-Brabant"],
    correct: 1,
  },
  {
    question: "Welke rivier loopt door het centrum van Gent?",
    options: ["Schelde en Leie", "Maas en Rijn", "Zenne en Dender", "Nete en Dijle"],
    correct: 0,
  },
  {
    question: "Hoe heet het bekende muziekfestival dat jaarlijks in Gent plaatsvindt?",
    options: ["Rock Werchter", "Pukkelpop", "Gentse Feesten", "Tomorrowland"],
    correct: 2,
  },
  {
    question: "Welk beroemd altaarstuk hangt in de Sint-Baafskathedraal in Gent?",
    options: ["De Nachtwacht", "Het Lam Gods", "De Aanbidding der Koningen", "De Schepping"],
    correct: 1,
  },
  {
    question: "Welke universiteit is gevestigd in Gent?",
    options: ["KU Leuven", "Universiteit Gent", "VUB", "UAntwerpen"],
    correct: 1,
  },
  {
    question: "Wat is de bijnaam van de inwoners van Gent?",
    options: ["Antwerpenaars", "Stroppendragers", "Bruggeling", "Gentenaren"],
    correct: 1,
  },
  {
    question: "Welk kasteel staat in het centrum van Gent?",
    options: ["Kasteel van Laarne", "Gravensteen", "Beersel", "Gaasbeek"],
    correct: 1,
  },
  {
    question: "Welk gerecht is een bekende Gentse specialiteit?",
    options: ["Gentse waterzooi", "Vlaamse stoofkarbonaden", "Luikse wafels", "Brusselse spruitjes"],
    correct: 0,
  },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type TriviaPhase = "answering" | "correct" | "wrong" | "done";

function useTriviaGame(onGameOver: (score: number) => void) {
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<TriviaPhase>("answering");
  const [selected, setSelected] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const reset = useCallback(() => {
    setQuestions(shuffle(TRIVIA_QUESTIONS));
    setCurrent(0);
    setLives(3);
    setScore(0);
    setPhase("answering");
    setSelected(null);
    setRunning(true);
    setGameOver(false);
  }, []);

  const answer = useCallback(
    (idx: number) => {
      if (phase !== "answering") return;
      setSelected(idx);
      const q = questions[current];
      if (idx === q.correct) {
        setScore((s) => s + 1);
        setPhase("correct");
      } else {
        const newLives = lives - 1;
        setLives(newLives);
        setPhase("wrong");
        if (newLives === 0) {
          setGameOver(true);
          setRunning(false);
          setTimeout(() => onGameOver(score + 0), 1200);
          return;
        }
      }
      // Advance after short delay
      setTimeout(() => {
        const next = current + 1;
        if (next >= questions.length) {
          setGameOver(true);
          setRunning(false);
          setPhase("done");
          onGameOver(score + (idx === q.correct ? 1 : 0));
        } else {
          setCurrent(next);
          setSelected(null);
          setPhase("answering");
        }
      }, 900);
    },
    [phase, questions, current, lives, score, onGameOver],
  );

  return {
    question: questions[current] ?? null,
    current,
    total: questions.length,
    lives,
    score,
    phase,
    selected,
    running,
    gameOver,
    reset,
    answer,
  };
}

function TriviaBoard({
  triviaGame,
}: {
  triviaGame: ReturnType<typeof useTriviaGame>;
}) {
  const { question, current, total, lives, score, phase, selected, gameOver } =
    triviaGame;

  if (!question || gameOver) return null;

  const heartColor = (i: number) =>
    i < lives ? "text-red-400" : "text-white/20";

  const optionStyle = (idx: number) => {
    if (phase === "answering") {
      return "bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.18] cursor-pointer";
    }
    if (idx === question.correct) return "bg-emerald-600/50 border-emerald-400/60";
    if (idx === selected && idx !== question.correct) return "bg-red-600/40 border-red-400/50";
    return "bg-white/[0.03] opacity-50";
  };

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <Heart key={i} size={18} className={heartColor(i)} fill={i < lives ? "currentColor" : "none"} />
          ))}
        </div>
        <span className="text-xs text-white/40 tabular-nums">
          {current + 1} / {total}
        </span>
        <Badge variant="default">Score: {score}</Badge>
      </div>

      {/* Question */}
      <p className="text-sm font-medium text-white/90 leading-relaxed">
        {question.question}
      </p>

      {/* Options */}
      <div className="space-y-2">
        {question.options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => triviaGame.answer(idx)}
            disabled={phase !== "answering"}
            className={`w-full text-left px-4 py-3 rounded-xl border border-white/[0.08] text-sm text-white/80 transition-colors ${optionStyle(idx)}`}
          >
            {opt}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {phase === "correct" && (
        <p className="text-center text-sm font-semibold text-emerald-400">✓ Correct!</p>
      )}
      {phase === "wrong" && (
        <p className="text-center text-sm font-semibold text-red-400">✗ Fout!</p>
      )}
    </div>
  );
}

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
  const triviaGame = useTriviaGame(handleGameOver);
  const [gameOverReady, setGameOverReady] = useState(false);

  const startGame = () => {
    setPlaying(true);
    setGameOverReady(false);
    if (selectedGame?.id === "snake") snakeGame.reset();
    else if (selectedGame?.id === "flappy") flappyGame.reset();
    else if (selectedGame?.id === "trivia") triviaGame.reset();
  };

  // Delay-enable buttons after game over to prevent accidental taps
  const isGameOverNow =
    (selectedGame?.id === "snake" && snakeGame.gameOver) ||
    (selectedGame?.id === "flappy" && flappyGame.gameOver) ||
    (selectedGame?.id === "trivia" && triviaGame.gameOver);
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
                  {(selectedGame.id === "snake"
                    ? snakeGame.gameOver
                    : selectedGame.id === "flappy"
                      ? flappyGame.gameOver
                      : triviaGame.gameOver)
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
                    selectedGame.id === "snake"
                      ? snakeGame.score
                      : selectedGame.id === "flappy"
                        ? flappyGame.score
                        : triviaGame.score;
                  const isGameOver =
                    selectedGame.id === "snake"
                      ? snakeGame.gameOver
                      : selectedGame.id === "flappy"
                        ? flappyGame.gameOver
                        : triviaGame.gameOver;

                  return (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        {selectedGame.id !== "trivia" && (
                          <Badge variant="default">Score: {currentScore}</Badge>
                        )}
                        <div className="flex-1" />
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
                      {selectedGame.id === "trivia" && !triviaGame.gameOver && (
                        <TriviaBoard triviaGame={triviaGame} />
                      )}

                      {isGameOver && (
                        <div className="mt-3 text-center">
                          <p className="text-sm text-white/70 mb-2">
                            Game Over! Score:{" "}
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
