import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import { useCachedFetch } from "../lib/useCachedFetch";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
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
  { id: "lingo", name: "Lingo", emoji: "🔤" },
  { id: "trivia", name: "Trivia", emoji: "🧠" },
  { id: "chess", name: "Chess", emoji: "♟️" },
  { id: "parking", name: "Inparkeren", emoji: "🚗" },
  { id: "maze", name: "3D Maze", emoji: "🏁" },
];

// ─── Lingo Game ──────────────────────────────────────────────────────────────

const LINGO_WORD_LENGTH = 5;
const LINGO_MAX_ATTEMPTS = 5;

// ─── Lingo Sound Effects (inspired by Dutch Lingo TV show) ──────────────────
function createLingoSounds() {
  let audioCtx: AudioContext | null = null;

  const getCtx = () => {
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  };

  const playTone = (frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.3) => {
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.value = volume;
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch { /* audio not supported */ }
  };

  return {
    // Ball drop / letter reveal tick
    letterReveal: () => playTone(800, 0.08, "sine", 0.2),
    // Correct letter in correct position
    correctPosition: () => playTone(1200, 0.12, "sine", 0.25),
    // Letter present but wrong position
    wrongPosition: () => playTone(400, 0.15, "triangle", 0.2),
    // Correct word - ascending jingle like Lingo win
    correctWord: () => {
      [523, 659, 784, 1047].forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.2, "sine", 0.3), i * 120);
      });
    },
    // Wrong guess - descending buzz
    wrongGuess: () => playTone(200, 0.3, "sawtooth", 0.15),
    // Game over - low descending tones
    gameOver: () => {
      [400, 300, 200].forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.3, "sawtooth", 0.15), i * 200);
      });
    },
    // New round start
    newRound: () => {
      [440, 550, 660].forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.15, "sine", 0.2), i * 100);
      });
    },
  };
}

const lingoSounds = createLingoSounds();
const LINGO_WORDS = [
  "APPEL",
  "BROOD",
  "DROOM",
  "FIETS",
  "GROEN",
  "KLANK",
  "KUNST",
  "LUNCH",
  "MANGO",
  "PIZZA",
  "PLANT",
  "STOEL",
  "TREIN",
  "VOGEL",
  "WAFEL",
  "WATER",
  "ZOMER",
] as const;

type LingoLetterResult = "correct" | "present" | "absent";

interface LingoGuess {
  word: string;
  result: LingoLetterResult[];
}

function pickLingoWord(previousWord?: string) {
  if (LINGO_WORDS.length <= 1) return LINGO_WORDS[0];
  let next = LINGO_WORDS[Math.floor(Math.random() * LINGO_WORDS.length)];
  while (next === previousWord) {
    next = LINGO_WORDS[Math.floor(Math.random() * LINGO_WORDS.length)];
  }
  return next;
}

function scoreLingoGuess(guess: string, answer: string): LingoLetterResult[] {
  const result: LingoLetterResult[] = Array(LINGO_WORD_LENGTH).fill("absent");
  const remaining = answer.split("");

  for (let i = 0; i < LINGO_WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) {
      result[i] = "correct";
      remaining[i] = "";
    }
  }

  for (let i = 0; i < LINGO_WORD_LENGTH; i++) {
    if (result[i] === "correct") continue;
    const matchIndex = remaining.indexOf(guess[i]);
    if (matchIndex !== -1) {
      result[i] = "present";
      remaining[matchIndex] = "";
    }
  }

  return result;
}

function useLingo(onGameOver: (score: number) => void) {
  const [answer, setAnswer] = useState<string>(LINGO_WORDS[0]);
  const [guesses, setGuesses] = useState<LingoGuess[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState("Guess the 5-letter word.");

  const scoreRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  scoreRef.current = score;

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startRound = useCallback((previousWord?: string) => {
    setAnswer(pickLingoWord(previousWord));
    setGuesses([]);
    setCurrentGuess("");
    setRound((r) => r + 1);
    setMessage("Correct! Next word.");
    lingoSounds.newRound();
  }, []);

  const reset = useCallback(() => {
    clearPendingTimeout();
    setAnswer(pickLingoWord());
    setGuesses([]);
    setCurrentGuess("");
    setScore(0);
    setRound(1);
    setRunning(true);
    setGameOver(false);
    setMessage("Guess the 5-letter word.");
    scoreRef.current = 0;
    lingoSounds.newRound();
  }, [clearPendingTimeout]);

  const updateGuess = useCallback((value: string) => {
    const sanitized = value
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, LINGO_WORD_LENGTH);
    setCurrentGuess(sanitized);
  }, []);

  const submitGuess = useCallback(() => {
    if (!running || gameOver) return;

    if (currentGuess.length !== LINGO_WORD_LENGTH) {
      setMessage("Type all 5 letters.");
      return;
    }

    const fullGuess = currentGuess;
    const result = scoreLingoGuess(fullGuess, answer);
    const nextGuesses = [...guesses, { word: fullGuess, result }];
    setGuesses(nextGuesses);
    setCurrentGuess("");

    // Play letter reveal sounds
    result.forEach((r, i) => {
      setTimeout(() => {
        if (r === "correct") lingoSounds.correctPosition();
        else if (r === "present") lingoSounds.wrongPosition();
        else lingoSounds.letterReveal();
      }, i * 150);
    });

    if (fullGuess === answer) {
      const points = LINGO_MAX_ATTEMPTS - guesses.length;
      const nextScore = scoreRef.current + points;
      setScore(nextScore);
      scoreRef.current = nextScore;
      clearPendingTimeout();
      setTimeout(() => lingoSounds.correctWord(), LINGO_WORD_LENGTH * 150);
      timeoutRef.current = window.setTimeout(() => {
        startRound(answer);
      }, 1500);
      return;
    }

    if (nextGuesses.length >= LINGO_MAX_ATTEMPTS) {
      setRunning(false);
      setGameOver(true);
      setMessage(`Game Over! The word was ${answer}.`);
      setTimeout(() => lingoSounds.gameOver(), LINGO_WORD_LENGTH * 150);
      onGameOver(scoreRef.current);
      return;
    }

    setTimeout(() => lingoSounds.wrongGuess(), LINGO_WORD_LENGTH * 150);
    setMessage(`${LINGO_MAX_ATTEMPTS - nextGuesses.length} attempts left.`);
  }, [
    answer,
    clearPendingTimeout,
    currentGuess,
    gameOver,
    guesses,
    onGameOver,
    running,
    startRound,
  ]);

  useEffect(() => () => clearPendingTimeout(), [clearPendingTimeout]);

  return {
    answer,
    guesses,
    currentGuess,
    score,
    round,
    running,
    gameOver,
    message,
    reset,
    updateGuess,
    submitGuess,
  };
}

