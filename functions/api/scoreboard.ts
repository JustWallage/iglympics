export const onRequestGet: PagesFunction<Env> = async (context) => {
  // Get thresholds
  const thresholdRows = await context.env.DB.prepare(
    "SELECT key, value FROM settings WHERE key IN ('confirm_threshold', 'reject_threshold')",
  ).all<{ key: string; value: string }>();

  const thresholds: Record<string, number> = {};
  for (const row of thresholdRows.results) {
    thresholds[row.key] = parseInt(row.value, 10);
  }
  const confirmThreshold = thresholds.confirm_threshold ?? 4;
  const rejectThreshold = thresholds.reject_threshold ?? 8;

  // Confirmed match IDs: matches with enough confirms and not rejected
  // We use a CTE to calculate vote counts
  const scores = await context.env.DB.prepare(
    `
    WITH match_status AS (
      SELECT m.id,
        COALESCE(SUM(CASE WHEN mv.vote = 'confirm' THEN 1 ELSE 0 END), 0) as confirms,
        COALESCE(SUM(CASE WHEN mv.vote = 'reject' THEN 1 ELSE 0 END), 0) as rejects
      FROM matches m
      LEFT JOIN match_votes mv ON mv.match_id = m.id
      GROUP BY m.id
    ),
    confirmed_matches AS (
      SELECT id FROM match_status
      WHERE confirms >= ? AND rejects < ?
    ),
    pending_matches AS (
      SELECT id FROM match_status
      WHERE confirms < ? AND rejects < ?
    )
    SELECT 
      u.id, u.name,
      COALESCE((SELECT SUM(mp2.points_earned) FROM match_participants mp2 WHERE mp2.user_id = u.id AND mp2.match_id IN (SELECT id FROM confirmed_matches)), 0) as points,
      COALESCE((SELECT SUM(CASE WHEN mp2.outcome = 'win' THEN 1 ELSE 0 END) FROM match_participants mp2 WHERE mp2.user_id = u.id AND mp2.match_id IN (SELECT id FROM confirmed_matches)), 0) as wins,
      COALESCE((SELECT SUM(CASE WHEN mp2.outcome = 'loss' THEN 1 ELSE 0 END) FROM match_participants mp2 WHERE mp2.user_id = u.id AND mp2.match_id IN (SELECT id FROM confirmed_matches)), 0) as losses,
      COALESCE((SELECT SUM(CASE WHEN mp2.outcome = 'tie' THEN 1 ELSE 0 END) FROM match_participants mp2 WHERE mp2.user_id = u.id AND mp2.match_id IN (SELECT id FROM confirmed_matches)), 0) as ties,
      COALESCE((SELECT COUNT(*) FROM match_participants mp2 WHERE mp2.user_id = u.id AND mp2.match_id IN (SELECT id FROM confirmed_matches)), 0) as matches_played,
      COALESCE((SELECT SUM(mp2.points_earned) FROM match_participants mp2 WHERE mp2.user_id = u.id AND mp2.match_id IN (SELECT id FROM pending_matches)), 0) as pending_points,
      COALESCE(printf('%.2f', (SELECT AVG(r.rating * 1.0) FROM ratings r WHERE r.rated_id = u.id)), '0.00') as avg_rating,
      (SELECT COUNT(*) FROM ratings r WHERE r.rated_id = u.id) as rating_count
    FROM users u
    ORDER BY points DESC, wins DESC, u.name ASC
  `,
  )
    .bind(confirmThreshold, rejectThreshold, confirmThreshold, rejectThreshold)
    .all();

  return Response.json({ scores: scores.results });
};
