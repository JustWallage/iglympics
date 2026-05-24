import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ArrowLeft, Users, Loader2, Trophy, Flag } from "lucide-react";
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

// ─── Track Definition ────────────────────────────────────────────────────────

const TRACK_WIDTH = 800;
const TRACK_HEIGHT = 600;
const TOTAL_LAPS = 3;
const LOBBY_REFRESH_MS = 5000;
const POSITION_UPDATE_MS = 50;
const OFF_TRACK_FRICTION = 0.92;

// Physics constants
const ACCELERATION = 0.15;
const FRICTION = 0.97;
const TURN_SPEED = 0.05;
const MAX_SPEED = 6;
const BRAKE_FACTOR = 1.5;
const MAX_REVERSE_FACTOR = 2;

const CHECKPOINTS = [
  { x: 400, y: 100, radius: 60 },
  { x: 700, y: 300, radius: 60 },
  { x: 400, y: 500, radius: 60 },
  { x: 100, y: 300, radius: 60 },
];

const KART_COLORS: Record<number, string> = {};
const COLOR_PALETTE = [
  "#ff4444", "#44ff44", "#4444ff", "#ffff44",
  "#ff44ff", "#44ffff", "#ff8844", "#8844ff",
];

function getKartColor(id: number, index: number): string {
  if (!KART_COLORS[id]) {
    KART_COLORS[id] = COLOR_PALETTE[index % COLOR_PALETTE.length];
  }
  return KART_COLORS[id];
}

// ─── Racing Page Component ───────────────────────────────────────────────────

export default function Racing() {
  const { user } = useAuth();
  const [view, setView] = useState<"lobby" | "racing">("lobby");
  const [gameId, setGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState<RaceListEntry[]>([]);

  // Fetch available races
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
        <h1 className="text-xl font-bold text-white/90">🏎️ Racing</h1>
      </div>

      <Card>
        <div className="space-y-3">
          <p className="text-sm text-white/60">
            Race against AI opponents or challenge other players! Create a race to start,
            or join an existing one to compete head-to-head.
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

// ─── Race Game Component ─────────────────────────────────────────────────────

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

  // Local player state for client-side physics
  const localPlayerRef = useRef({
    x: 350, y: 280, angle: -Math.PI / 2, speed: 0, lap: 0, checkpoint: 0,
  });
  const positionsRef = useRef<PlayerPosition[]>([]);

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
            // Set local player position from state
            const me = state.players.find(p => p.id === user.id);
            if (me) {
              localPlayerRef.current = { x: me.x, y: me.y, angle: me.angle, speed: 0, lap: 0, checkpoint: 0 };
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
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Touch controls state
  const touchRef = useRef({ accelerating: false, braking: false, left: false, right: false });

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastSendTime = 0;

    const gameLoop = () => {
      animRef.current = requestAnimationFrame(gameLoop);

      const local = localPlayerRef.current;
      const keys = keysRef.current;
      const touch = touchRef.current;

      // Update local player physics when racing
      if (status === "racing" && user) {
        // Acceleration
        if (keys.has("ArrowUp") || keys.has("w") || keys.has("W") || touch.accelerating) {
          local.speed = Math.min(MAX_SPEED, local.speed + ACCELERATION);
        }
        if (keys.has("ArrowDown") || keys.has("s") || keys.has("S") || touch.braking) {
          local.speed = Math.max(-MAX_SPEED / MAX_REVERSE_FACTOR, local.speed - ACCELERATION * BRAKE_FACTOR);
        }

        // Turning (only when moving)
        if (Math.abs(local.speed) > 0.1) {
          if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A") || touch.left) {
            local.angle -= TURN_SPEED * (local.speed > 0 ? 1 : -1);
          }
          if (keys.has("ArrowRight") || keys.has("d") || keys.has("D") || touch.right) {
            local.angle += TURN_SPEED * (local.speed > 0 ? 1 : -1);
          }
        }

        // Friction
        local.speed *= FRICTION;

        // Move
        local.x += Math.cos(local.angle) * local.speed;
        local.y += Math.sin(local.angle) * local.speed;

        // Keep in bounds
        local.x = Math.max(20, Math.min(TRACK_WIDTH - 20, local.x));
        local.y = Math.max(20, Math.min(TRACK_HEIGHT - 20, local.y));

        // Off-track slowdown
        if (!isOnTrack(local.x, local.y)) {
          local.speed *= OFF_TRACK_FRICTION;
        }

        // Checkpoint detection
        const targetCP = CHECKPOINTS[local.checkpoint % CHECKPOINTS.length];
        const dist = Math.sqrt((local.x - targetCP.x) ** 2 + (local.y - targetCP.y) ** 2);
        if (dist < targetCP.radius) {
          local.checkpoint++;
          if (local.checkpoint % CHECKPOINTS.length === 0 && local.checkpoint > 0) {
            local.lap++;
          }
        }

        // Send position updates at ~20fps
        const now = Date.now();
        if (now - lastSendTime > POSITION_UPDATE_MS && wsRef.current?.readyState === WebSocket.OPEN) {
          lastSendTime = now;
          wsRef.current.send(JSON.stringify({
            type: "player_update",
            payload: {
              id: user.id,
              x: local.x,
              y: local.y,
              angle: local.angle,
              speed: local.speed,
              lap: local.lap,
              checkpoint: local.checkpoint,
            },
          }));
        }
      }

      // Draw
      drawFrame(ctx, local, positionsRef.current, players, user?.id || 0, status, countdown);
    };

    animRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [status, countdown, user, players]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-white/60 hover:text-white/90">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-white/90">🏎️ Racing</h1>
        {status === "racing" && (
          <Badge className="ml-auto">
            Lap {Math.min(localPlayerRef.current.lap + 1, TOTAL_LAPS)}/{TOTAL_LAPS}
          </Badge>
        )}
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={TRACK_WIDTH}
          height={TRACK_HEIGHT}
          className="w-full rounded-lg border border-white/10 bg-green-950 touch-none"
          style={{ aspectRatio: `${TRACK_WIDTH}/${TRACK_HEIGHT}` }}
        />

        {status === "waiting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
            <div className="text-center">
              <Loader2 className="animate-spin mx-auto mb-2 text-white/80" size={32} />
              <p className="text-white/80 text-sm">Waiting to start...</p>
              <p className="text-white/40 text-xs mt-1">Other players can join your race</p>
            </div>
          </div>
        )}

        {status === "finished" && rankings.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
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
              <Button onClick={onBack} className="w-full mt-3">
                Back to Lobby
              </Button>
            </Card>
          </div>
        )}
      </div>

      {/* Touch controls for mobile */}
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
          <strong className="text-white/60">Controls:</strong> Arrow keys or WASD to drive.
          On mobile, use the touch buttons below the track.
        </p>
      </Card>
    </div>
  );
}

