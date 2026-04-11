import { verifyJWT } from "../_lib/auth";

interface JWTPayload {
  userId: number;
  name: string;
}

const PUBLIC_PATHS = ["/api/login", "/api/seed", "/api/test/reset"];

export const onRequest: PagesFunction<Env>[] = [
  async (context) => {
    const url = new URL(context.request.url);

    if (PUBLIC_PATHS.includes(url.pathname)) {
      return context.next();
    }

    if (url.pathname === "/api/ws") {
      return context.next();
    }

    const cookie = context.request.headers.get("cookie") || "";
    const tokenMatch = cookie.match(/(?:^|;\s*)token=([^;]*)/);
    if (!tokenMatch) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await verifyJWT(
      tokenMatch[1],
      context.env.JWT_SECRET,
    )) as JWTPayload | null;

    if (!payload) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    context.data = {
      ...context.data,
      user: {
        id: payload.userId,
        name: payload.name,
      },
    };

    return context.next();
  },
];
