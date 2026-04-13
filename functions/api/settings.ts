interface UserData {
  id: number;
  name: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const rows = await context.env.DB.prepare(
    "SELECT key, value FROM settings WHERE key IN ('confirm_threshold', 'reject_threshold')",
  ).all<{ key: string; value: string }>();

  const settings: Record<string, number> = {};
  for (const row of rows.results) {
    settings[row.key] = parseInt(row.value, 10);
  }

  return Response.json({
    confirm_threshold: settings.confirm_threshold ?? 4,
    reject_threshold: settings.reject_threshold ?? 8,
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const currentUser = (context.data as { user: UserData }).user;

  if (currentUser.name !== context.env.ADMIN_NAME) {
    return Response.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const body = (await context.request.json()) as {
    confirm_threshold?: number;
    reject_threshold?: number;
  };

  const stmts = [];
  if (body.confirm_threshold != null && body.confirm_threshold >= 1) {
    stmts.push(
      context.env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES ('confirm_threshold', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ).bind(String(body.confirm_threshold)),
    );
  }
  if (body.reject_threshold != null && body.reject_threshold >= 1) {
    stmts.push(
      context.env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES ('reject_threshold', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ).bind(String(body.reject_threshold)),
    );
  }

  if (stmts.length > 0) {
    await context.env.DB.batch(stmts);
  }

  return Response.json({ ok: true });
};
