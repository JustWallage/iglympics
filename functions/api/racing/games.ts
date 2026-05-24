// GET /api/racing/games - list active races
// POST /api/racing/games - create a new race

interface RaceListEntry {
  id: string;
  createdBy: string;
  status: string;
  players: { id: number; name: string; isAI: boolean }[];
  createdAt: number;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const result = await context.env.DB.prepare(
    `SELECT id, created_by, status, players, created_at FROM racing_games
     WHERE status IN ('waiting', 'countdown', 'racing')
     ORDER BY created_at DESC LIMIT 20`
  ).all<{ id: string; created_by: string; status: string; players: string; created_at: number }>();

  const games: RaceListEntry[] = (result.results || []).map(row => ({
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

  if (!context.env.RACING_GAME_DO) {
    return Response.json({ error: "Racing not available" }, { status: 503 });
  }

  const gameId = crypto.randomUUID();
  const doId = context.env.RACING_GAME_DO.idFromName(gameId);
  const doStub = context.env.RACING_GAME_DO.get(doId);

  const res = await doStub.fetch(new Request("https://internal/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: user.id, userName: user.name }),
  }));

  const gameState = await res.json() as { players: { id: number; name: string; isAI: boolean }[]; status: string };

  await context.env.DB.prepare(
    `INSERT OR REPLACE INTO racing_games (id, created_by, status, players, created_at)
     VALUES (?, ?, 'waiting', ?, ?)`
  ).bind(gameId, user.name, JSON.stringify(gameState.players), Date.now()).run();

  return Response.json({ gameId, ...gameState });
};