function LingoBoard({
  lingoGame,
}: {
  lingoGame: ReturnType<typeof useLingo>;
}) {
  const { guesses, currentGuess, round, gameOver, message } = lingoGame;
  const attemptsLeft = LINGO_MAX_ATTEMPTS - guesses.length;

  const rows: { letter: string; state: LingoLetterResult | null }[][] = Array.from(
    { length: LINGO_MAX_ATTEMPTS },
    (_, index) => {
    const guess = guesses[index];
    if (guess) {
      return guess.word.split("").map((letter, letterIndex) => ({
        letter,
        state: guess.result[letterIndex],
      }));
    }

    if (!gameOver && index === guesses.length) {
      const draftLetters = currentGuess.split("");
      return Array.from({ length: LINGO_WORD_LENGTH }, (_, letterIndex) => ({
        letter: draftLetters[letterIndex] ?? "",
        state: null,
      }));
    }

    return Array.from({ length: LINGO_WORD_LENGTH }, () => ({
      letter: "",
      state: null,
    }));
    },
  );

  const tileClass = (state: LingoLetterResult | null) => {
    if (state === "correct") return "border-emerald-400/70 bg-emerald-500/30";
    if (state === "present") return "border-amber-300/70 bg-amber-500/30";
    if (state === "absent") return "border-white/[0.08] bg-white/[0.05]";
    return "border-white/[0.08] bg-white/[0.03]";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-white/50">
        <span>Round {round}</span>
        <span>{attemptsLeft} attempts left</span>
      </div>

      <div className="grid gap-2">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-5 gap-2">
            {row.map((tile, tileIndex) => (
              <div
                key={`${rowIndex}-${tileIndex}`}
                className={`flex aspect-square items-center justify-center rounded-xl border text-base font-semibold text-white/90 ${tileClass(tile.state)}`}
              >
                {tile.letter}
              </div>
            ))}
          </div>
        ))}
      </div>

      {!gameOver && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            lingoGame.submitGuess();
          }}
        >
          <Input
            value={currentGuess}
            onChange={(e) => lingoGame.updateGuess(e.target.value)}
            placeholder="Type the 5-letter word"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            maxLength={LINGO_WORD_LENGTH}
            aria-label="Lingo guess"
          />
          <Button type="submit" className="w-full">
            Submit Guess
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-white/60">{message}</p>
    </div>
  );
}

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
          setTimeout(() => onGameOver(score), 1200);
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

// ─── Chess Game ──────────────────────────────────────────────────────────────

type PieceColor = "w" | "b";
type PieceType = "K" | "Q" | "R" | "B" | "N" | "P";
type ChessPiece = { color: PieceColor; type: PieceType };
type Square = ChessPiece | null;

const BOARD_CENTER = 3.5;
const CENTER_BONUS_WEIGHT = 0.05;
const AI_MOVE_DELAY_MS = 400;
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
      const centerBonus = (p.type !== "K") ? (BOARD_CENTER - Math.abs(c - BOARD_CENTER)) * CENTER_BONUS_WEIGHT + (BOARD_CENTER - Math.abs(r - BOARD_CENTER)) * CENTER_BONUS_WEIGHT : 0;
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
    }, AI_MOVE_DELAY_MS);

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

// ─── Inparkeren (Parallel Parking) Game ─────────────────────────────────────

const PARKING_W = 300;
const PARKING_H = 400;
const CAR_W = 30;
const CAR_H = 56;
const PARKED_CAR_W = 32;
const PARKED_CAR_H = 60;
const PARKING_TICK = 16;
const TURN_SPEED = 0.04;
const ACCEL = 0.12;
const FRICTION = 0.94;
const MAX_SPEED = 2.5;
const PARKING_LEVELS = 5;

interface ParkingState {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  speed: number;
  steering: number; // -1 left, 0 straight, 1 right
  throttle: number; // -1 reverse, 0 idle, 1 forward
}

