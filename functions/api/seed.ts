import { hashPassword } from "../_lib/auth";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const defaultPassword = "iglympics2024";
  const users = await context.env.DB.prepare("SELECT id FROM users").all();

  const stmts = [];
  for (const user of users.results) {
    const { hash, salt } = await hashPassword(defaultPassword);
    stmts.push(
      context.env.DB.prepare(
        "UPDATE users SET password_hash = ?, salt = ? WHERE id = ?",
      ).bind(hash, salt, (user as { id: number }).id),
    );
  }

  await context.env.DB.batch(stmts);

  return Response.json({
    ok: true,
    message: `Seeded ${users.results.length} users with default password`,
  });
};
