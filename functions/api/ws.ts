export const onRequestGet: PagesFunction<Env> = async (context) => {
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
