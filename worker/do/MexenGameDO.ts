// ─── Mexen Dice Game Durable Object ──────────────────────────────────────────
// Real-time multiplayer "Mexen" dice game. Two dice, each player gets 3 throws.
// Rules:
// - Roll two dice each throw
// - If you roll a 1, 2, or 3 on one die, you MUST keep it (set aside).
//   The other die must be re-thrown — this is called "doorjagen".
// - If both dice show 1-3, keep the higher one and doorjagen the other.
// - If neither die shows 1-3, keep both (sum counts).
// - After 3 throws (or when both dice are kept), your score is the sum of all kept dice.
// - Highest score wins the round.
//
// "Mexen" = rolling double 1s (score 0, worst possible).
// Special combos: 2+1 = "Mex" (21 points, instant win).

interface MexenPlayer {
  id: number;
  name: string;
  score: number;
  throwsLeft: number;
  keptDice: number[];     // dice values kept so far
  currentRoll: number[];  // current roll (2 dice)
  finished: boolean;
  connected: boolean;
}

interface MexenGameState {
  players: MexenPlayer[];
  status: "waiting" | "playing" | "finished";
  currentPlayerIndex: number;
  round: number;
  maxRounds: number;
  scores: Record<number, number>; // cumulative scores across rounds
  createdBy: string;
  createdAt: number;
  winner: { id: number; name: string } | null;
  lastAction: string;
}

