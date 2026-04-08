export const onRequestPost: PagesFunction<Env> = async () => {
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie":
          "token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
      },
    },
  );
};
