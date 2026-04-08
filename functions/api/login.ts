import { verifyPassword, createJWT } from "../_lib/auth";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { email, password } = (await context.request.json()) as {
    email: string;
    password: string;
  };

  if (!email || !password) {
    return Response.json(
      { error: "Email and password required" },
      { status: 400 },
    );
  }

  const user = await context.env.DB.prepare(
    "SELECT id, name, email, password_hash, salt FROM users WHERE email = ?",
  )
    .bind(email)
    .first<{
      id: number;
      name: string;
      email: string;
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
    { userId: user.id, email: user.email, name: user.name },
    context.env.JWT_SECRET,
  );

  const isSecure = new URL(context.request.url).protocol === "https:";

  return Response.json(
    { user: { id: user.id, name: user.name, email: user.email } },
    {
      headers: {
        "Set-Cookie": `token=${token}; HttpOnly; ${isSecure ? "Secure; SameSite=Strict" : "SameSite=Lax"}; Path=/; Max-Age=86400`,
      },
    },
  );
};
