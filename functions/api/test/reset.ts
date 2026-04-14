export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!context.env.ALLOW_TEST_RESET) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await context.env.DB.batch([
    context.env.DB.prepare("DELETE FROM minigame_scores"),
    context.env.DB.prepare("DELETE FROM activities"),
    context.env.DB.prepare("DELETE FROM chat_messages"),
    context.env.DB.prepare("DELETE FROM match_votes"),
    context.env.DB.prepare("DELETE FROM ratings"),
    context.env.DB.prepare("DELETE FROM match_participants"),
    context.env.DB.prepare("DELETE FROM matches"),
    context.env.DB.prepare(
      "UPDATE settings SET value = '4' WHERE key = 'confirm_threshold'",
    ),
    context.env.DB.prepare(
      "UPDATE settings SET value = '8' WHERE key = 'reject_threshold'",
    ),
  ]);

  return Response.json({ ok: true });
};
