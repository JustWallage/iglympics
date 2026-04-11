export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!context.env.ALLOW_TEST_RESET) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await context.env.DB.batch([
    context.env.DB.prepare("DELETE FROM ratings"),
    context.env.DB.prepare("DELETE FROM match_participants"),
    context.env.DB.prepare("DELETE FROM matches"),
  ]);

  return Response.json({ ok: true });
};
