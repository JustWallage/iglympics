// ─── Chess Game Durable Object ───────────────────────────────────────────────
// Manages a single PvP chess game between two players via WebSockets.

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

export class ChessGameDO implements DurableObject {
  private sessions: Map<WebSocket, PlayerInfo> = new Map();
  private gameState: GameState;

  constructor(
    private state: DurableObjectState,
    private _env: Env,
  ) {
    this.gameState = {
      board: initialBoard(),
      turn: "w",
      players: [],
      status: "waiting",
      winner: null,
      reason: "",
      createdBy: "",
      createdAt: Date.now(),
    };

    // Restore persisted state and hibernating WebSockets before handling any
    // incoming messages. Without blockConcurrencyWhile, a hibernation wakeup
    // would leave gameState as the blank initial board, silently rejecting
    // every move because status === "waiting".
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<GameState>("game");
      if (stored) this.gameState = stored;

      for (const ws of this.state.getWebSockets()) {
        const meta = ws.deserializeAttachment() as PlayerInfo | null;
        if (meta) {
          this.sessions.set(ws, meta);
        }
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // GET /state - return current game state (for REST polling)
    if (url.pathname === "/state" && request.method === "GET") {
      // Load persisted state
      const stored = await this.state.storage.get<GameState>("game");
      if (stored) this.gameState = stored;
      return Response.json(this.gameState);
    }

    // POST /create - initialize game
    if (url.pathname === "/create" && request.method === "POST") {
      const body = await request.json() as { userId: number; userName: string };
      const stored = await this.state.storage.get<GameState>("game");
      if (stored && stored.status !== "finished") {
        this.gameState = stored;
        return Response.json(this.gameState);
      }
      this.gameState = {
        board: initialBoard(),
        turn: "w",
        players: [{ id: body.userId, name: body.userName, color: "w" }],
        status: "waiting",
        winner: null,
        reason: "",
        createdBy: body.userName,
        createdAt: Date.now(),
      };
      await this.state.storage.put("game", this.gameState);
      return Response.json(this.gameState);
    }

    // POST /join - second player joins
    if (url.pathname === "/join" && request.method === "POST") {
      const body = await request.json() as { userId: number; userName: string };
      const stored = await this.state.storage.get<GameState>("game");
      if (stored) this.gameState = stored;

      if (this.gameState.status !== "waiting") {
        return Response.json({ error: "Game not available" }, { status: 400 });
      }
      if (this.gameState.players.some(p => p.id === body.userId)) {
        return Response.json(this.gameState);
      }
      this.gameState.players.push({ id: body.userId, name: body.userName, color: "b" });
      this.gameState.status = "active";
      await this.state.storage.put("game", this.gameState);
      this.broadcast({ type: "game_state", payload: this.gameState });
      return Response.json(this.gameState);
    }

    // WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const userId = parseInt(url.searchParams.get("userId") || "0");
      const userName = url.searchParams.get("userName") || "";

      const stored = await this.state.storage.get<GameState>("game");
      if (stored) this.gameState = stored;

      const player = this.gameState.players.find(p => p.id === userId);
      if (!player) {
        return new Response("Not a player in this game", { status: 403 });
      }

      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];

      const playerInfo: PlayerInfo = { id: userId, name: userName, color: player.color };
      this.state.acceptWebSocket(server);
      server.serializeAttachment(playerInfo);
      this.sessions.set(server, playerInfo);

      // Send current state to the connecting player
      server.send(JSON.stringify({ type: "game_state", payload: this.gameState }));

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== "string") return;
    try {
      const data = JSON.parse(message) as { type: string; move?: ChessMove };
      const player = this.sessions.get(ws);
      if (!player) return;

      if (data.type === "move" && data.move) {
        this.handleMove(player, data.move);
      } else if (data.type === "resign") {
        this.handleResign(player);
      }
    } catch {
      // ignore malformed messages
    }
  }

  webSocketClose(ws: WebSocket): void {
    this.sessions.delete(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.sessions.delete(ws);
  }

  private async handleMove(player: PlayerInfo, move: ChessMove): Promise<void> {
    if (this.gameState.status !== "active") return;
    if (this.gameState.turn !== player.color) return;

    // Validate the move
    const legalMoves = getLegalMoves(this.gameState.board, player.color);
    const isLegal = legalMoves.some(
      m => m.fromR === move.fromR && m.fromC === move.fromC &&
        m.toR === move.toR && m.toC === move.toC &&
        m.promotion === move.promotion
    );

    if (!isLegal) return;

    // Apply move
    this.gameState.board = applyMove(this.gameState.board, move);
    const nextTurn: PieceColor = player.color === "w" ? "b" : "w";
    this.gameState.turn = nextTurn;

    // Check game end conditions
    const nextMoves = getLegalMoves(this.gameState.board, nextTurn);
    const kingInCheck = isKingInCheck(this.gameState.board, nextTurn);

    if (nextMoves.length === 0) {
      this.gameState.status = "finished";
      if (kingInCheck) {
        this.gameState.winner = player.color;
        this.gameState.reason = `Checkmate — ${player.name} wins!`;
      } else {
        this.gameState.winner = "draw";
        this.gameState.reason = "Stalemate — draw!";
      }
    }

    await this.state.storage.put("game", this.gameState);
    this.broadcast({
      type: "game_state",
      payload: this.gameState,
      lastMove: move,
    });
  }

  private async handleResign(player: PlayerInfo): Promise<void> {
    if (this.gameState.status !== "active") return;
    this.gameState.status = "finished";
    this.gameState.winner = player.color === "w" ? "b" : "w";
    const opponentName = this.gameState.players.find(p => p.color !== player.color)?.name || "Opponent";
    this.gameState.reason = `${player.name} resigned — ${opponentName} wins!`;
    await this.state.storage.put("game", this.gameState);
    this.broadcast({ type: "game_state", payload: this.gameState });
  }

  private broadcast(message: object): void {
    const msg = JSON.stringify(message);
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {
        this.sessions.delete(ws);
      }
    }
  }
}
