import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ArrowLeft, Users, Loader2, Trophy, Flag, Zap } from "lucide-react";
import { Link } from "react-router-dom";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlayerPosition {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  lap: number;
  checkpoint: number;
  finished: boolean;
}

interface RacePlayer {
  id: number;
  name: string;
  isAI: boolean;
}

interface RaceListEntry {
  id: string;
  createdBy: string;
  status: string;
  players: RacePlayer[];
  createdAt: number;
}

interface RankingEntry {
  id: number;
  name: string;
  position: number;
  time: number | null;
}

// ─── Track Definition (unique winding circuit) ───────────────────────────────

const CANVAS_W = 900;
const CANVAS_H = 600;
const TOTAL_LAPS = 3;
const LOBBY_REFRESH_MS = 5000;
const POSITION_UPDATE_MS = 50;
const RENDER_DISTANCE = 400; // Max distance to render objects from camera
const MIN_CAMERA_DEPTH = 20; // Objects behind this depth are behind the camera
const SPEED_TO_KMH = 15; // Conversion factor: internal speed units to km/h

// Physics constants - tuned for exciting feel
const ACCELERATION = 0.18;
const FRICTION = 0.975;
const TURN_SPEED = 0.045;
const MAX_SPEED = 8;
const BRAKE_FACTOR = 1.8;
const MAX_REVERSE_FACTOR = 2.5;
const OFF_TRACK_FRICTION = 0.88;
const DRIFT_FACTOR = 0.92;
const BOOST_SPEED = 12;
const BOOST_DURATION = 60; // frames

// Complex winding track - defined as a series of waypoints forming the center line
// This creates an exciting circuit with hairpins, chicanes, and sweeping curves
const TRACK_POINTS: { x: number; y: number }[] = [
  // Start/Finish straight
  { x: 450, y: 520 }, { x: 550, y: 520 }, { x: 650, y: 510 },
  // First sweeping right turn
  { x: 730, y: 480 }, { x: 790, y: 430 }, { x: 820, y: 370 },
  // Chicane section
  { x: 810, y: 300 }, { x: 770, y: 250 }, { x: 720, y: 220 },
  // Hard left hairpin
  { x: 650, y: 180 }, { x: 580, y: 140 }, { x: 500, y: 120 },
  // Esses (S-curves)
  { x: 420, y: 130 }, { x: 350, y: 160 }, { x: 300, y: 200 },
  { x: 270, y: 250 }, { x: 260, y: 300 },
  // Sweeping left through the valley
  { x: 230, y: 350 }, { x: 180, y: 380 }, { x: 140, y: 410 },
  // Tight U-turn
  { x: 100, y: 440 }, { x: 90, y: 470 }, { x: 110, y: 500 },
  // Back straight with slight curve
  { x: 160, y: 520 }, { x: 230, y: 530 }, { x: 320, y: 535 },
  { x: 400, y: 530 },
];

const TRACK_WIDTH_HALF = 42;

// Checkpoints for lap detection (subset of track points)
const CHECKPOINTS = [
  { x: 820, y: 370, radius: 55 },
  { x: 500, y: 120, radius: 55 },
  { x: 140, y: 410, radius: 55 },
  { x: 320, y: 535, radius: 55 },
];

// Boost pad locations
const BOOST_PADS = [
  { x: 600, y: 515, angle: 0, width: 40, height: 20 },
  { x: 500, y: 125, angle: -0.3, width: 40, height: 20 },
  { x: 200, y: 525, angle: 0.1, width: 40, height: 20 },
];

// Trackside decorations
const TREES: { x: number; y: number; size: number }[] = [];
const BUILDINGS: { x: number; y: number; w: number; h: number; color: string }[] = [];

// Generate decorations
(function generateDecorations() {
  const rng = (seed: number) => {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; };
  };
  const rand = rng(42);
  for (let i = 0; i < 60; i++) {
    const x = rand() * CANVAS_W;
    const y = rand() * CANVAS_H;
    if (!isNearTrack(x, y, 65)) {
      TREES.push({ x, y, size: 8 + rand() * 12 });
    }
  }
  for (let i = 0; i < 12; i++) {
    const x = rand() * CANVAS_W;
    const y = rand() * CANVAS_H;
    if (!isNearTrack(x, y, 80)) {
      BUILDINGS.push({
        x, y,
        w: 20 + rand() * 30,
        h: 20 + rand() * 40,
        color: `hsl(${rand() * 360}, 30%, ${20 + rand() * 20}%)`,
      });
    }
  }
})();

function isNearTrack(px: number, py: number, minDist: number): boolean {
  for (const pt of TRACK_POINTS) {
    const d = Math.sqrt((px - pt.x) ** 2 + (py - pt.y) ** 2);
    if (d < minDist) return true;
  }
  return false;
}

