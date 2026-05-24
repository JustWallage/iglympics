interface UserData {
  id: number;
  name: string;
}

interface ChwaziInput {
  winner_id: number;
  participant_ids: number[];
}

// POST /api/chwazi — record a chwazi result and create a match entry
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const currentUser = (context.data as { user?: UserData }).user;
  if (!currentUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { winner_id, participant_ids } =
    (await context.request.json()) as ChwaziInput;

  if (!winner_id || !participant_ids?.length || participant_ids.length < 2) {
    return Response.json(
      { error: "winner_id and at least 2 participant_ids are required" },
      { status: 400 },
    );
  }

  if (!participant_ids.includes(winner_id)) {
    return Response.json(
      { error: "winner_id must be one of the participant_ids" },
      { status: 400 },
    );
  }

  // Create a match with game_name "Chwazi"
  // Winner is team_a, losers are team_b, outcome is team_a
  const matchResult = await context.env.DB.prepare(
    "INSERT INTO matches (game_name, outcome, created_by) VALUES (?, ?, ?) RETURNING id",
  )
    .bind("Chwazi", "team_a", currentUser.id)
    .first<{ id: number }>();

  if (!matchResult) {
    return Response.json({ error: "Failed to create match" }, { status: 500 });
  }

  const matchId = matchResult.id;
  const losers = participant_ids.filter((id) => id !== winner_id);

  const stmts = [];

  // Winner: team A, 3 points
  stmts.push(
    context.env.DB.prepare(
      "INSERT INTO match_participants (match_id, user_id, team, outcome, points_earned) VALUES (?, ?, 'A', 'win', 3)",
    ).bind(matchId, winner_id),
  );

  // Losers: team B, 0 points
  for (const loserId of losers) {
    stmts.push(
      context.env.DB.prepare(
        "INSERT INTO match_participants (match_id, user_id, team, outcome, points_earned) VALUES (?, ?, 'B', 'loss', 0)",
      ).bind(matchId, loserId),
    );
  }

  // Auto-confirm the match (Chwazi results are indisputable)
  // Add confirm votes from all participants to auto-confirm
  for (const pid of participant_ids) {
    stmts.push(
      context.env.DB.prepare(
        "INSERT OR IGNORE INTO match_votes (match_id, user_id, vote) VALUES (?, ?, 'confirm')",
      ).bind(matchId, pid),
    );
  }

  // Also add creator's vote if not a participant
  if (!participant_ids.includes(currentUser.id)) {
    stmts.push(
      context.env.DB.prepare(
        "INSERT OR IGNORE INTO match_votes (match_id, user_id, vote) VALUES (?, ?, 'confirm')",
      ).bind(matchId, currentUser.id),
    );
  }

  await context.env.DB.batch(stmts);

  // Broadcast via WebSocket
  if (context.env.SCOREBOARD_DO) {
    const doId = context.env.SCOREBOARD_DO.idFromName("global");
    const doStub = context.env.SCOREBOARD_DO.get(doId);
    await doStub.fetch("https://do/broadcast", {
      method: "POST",
      body: JSON.stringify({
        type: "match_created",
        payload: {
          matchId,
          game_name: "Chwazi",
          outcome: "team_a",
          team_a: [winner_id],
          team_b: losers,
        },
      }),
    });
  }

  return Response.json({ matchId, winner_id }, { status: 201 });
};

// GET /api/chwazi — get recent chwazi results
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const results = await context.env.DB.prepare(
    `SELECT m.id, m.played_at as created_at,
            (SELECT u.name FROM match_participants mp JOIN users u ON u.id = mp.user_id WHERE mp.match_id = m.id AND mp.team = 'A' LIMIT 1) as winner_name,
            (SELECT GROUP_CONCAT(u.name, ', ') FROM match_participants mp JOIN users u ON u.id = mp.user_id WHERE mp.match_id = m.id AND mp.team = 'B') as participant_names
     FROM matches m
     WHERE m.game_name = 'Chwazi'
     ORDER BY m.played_at DESC
     LIMIT 20`,
  ).all<{
    id: number;
    winner_name: string;
    participant_names: string;
    created_at: string;
  }>();

  return Response.json({ results: results.results });
};
