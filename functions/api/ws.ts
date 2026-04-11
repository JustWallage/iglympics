export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!context.env.SCOREBOARD_DO) {
    return Response.json({ error: "WebSocket not available" }, { status: 503 });
  }

  const upgradeHeader = context.request.headers.get("Upgrade");
  if (upgradeHeader !== "websocket") {
    return Response.json(
      { error: "Expected WebSocket upgrade" },
      { status: 426 },
    );
  }

  const doId = context.env.SCOREBOARD_DO.idFromName("global");
  const doStub = context.env.SCOREBOARD_DO.get(doId);
  return doStub.fetch(context.request);
};