function isOnTrack(px: number, py: number): boolean {
  // Check distance to track center line segments
  for (let i = 0; i < TRACK_POINTS.length; i++) {
    const a = TRACK_POINTS[i];
    const b = TRACK_POINTS[(i + 1) % TRACK_POINTS.length];
    const dist = pointToSegmentDist(px, py, a.x, a.y, b.x, b.y);
    if (dist < TRACK_WIDTH_HALF) return true;
  }
  return false;
}

function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
}

function isOnBoostPad(px: number, py: number): boolean {
  for (const pad of BOOST_PADS) {
    const dist = Math.sqrt((px - pad.x) ** 2 + (py - pad.y) ** 2);
    if (dist < 25) return true;
  }
  return false;
}

// Color assignment
const KART_COLORS: Record<number, string> = {};
const COLOR_PALETTE = [
  "#ff2222", "#22cc22", "#2266ff", "#ffcc00",
  "#ff44ff", "#00cccc", "#ff6600", "#9933ff",
];

function getKartColor(id: number, index: number): string {
  if (!KART_COLORS[id]) {
    KART_COLORS[id] = COLOR_PALETTE[index % COLOR_PALETTE.length];
  }
  return KART_COLORS[id];
}

// ─── Particle System ─────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
}

const particles: Particle[] = [];

function emitParticles(x: number, y: number, count: number, color: string, spread: number) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * spread,
      vy: (Math.random() - 0.5) * spread,
      life: 1.0,
      maxLife: 20 + Math.random() * 20,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1 / p.maxLife;
    p.vx *= 0.95;
    p.vy *= 0.95;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ─── Racing Page Component ───────────────────────────────────────────────────

