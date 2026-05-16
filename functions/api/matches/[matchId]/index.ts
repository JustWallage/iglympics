import { isAdmin } from "../../../_lib/auth";

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const user = (context.data as { user?: { id: number; name: string } }).user;
  if (!user || !isAdmin(user.name, context.env.ADMIN_NAMES)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const matchId = Number((context.params as { matchId: string }).matchId);
  await context.env.DB.prepare("DELETE FROM matches WHERE id = ?")
    .bind(matchId)
    .run();

  return Response.json({ ok: true });
};
