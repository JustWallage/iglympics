// ─── Racing Game Durable Object ──────────────────────────────────────────────
// Manages a real-time multiplayer racing game. Players race on a top-down track.
// When only one human player is present, AI opponents fill the race.
// When a second player joins, they race against each other (plus AI).

interface PlayerState {
  id: number;
  name: string;
  x: number;
  y: number;
  angle: number; // radians
  speed: number;
  lap: number;
  checkpoint: number;
  finished: boolean;
  finishTime: number | null;
  isAI: boolean;
}

interface RaceState {
  players: PlayerState[];
  status: "waiting" | "countdown" | "racing" | "finished";
  countdown: number;
  startTime: number | null;
  trackId: string;
  createdBy: string;
  createdAt: number;
  totalLaps: number;
}

const TRACK_WIDTH = 800;
const TRACK_HEIGHT = 600;
const TOTAL_LAPS = 3;
const AI_BASE_SPEED = 3.5;
const AI_SPEED_VARIATION = 0.4;
const AI_TURN_FACTOR = 0.08;
const SERVER_TICK_MS = 50;
const CHECKPOINTS = [
  { x: 400, y: 100, radius: 60 },
  { x: 700, y: 300, radius: 60 },
  { x: 400, y: 500, radius: 60 },
  { x: 100, y: 300, radius: 60 },
];

const AI_NAMES = ["Bowser", "Toad", "Yoshi", "Peach", "Luigi", "DK"];

function createStartPosition(index: number): { x: number; y: number; angle: number } {
  // Stagger start positions along the start line
  const baseX = 350 + (index % 2) * 80;
  const baseY = 280 + Math.floor(index / 2) * 50;
  return { x: baseX, y: baseY, angle: -Math.PI / 2 };
}

function createAIPlayers(count: number, startIndex: number): PlayerState[] {
  const ais: PlayerState[] = [];
  for (let i = 0; i < count; i++) {
    const pos = createStartPosition(startIndex + i);
    ais.push({
      id: -(i + 1),
      name: AI_NAMES[i % AI_NAMES.length],
      x: pos.x,
      y: pos.y,
      angle: pos.angle,
      speed: 0,
      lap: 0,
      checkpoint: 0,
      finished: false,
      finishTime: null,
      isAI: true,
    });
  }
  return ais;
}

