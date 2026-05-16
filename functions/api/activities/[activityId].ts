import { isAdmin } from "../../_lib/auth";

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const user = (context.data as { user?: { id: number; name: string } }).user;
  if (!user || !isAdmin(user.name, context.env.ADMIN_NAMES)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const activityId = Number(
    (context.params as { activityId: string }).activityId,
  );

  const body = (await context.request.json()) as {
    title?: string;
    date?: string;
    time?: string;
    description?: string;
    image_url?: string;
    release_at?: number;
    link_url?: string;
    hint?: string;
  };

  if (!body.title?.trim()) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  await context.env.DB.prepare(
    `UPDATE activities SET title = ?, date = ?, time = ?, description = ?, image_url = ?, release_at = ?, link_url = ?, hint = ?
     WHERE id = ?`,
  )
    .bind(
      body.title.trim(),
      body.date || null,
      body.time || null,
      body.description || null,
      body.image_url || null,
      body.release_at || null,
      body.link_url || null,
      body.hint || null,
      activityId,
    )
    .run();

  return Response.json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const user = (context.data as { user?: { id: number; name: string } }).user;
  if (!user || !isAdmin(user.name, context.env.ADMIN_NAMES)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const activityId = Number(
    (context.params as { activityId: string }).activityId,
  );
  await context.env.DB.prepare("DELETE FROM activities WHERE id = ?")
    .bind(activityId)
    .run();

  return Response.json({ ok: true });
};
