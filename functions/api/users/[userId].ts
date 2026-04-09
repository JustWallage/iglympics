interface UserData {
  id: number;
  name: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const userId = parseInt(context.params.userId as string, 10);
  if (isNaN(userId)) {
    return Response.json({ error: "Invalid user ID" }, { status: 400 });
  }

  const currentUser = (context.data as { user: UserData }).user;

  const user = await context.env.DB.prepare(`
    SELECT 
      u.id, u.name,
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
    GROUP BY u.id
  `)
    .bind(userId)
    .first();

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const myRating = await context.env.DB.prepare(
    "SELECT rating FROM ratings WHERE rater_id = ? AND rated_id = ?",
  )
    .bind(currentUser.id, userId)
    .first<{ rating: number }>();

  const matches = await context.env.DB.prepare(`
    SELECT m.id, m.game_name, m.played_at, mp.outcome, mp.points_earned
    FROM match_participants mp
    JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = ?
    ORDER BY m.played_at DESC
    LIMIT 50
  `)
    .bind(userId)
    .all();

  return Response.json({
    user: { ...user, my_rating: myRating?.rating ?? null },
    matches: matches.results,
  });
};
