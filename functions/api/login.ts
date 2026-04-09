import { verifyPassword, createJWT } from "../_lib/auth";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { name, password } = (await context.request.json()) as {
    name: string;
    password: string;
  };

  if (!name || !password) {
    return Response.json(
      { error: "Name and password required" },
      { status: 400 },
    );
  }

  const user = await context.env.DB.prepare(
    "SELECT id, name, password_hash, salt FROM users WHERE name = ?",
  )
    .bind(name)
    .first<{
      id: number;
      name: string;
      password_hash: string;
      salt: string;
    }>();

  if (!user) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.password_hash, user.salt);
  if (!valid) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createJWT(
    { userId: user.id, name: user.name },
    context.env.JWT_SECRET,
  );

  const isSecure = new URL(context.request.url).protocol === "https:";

  return Response.json(
    { user: { id: user.id, name: user.name } },
    {
      headers: {
        "Set-Cookie": `token=${token}; HttpOnly; ${isSecure ? "Secure; SameSite=Strict" : "SameSite=Lax"}; Path=/; Max-Age=86400`,
      },
    },
  );
};