// ─── Track Helpers ───────────────────────────────────────────────────────────

function isOnTrack(x: number, y: number): boolean {
  // Check if point is within the oval track boundaries
  // The track is an oval centered roughly at (400, 300)
  const cx = 400, cy = 300;
  const rx = 320, ry = 220; // outer radii
  const rxInner = 180, ryInner = 100; // inner radii

  const normOuter = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
  const normInner = ((x - cx) / rxInner) ** 2 + ((y - cy) / ryInner) ** 2;

  return normOuter <= 1.0 && normInner >= 1.0;
}

// ─── Drawing ─────────────────────────────────────────────────────────────────

function drawFrame(
  ctx: CanvasRenderingContext2D,
  localPlayer: { x: number; y: number; angle: number; speed: number; lap: number; checkpoint: number },
  positions: PlayerPosition[],
  players: RacePlayer[],
  myId: number,
  status: string,
  countdown: number,
) {
  const W = TRACK_WIDTH;
  const H = TRACK_HEIGHT;

  // Clear
  ctx.fillStyle = "#1a4d1a";
  ctx.fillRect(0, 0, W, H);

  // Draw track (oval)
  drawTrack(ctx);

  // Draw checkpoints (subtle)
  for (let i = 0; i < CHECKPOINTS.length; i++) {
    const cp = CHECKPOINTS[i];
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, cp.radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw start/finish line
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(350, 260);
  ctx.lineTo(450, 260);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw all karts from server positions
  let playerIndex = 0;
  for (const pos of positions) {
    if (pos.id === myId) {
      playerIndex++;
      continue; // We'll draw local player separately
    }
    const color = getKartColor(pos.id, playerIndex);
    drawKart(ctx, pos.x, pos.y, pos.angle, color, players.find(p => p.id === pos.id)?.name || "");
    playerIndex++;
  }

  // Draw local player
  if (myId) {
    drawKart(ctx, localPlayer.x, localPlayer.y, localPlayer.angle, "#ff4444", "You");
  }

  // Draw countdown overlay
  if (status === "countdown") {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 80px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(countdown.toString(), W / 2, H / 2);
  }

  // Draw minimap lap counter
  if (status === "racing") {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(W - 110, 10, 100, 30);
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Lap ${Math.min(localPlayer.lap + 1, TOTAL_LAPS)}/${TOTAL_LAPS}`, W - 60, 28);
  }
}

function drawTrack(ctx: CanvasRenderingContext2D) {
  const cx = 400, cy = 300;

  // Outer track border
  ctx.beginPath();
  ctx.ellipse(cx, cy, 340, 240, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#555555";
  ctx.fill();

  // Track surface
  ctx.beginPath();
  ctx.ellipse(cx, cy, 320, 220, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#444444";
  ctx.fill();

  // Inner grass
  ctx.beginPath();
  ctx.ellipse(cx, cy, 180, 100, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#1a4d1a";
  ctx.fill();

  // Inner border
  ctx.beginPath();
  ctx.ellipse(cx, cy, 180, 100, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "#666666";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Outer border
  ctx.beginPath();
  ctx.ellipse(cx, cy, 340, 240, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "#666666";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Track markings (dashed center line)
  ctx.beginPath();
  ctx.ellipse(cx, cy, 250, 160, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 20]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawKart(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, name: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Kart body
  ctx.fillStyle = color;
  ctx.fillRect(-12, -8, 24, 16);

  // Kart front
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(10, -4, 4, 8);

  // Wheels
  ctx.fillStyle = "#222222";
  ctx.fillRect(-10, -10, 6, 3);
  ctx.fillRect(-10, 7, 6, 3);
  ctx.fillRect(6, -10, 6, 3);
  ctx.fillRect(6, 7, 6, 3);

  ctx.restore();

  // Name label
  if (name) {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(name, x, y - 16);
  }
}

