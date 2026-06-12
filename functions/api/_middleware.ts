import { verifyJWT } from "../_lib/auth";

interface JWTPayload {
  userId: number;
  name: string;
}

const PUBLIC_PATHS = ["/api/login", "/api/seed", "/api/test/reset"];
const PUBLIC_GET_PREFIXES = [
  "/api/scoreboard",
  "/api/users",
  "/api/matches",
  "/api/settings",
  "/api/messages",
  "/api/activities",
  "/api/minigame-scores",
  // NOTE: /api/stories is intentionally NOT public — story photos/videos
  // must only be visible to logged-in users.
  "/api/chess",
  "/api/racing",
  "/api/bets",
];

export const onRequest: PagesFunction<Env>[] = [
  async (context) => {
    const url = new URL(context.request.url);
    const method = context.request.method;

    if (PUBLIC_PATHS.includes(url.pathname)) {
      return context.next();
    }

    if (url.pathname === "/api/ws") {
      return context.next();
    }

    if (url.pathname === "/api/chess/game/ws") {
      return context.next();
    }

    if (url.pathname === "/api/racing/game/ws") {
      return context.next();
    }

    // Allow unauthenticated GET for public prefixes (scoreboard, user profiles)
    if (
      method === "GET" &&
      PUBLIC_GET_PREFIXES.some((p) => url.pathname.startsWith(p))
    ) {
      // Still try to attach user if cookie is present
      const cookie = context.request.headers.get("cookie") || "";
      const tokenMatch = cookie.match(/(?:^|;\s*)token=([^;]*)/);
      if (tokenMatch) {
        const payload = (await verifyJWT(
          tokenMatch[1],
          context.env.JWT_SECRET,
        )) as JWTPayload | null;
        if (payload) {
          context.data = {
            ...context.data,
            user: { id: payload.userId, name: payload.name },
          };
        }
      }
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
