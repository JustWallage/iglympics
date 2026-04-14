import { hashPassword } from "../_lib/auth";

interface UserEntry {
  name: string;
  password: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const usersJson = context.env.USERS_JSON;
  if (!usersJson) {
    return Response.json(
      { error: "USERS_JSON env var not configured" },
      { status: 500 },
    );
  }

  let users: UserEntry[];
  try {
    users = JSON.parse(usersJson);
  } catch {
    return Response.json(
      { error: "Invalid USERS_JSON format" },
      { status: 500 },
    );
  }

  if (!Array.isArray(users) || users.length === 0) {
    return Response.json(
      { error: "USERS_JSON must be a non-empty array" },
      { status: 500 },
    );
  }

  const stmts = [];
  for (const u of users) {
    if (!u.name || !u.password) continue;
    const { hash, salt } = await hashPassword(u.password);
    stmts.push(
      context.env.DB.prepare(
        `INSERT INTO users (name, password_hash, salt)
         VALUES (?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET password_hash = excluded.password_hash, salt = excluded.salt`,
      ).bind(u.name, hash, salt),
    );
  }

  await context.env.DB.batch(stmts);

  return Response.json({
    ok: true,
    message: `Seeded ${stmts.length} users`,
  });
};