export default function Racing() {
  const { user } = useAuth();
  const [view, setView] = useState<"lobby" | "racing">("lobby");
  const [gameId, setGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState<RaceListEntry[]>([]);

  const fetchGames = useCallback(async () => {
    try {
      const res = await fetch("/api/racing/games");
      if (res.ok) {
        const data = await res.json() as { games: RaceListEntry[] };
        setGames(data.games);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, LOBBY_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchGames]);

  const createGame = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch("/api/racing/games", { method: "POST" });
      if (res.ok) {
        const data = await res.json() as { gameId: string };
        setGameId(data.gameId);
        setView("racing");
      }
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async (id: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/racing/game/join?gameId=${id}`, { method: "POST" });
      if (res.ok) {
        setGameId(id);
        setView("racing");
      }
    } finally {
      setLoading(false);
    }
  };

  if (view === "racing" && gameId) {
    return <RaceGame gameId={gameId} onBack={() => setView("lobby")} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/games" className="text-white/60 hover:text-white/90">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-white/90">🏎️ Kart Racing</h1>
      </div>

      <Card>
        <div className="space-y-3">
          <p className="text-sm text-white/60">
            3D Kart Racing! Hit the track, drift through hairpins, and hit boost pads.
            Your <strong className="text-yellow-400">top speed each lap</strong> is your score — push the limits!
          </p>
          <Button onClick={createGame} disabled={loading || !user} className="w-full">
            {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : <Flag className="mr-2" size={16} />}
            Start New Race
          </Button>
          {!user && (
            <p className="text-xs text-yellow-400/80 text-center">Log in to race</p>
          )}
        </div>
      </Card>

      {games.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-white/80 mb-2 flex items-center gap-2">
            <Users size={14} /> Active Races
          </h2>
          <div className="space-y-2">
            {games.map(game => (
              <div
                key={game.id}
                className="flex items-center justify-between p-2 rounded bg-white/[0.03]"
              >
                <div>
                  <div className="text-sm text-white/80">{game.createdBy}&apos;s race</div>
                  <div className="text-xs text-white/40">
                    {game.players.filter(p => !p.isAI).length} player(s) • {game.status}
                  </div>
                </div>
                <Button
                  onClick={() => joinGame(game.id)}
                  disabled={loading || !user || game.status === "racing"}
                  className="text-xs px-3 py-1"
                >
                  Join
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Race Game Component (3D Perspective View) ───────────────────────────────

function RaceGame({ gameId, onBack }: { gameId: string; onBack: () => void }) {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const animRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());

  const [status, setStatus] = useState<"waiting" | "countdown" | "racing" | "finished">("waiting");
  const [countdown, setCountdown] = useState(3);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [players, setPlayers] = useState<RacePlayer[]>([]);
  const [currentLap, setCurrentLap] = useState(0);
  const [topSpeedThisLap, setTopSpeedThisLap] = useState(0);
  const [bestLapSpeed, setBestLapSpeed] = useState(0);

  // Local player state
  const localPlayerRef = useRef({
    x: 450, y: 520, angle: 0, speed: 0, lap: 0, checkpoint: 0,
    driftAngle: 0, boostTimer: 0, topSpeedThisLap: 0, bestLapSpeed: 0,
  });
  const positionsRef = useRef<PlayerPosition[]>([]);
  const frameCountRef = useRef(0);

  // Save top speed per lap to backend instantly
  const saveTopSpeed = useCallback(async (speed: number) => {
    try {
      // Convert internal speed units to km/h for display (multiply by 15)
      const kmh = Math.round(speed * SPEED_TO_KMH);
      await fetch("/api/minigame-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: "racing-topspeed", score: kmh }),
      });
    } catch { /* ignore */ }
  }, []);

  // Connect WebSocket
  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/racing/game/ws?gameId=${gameId}&userId=${user.id}&userName=${encodeURIComponent(user.name)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; payload: unknown };

        switch (msg.type) {
          case "state": {
            const state = msg.payload as {
              players: { id: number; name: string; isAI: boolean; x: number; y: number; angle: number }[];
              status: string;
            };
            setPlayers(state.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI })));
            setStatus(state.status as typeof status);
            const me = state.players.find(p => p.id === user.id);
            if (me) {
              localPlayerRef.current.x = me.x;
              localPlayerRef.current.y = me.y;
              localPlayerRef.current.angle = me.angle;
            }
            break;
          }
          case "countdown": {
            const { count } = msg.payload as { count: number };
            setCountdown(count);
            setStatus("countdown");
            break;
          }
          case "race_start":
            setStatus("racing");
            break;
          case "positions": {
            positionsRef.current = msg.payload as PlayerPosition[];
            break;
          }
          case "player_joined": {
            const { id, name } = msg.payload as { id: number; name: string };
            setPlayers(prev => {
              if (prev.some(p => p.id === id)) return prev;
              return [...prev, { id, name, isAI: false }];
            });
            break;
          }
          case "race_end": {
            const { rankings: r } = msg.payload as { rankings: RankingEntry[] };
            setRankings(r);
            setStatus("finished");
            break;
          }
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => { wsRef.current = null; };
    return () => { ws.close(); };
  }, [user, gameId]);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const touchRef = useRef({ accelerating: false, braking: false, left: false, right: false });

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastSendTime = 0;

    const gameLoop = () => {
      animRef.current = requestAnimationFrame(gameLoop);
      frameCountRef.current++;

      const local = localPlayerRef.current;
      const keys = keysRef.current;
      const touch = touchRef.current;

      if (status === "racing" && user) {
        const isDrifting = keys.has(" ");
        const effectiveMaxSpeed = local.boostTimer > 0 ? BOOST_SPEED : MAX_SPEED;

        // Acceleration
        if (keys.has("ArrowUp") || keys.has("w") || keys.has("W") || touch.accelerating) {
          local.speed = Math.min(effectiveMaxSpeed, local.speed + ACCELERATION);
        }
        if (keys.has("ArrowDown") || keys.has("s") || keys.has("S") || touch.braking) {
          local.speed = Math.max(-MAX_SPEED / MAX_REVERSE_FACTOR, local.speed - ACCELERATION * BRAKE_FACTOR);
        }

        // Turning with drift mechanic
        if (Math.abs(local.speed) > 0.1) {
          const turnMod = isDrifting ? 1.5 : 1.0;
          if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A") || touch.left) {
            local.angle -= TURN_SPEED * turnMod * (local.speed > 0 ? 1 : -1);
            if (isDrifting) local.driftAngle -= 0.02;
          }
          if (keys.has("ArrowRight") || keys.has("d") || keys.has("D") || touch.right) {
            local.angle += TURN_SPEED * turnMod * (local.speed > 0 ? 1 : -1);
            if (isDrifting) local.driftAngle += 0.02;
          }
        }

        // Drift decay
        local.driftAngle *= DRIFT_FACTOR;

        // Friction
        local.speed *= FRICTION;

        // Boost timer
        if (local.boostTimer > 0) {
          local.boostTimer--;
          // Boost particles
          if (frameCountRef.current % 2 === 0) {
            emitParticles(
              local.x - Math.cos(local.angle) * 15,
              local.y - Math.sin(local.angle) * 15,
              2, "#ff6600", 3
            );
          }
        }

        // Move
        const moveAngle = local.angle + local.driftAngle * 0.3;
        local.x += Math.cos(moveAngle) * local.speed;
        local.y += Math.sin(moveAngle) * local.speed;

        // Bounds
        local.x = Math.max(10, Math.min(CANVAS_W - 10, local.x));
        local.y = Math.max(10, Math.min(CANVAS_H - 10, local.y));

        // Off-track penalty
        if (!isOnTrack(local.x, local.y)) {
          local.speed *= OFF_TRACK_FRICTION;
          // Grass particles
          if (Math.abs(local.speed) > 1 && frameCountRef.current % 4 === 0) {
            emitParticles(local.x, local.y, 1, "#4a7c3f", 2);
          }
        }

        // Boost pad detection
        if (isOnBoostPad(local.x, local.y) && local.boostTimer <= 0) {
          local.boostTimer = BOOST_DURATION;
          local.speed = Math.min(BOOST_SPEED, local.speed + 3);
          emitParticles(local.x, local.y, 15, "#ffaa00", 5);
        }

        // Track top speed this lap (throttle React updates to every 0.5 unit change)
        const currentSpeed = Math.abs(local.speed);
        if (currentSpeed > local.topSpeedThisLap) {
          const shouldUpdate = currentSpeed - local.topSpeedThisLap > 0.5;
          local.topSpeedThisLap = currentSpeed;
          if (shouldUpdate) setTopSpeedThisLap(currentSpeed);
        }

        // Tire smoke when drifting
        if (isDrifting && Math.abs(local.speed) > 2) {
          emitParticles(
            local.x - Math.cos(local.angle) * 10,
            local.y - Math.sin(local.angle) * 10,
            1, "rgba(200,200,200,0.6)", 2
          );
        }

        // Checkpoint detection
        const targetCP = CHECKPOINTS[local.checkpoint % CHECKPOINTS.length];
        const dist = Math.sqrt((local.x - targetCP.x) ** 2 + (local.y - targetCP.y) ** 2);
        if (dist < targetCP.radius) {
          local.checkpoint++;
          if (local.checkpoint % CHECKPOINTS.length === 0 && local.checkpoint > 0) {
            local.lap++;
            setCurrentLap(local.lap);
            // Save top speed for this lap instantly
            if (local.topSpeedThisLap > local.bestLapSpeed) {
              local.bestLapSpeed = local.topSpeedThisLap;
              setBestLapSpeed(local.topSpeedThisLap);
            }
            saveTopSpeed(local.topSpeedThisLap);
            // Reset for next lap
            local.topSpeedThisLap = 0;
            setTopSpeedThisLap(0);
            // Celebration particles
            emitParticles(local.x, local.y, 20, "#ffcc00", 6);
          }
        }

        // Send position updates
        const now = Date.now();
        if (now - lastSendTime > POSITION_UPDATE_MS && wsRef.current?.readyState === WebSocket.OPEN) {
          lastSendTime = now;
          wsRef.current.send(JSON.stringify({
            type: "player_update",
            payload: {
              id: user.id,
              x: local.x, y: local.y,
              angle: local.angle,
              speed: local.speed,
              lap: local.lap,
              checkpoint: local.checkpoint,
            },
          }));
        }
      }

      // Update particles
      updateParticles();

      // Render
      draw3DFrame(ctx, local, positionsRef.current, players, user?.id || 0, status, countdown, frameCountRef.current);
    };

    animRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [status, countdown, user, players, saveTopSpeed]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-white/60 hover:text-white/90">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-white/90">🏎️ Kart Racing</h1>
        {status === "racing" && (
          <div className="ml-auto flex items-center gap-2">
            <Badge>Lap {Math.min(currentLap + 1, TOTAL_LAPS)}/{TOTAL_LAPS}</Badge>
            <Badge className="bg-yellow-500/20 text-yellow-300">
              <Zap size={12} className="mr-1" />
              {Math.round(topSpeedThisLap * SPEED_TO_KMH)} km/h
            </Badge>
          </div>
        )}
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="w-full rounded-lg border border-white/10 touch-none"
          style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
        />

        {status === "waiting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg backdrop-blur-sm">
            <div className="text-center">
              <Loader2 className="animate-spin mx-auto mb-2 text-white/80" size={32} />
              <p className="text-white/80 text-sm">Waiting to start...</p>
              <p className="text-white/40 text-xs mt-1">Other players can join your race</p>
            </div>
          </div>
        )}

        {status === "finished" && rankings.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg backdrop-blur-sm">
            <Card className="max-w-xs w-full mx-4">
              <h2 className="text-lg font-bold text-white/90 flex items-center gap-2 mb-3">
                <Trophy size={20} className="text-yellow-400" /> Race Results
              </h2>
              <div className="space-y-2">
                {rankings.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-white/60 w-5">{r.position}.</span>
                      <span className={r.id === user?.id ? "text-yellow-400 font-semibold" : "text-white/80"}>
                        {r.name}
                      </span>
                    </div>
                    <span className="text-white/40 text-xs">
                      {r.time ? `${(r.time / 1000).toFixed(1)}s` : "DNF"}
                    </span>
                  </div>
                ))}
              </div>
              {bestLapSpeed > 0 && (
                <div className="mt-3 p-2 rounded bg-yellow-500/10 text-center">
                  <p className="text-xs text-yellow-400">
                    🏆 Best Lap Top Speed: <strong>{Math.round(bestLapSpeed * SPEED_TO_KMH)} km/h</strong>
                  </p>
                </div>
              )}
              <Button onClick={onBack} className="w-full mt-3">
                Back to Lobby
              </Button>
            </Card>
          </div>
        )}
      </div>

      {/* Touch controls */}
      <div className="grid grid-cols-3 gap-2 md:hidden">
        <button
          className="bg-white/10 rounded-lg p-4 text-center text-xl active:bg-white/20"
          onTouchStart={() => { touchRef.current.left = true; }}
          onTouchEnd={() => { touchRef.current.left = false; }}
        >
          ◀
        </button>
        <div className="flex flex-col gap-1">
          <button
            className="bg-green-600/40 rounded-lg p-2 text-center text-sm active:bg-green-600/60 flex-1"
            onTouchStart={() => { touchRef.current.accelerating = true; }}
            onTouchEnd={() => { touchRef.current.accelerating = false; }}
          >
            ▲ Gas
          </button>
          <button
            className="bg-red-600/40 rounded-lg p-2 text-center text-sm active:bg-red-600/60 flex-1"
            onTouchStart={() => { touchRef.current.braking = true; }}
            onTouchEnd={() => { touchRef.current.braking = false; }}
          >
            ▼ Brake
          </button>
        </div>
        <button
          className="bg-white/10 rounded-lg p-4 text-center text-xl active:bg-white/20"
          onTouchStart={() => { touchRef.current.right = true; }}
          onTouchEnd={() => { touchRef.current.right = false; }}
        >
          ▶
        </button>
      </div>

      <Card>
        <p className="text-xs text-white/40">
          <strong className="text-white/60">Controls:</strong> Arrow keys / WASD to drive.
          <strong className="text-cyan-400"> Space</strong> to drift.
          Hit <span className="text-orange-400">boost pads</span> for speed!
          Your <span className="text-yellow-400">top speed per lap</span> is saved as your score.
        </p>
      </Card>
    </div>
  );
}

// ─── 3D Pseudo-Perspective Rendering ─────────────────────────────────────────

function draw3DFrame(
  ctx: CanvasRenderingContext2D,
  localPlayer: { x: number; y: number; angle: number; speed: number; lap: number; checkpoint: number; boostTimer: number; driftAngle: number; topSpeedThisLap: number },
  positions: PlayerPosition[],
  players: RacePlayer[],
  myId: number,
  status: string,
  countdown: number,
  frame: number,
) {
  const W = CANVAS_W;
  const H = CANVAS_H;

  // Sky gradient (dynamic based on speed)
  const speedRatio = Math.min(Math.abs(localPlayer.speed) / MAX_SPEED, 1);
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.4);
  skyGrad.addColorStop(0, `hsl(${210 - speedRatio * 10}, 70%, ${55 + speedRatio * 10}%)`);
  skyGrad.addColorStop(1, `hsl(${200 - speedRatio * 10}, 60%, ${75 + speedRatio * 5}%)`);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H * 0.4);

  // Clouds in sky (subtle)
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  for (let i = 0; i < 8; i++) {
    const cx = ((i * 137 + frame * 0.05) % W);
    const cy = 20 + ((i * 97) % (H * 0.25));
    ctx.beginPath();
    ctx.ellipse(cx, cy, 30 + (i % 3) * 15, 10 + (i % 2) * 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground (grass)
  const groundGrad = ctx.createLinearGradient(0, H * 0.4, 0, H);
  groundGrad.addColorStop(0, "#4a9e3f");
  groundGrad.addColorStop(1, "#357a2b");
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, H * 0.4, W, H * 0.6);

  // Draw the track from top-down with camera following player
  const camX = localPlayer.x;
  const camY = localPlayer.y;
  const camAngle = localPlayer.angle;

  // Transform helper: world -> screen with perspective
  // Cache trig values for the frame (camAngle is constant during rendering)
  const camCos = Math.cos(-camAngle + Math.PI / 2);
  const camSin = Math.sin(-camAngle + Math.PI / 2);

  const worldToScreen = (wx: number, wy: number): { sx: number; sy: number; scale: number } | null => {
    // Translate relative to camera
    const dx = wx - camX;
    const dy = wy - camY;

    // Rotate by camera angle (look forward)
    const rx = -(dx * camCos - dy * camSin);
    const ry = dx * camSin + dy * camCos;

    // Perspective projection
    const depth = ry; // distance in front of camera
    if (depth < MIN_CAMERA_DEPTH) return null; // behind camera

    const perspective = 300 / depth;
    const sx = W / 2 + rx * perspective;
    const sy = H * 0.45 - 20 * perspective + (H * 0.55) * (1 - Math.min(perspective, 3) / 3);

    return { sx, sy, scale: Math.min(perspective * 0.5, 2) };
  };

  // Draw track segments with pseudo-3D perspective
  // Sort track elements by distance to draw far-to-near
  type DrawItem = { dist: number; draw: () => void };
  const drawQueue: DrawItem[] = [];

  // Draw track surface segments
  for (let i = 0; i < TRACK_POINTS.length; i++) {
    const a = TRACK_POINTS[i];
    const b = TRACK_POINTS[(i + 1) % TRACK_POINTS.length];
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const dist = Math.sqrt((midX - camX) ** 2 + (midY - camY) ** 2);

    if (dist > RENDER_DISTANCE) continue; // cull distant segments

    const sa = worldToScreen(a.x, a.y);
    const sb = worldToScreen(b.x, b.y);
    if (!sa || !sb) continue;

    // Track edges (perpendicular offset)
    const segAngle = Math.atan2(b.y - a.y, b.x - a.x);
    const perpX = Math.cos(segAngle + Math.PI / 2);
    const perpY = Math.sin(segAngle + Math.PI / 2);

    const trackW = TRACK_WIDTH_HALF;
    const aL = worldToScreen(a.x + perpX * trackW, a.y + perpY * trackW);
    const aR = worldToScreen(a.x - perpX * trackW, a.y - perpY * trackW);
    const bL = worldToScreen(b.x + perpX * trackW, b.y + perpY * trackW);
    const bR = worldToScreen(b.x - perpX * trackW, b.y - perpY * trackW);

    if (!aL || !aR || !bL || !bR) continue;

    drawQueue.push({
      dist,
      draw: () => {
        // Track surface
        ctx.beginPath();
        ctx.moveTo(aL.sx, aL.sy);
        ctx.lineTo(aR.sx, aR.sy);
        ctx.lineTo(bR.sx, bR.sy);
        ctx.lineTo(bL.sx, bL.sy);
        ctx.closePath();

        // Alternate dark/light for racing stripe effect
        const isStripe = i % 2 === 0;
        ctx.fillStyle = isStripe ? "#3a3a3a" : "#444444";
        ctx.fill();

        // Track borders (curbs)
        ctx.strokeStyle = i % 4 < 2 ? "#cc2222" : "#ffffff";
        ctx.lineWidth = Math.max(1, sa.scale * 2);
        ctx.beginPath();
        ctx.moveTo(aL.sx, aL.sy);
        ctx.lineTo(bL.sx, bL.sy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(aR.sx, aR.sy);
        ctx.lineTo(bR.sx, bR.sy);
        ctx.stroke();
      },
    });
  }

  // Draw boost pads
  for (const pad of BOOST_PADS) {
    const dist = Math.sqrt((pad.x - camX) ** 2 + (pad.y - camY) ** 2);
    if (dist > RENDER_DISTANCE * 0.875) continue;
    const sp = worldToScreen(pad.x, pad.y);
    if (!sp) continue;

    drawQueue.push({
      dist,
      draw: () => {
        const s = sp.scale * 15;
        ctx.save();
        ctx.translate(sp.sx, sp.sy);
        // Glowing boost pad
        const glow = 0.5 + 0.5 * Math.sin(frame * 0.1);
        ctx.fillStyle = `rgba(255, ${150 + glow * 100}, 0, ${0.6 + glow * 0.3})`;
        ctx.fillRect(-s, -s / 2, s * 2, s);
        // Arrow chevrons
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.max(8, s)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚡", 0, 0);
        ctx.restore();
      },
    });
  }

  // Draw trees
  for (const tree of TREES) {
    const dist = Math.sqrt((tree.x - camX) ** 2 + (tree.y - camY) ** 2);
    if (dist > RENDER_DISTANCE * 0.875) continue;
    const sp = worldToScreen(tree.x, tree.y);
    if (!sp) continue;

    drawQueue.push({
      dist,
      draw: () => {
        const s = sp.scale * tree.size;
        if (s < 2) return;
        // Tree trunk
        ctx.fillStyle = "#5c3a1e";
        ctx.fillRect(sp.sx - s * 0.1, sp.sy - s * 0.5, s * 0.2, s * 0.5);
        // Tree canopy
        ctx.beginPath();
        ctx.arc(sp.sx, sp.sy - s * 0.6, s * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = "#2d7a2d";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sp.sx - s * 0.2, sp.sy - s * 0.5, s * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = "#348834";
        ctx.fill();
      },
    });
  }

  // Draw buildings
  for (const bldg of BUILDINGS) {
    const dist = Math.sqrt((bldg.x - camX) ** 2 + (bldg.y - camY) ** 2);
    if (dist > RENDER_DISTANCE * 0.875) continue;
    const sp = worldToScreen(bldg.x, bldg.y);
    if (!sp) continue;

    drawQueue.push({
      dist,
      draw: () => {
        const s = sp.scale;
        const bw = bldg.w * s;
        const bh = bldg.h * s;
        if (bw < 3) return;
        ctx.fillStyle = bldg.color;
        ctx.fillRect(sp.sx - bw / 2, sp.sy - bh, bw, bh);
        // Roof
        ctx.fillStyle = "#333";
        ctx.fillRect(sp.sx - bw / 2 - 2, sp.sy - bh - 3 * s, bw + 4, 3 * s);
        // Windows
        ctx.fillStyle = "#ffee88";
        const winSize = Math.max(2, 3 * s);
        for (let wy = 0; wy < 3 && wy * winSize * 2 < bh; wy++) {
          ctx.fillRect(sp.sx - bw * 0.2, sp.sy - bh + wy * winSize * 2.5 + winSize, winSize, winSize);
          ctx.fillRect(sp.sx + bw * 0.1, sp.sy - bh + wy * winSize * 2.5 + winSize, winSize, winSize);
        }
      },
    });
  }

  // Draw other karts
  let playerIndex = 0;
  for (const pos of positions) {
    if (pos.id === myId) { playerIndex++; continue; }
    const dist = Math.sqrt((pos.x - camX) ** 2 + (pos.y - camY) ** 2);
    if (dist > RENDER_DISTANCE * 0.875) { playerIndex++; continue; }
    const sp = worldToScreen(pos.x, pos.y);
    if (!sp) { playerIndex++; continue; }

    const color = getKartColor(pos.id, playerIndex);
    const name = players.find(p => p.id === pos.id)?.name || "";

    drawQueue.push({
      dist,
      draw: () => {
        drawKart3D(ctx, sp.sx, sp.sy, sp.scale, pos.angle - camAngle, color, name);
      },
    });
    playerIndex++;
  }

  // Sort far-to-near and draw
  drawQueue.sort((a, b) => b.dist - a.dist);
  for (const item of drawQueue) {
    item.draw();
  }

  // Draw particles
  for (const p of particles) {
    const sp = worldToScreen(p.x, p.y);
    if (!sp) continue;
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(sp.sx, sp.sy, p.size * sp.scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ─── HUD ───────────────────────────────────────────────────────────────────

  // Speedometer (bottom right)
  if (status === "racing") {
    const speed = Math.abs(localPlayer.speed);
    const kmh = Math.round(speed * SPEED_TO_KMH);
    const maxKmh = Math.round(BOOST_SPEED * SPEED_TO_KMH);

    // Speedometer background
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.beginPath();
    ctx.arc(W - 80, H - 80, 65, 0, Math.PI * 2);
    ctx.fill();

    // Speed arc
    const arcStart = Math.PI * 0.75;
    const arcEnd = Math.PI * 2.25;
    const arcProgress = arcStart + (speed / BOOST_SPEED) * (arcEnd - arcStart);

    ctx.beginPath();
    ctx.arc(W - 80, H - 80, 55, arcStart, arcEnd);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(W - 80, H - 80, 55, arcStart, Math.min(arcProgress, arcEnd));
    const speedColor = localPlayer.boostTimer > 0 ? "#ff6600" : speed > MAX_SPEED * 0.8 ? "#ff4444" : "#44ff44";
    ctx.strokeStyle = speedColor;
    ctx.lineWidth = 6;
    ctx.stroke();

    // Speed number
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${kmh}`, W - 80, H - 85);
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("km/h", W - 80, H - 65);
    ctx.fillText(`max: ${maxKmh}`, W - 80, H - 52);

    // Mini-map (top right)
    const mapSize = 120;
    const mapX = W - mapSize - 10;
    const mapY = 10;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);

    // Draw track on minimap
    const mapScale = mapSize / CANVAS_W * 0.9;
    const mapOffX = mapX + mapSize * 0.05;
    const mapOffY = mapY + mapSize * 0.05;

    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < TRACK_POINTS.length; i++) {
      const p = TRACK_POINTS[i];
      const mx = mapOffX + p.x * mapScale;
      const my = mapOffY + p.y * mapScale;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    }
    ctx.closePath();
    ctx.stroke();

    // Player position on minimap
    const myMX = mapOffX + localPlayer.x * mapScale;
    const myMY = mapOffY + localPlayer.y * mapScale;
    ctx.fillStyle = "#ff4444";
    ctx.beginPath();
    ctx.arc(myMX, myMY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Other players on minimap
    for (const pos of positions) {
      if (pos.id === myId) continue;
      const omx = mapOffX + pos.x * mapScale;
      const omy = mapOffY + pos.y * mapScale;
      ctx.fillStyle = "#44ff44";
      ctx.beginPath();
      ctx.arc(omx, omy, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Top speed this lap indicator (top left)
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(10, 10, 160, 50);
    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("⚡ TOP SPEED THIS LAP", 18, 28);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px monospace";
    ctx.fillText(`${Math.round(localPlayer.topSpeedThisLap * SPEED_TO_KMH)} km/h`, 18, 50);

    // Boost indicator
    if (localPlayer.boostTimer > 0) {
      ctx.fillStyle = `rgba(255, 100, 0, ${0.5 + 0.5 * Math.sin(frame * 0.3)})`;
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🔥 BOOST! 🔥", W / 2, 30);
    }

    // Speed lines effect when going fast
    if (speed > MAX_SPEED * 0.7) {
      const intensity = (speed - MAX_SPEED * 0.7) / (MAX_SPEED * 0.3);
      ctx.strokeStyle = `rgba(255,255,255,${intensity * 0.15})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const lx = W * 0.1 + Math.random() * W * 0.8;
        const ly = H * 0.3 + Math.random() * H * 0.5;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + (lx - W / 2) * 0.3, ly + 30 + Math.random() * 20);
        ctx.stroke();
      }
    }
  }

  // Draw local kart (always centered, slightly below center for behind-car view)
  if (myId && status === "racing") {
    drawKart3D(ctx, W / 2, H * 0.72, 1.8, 0, "#ff2222", "");
    // Draw drift sparks
    if (Math.abs(localPlayer.driftAngle) > 0.05) {
      const sparkIntensity = Math.abs(localPlayer.driftAngle) * 10;
      for (let i = 0; i < sparkIntensity; i++) {
        ctx.fillStyle = `hsl(${30 + Math.random() * 30}, 100%, ${50 + Math.random() * 50}%)`;
        ctx.beginPath();
        ctx.arc(
          W / 2 + (Math.random() - 0.5) * 30 - localPlayer.driftAngle * 50,
          H * 0.72 + 10 + Math.random() * 10,
          1 + Math.random() * 2, 0, Math.PI * 2
        );
        ctx.fill();
      }
    }
  }

  // Countdown overlay
  if (status === "countdown") {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, W, H);

    // Dramatic countdown
    const pulse = 1 + Math.sin(frame * 0.2) * 0.1;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = countdown === 1 ? "#44ff44" : "#ffffff";
    ctx.font = "bold 120px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = countdown === 1 ? "#44ff44" : "#ffffff";
    ctx.shadowBlur = 30;
    ctx.fillText(countdown.toString(), 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GET READY!", W / 2, H / 2 + 80);
  }

  // Vignette effect
  const vigGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
  vigGrad.addColorStop(0, "rgba(0,0,0,0)");
  vigGrad.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = vigGrad;
  ctx.fillRect(0, 0, W, H);
}

function drawKart3D(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, relAngle: number, color: string, name: string) {
  if (scale < 0.1) return;

  ctx.save();
  ctx.translate(x, y);

  const s = scale;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 5 * s, 14 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Kart body (3D-ish with angle)
  const angleFactor = Math.sin(relAngle) * 0.3;

  // Wheels
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(-12 * s + angleFactor * 10 * s, -3 * s, 5 * s, 10 * s);
  ctx.fillRect(7 * s + angleFactor * 10 * s, -3 * s, 5 * s, 10 * s);

  // Main body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-10 * s + angleFactor * 5 * s, 8 * s);
  ctx.lineTo(-8 * s + angleFactor * 5 * s, -12 * s);
  ctx.lineTo(8 * s + angleFactor * 5 * s, -12 * s);
  ctx.lineTo(10 * s + angleFactor * 5 * s, 8 * s);
  ctx.closePath();
  ctx.fill();

  // Windshield
  ctx.fillStyle = "rgba(100,200,255,0.7)";
  ctx.beginPath();
  ctx.moveTo(-5 * s + angleFactor * 5 * s, -4 * s);
  ctx.lineTo(-4 * s + angleFactor * 5 * s, -10 * s);
  ctx.lineTo(4 * s + angleFactor * 5 * s, -10 * s);
  ctx.lineTo(5 * s + angleFactor * 5 * s, -4 * s);
  ctx.closePath();
  ctx.fill();

  // Driver helmet
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(angleFactor * 5 * s, -6 * s, 3.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(angleFactor * 5 * s, -7 * s, 2.5 * s, Math.PI, 0);
  ctx.fill();

  // Exhaust pipe glow
  ctx.fillStyle = "rgba(255,100,0,0.5)";
  ctx.beginPath();
  ctx.arc(-2 * s, 9 * s, 2 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(2 * s, 9 * s, 2 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Name label
  if (name && scale > 0.3) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = `bold ${Math.max(9, 11 * scale)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(name, x, y - 20 * scale);
  }
}

