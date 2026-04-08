import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { verifyPassword, createJWT, verifyJWT, hashPassword } from "./lib/auth";

export { ScoreboardDO } from "./do/ScoreboardDO";

type Bindings = {
  DB: D1Database;
  SCOREBOARD_DO: DurableObjectNamespace;
  JWT_SECRET: string;
  ADMIN_EMAIL: string;
  ASSETS: Fetcher;
};

type Variables = {
  user: { id: number; email: string; name: string };
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Auth Middleware ─────────────────────────────────────────────────────────

const PUBLIC_PATHS = ["/api/login", "/api/seed"];

app.use("/api/*", async (c, next) => {
  if (PUBLIC_PATHS.includes(c.req.path)) return next();
  if (c.req.path === "/api/ws") return next();

  const token = getCookie(c, "token");
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: "Unauthorized" }, 401);

  c.set("user", {
    id: payload.userId as number,
    email: payload.email as string,
    name: payload.name as string,
  });

  return next();
});

// ─── Auth Routes ─────────────────────────────────────────────────────────────

app.post("/api/login", async (c) => {
  const { email, password } = await c.req.json<{
    email: string;
    password: string;
  }>();

  if (!email || !password) {
    return c.json({ error: "Email and password required" }, 400);
  }

  const user = await c.env.DB.prepare(
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

  if (!user) return c.json({ error: "Invalid credentials" }, 401);

  const valid = await verifyPassword(password, user.password_hash, user.salt);
  if (!valid) return c.json({ error: "Invalid credentials" }, 401);

  const token = await createJWT(
    { userId: user.id, email: user.email, name: user.name },
    c.env.JWT_SECRET,
  );

  const isSecure = new URL(c.req.url).protocol === "https:";
  setCookie(c, "token", token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? "Strict" : "Lax",
    path: "/",
    maxAge: 86400,
  });

  return c.json({
    user: { id: user.id, name: user.name, email: user.email },
  });
});

app.post("/api/logout", async (c) => {
  deleteCookie(c, "token", { path: "/" });
  return c.json({ ok: true });
});

app.get("/api/me", async (c) => {
  const user = c.get("user");
  return c.json({
    user: { id: user.id, name: user.name, email: user.email },
    isAdmin: user.email === c.env.ADMIN_EMAIL,
  });
});

// ─── Users Routes ────────────────────────────────────────────────────────────

app.get("/api/users", async (c) => {
  const users = await c.env.DB.prepare(
    "SELECT id, name, email FROM users ORDER BY name",
  ).all();
  return c.json({ users: users.results });
});

app.get("/api/users/:userId", async (c) => {
  const userId = parseInt(c.req.param("userId"), 10);
  if (isNaN(userId)) return c.json({ error: "Invalid user ID" }, 400);

  const currentUser = c.get("user");

  const user = await c.env.DB.prepare(
    `SELECT 
      u.id, u.name, u.email,
      COALESCE(SUM(mp.points_earned), 0) as points,
      COALESCE(SUM(CASE WHEN mp.outcome = 'win' THEN 1 ELSE 0 END), 0) as wins,
      COALESCE(SUM(CASE WHEN mp.outcome = 'loss' THEN 1 ELSE 0 END), 0) as losses,
      COALESCE(SUM(CASE WHEN mp.outcome = 'tie' THEN 1 ELSE 0 END), 0) as ties,
      COUNT(mp.id) as matches_played,
      COALESCE(printf('%.2f', AVG(r.rating * 1.0)), '0.00') as avg_rating
    FROM users u
    LEFT JOIN match_participants mp ON mp.user_id = u.id
    LEFT JOIN ratings r ON r.rated_id = u.id
    WHERE u.id = ?
    GROUP BY u.id`,
  )
    .bind(userId)
    .first();

  if (!user) return c.json({ error: "User not found" }, 404);

  const myRating = await c.env.DB.prepare(
    "SELECT rating FROM ratings WHERE rater_id = ? AND rated_id = ?",
  )
    .bind(currentUser.id, userId)
    .first<{ rating: number }>();

  const matches = await c.env.DB.prepare(
    `SELECT m.id, m.game_name, m.played_at, mp.outcome, mp.points_earned
    FROM match_participants mp
    JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = ?
    ORDER BY m.played_at DESC
    LIMIT 50`,
  )
    .bind(userId)
    .all();

  return c.json({
    user: { ...user, my_rating: myRating?.rating ?? null },
    matches: matches.results,
  });
});

// ─── Ratings Route ───────────────────────────────────────────────────────────