interface ParkingSpot {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ParkedCar {
  x: number;
  y: number;
  w: number;
  h: number;
}

function generateParkingLevel(level: number): { spot: ParkingSpot; parkedCars: ParkedCar[] } {
  // Gap gets tighter as level increases
  const gapSize = PARKED_CAR_H + 30 - level * 3;
  const spotX = PARKING_W - 50;
  const spotY = PARKING_H / 2 - gapSize / 2;

  const parkedCars: ParkedCar[] = [];
  // Car above the spot
  parkedCars.push({ x: spotX - 1, y: spotY - PARKED_CAR_H - 4, w: PARKED_CAR_W, h: PARKED_CAR_H });
  // Car below the spot
  parkedCars.push({ x: spotX - 1, y: spotY + gapSize + 4, w: PARKED_CAR_W, h: PARKED_CAR_H });

  // Add random cars on the left side for obstacles in later levels
  if (level >= 2) {
    parkedCars.push({ x: 30, y: 60, w: PARKED_CAR_W, h: PARKED_CAR_H });
  }
  if (level >= 3) {
    parkedCars.push({ x: 30, y: PARKING_H - 120, w: PARKED_CAR_W, h: PARKED_CAR_H });
  }
  if (level >= 4) {
    parkedCars.push({ x: 120, y: 140, w: PARKED_CAR_W, h: PARKED_CAR_H });
  }

  return {
    spot: { x: spotX, y: spotY, w: PARKED_CAR_W + 4, h: gapSize },
    parkedCars,
  };
}

function getCarCorners(x: number, y: number, angle: number, w: number, h: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const hw = w / 2;
  const hh = h / 2;
  return [
    { x: x + cos * (-hw) - sin * (-hh), y: y + sin * (-hw) + cos * (-hh) },
    { x: x + cos * (hw) - sin * (-hh), y: y + sin * (hw) + cos * (-hh) },
    { x: x + cos * (hw) - sin * (hh), y: y + sin * (hw) + cos * (hh) },
    { x: x + cos * (-hw) - sin * (hh), y: y + sin * (-hw) + cos * (hh) },
  ];
}

function rectContainsPoint(rx: number, ry: number, rw: number, rh: number, px: number, py: number) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

function checkCollision(car: ParkingState, obstacles: ParkedCar[]): boolean {
  const corners = getCarCorners(car.x, car.y, car.angle, CAR_W, CAR_H);
  // Check bounds
  for (const c of corners) {
    if (c.x < 0 || c.x > PARKING_W || c.y < 0 || c.y > PARKING_H) return true;
  }
  // Check obstacles
  for (const obs of obstacles) {
    for (const c of corners) {
      if (rectContainsPoint(obs.x, obs.y, obs.w, obs.h, c.x, c.y)) return true;
    }
    // Also check obstacle corners against player car (SAT approximation)
    const obsCorners = [
      { x: obs.x, y: obs.y },
      { x: obs.x + obs.w, y: obs.y },
      { x: obs.x + obs.w, y: obs.y + obs.h },
      { x: obs.x, y: obs.y + obs.h },
    ];
    // Transform obstacle corners into car's local space
    const cos = Math.cos(-car.angle);
    const sin = Math.sin(-car.angle);
    for (const oc of obsCorners) {
      const dx = oc.x - car.x;
      const dy = oc.y - car.y;
      const lx = cos * dx - sin * dy;
      const ly = sin * dx + cos * dy;
      if (Math.abs(lx) < CAR_W / 2 && Math.abs(ly) < CAR_H / 2) return true;
    }
  }
  return false;
}

function checkParked(car: ParkingState, spot: ParkingSpot): boolean {
  const corners = getCarCorners(car.x, car.y, car.angle, CAR_W, CAR_H);
  // All corners must be inside the spot (with some tolerance)
  const tolerance = 3;
  for (const c of corners) {
    if (
      c.x < spot.x - tolerance ||
      c.x > spot.x + spot.w + tolerance ||
      c.y < spot.y - tolerance ||
      c.y > spot.y + spot.h + tolerance
    ) {
      return false;
    }
  }
  // Car must be roughly vertical (angle close to 0 or PI)
  const normAngle = ((car.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const angleOk = normAngle < 0.3 || normAngle > Math.PI * 2 - 0.3 || (normAngle > Math.PI - 0.3 && normAngle < Math.PI + 0.3);
  // Car must be nearly stopped
  const stopped = Math.abs(car.speed) < 0.3;
  return angleOk && stopped;
}

function useParking(onGameOver: (score: number) => void) {
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState("");
  const [parked, setParked] = useState(false);
  const [car, setCar] = useState<ParkingState>({
    x: 80, y: PARKING_H / 2, angle: 0, vx: 0, vy: 0, speed: 0, steering: 0, throttle: 0,
  });
  const [levelData, setLevelData] = useState(() => generateParkingLevel(1));
  const [timeLeft, setTimeLeft] = useState(15);
  const keysRef = useRef<Set<string>>(new Set());
  const tickRef = useRef<number>(0);
  const gameOverRef = useRef(false);
  const parkedRef = useRef(false);

  const reset = useCallback(() => {
    setLevel(1);
    setScore(0);
    setGameOver(false);
    setGameOverReason("");
    setParked(false);
    setTimeLeft(15);
    gameOverRef.current = false;
    parkedRef.current = false;
    const ld = generateParkingLevel(1);
    setLevelData(ld);
    setCar({ x: 80, y: PARKING_H / 2, angle: 0, vx: 0, vy: 0, speed: 0, steering: 0, throttle: 0 });
  }, []);

  const nextLevel = useCallback((currentLevel: number, currentScore: number) => {
    if (currentLevel >= PARKING_LEVELS) {
      // All levels complete!
      const finalScore = currentScore;
      setGameOver(true);
      setGameOverReason("All levels complete! 🎉");
      gameOverRef.current = true;
      onGameOver(finalScore);
      return;
    }
    const nl = currentLevel + 1;
    setLevel(nl);
    setParked(false);
    parkedRef.current = false;
    setTimeLeft(Math.max(10, 16 - nl));
    const ld = generateParkingLevel(nl);
    setLevelData(ld);
    setCar({ x: 80, y: PARKING_H / 2, angle: 0, vx: 0, vy: 0, speed: 0, steering: 0, throttle: 0 });
  }, [onGameOver]);

  // Keyboard controls
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { keysRef.current.add(e.key); };
    const onUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  // Game loop
  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      if (gameOverRef.current || parkedRef.current) return;

      setCar((prev) => {
        const keys = keysRef.current;
        let steering = 0;
        let throttle = 0;
        if (keys.has("ArrowLeft") || keys.has("a")) steering = -1;
        if (keys.has("ArrowRight") || keys.has("d")) steering = 1;
        if (keys.has("ArrowUp") || keys.has("w")) throttle = 1;
        if (keys.has("ArrowDown") || keys.has("s")) throttle = -1;

        let speed = prev.speed;
        if (throttle !== 0) {
          speed += throttle * ACCEL;
          speed = Math.max(-MAX_SPEED * 0.6, Math.min(MAX_SPEED, speed));
        } else {
          speed *= FRICTION;
          if (Math.abs(speed) < 0.01) speed = 0;
        }

        let angle = prev.angle;
        if (Math.abs(speed) > 0.05) {
          angle += steering * TURN_SPEED * Math.sign(speed);
        }

        const vx = Math.sin(angle) * speed;
        const vy = -Math.cos(angle) * speed;
        const x = prev.x + vx;
        const y = prev.y + vy;

        return { x, y, angle, vx, vy, speed, steering, throttle };
      });
    }, PARKING_TICK);

    return () => clearInterval(interval);
  }, [gameOver]);

  // Collision & parking check (separate from physics to avoid stale closures)
  useEffect(() => {
    if (gameOver) return;
    const check = setInterval(() => {
      if (gameOverRef.current || parkedRef.current) return;
      setCar((currentCar) => {
        if (checkCollision(currentCar, levelData.parkedCars)) {
          setGameOver(true);
          setGameOverReason("💥 Crash!");
          gameOverRef.current = true;
          setScore((s) => { onGameOver(s); return s; });
        } else if (checkParked(currentCar, levelData.spot)) {
          parkedRef.current = true;
          setParked(true);
          const bonus = Math.ceil(timeLeft * 10);
          setScore((s) => {
            const newScore = s + 100 + bonus;
            setLevel((cl) => {
              nextLevel(cl, newScore);
              return cl;
            });
            return newScore;
          });
        }
        return currentCar;
      });
    }, 50);
    return () => clearInterval(check);
  }, [gameOver, levelData, timeLeft, onGameOver, nextLevel]);

  // Timer
  useEffect(() => {
    if (gameOver || parked) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0.1) {
          setGameOver(true);
          setGameOverReason("⏱️ Time's up!");
          gameOverRef.current = true;
          setScore((s) => { onGameOver(s); return s; });
          return 0;
        }
        return Math.max(0, t - 0.1);
      });
    }, 100);
    return () => clearInterval(timer);
  }, [gameOver, parked, onGameOver]);

  // Touch/button controls
  const setSteer = useCallback((dir: number) => {
    if (dir === -1) { keysRef.current.add("ArrowLeft"); keysRef.current.delete("ArrowRight"); }
    else if (dir === 1) { keysRef.current.add("ArrowRight"); keysRef.current.delete("ArrowLeft"); }
    else { keysRef.current.delete("ArrowLeft"); keysRef.current.delete("ArrowRight"); }
  }, []);

  const setThrottle = useCallback((dir: number) => {
    if (dir === 1) { keysRef.current.add("ArrowUp"); keysRef.current.delete("ArrowDown"); }
    else if (dir === -1) { keysRef.current.add("ArrowDown"); keysRef.current.delete("ArrowUp"); }
    else { keysRef.current.delete("ArrowUp"); keysRef.current.delete("ArrowDown"); }
  }, []);

  return { car, level, score, gameOver, gameOverReason, parked, timeLeft, levelData, reset, setSteer, setThrottle };
}

