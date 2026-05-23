// GET /api/chess/game/ws - WebSocket upgrade for chess game
// Expects ?gameId=&userId=&userName= query params

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!context.env.CHESS_GAME_DO) {
    return Response.json({ error: "Chess not available" }, { status: 503 });
  }

  const upgradeHeader = context.request.headers.get("Upgrade");
  if (upgradeHeader !== "websocket") {
    return Response.json({ error: "Expected WebSocket upgrade" }, { status: 426 });
  }

  const url = new URL(context.request.url);
  const gameId = url.searchParams.get("gameId");
  const userId = url.searchParams.get("userId");
  const userName = url.searchParams.get("userName");

  if (!gameId || !userId || !userName) {
    return Response.json({ error: "Missing params" }, { status: 400 });
  }

  const doId = context.env.CHESS_GAME_DO.idFromName(gameId);
  const doStub = context.env.CHESS_GAME_DO.get(doId);

  // Forward the WebSocket upgrade to the DO
  const doUrl = `https://internal/ws?userId=${userId}&userName=${encodeURIComponent(userName)}`;
  return doStub.fetch(new Request(doUrl, {
    headers: context.request.headers,
  }));
};