app.post("/api/users/:userId/rate", async (c) => {
  const userId = parseInt(c.req.param("userId"), 10);
  if (isNaN(userId)) return c.json({ error: "Invalid user ID" }, 400);

  const currentUser = c.get("user");
  if (currentUser.id === userId) {
    return c.json({ error: "Cannot rate yourself" }, 400);
  }

  const { rating } = await c.req.json<{ rating: number }>();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return c.json({ error: "Rating must be an integer between 1 and 5" }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO ratings (rater_id, rated_id, rating, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(rater_id, rated_id) DO UPDATE SET
      rating = excluded.rating,
      updated_at = excluded.updated_at`,
  )
    .bind(currentUser.id, userId, rating)
    .run();

  // Notify Durable Object
  const doId = c.env.SCOREBOARD_DO.idFromName("global");
  const doStub = c.env.SCOREBOARD_DO.get(doId);
  await doStub.fetch("https://do/broadcast", {
    method: "POST",
    body: JSON.stringify({
      type: "rating_updated",
      payload: { raterId: currentUser.id, ratedId: userId, rating },
    }),
  });

  return c.json({ ok: true });
});

// ─── Scoreboard Route ────────────────────────────────────────────────────────

app.get("/api/scoreboard", async (c) => {
  const scores = await c.env.DB.prepare(
    `SELECT 
      u.id, u.name,
      COALESCE(SUM(mp.points_earned), 0) as points,
      COALESCE(SUM(CASE WHEN mp.outcome = 'win' THEN 1 ELSE 0 END), 0) as wins,
      COALESCE(SUM(CASE WHEN mp.outcome = 'loss' THEN 1 ELSE 0 END), 0) as losses,
      COALESCE(SUM(CASE WHEN mp.outcome = 'tie' THEN 1 ELSE 0 END), 0) as ties,
      COUNT(mp.id) as matches_played,
      COALESCE(printf('%.2f', (SELECT AVG(r.rating * 1.0) FROM ratings r WHERE r.rated_id = u.id)), '0.00') as avg_rating
    FROM users u
    LEFT JOIN match_participants mp ON mp.user_id = u.id
    GROUP BY u.id
    ORDER BY points DESC, wins DESC, u.name ASC`,
  ).all();

  return c.json({ scores: scores.results });
});

// ─── Matches Route (Admin only) ─────────────────────────────────────────────

app.post("/api/matches", async (c) => {
  const currentUser = c.get("user");
  if (currentUser.email !== c.env.ADMIN_EMAIL) {
    return c.json({ error: "Forbidden: admin only" }, 403);
  }

  const { game_name, team_a, team_b, outcome } = await c.req.json<{
    game_name: string;
    team_a: number[];
    team_b: number[];
    outcome: "team_a" | "team_b" | "tie";
  }>();

  if (!game_name || !team_a?.length || !team_b?.length) {
    return c.json({ error: "game_name, team_a, and team_b are required" }, 400);
  }

  if (!["team_a", "team_b", "tie"].includes(outcome)) {
    return c.json({ error: "outcome must be team_a, team_b, or tie" }, 400);
  }

  const matchResult = await c.env.DB.prepare(
    "INSERT INTO matches (game_name, outcome, created_by) VALUES (?, ?, ?) RETURNING id",
  )
    .bind(game_name, outcome, currentUser.id)
    .first<{ id: number }>();

  if (!matchResult) {
    return c.json({ error: "Failed to create match" }, 500);
  }

  const matchId = matchResult.id;

  const teamAOutcome =
    outcome === "team_a" ? "win" : outcome === "team_b" ? "loss" : "tie";
  const teamBOutcome =
    outcome === "team_b" ? "win" : outcome === "team_a" ? "loss" : "tie";
  const teamAPoints = outcome === "team_a" ? 3 : outcome === "tie" ? 1 : 0;
  const teamBPoints = outcome === "team_b" ? 3 : outcome === "tie" ? 1 : 0;

  const stmts = [];
  for (const userId of team_a) {
    stmts.push(
      c.env.DB.prepare(
        "INSERT INTO match_participants (match_id, user_id, team, outcome, points_earned) VALUES (?, ?, 'A', ?, ?)",
      ).bind(matchId, userId, teamAOutcome, teamAPoints),
    );
  }
  for (const userId of team_b) {
    stmts.push(
      c.env.DB.prepare(
        "INSERT INTO match_participants (match_id, user_id, team, outcome, points_earned) VALUES (?, ?, 'B', ?, ?)",
      ).bind(matchId, userId, teamBOutcome, teamBPoints),
    );
  }

  await c.env.DB.batch(stmts);

  // Notify Durable Object
  const doId = c.env.SCOREBOARD_DO.idFromName("global");
  const doStub = c.env.SCOREBOARD_DO.get(doId);
  await doStub.fetch("https://do/broadcast", {
    method: "POST",
    body: JSON.stringify({
      type: "match_created",
      payload: { matchId, game_name, outcome, team_a, team_b },
    }),
  });

  return c.json({ matchId }, 201);
});

// ─── WebSocket Route ─────────────────────────────────────────────────────────

app.get("/api/ws", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader !== "websocket") {
    return c.json({ error: "Expected WebSocket upgrade" }, 426);
  }

  const doId = c.env.SCOREBOARD_DO.idFromName("global");
  const doStub = c.env.SCOREBOARD_DO.get(doId);
  return doStub.fetch(c.req.raw);
});

// ─── Seed Route (dev only) ──────────────────────────────────────────────────

app.post("/api/seed", async (c) => {
  const defaultPassword = "iglympics2024";
  const users = await c.env.DB.prepare("SELECT id FROM users").all();

  const stmts = [];
  for (const user of users.results) {
    const { hash, salt } = await hashPassword(defaultPassword);
    stmts.push(
      c.env.DB.prepare(
        "UPDATE users SET password_hash = ?, salt = ? WHERE id = ?",
      ).bind(hash, salt, (user as { id: number }).id),
    );
  }

  await c.env.DB.batch(stmts);

  return c.json({
    ok: true,
    message: `Seeded ${users.results.length} users with default password`,
  });
});

// ─── Static Asset Fallback (SPA) ────────────────────────────────────────────

app.get("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