function ParkingBoard({ game }: { game: ReturnType<typeof useParking> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animId: number;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Clear
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, PARKING_W, PARKING_H);

      // Draw road markings
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(PARKING_W / 2, 0);
      ctx.lineTo(PARKING_W / 2, PARKING_H);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw parking spot
      const spot = game.levelData.spot;
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 2;
      ctx.strokeRect(spot.x, spot.y, spot.w, spot.h);
      ctx.fillStyle = "rgba(74,222,128,0.08)";
      ctx.fillRect(spot.x, spot.y, spot.w, spot.h);

      // Draw parked cars (obstacles)
      for (const obs of game.levelData.parkedCars) {
        ctx.fillStyle = "#64748b";
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        // Windshield
        ctx.fillStyle = "#334155";
        ctx.fillRect(obs.x + 4, obs.y + 6, obs.w - 8, 10);
      }

      // Draw player car
      const { x, y, angle } = game.car;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      // Car body
      ctx.fillStyle = game.gameOver ? "#ef4444" : "#3b82f6";
      ctx.fillRect(-CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H);
      // Windshield
      ctx.fillStyle = "#1e3a5f";
      ctx.fillRect(-CAR_W / 2 + 4, -CAR_H / 2 + 6, CAR_W - 8, 12);
      // Tail lights
      ctx.fillStyle = "#f87171";
      ctx.fillRect(-CAR_W / 2 + 2, CAR_H / 2 - 6, 6, 4);
      ctx.fillRect(CAR_W / 2 - 8, CAR_H / 2 - 6, 6, 4);
      // Direction indicator (front)
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(-CAR_W / 2 + 2, -CAR_H / 2 + 2, 6, 3);
      ctx.fillRect(CAR_W / 2 - 8, -CAR_H / 2 + 2, 6, 3);
      ctx.restore();

      // HUD - level and timer
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "bold 14px system-ui";
      ctx.fillText(`Level ${game.level}/${PARKING_LEVELS}`, 8, 20);
      ctx.fillStyle = game.timeLeft < 3 ? "#ef4444" : "rgba(255,255,255,0.7)";
      ctx.fillText(`⏱️ ${game.timeLeft.toFixed(1)}s`, 8, 40);

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [game.car, game.levelData, game.level, game.timeLeft, game.gameOver]);

  return (
    <canvas
      ref={canvasRef}
      width={PARKING_W}
      height={PARKING_H}
      className="w-full rounded-lg border border-white/[0.1]"
      style={{ imageRendering: "crisp-edges" }}
    />
  );
}

