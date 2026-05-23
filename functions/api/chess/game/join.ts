// POST /api/chess/game/join - join an existing game
// GET /api/chess/game/state - get game state
// Expects ?gameId= query param

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = (context.data as { user?: { id: number; name: string } }).user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.env.CHESS_GAME_DO) {
    return Response.json({ error: "Chess not available" }, { status: 503 });
  }

  const url = new URL(context.request.url);
  const gameId = url.searchParams.get("gameId");
  if (!gameId) {
    return Response.json({ error: "Missing gameId" }, { status: 400 });
  }

  const doId = context.env.CHESS_GAME_DO.idFromName(gameId);
  const doStub = context.env.CHESS_GAME_DO.get(doId);

  const res = await doStub.fetch(new Request("https://internal/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: user.id, userName: user.name }),
  }));

  if (!res.ok) {
    const err = await res.json() as { error?: string };
    return Response.json(err, { status: res.status });
  }

  const gameState = await res.json() as { players: { id: number; name: string; color: string }[]; status: string };

  // Update D1
  await context.env.DB.prepare(
    `UPDATE chess_games SET status = ?, players = ? WHERE id = ?`
  ).bind(gameState.status, JSON.stringify(gameState.players), gameId).run();

  return Response.json({ gameId, ...gameState });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!context.env.CHESS_GAME_DO) {
    return Response.json({ error: "Chess not available" }, { status: 503 });
  }

  const url = new URL(context.request.url);
  const gameId = url.searchParams.get("gameId");
  if (!gameId) {
    return Response.json({ error: "Missing gameId" }, { status: 400 });
  }

  const doId = context.env.CHESS_GAME_DO.idFromName(gameId);
  const doStub = context.env.CHESS_GAME_DO.get(doId);

  const res = await doStub.fetch(new Request("https://internal/state", {
    method: "GET",
  }));

  const gameState = await res.json();
  return Response.json(gameState);
};
