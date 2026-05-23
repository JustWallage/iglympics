// GET /api/chess/games - list active games
// POST /api/chess/games - create a new game

interface GameListEntry {
  id: string;
  createdBy: string;
  status: string;
  players: { id: number; name: string; color: string }[];
  createdAt: number;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  // List all active chess games from D1
  const result = await context.env.DB.prepare(
    `SELECT id, created_by, status, players, created_at FROM chess_games
     WHERE status IN ('waiting', 'active')
     ORDER BY created_at DESC LIMIT 20`
  ).all<{ id: string; created_by: string; status: string; players: string; created_at: number }>();

  const games: GameListEntry[] = (result.results || []).map(row => ({
    id: row.id,
    createdBy: row.created_by,
    status: row.status,
    players: JSON.parse(row.players),
    createdAt: row.created_at,
  }));

  return Response.json({ games });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = (context.data as { user?: { id: number; name: string } }).user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.env.CHESS_GAME_DO) {
    return Response.json({ error: "Chess not available" }, { status: 503 });
  }

  // Generate a unique game ID
  const gameId = crypto.randomUUID();

  // Create the DO instance
  const doId = context.env.CHESS_GAME_DO.idFromName(gameId);
  const doStub = context.env.CHESS_GAME_DO.get(doId);

  const res = await doStub.fetch(new Request("https://internal/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: user.id, userName: user.name }),
  }));

  const gameState = await res.json() as { players: { id: number; name: string; color: string }[] };

  // Store in D1 for listing
  await context.env.DB.prepare(
    `INSERT OR REPLACE INTO chess_games (id, created_by, status, players, created_at)
     VALUES (?, ?, 'waiting', ?, ?)`
  ).bind(gameId, user.name, JSON.stringify(gameState.players), Date.now()).run();

  return Response.json({ gameId, ...gameState });
};