// Scoring: Mex (2+1 or 1+2) = 21 (instant round win)
// Regular: sum of all kept dice across throws
function calculateMexScore(keptDice: number[]): { score: number; isMex: boolean } {
  // Check for Mex: exactly two dice summing to 3 with one being 2 and other 1
  if (keptDice.length === 2) {
    const sorted = [...keptDice].sort();
    if (sorted[0] === 1 && sorted[1] === 2) {
      return { score: 21, isMex: true };
    }
  }
  return { score: keptDice.reduce((a, b) => a + b, 0), isMex: false };
}

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export class MexenGameDO {
  private state: DurableObjectState;
  private sessions: Map<number, WebSocket> = new Map();
  private gameState: MexenGameState | null = null;

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

    const player: MexenPlayer = {
      id: userId,
      name: userName,
      score: 0,
      throwsLeft: 3,
      keptDice: [],
      currentRoll: [],
      finished: false,
      connected: false,
    };

    this.gameState = {
      players: [player],
      status: "waiting",
      currentPlayerIndex: 0,
      round: 1,
      maxRounds: 3,
      scores: { [userId]: 0 },
      createdBy: userName,
      createdAt: Date.now(),
      winner: null,
      lastAction: `${userName} created the game. Waiting for opponent...`,
    };

    await this.state.storage.put("gameState", this.gameState);

    return Response.json({
      players: this.gameState.players.map(p => ({ id: p.id, name: p.name })),
      status: this.gameState.status,
    });
  }

  private async handleJoin(request: Request): Promise<Response> {
    if (!this.gameState) {
      this.gameState = await this.state.storage.get("gameState") as MexenGameState | undefined || null;
    }
    if (!this.gameState) {
      return Response.json({ error: "Game not found" }, { status: 404 });
    }
    if (this.gameState.status === "finished") {
      return Response.json({ error: "Game already finished" }, { status: 400 });
    }
    if (this.gameState.players.length >= 2) {
      // Check if already in game
      const { userId } = await request.json() as { userId: number; userName: string };
      if (this.gameState.players.some(p => p.id === userId)) {
        return Response.json({
          players: this.gameState.players.map(p => ({ id: p.id, name: p.name })),
          status: this.gameState.status,
        });
      }
      return Response.json({ error: "Game is full" }, { status: 400 });
    }

    const { userId, userName } = await request.json() as { userId: number; userName: string };

    // Check if already in game
    if (this.gameState.players.some(p => p.id === userId)) {
      return Response.json({
        players: this.gameState.players.map(p => ({ id: p.id, name: p.name })),
        status: this.gameState.status,
      });
    }

    const newPlayer: MexenPlayer = {
      id: userId,
      name: userName,
      score: 0,
      throwsLeft: 3,
      keptDice: [],
      currentRoll: [],
      finished: false,
      connected: false,
    };

    this.gameState.players.push(newPlayer);
    this.gameState.scores[userId] = 0;
    this.gameState.status = "playing";
    this.gameState.lastAction = `${userName} joined! Game starts. ${this.gameState.players[0].name} rolls first.`;

    await this.state.storage.put("gameState", this.gameState);

    this.broadcast({ type: "player_joined", payload: { id: userId, name: userName } });
    this.broadcast({ type: "state", payload: this.getPublicState() });

    return Response.json({
      players: this.gameState.players.map(p => ({ id: p.id, name: p.name })),
      status: this.gameState.status,
    });
  }

  private async handleGetState(): Promise<Response> {
    if (!this.gameState) {
      this.gameState = await this.state.storage.get("gameState") as MexenGameState | undefined || null;
    }
    if (!this.gameState) {
      return Response.json({ error: "Game not found" }, { status: 404 });
    }
    return Response.json(this.getPublicState());
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    if (!this.gameState) {
      this.gameState = await this.state.storage.get("gameState") as MexenGameState | undefined || null;
    }
    if (!this.gameState) {
      return new Response("Game not found", { status: 404 });
    }

    const url = new URL(request.url);
    const userId = parseInt(url.searchParams.get("userId") || "0");

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    this.state.acceptWebSocket(server);
    this.sessions.set(userId, server);

    // Mark player as connected
    const player = this.gameState.players.find(p => p.id === userId);
    if (player) {
      player.connected = true;
    }

    // Send current state
    server.send(JSON.stringify({ type: "state", payload: this.getPublicState() }));

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const data = JSON.parse(message as string) as { type: string; payload?: Record<string, unknown> };

      if (!this.gameState || this.gameState.status !== "playing") return;

      // Find which player sent this
      let senderId = 0;
      for (const [userId, socket] of this.sessions) {
        if (socket === ws) { senderId = userId; break; }
      }

      const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
      if (!currentPlayer || currentPlayer.id !== senderId) {
        // Not this player's turn
        ws.send(JSON.stringify({ type: "error", payload: { message: "Not your turn!" } }));
        return;
      }

      if (data.type === "roll") {
        this.handleRoll(currentPlayer);
      } else if (data.type === "keep") {
        // Player chooses which die to keep (index 0 or 1)
        const { dieIndex } = (data.payload || {}) as { dieIndex?: number };
        if (dieIndex !== undefined) {
          this.handleKeep(currentPlayer, dieIndex);
        }
      }
    } catch {
      // ignore malformed messages
    }
  }

  private handleRoll(player: MexenPlayer) {
    if (player.throwsLeft <= 0 || player.finished) return;

    // How many dice to roll?
    const diceToRoll = player.keptDice.length === 0 ? 2 : 1;
    const roll: number[] = [];
    for (let i = 0; i < diceToRoll; i++) {
      roll.push(rollDie());
    }

    player.currentRoll = roll;
    player.throwsLeft--;

    // Auto-resolve logic
    if (diceToRoll === 2) {
      const low1 = roll[0] >= 1 && roll[0] <= 3;
      const low2 = roll[1] >= 1 && roll[1] <= 3;

      if (low1 && low2) {
        // Both are 1-3: keep the higher one, doorjagen the other
        const keepIdx = roll[0] >= roll[1] ? 0 : 1;
        player.keptDice.push(roll[keepIdx]);
        this.gameState!.lastAction = `${player.name} rolled [${roll[0]}][${roll[1]}] — keeps the ${roll[keepIdx]}, doorjagen! 🎲`;
        player.currentRoll = [];

        // If out of throws, doorjagen doesn't count as a throw — roll once more
                if (player.throwsLeft <= 0) {
          const doorjagenDie = rollDie();
          player.keptDice.push(doorjagenDie);
          this.gameState!.lastAction += ` Doorjagen roll: [${doorjagenDie}]`;
          this.finishPlayerTurn(player);
          return;
        }

        this.broadcastState();
        return;
      } else if (low1 && !low2) {
        // Die 0 is 1-3, must keep it, doorjagen die 1
        player.keptDice.push(roll[0]);
        this.gameState!.lastAction = `${player.name} rolled [${roll[0]}][${roll[1]}] — keeps the ${roll[0]}, doorjagen! 🎲`;
        player.currentRoll = [];

        if (player.throwsLeft <= 0) {
          const doorjagenDie = rollDie();
          player.keptDice.push(doorjagenDie);
          this.gameState!.lastAction += ` Doorjagen roll: [${doorjagenDie}]`;
          this.finishPlayerTurn(player);
          return;
        }

        this.broadcastState();
        return;
      } else if (!low1 && low2) {
        // Die 1 is 1-3, must keep it, doorjagen die 0
        player.keptDice.push(roll[1]);
        this.gameState!.lastAction = `${player.name} rolled [${roll[0]}][${roll[1]}] — keeps the ${roll[1]}, doorjagen! 🎲`;
        player.currentRoll = [];

        if (player.throwsLeft <= 0) {
          const doorjagenDie = rollDie();
          player.keptDice.push(doorjagenDie);
          this.gameState!.lastAction += ` Doorjagen roll: [${doorjagenDie}]`;
          this.finishPlayerTurn(player);
          return;
        }

        this.broadcastState();
        return;
      } else {
        // Neither is 1-3: keep both, turn score = sum
        player.keptDice.push(roll[0], roll[1]);
        this.gameState!.lastAction = `${player.name} rolled [${roll[0]}][${roll[1]}] — both high! Keeps both.`;
        this.finishPlayerTurn(player);
        return;
      }
    } else {
      // Single die roll (doorjagen result)
      player.keptDice.push(roll[0]);
      this.gameState!.lastAction = `${player.name} rolls the doorjagen die: [${roll[0]}]!`;

      // Check if we need more throws
      if (player.keptDice.length >= 2 || player.throwsLeft <= 0) {
        this.finishPlayerTurn(player);
        return;
      }

      this.broadcastState();
    }
  }

  private handleKeep(player: MexenPlayer, dieIndex: number) {
    // Manual keep (fallback, mostly auto-resolved)
    if (player.currentRoll.length === 0) return;
    if (dieIndex < 0 || dieIndex >= player.currentRoll.length) return;

    player.keptDice.push(player.currentRoll[dieIndex]);
    player.currentRoll = [];

    if (player.keptDice.length >= 2 || player.throwsLeft <= 0) {
      this.finishPlayerTurn(player);
    } else {
      this.broadcastState();
    }
  }

  private finishPlayerTurn(player: MexenPlayer) {
    if (!this.gameState) return;

    player.finished = true;
    player.currentRoll = [];
    const { score, isMex } = calculateMexScore(player.keptDice);
    player.score = score;

    if (isMex) {
      this.gameState.lastAction = `🎯 MEX! ${player.name} rolled a 2+1 = 21 points! Instant round win!`;
    } else {
      this.gameState.lastAction = `${player.name} finishes with ${score} points (dice: ${player.keptDice.join(", ")})`;
    }

    // Check if all players are done
    const allDone = this.gameState.players.every(p => p.finished);
    if (allDone) {
      this.endRound();
    } else {
      // Next player's turn
      this.gameState.currentPlayerIndex = (this.gameState.currentPlayerIndex + 1) % this.gameState.players.length;
      const next = this.gameState.players[this.gameState.currentPlayerIndex];
      this.gameState.lastAction += ` → ${next.name}'s turn!`;
    }

    this.broadcastState();
  }

  private endRound() {
    if (!this.gameState) return;

    // Find round winner
    let maxScore = -1;
    let roundWinner: MexenPlayer | null = null;
    // Check for Mex first (instant win)
    for (const p of this.gameState.players) {
      const { isMex } = calculateMexScore(p.keptDice);
      if (isMex) {
        roundWinner = p;
        break;
      }
    }
    if (!roundWinner) {
      for (const p of this.gameState.players) {
        if (p.score > maxScore) {
          maxScore = p.score;
          roundWinner = p;
        }
      }
    }

    if (roundWinner) {
      this.gameState.scores[roundWinner.id] = (this.gameState.scores[roundWinner.id] || 0) + 1;
      this.gameState.lastAction = `🏆 Round ${this.gameState.round} won by ${roundWinner.name}!`;
    }

    // Check if game is over
    if (this.gameState.round >= this.gameState.maxRounds) {
      this.gameState.status = "finished";
      // Determine overall winner
      let bestId = 0;
      let bestScore = -1;
      for (const [id, score] of Object.entries(this.gameState.scores)) {
        if (score > bestScore) {
          bestScore = score;
          bestId = parseInt(id);
        }
      }
      const winnerPlayer = this.gameState.players.find(p => p.id === bestId);
      this.gameState.winner = winnerPlayer ? { id: winnerPlayer.id, name: winnerPlayer.name } : null;
      this.gameState.lastAction = `🎉 Game Over! ${winnerPlayer?.name || "Unknown"} wins ${bestScore}-${this.gameState.maxRounds - bestScore}!`;
    } else {
      // Start next round
      this.gameState.round++;
      // Reset players for new round
      for (const p of this.gameState.players) {
        p.score = 0;
        p.throwsLeft = 3;
        p.keptDice = [];
        p.currentRoll = [];
        p.finished = false;
      }
      // Alternate who starts
      this.gameState.currentPlayerIndex = (this.gameState.round - 1) % this.gameState.players.length;
      const starter = this.gameState.players[this.gameState.currentPlayerIndex];
      this.gameState.lastAction += ` Round ${this.gameState.round} begins — ${starter.name} starts!`;
    }

    this.state.storage.put("gameState", this.gameState);
  }

  async webSocketClose(ws: WebSocket) {
    for (const [userId, socket] of this.sessions) {
      if (socket === ws) {
        this.sessions.delete(userId);
        if (this.gameState) {
          const player = this.gameState.players.find(p => p.id === userId);
          if (player) player.connected = false;
        }
        break;
      }
    }
  }

  async webSocketError(ws: WebSocket) {
    this.webSocketClose(ws);
  }

  private getPublicState() {
    if (!this.gameState) return null;
    return {
      players: this.gameState.players.map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        throwsLeft: p.throwsLeft,
        keptDice: p.keptDice,
        currentRoll: p.currentRoll,
        finished: p.finished,
        connected: p.connected,
      })),
      status: this.gameState.status,
      currentPlayerIndex: this.gameState.currentPlayerIndex,
      round: this.gameState.round,
      maxRounds: this.gameState.maxRounds,
      scores: this.gameState.scores,
      winner: this.gameState.winner,
      lastAction: this.gameState.lastAction,
      createdBy: this.gameState.createdBy,
    };
  }

  private broadcastState() {
    this.broadcast({ type: "state", payload: this.getPublicState() });
  }

  private broadcast(message: { type: string; payload: unknown }) {
    const msg = JSON.stringify(message);
    for (const ws of this.sessions.values()) {
      try { ws.send(msg); } catch { /* ignore closed sockets */ }
    }
  }
}
