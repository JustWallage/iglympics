export const onRequestGet: PagesFunction<Env> = async (context) => {
  const users = await context.env.DB.prepare(
    "SELECT id, name FROM users ORDER BY name",
  ).all();

  return Response.json({ users: users.results });
};
