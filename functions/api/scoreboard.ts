export const onRequestGet: PagesFunction<Env> = async (context) => {
  const scores = await context.env.DB.prepare(
    `
    SELECT 
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
    ORDER BY points DESC, wins DESC, u.name ASC
  `,
  ).all();

  return Response.json({ scores: scores.results });
};