// ─── 3D Maze Game (Raycasting) ──────────────────────────────────────────────

const MAZE_W = 320;
const MAZE_H = 240;
const MAZE_SIZE = 15; // grid cells
const MAZE_FOV = Math.PI / 3;
const MAZE_NUM_RAYS = MAZE_W;
const MAZE_MOVE_SPEED = 0.06;
const MAZE_ROT_SPEED = 0.05;

function generateMaze(size: number): { grid: number[][]; startX: number; startY: number; endX: number; endY: number } {
  // Create grid filled with walls (1)
  const grid: number[][] = Array.from({ length: size }, () => Array(size).fill(1));

  // Recursive backtracker maze generation
  const visited: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const carve = (cx: number, cy: number) => {
    visited[cy][cx] = true;
    grid[cy][cx] = 0;

    const dirs = [
      [0, -2], [0, 2], [-2, 0], [2, 0],
    ].sort(() => Math.random() - 0.5);

    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size && !visited[ny][nx]) {
        // Carve the wall between
        grid[cy + dy / 2][cx + dx / 2] = 0;
        carve(nx, ny);
      }
    }
  };

  // Start at (1,1)
  carve(1, 1);

  const startX = 1;
  const startY = 1;
  // End at bottom-right open cell
  let endX = size - 2;
  let endY = size - 2;
  // Ensure end is open
  grid[endY][endX] = 0;
  // Also ensure the cell before it is open for accessibility
  if (endX - 1 >= 0) grid[endY][endX - 1] = 0;

  return { grid, startX, startY, endX, endY };
}