export class RacingGameDO {
  private state: DurableObjectState;
  private sessions: Map<number, WebSocket> = new Map();
  private raceState: RaceState | null = null;
  private gameLoop: ReturnType<typeof setInterval> | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/create" && request.method === "POST") {
      return this.handleCreate(request);
    } else if (path === "/join" && request.method === "POST") {
      return this.handleJoin(request);
    } else if (path === "/state" && request.method === "GET") {
      return this.handleGetState();
    } else if (path === "/ws") {
      return this.handleWebSocket(request);
    }

    return new Response("Not found", { status: 404 });
  }

  private async handleCreate(request: Request): Promise<Response> {
    const { userId, userName } = await request.json() as { userId: number; userName: string };

    const startPos = createStartPosition(0);
    const humanPlayer: PlayerState = {
      id: userId,
      name: userName,
      x: startPos.x,
      y: startPos.y,
      angle: startPos.angle,
      speed: 0,
      lap: 0,
      checkpoint: 0,
      finished: false,
      finishTime: null,
      isAI: false,
    };

    // Add AI opponents
    const aiPlayers = createAIPlayers(3, 1);

    this.raceState = {
      players: [humanPlayer, ...aiPlayers],
      status: "waiting",
      countdown: 3,
      startTime: null,
      trackId: "oval",
      createdBy: userName,
      createdAt: Date.now(),
      totalLaps: TOTAL_LAPS,
    };

    await this.state.storage.put("raceState", this.raceState);

    return Response.json({
      players: this.raceState.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI })),
      status: this.raceState.status,
    });
  }

  private async handleJoin(request: Request): Promise<Response> {
    if (!this.raceState) {
      this.raceState = await this.state.storage.get("raceState") as RaceState | undefined || null;
    }
    if (!this.raceState) {
      return Response.json({ error: "Game not found" }, { status: 404 });
    }
    if (this.raceState.status === "finished") {
      return Response.json({ error: "Race already finished" }, { status: 400 });
    }

    const { userId, userName } = await request.json() as { userId: number; userName: string };

    // Check if already in race
    if (this.raceState.players.some(p => p.id === userId)) {
      return Response.json({
        players: this.raceState.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI })),
        status: this.raceState.status,
      });
    }

    // Add human player, replace one AI
    const humanCount = this.raceState.players.filter(p => !p.isAI).length;
    const posIndex = humanCount;
    const startPos = createStartPosition(posIndex);

    const newPlayer: PlayerState = {
      id: userId,
      name: userName,
      x: startPos.x,
      y: startPos.y,
      angle: startPos.angle,
      speed: 0,
      lap: 0,
      checkpoint: 0,
      finished: false,
      finishTime: null,
      isAI: false,
    };

    // Remove last AI to make room
    const aiIndex = this.raceState.players.findIndex(p => p.isAI);
    if (aiIndex !== -1) {
      this.raceState.players.splice(aiIndex, 1);
    }
    this.raceState.players.push(newPlayer);

    await this.state.storage.put("raceState", this.raceState);

    // Notify existing players
    this.broadcast({ type: "player_joined", payload: { id: userId, name: userName } });

    return Response.json({
      players: this.raceState.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI })),
      status: this.raceState.status,
    });
  }

  private async handleGetState(): Promise<Response> {
    if (!this.raceState) {
      this.raceState = await this.state.storage.get("raceState") as RaceState | undefined || null;
    }
    if (!this.raceState) {
      return Response.json({ error: "Game not found" }, { status: 404 });
    }
    return Response.json(this.raceState);
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    if (!this.raceState) {
      this.raceState = await this.state.storage.get("raceState") as RaceState | undefined || null;
    }
    if (!this.raceState) {
      return new Response("Game not found", { status: 404 });
    }

    const url = new URL(request.url);
    const userId = parseInt(url.searchParams.get("userId") || "0");

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    this.state.acceptWebSocket(server);
    this.sessions.set(userId, server);

    // Send current state
    server.send(JSON.stringify({ type: "state", payload: this.raceState }));

    // Start countdown if we have players and haven't started
    if (this.raceState.status === "waiting") {
      this.startCountdown();
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  private startCountdown() {
    if (!this.raceState || this.raceState.status !== "waiting") return;

    this.raceState.status = "countdown";
    this.raceState.countdown = 3;
    this.broadcast({ type: "countdown", payload: { count: 3 } });

    const countdownInterval = setInterval(() => {
      if (!this.raceState) { clearInterval(countdownInterval); return; }
      this.raceState.countdown--;
      if (this.raceState.countdown <= 0) {
        clearInterval(countdownInterval);
        this.raceState.status = "racing";
        this.raceState.startTime = Date.now();
        this.broadcast({ type: "race_start", payload: {} });
        this.startGameLoop();
      } else {
        this.broadcast({ type: "countdown", payload: { count: this.raceState.countdown } });
      }
    }, 1000);
  }

  private startGameLoop() {
    // Update AI positions at ~20fps server-side
    this.gameLoop = setInterval(() => {
      if (!this.raceState || this.raceState.status !== "racing") {
        if (this.gameLoop) clearInterval(this.gameLoop);
        return;
      }
      this.updateAI();
      this.broadcastPositions();
    }, SERVER_TICK_MS);
  }

  private updateAI() {
    if (!this.raceState) return;

    for (const player of this.raceState.players) {
      if (!player.isAI || player.finished) continue;

      // AI drives toward the next checkpoint
      const targetCP = CHECKPOINTS[player.checkpoint % CHECKPOINTS.length];
      const dx = targetCP.x - player.x;
      const dy = targetCP.y - player.y;
      const targetAngle = Math.atan2(dy, dx);

      // Smoothly turn toward target
      let angleDiff = targetAngle - player.angle;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      player.angle += angleDiff * AI_TURN_FACTOR;

      // Vary speed slightly per AI to make it interesting
      const baseSpeed = AI_BASE_SPEED + (Math.abs(player.id) % 3) * AI_SPEED_VARIATION;
      player.speed = baseSpeed + Math.sin(Date.now() / 1000 + player.id) * 0.5;

      // Move
      player.x += Math.cos(player.angle) * player.speed;
      player.y += Math.sin(player.angle) * player.speed;

      // Keep in bounds
      player.x = Math.max(20, Math.min(TRACK_WIDTH - 20, player.x));
      player.y = Math.max(20, Math.min(TRACK_HEIGHT - 20, player.y));

      // Check checkpoint
      const dist = Math.sqrt((player.x - targetCP.x) ** 2 + (player.y - targetCP.y) ** 2);
      if (dist < targetCP.radius) {
        player.checkpoint++;
        if (player.checkpoint % CHECKPOINTS.length === 0 && player.checkpoint > 0) {
          player.lap++;
          if (player.lap >= this.raceState.totalLaps) {
            player.finished = true;
            player.finishTime = Date.now() - (this.raceState.startTime || Date.now());
          }
        }
      }
    }

    // Check if race is over
    this.checkRaceEnd();
  }

  private checkRaceEnd() {
    if (!this.raceState) return;
    const allFinished = this.raceState.players.every(p => p.finished);
    const anyHumanFinished = this.raceState.players.some(p => !p.isAI && p.finished);

    if (allFinished || anyHumanFinished) {
      // End race when all humans finish (or everyone finishes)
      const humansFinished = this.raceState.players.filter(p => !p.isAI).every(p => p.finished);
      if (humansFinished || allFinished) {
        this.raceState.status = "finished";
        if (this.gameLoop) clearInterval(this.gameLoop);

        const rankings = [...this.raceState.players]
          .sort((a, b) => {
            if (a.finished && !b.finished) return -1;
            if (!a.finished && b.finished) return 1;
            return (a.finishTime || Infinity) - (b.finishTime || Infinity);
          })
          .map((p, i) => ({ id: p.id, name: p.name, position: i + 1, time: p.finishTime }));

        this.broadcast({ type: "race_end", payload: { rankings } });
      }
    }
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const data = JSON.parse(message as string) as { type: string; payload: Record<string, unknown> };

      if (data.type === "player_update" && this.raceState?.status === "racing") {
        const { id, x, y, angle, speed, lap, checkpoint } = data.payload as unknown as {
          id: number; x: number; y: number; angle: number; speed: number; lap: number; checkpoint: number;
        };

        const player = this.raceState.players.find(p => p.id === id);
        if (player && !player.isAI) {
          player.x = x;
          player.y = y;
          player.angle = angle;
          player.speed = speed;
          player.lap = lap;
          player.checkpoint = checkpoint;

          // Check if player finished
          if (lap >= this.raceState.totalLaps && !player.finished) {
            player.finished = true;
            player.finishTime = Date.now() - (this.raceState.startTime || Date.now());
            this.broadcast({ type: "player_finished", payload: { id, name: player.name, time: player.finishTime } });
            this.checkRaceEnd();
          }
        }
      }
    } catch {
      // ignore malformed messages
    }
  }

  async webSocketClose(ws: WebSocket) {
    // Remove from sessions
    for (const [userId, socket] of this.sessions) {
      if (socket === ws) {
        this.sessions.delete(userId);
        break;
      }
    }
  }

  async webSocketError(ws: WebSocket) {
    this.webSocketClose(ws);
  }

  private broadcast(message: { type: string; payload: unknown }) {
    const msg = JSON.stringify(message);
    for (const ws of this.sessions.values()) {
      try { ws.send(msg); } catch { /* ignore closed sockets */ }
    }
  }

  private broadcastPositions() {
    if (!this.raceState) return;
    const positions = this.raceState.players.map(p => ({
      id: p.id,
      x: p.x,
      y: p.y,
      angle: p.angle,
      speed: p.speed,
      lap: p.lap,
      checkpoint: p.checkpoint,
      finished: p.finished,
    }));
    this.broadcast({ type: "positions", payload: positions });
  }
}
