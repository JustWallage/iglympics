interface UserData {
  id: number;
  name: string;
}

interface ScoreRow {
  id: number;
  user_id: number;
  user_name: string;
  game: string;
  score: number;
  created_at: string;
}

// GET /api/minigame-scores?game=snake (optional filter)
// Returns per-game high scores and the global leaderboard (top-3 points: 3/2/1)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const gameFilter = url.searchParams.get("game");

  // Get the best score per user per game
  const highScores = await context.env.DB.prepare(
    `SELECT ms.game, ms.user_id, u.name AS user_name, MAX(ms.score) AS score
     FROM minigame_scores ms
     JOIN users u ON u.id = ms.user_id
     GROUP BY ms.game, ms.user_id
     ORDER BY ms.game, score DESC`,
  ).all<{ game: string; user_id: number; user_name: string; score: number }>();

  // Build per-game rankings
  const byGame: Record<
    string,
    { user_id: number; user_name: string; score: number; rank: number }[]
  > = {};
  for (const row of highScores.results) {
    if (!byGame[row.game]) byGame[row.game] = [];
    byGame[row.game].push({
      user_id: row.user_id,
      user_name: row.user_name,
      score: row.score,
      rank: byGame[row.game].length + 1,
    });
  }

  // Compute global points (top 3 per game get 3/2/1)
  const pointsMap: Record<number, { user_name: string; points: number }> = {};
  const medals = [3, 2, 1];
  for (const game of Object.keys(byGame)) {
    for (let i = 0; i < Math.min(3, byGame[game].length); i++) {
      const entry = byGame[game][i];
      if (!pointsMap[entry.user_id]) {
        pointsMap[entry.user_id] = { user_name: entry.user_name, points: 0 };
      }
      pointsMap[entry.user_id].points += medals[i];
    }
  }

  const globalLeaderboard = Object.entries(pointsMap)
    .map(([userId, data]) => ({
      user_id: Number(userId),
      user_name: data.user_name,
      points: data.points,
    }))
    .sort((a, b) => b.points - a.points);

  return Response.json({
    global_leaderboard: globalLeaderboard,
    game_scores: gameFilter
      ? { [gameFilter]: byGame[gameFilter] || [] }
      : byGame,
  });
};

// POST /api/minigame-scores  { game: "snake", score: 42 }
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const currentUser = (context.data as { user?: UserData }).user;
  if (!currentUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { game, score } = (await context.request.json()) as {
    game?: string;
    score?: number;
  };

  if (!game || typeof score !== "number" || score < 0) {
    return Response.json(
      { error: "game (string) and score (non-negative number) are required" },
      { status: 400 },
    );
  }

  const result = await context.env.DB.prepare(
    "INSERT INTO minigame_scores (user_id, game, score) VALUES (?, ?, ?)",
  )
    .bind(currentUser.id, game, score)
    .run();

  // Broadcast via Durable Object if available
  if (context.env.SCOREBOARD_DO) {
    const doId = context.env.SCOREBOARD_DO.idFromName("global");
    const stub = context.env.SCOREBOARD_DO.get(doId);
    await stub.fetch("https://do/broadcast", {
      method: "POST",
      body: JSON.stringify({
        type: "minigame_score",
        payload: { userId: currentUser.id, game, score },
      }),
    });
  }

  return Response.json({ ok: true, id: result.meta.last_row_id });
};