function useMaze(onGameOver: (score: number) => void) {
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [mazeData, setMazeData] = useState(() => generateMaze(MAZE_SIZE));
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [won, setWon] = useState(false);

  const playerRef = useRef({ x: 1.5, y: 1.5, angle: 0 });
  const keysRef = useRef<Set<string>>(new Set());
  const gameOverRef = useRef(false);
  const startTimeRef = useRef(0);

  const reset = useCallback(() => {
    const maze = generateMaze(MAZE_SIZE);
    setMazeData(maze);
    setScore(0);
    setGameOver(false);
    setWon(false);
    setTimeElapsed(0);
    gameOverRef.current = false;
    playerRef.current = { x: maze.startX + 0.5, y: maze.startY + 0.5, angle: 0 };
    startTimeRef.current = performance.now();
  }, []);

  // Keyboard controls
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { keysRef.current.add(e.key); };
    const onUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  // Game loop
  useEffect(() => {
    if (gameOver) return;
    startTimeRef.current = performance.now();

    let animId: number;
    const tick = () => {
      if (gameOverRef.current) return;

      const keys = keysRef.current;
      const p = playerRef.current;

      // Rotation
      if (keys.has("ArrowLeft") || keys.has("a")) p.angle -= MAZE_ROT_SPEED;
      if (keys.has("ArrowRight") || keys.has("d")) p.angle += MAZE_ROT_SPEED;

      // Movement
      let dx = 0, dy = 0;
      if (keys.has("ArrowUp") || keys.has("w")) {
        dx += Math.cos(p.angle) * MAZE_MOVE_SPEED;
        dy += Math.sin(p.angle) * MAZE_MOVE_SPEED;
      }
      if (keys.has("ArrowDown") || keys.has("s")) {
        dx -= Math.cos(p.angle) * MAZE_MOVE_SPEED;
        dy -= Math.sin(p.angle) * MAZE_MOVE_SPEED;
      }

      // Collision detection
      const margin = 0.2;
      const newX = p.x + dx;
      const newY = p.y + dy;
      if (mazeData.grid[Math.floor(p.y)][Math.floor(newX + margin * Math.sign(dx))] === 0) {
        p.x = newX;
      }
      if (mazeData.grid[Math.floor(newY + margin * Math.sign(dy))][Math.floor(p.x)] === 0) {
        p.y = newY;
      }

      // Check if reached end
      const distToEnd = Math.hypot(p.x - (mazeData.endX + 0.5), p.y - (mazeData.endY + 0.5));
      if (distToEnd < 0.5) {
        gameOverRef.current = true;
        const elapsed = (performance.now() - startTimeRef.current) / 1000;
        setTimeElapsed(elapsed);
        // Score: higher is better, based on speed. Max 10000, minus time penalty
        const finalScore = Math.max(100, Math.round(10000 - elapsed * 100));
        setScore(finalScore);
        setWon(true);
        setGameOver(true);
        onGameOver(finalScore);
        return;
      }

      setTimeElapsed((performance.now() - startTimeRef.current) / 1000);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [gameOver, mazeData, onGameOver]);

  // Mobile controls
  const moveForward = useCallback(() => { keysRef.current.add("ArrowUp"); }, []);
  const moveBackward = useCallback(() => { keysRef.current.add("ArrowDown"); }, []);
  const turnLeft = useCallback(() => { keysRef.current.add("ArrowLeft"); }, []);
  const turnRight = useCallback(() => { keysRef.current.add("ArrowRight"); }, []);
  const stopForward = useCallback(() => { keysRef.current.delete("ArrowUp"); }, []);
  const stopBackward = useCallback(() => { keysRef.current.delete("ArrowDown"); }, []);
  const stopLeft = useCallback(() => { keysRef.current.delete("ArrowLeft"); }, []);
  const stopRight = useCallback(() => { keysRef.current.delete("ArrowRight"); }, []);

  return {
    score, gameOver, won, timeElapsed, mazeData, playerRef, reset,
    moveForward, moveBackward, turnLeft, turnRight,
    stopForward, stopBackward, stopLeft, stopRight,
  };
}

function MazeBoard({ game }: { game: ReturnType<typeof useMaze> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const draw = () => {
      const { grid } = game.mazeData;
      const player = game.playerRef.current;
      const w = MAZE_W;
      const h = MAZE_H;

      // Clear - sky and floor
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, w, h / 2);
      ctx.fillStyle = "#2d2d44";
      ctx.fillRect(0, h / 2, w, h / 2);

      // Raycasting
      const startAngle = player.angle - MAZE_FOV / 2;
      const angleStep = MAZE_FOV / MAZE_NUM_RAYS;

      for (let i = 0; i < MAZE_NUM_RAYS; i++) {
        const rayAngle = startAngle + i * angleStep;
        const cos = Math.cos(rayAngle);
        const sin = Math.sin(rayAngle);

        // DDA algorithm for efficient raycasting
        let mapX = Math.floor(player.x);
        let mapY = Math.floor(player.y);
        const deltaDistX = Math.abs(1 / cos);
        const deltaDistY = Math.abs(1 / sin);
        const stepX = cos < 0 ? -1 : 1;
        const stepY = sin < 0 ? -1 : 1;
        let sideDistX = cos < 0
          ? (player.x - mapX) * deltaDistX
          : (mapX + 1 - player.x) * deltaDistX;
        let sideDistY = sin < 0
          ? (player.y - mapY) * deltaDistY
          : (mapY + 1 - player.y) * deltaDistY;

        let hit = false;
        let side = 0; // 0 = vertical wall hit, 1 = horizontal wall hit
        let dist = 0;

        while (!hit && dist < 20) {
          if (sideDistX < sideDistY) {
            sideDistX += deltaDistX;
            mapX += stepX;
            side = 0;
          } else {
            sideDistY += deltaDistY;
            mapY += stepY;
            side = 1;
          }

          if (mapX < 0 || mapX >= MAZE_SIZE || mapY < 0 || mapY >= MAZE_SIZE) {
            hit = true;
            dist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
          } else if (grid[mapY][mapX] === 1) {
            hit = true;
            dist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
          }
        }

        if (!hit) continue;

        // Fix fisheye
        const correctedDist = dist * Math.cos(rayAngle - player.angle);
        const wallHeight = Math.min(h, h / correctedDist);

        // Color based on distance and wall side
        const brightness = Math.max(0, 1 - correctedDist / 8);

        let r: number, g: number, b: number;
        if (side === 0) {
          r = Math.floor(80 * brightness);
          g = Math.floor(120 * brightness);
          b = Math.floor(200 * brightness);
        } else {
          r = Math.floor(60 * brightness);
          g = Math.floor(90 * brightness);
          b = Math.floor(160 * brightness);
        }

        // Check if this is the end cell (green walls near goal)
        const isEnd = mapX === game.mazeData.endX && mapY === game.mazeData.endY;
        if (isEnd) {
          r = Math.floor(80 * brightness);
          g = Math.floor(200 * brightness);
          b = Math.floor(80 * brightness);
        }

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(i, (h - wallHeight) / 2, 1, wallHeight);
      }

      // Draw end marker (green glow at the end position)
      const endDx = (game.mazeData.endX + 0.5) - player.x;
      const endDy = (game.mazeData.endY + 0.5) - player.y;
      const endAngle = Math.atan2(endDy, endDx);
      const endDist = Math.hypot(endDx, endDy);
      const relAngle = endAngle - player.angle;
      // Normalize to [-PI, PI]
      const normAngle = ((relAngle + Math.PI) % (2 * Math.PI)) - Math.PI;

      if (Math.abs(normAngle) < MAZE_FOV / 2 && endDist < 10) {
        const screenX = (normAngle / MAZE_FOV + 0.5) * w;
        const correctedEndDist = endDist * Math.cos(normAngle);
        const markerSize = Math.min(80, h / correctedEndDist * 0.4);
        const alpha = Math.max(0.2, 1 - correctedEndDist / 8);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#22c55e";
        ctx.shadowColor = "#22c55e";
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(screenX, h / 2, markerSize / 2, 0, Math.PI * 2);
        ctx.fill();
        // Flag icon
        ctx.fillStyle = "#ffffff";
        ctx.font = `${Math.max(12, markerSize * 0.6)}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🏁", screenX, h / 2);
        ctx.restore();
      }

      // HUD
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "bold 14px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(`⏱️ ${game.timeElapsed.toFixed(1)}s`, 8, 20);

      // Minimap
      const mmSize = 60;
      const mmCellSize = mmSize / MAZE_SIZE;
      const mmX = w - mmSize - 8;
      const mmY = 8;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(mmX, mmY, mmSize, mmSize);
      for (let my = 0; my < MAZE_SIZE; my++) {
        for (let mx = 0; mx < MAZE_SIZE; mx++) {
          if (grid[my][mx] === 1) {
            ctx.fillStyle = "rgba(100,130,200,0.5)";
            ctx.fillRect(mmX + mx * mmCellSize, mmY + my * mmCellSize, mmCellSize, mmCellSize);
          }
        }
      }
      // Player on minimap
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(mmX + player.x * mmCellSize, mmY + player.y * mmCellSize, 2, 0, Math.PI * 2);
      ctx.fill();
      // End on minimap
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(mmX + (game.mazeData.endX + 0.5) * mmCellSize, mmY + (game.mazeData.endY + 0.5) * mmCellSize, 2, 0, Math.PI * 2);
      ctx.fill();

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [game.mazeData, game.playerRef, game.timeElapsed, game.gameOver]);

  return (
    <canvas
      ref={canvasRef}
      width={MAZE_W}
      height={MAZE_H}
      className="w-full rounded-lg border border-white/[0.1]"
      style={{ imageRendering: "crisp-edges" }}
    />
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
  const lingoGame = useLingo(handleGameOver);
  const triviaGame = useTriviaGame(handleGameOver);
  const chessGame = useChess(handleGameOver);
  const parkingGame = useParking(handleGameOver);
  const mazeGame = useMaze(handleGameOver);
  const [gameOverReady, setGameOverReady] = useState(false);

  const startGame = () => {
    setPlaying(true);
    setGameOverReady(false);
    if (selectedGame?.id === "snake") snakeGame.reset();
    else if (selectedGame?.id === "flappy") flappyGame.reset();
    else if (selectedGame?.id === "lingo") lingoGame.reset();
    else if (selectedGame?.id === "trivia") triviaGame.reset();
    else if (selectedGame?.id === "chess") chessGame.reset();
    else if (selectedGame?.id === "parking") parkingGame.reset();
    else if (selectedGame?.id === "maze") mazeGame.reset();
  };

  // Delay-enable buttons after game over to prevent accidental taps
  const isGameOverNow =
    (selectedGame?.id === "snake" && snakeGame.gameOver) ||
    (selectedGame?.id === "flappy" && flappyGame.gameOver) ||
    (selectedGame?.id === "lingo" && lingoGame.gameOver) ||
    (selectedGame?.id === "trivia" && triviaGame.gameOver) ||
    (selectedGame?.id === "chess" && chessGame.gameOver) ||
    (selectedGame?.id === "parking" && parkingGame.gameOver) ||
    (selectedGame?.id === "maze" && mazeGame.gameOver);
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

        {/* Chess PvP link */}
        <Link to="/games/chess-pvp">
          <Card className="cursor-pointer active:bg-white/[0.06] transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚔️</span>
              <div>
                <div className="text-sm font-semibold text-white/90">
                  Chess PvP
                </div>
                <div className="text-xs text-white/40">
                  Play chess against other players
                </div>
              </div>
            </div>
          </Card>
        </Link>

        {/* Racing link */}
        <Link to="/games/racing">
          <Card className="cursor-pointer active:bg-white/[0.06] transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏎️</span>
              <div>
                <div className="text-sm font-semibold text-white/90">
                  Racing
                </div>
                <div className="text-xs text-white/40">
                  Race against AI or other players
                </div>
              </div>
            </div>
          </Card>
        </Link>

        {/* Mexen link */}
        <Link to="/games/mexen">
          <Card className="cursor-pointer active:bg-white/[0.06] transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎲</span>
              <div>
                <div className="text-sm font-semibold text-white/90">
                  Mexen
                </div>
                <div className="text-xs text-white/40">
                  Dobbelspel — doorjagen en scoren!
                </div>
              </div>
            </div>
          </Card>
        </Link>
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
                      : selectedGame.id === "lingo"
                        ? lingoGame.gameOver
                      : selectedGame.id === "trivia"
                        ? triviaGame.gameOver
                        : selectedGame.id === "parking"
                          ? parkingGame.gameOver
                          : selectedGame.id === "maze"
                            ? mazeGame.gameOver
                            : chessGame.gameOver)
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
                        : selectedGame.id === "lingo"
                          ? lingoGame.score
                        : selectedGame.id === "trivia"
                          ? triviaGame.score
                          : selectedGame.id === "parking"
                            ? parkingGame.score
                            : selectedGame.id === "maze"
                              ? mazeGame.score
                              : chessGame.score;
                  const isGameOver =
                    selectedGame.id === "snake"
                      ? snakeGame.gameOver
                      : selectedGame.id === "flappy"
                        ? flappyGame.gameOver
                        : selectedGame.id === "lingo"
                          ? lingoGame.gameOver
                        : selectedGame.id === "trivia"
                          ? triviaGame.gameOver
                          : selectedGame.id === "parking"
                            ? parkingGame.gameOver
                            : selectedGame.id === "maze"
                              ? mazeGame.gameOver
                              : chessGame.gameOver;

                  return (
                    <>
                      <div className={`flex items-center mb-3 ${selectedGame.id !== "trivia" ? "justify-between" : "justify-end"}`}>
                        {selectedGame.id !== "trivia" && (
                          <Badge variant="default">Score: {currentScore}</Badge>
                        )}
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
                      {selectedGame.id === "lingo" && (
                        <LingoBoard lingoGame={lingoGame} />
                      )}
                      {selectedGame.id === "trivia" && !triviaGame.gameOver && (
                        <TriviaBoard triviaGame={triviaGame} />
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
                      {selectedGame.id === "parking" && (
                        <ParkingBoard game={parkingGame} />
                      )}
                      {selectedGame.id === "maze" && (
                        <MazeBoard game={mazeGame} />
                      )}

                      {isGameOver && (
                        <div className="mt-3 text-center">
                          <p className="text-sm text-white/70 mb-2">
                            {selectedGame.id === "chess" && chessGame.gameOverReason ? (
                              <>{chessGame.gameOverReason} Score:{" "}</>
                            ) : selectedGame.id === "parking" && parkingGame.gameOverReason ? (
                              <>{parkingGame.gameOverReason} Score:{" "}</>
                            ) : selectedGame.id === "maze" && mazeGame.won ? (
                              <>Maze completed in {mazeGame.timeElapsed.toFixed(1)}s! Score:{" "}</>
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
                          <div className="grid grid-cols-3 gap-2 w-52 select-none">
                            <div />
                            <button
                              onPointerDown={() => snakeGame.changeDir("UP")}
                              className="h-16 rounded-2xl bg-white/[0.12] active:bg-white/[0.25] flex items-center justify-center text-white/80 touch-none"
                            >
                              <ArrowUp size={32} />
                            </button>
                            <div />
                            <button
                              onPointerDown={() => snakeGame.changeDir("LEFT")}
                              className="h-16 rounded-2xl bg-white/[0.12] active:bg-white/[0.25] flex items-center justify-center text-white/80 touch-none"
                            >
                              <ArrowLeft size={32} />
                            </button>
                            <div className="h-16 rounded-2xl bg-white/[0.05]" role="presentation" aria-hidden="true" />
                            <button
                              onPointerDown={() => snakeGame.changeDir("RIGHT")}
                              className="h-16 rounded-2xl bg-white/[0.12] active:bg-white/[0.25] flex items-center justify-center text-white/80 touch-none"
                            >
                              <ArrowRight size={32} />
                            </button>
                            <div />
                            <button
                              onPointerDown={() => snakeGame.changeDir("DOWN")}
                              className="h-16 rounded-2xl bg-white/[0.12] active:bg-white/[0.25] flex items-center justify-center text-white/80 touch-none"
                            >
                              <ArrowDown size={32} />
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

                      {/* Parking controls */}
                      {selectedGame.id === "parking" && !parkingGame.gameOver && (
                        <div className="mt-4 flex justify-center">
                          <div className="grid grid-cols-3 gap-2 w-52 select-none">
                            <div />
                            <button
                              onPointerDown={() => parkingGame.setThrottle(1)}
                              onPointerUp={() => parkingGame.setThrottle(0)}
                              onPointerLeave={() => parkingGame.setThrottle(0)}
                              className="h-14 rounded-2xl bg-white/[0.12] active:bg-white/[0.25] flex items-center justify-center text-white/80 touch-none"
                            >
                              <ArrowUp size={28} />
                            </button>
                            <div />
                            <button
                              onPointerDown={() => parkingGame.setSteer(-1)}
                              onPointerUp={() => parkingGame.setSteer(0)}
                              onPointerLeave={() => parkingGame.setSteer(0)}
                              className="h-14 rounded-2xl bg-white/[0.12] active:bg-white/[0.25] flex items-center justify-center text-white/80 touch-none"
                            >
                              <ArrowLeft size={28} />
                            </button>
                            <div className="h-14 rounded-2xl bg-white/[0.05]" role="presentation" aria-hidden="true" />
                            <button
                              onPointerDown={() => parkingGame.setSteer(1)}
                              onPointerUp={() => parkingGame.setSteer(0)}
                              onPointerLeave={() => parkingGame.setSteer(0)}
                              className="h-14 rounded-2xl bg-white/[0.12] active:bg-white/[0.25] flex items-center justify-center text-white/80 touch-none"
                            >
                              <ArrowRight size={28} />
                            </button>
                            <div />
                            <button
                              onPointerDown={() => parkingGame.setThrottle(-1)}
                              onPointerUp={() => parkingGame.setThrottle(0)}
                              onPointerLeave={() => parkingGame.setThrottle(0)}
                              className="h-14 rounded-2xl bg-white/[0.12] active:bg-white/[0.25] flex items-center justify-center text-white/80 touch-none"
                            >
                              <ArrowDown size={28} />
                            </button>
                            <div />
                          </div>
                        </div>
                      )}

                      {/* Maze controls */}
                      {selectedGame.id === "maze" && !mazeGame.gameOver && (
                        <div className="mt-4 flex justify-center">
                          <div className="grid grid-cols-3 gap-2 w-52 select-none">
                            <div />
                            <button
                              aria-label="Move forward"
                              onPointerDown={mazeGame.moveForward}
                              onPointerUp={mazeGame.stopForward}
                              onPointerLeave={mazeGame.stopForward}
                              className="h-14 rounded-2xl bg-white/[0.12] active:bg-white/[0.25] flex items-center justify-center text-white/80 touch-none"
                            >
                              <ArrowUp size={28} />
                            </button>
                            <div />
                            <button
                              aria-label="Turn left"
                              onPointerDown={mazeGame.turnLeft}
                              onPointerUp={mazeGame.stopLeft}
                              onPointerLeave={mazeGame.stopLeft}
                              className="h-14 rounded-2xl bg-white/[0.12] active:bg-white/[0.25] flex items-center justify-center text-white/80 touch-none"
                            >
                              <ArrowLeft size={28} />
                            </button>
                            <div className="h-14 rounded-2xl bg-white/[0.05]" role="presentation" aria-hidden="true" />
                            <button
                              aria-label="Turn right"
                              onPointerDown={mazeGame.turnRight}
                              onPointerUp={mazeGame.stopRight}
                              onPointerLeave={mazeGame.stopRight}
                              className="h-14 rounded-2xl bg-white/[0.12] active:bg-white/[0.25] flex items-center justify-center text-white/80 touch-none"
                            >
                              <ArrowRight size={28} />
                            </button>
                            <div />
                            <button
                              aria-label="Move backward"
                              onPointerDown={mazeGame.moveBackward}
                              onPointerUp={mazeGame.stopBackward}
                              onPointerLeave={mazeGame.stopBackward}
                              className="h-14 rounded-2xl bg-white/[0.12] active:bg-white/[0.25] flex items-center justify-center text-white/80 touch-none"
                            >
                              <ArrowDown size={28} />
                            </button>
                            <div />
                          </div>
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
