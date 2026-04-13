interface UserData {
  id: number;
  name: string;
}

interface MatchInput {
  game_name: string;
  team_a: number[];
  team_b: number[];
  outcome: "team_a" | "team_b" | "tie";
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const currentUser = (context.data as { user: UserData }).user;

  if (currentUser.name !== context.env.ADMIN_NAME) {
    return Response.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const { game_name, team_a, team_b, outcome } =
    (await context.request.json()) as MatchInput;

  if (!game_name || !team_a?.length || !team_b?.length) {
    return Response.json(
      { error: "game_name, team_a, and team_b are required" },
      { status: 400 },
    );
  }

  if (!["team_a", "team_b", "tie"].includes(outcome)) {
    return Response.json(
      { error: "outcome must be team_a, team_b, or tie" },
      { status: 400 },
    );
  }

  const matchResult = await context.env.DB.prepare(
    "INSERT INTO matches (game_name, outcome, created_by) VALUES (?, ?, ?) RETURNING id",
  )
    .bind(game_name, outcome, currentUser.id)
    .first<{ id: number }>();

  if (!matchResult) {
    return Response.json({ error: "Failed to create match" }, { status: 500 });
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
      context.env.DB.prepare(
        "INSERT INTO match_participants (match_id, user_id, team, outcome, points_earned) VALUES (?, ?, 'A', ?, ?)",
      ).bind(matchId, userId, teamAOutcome, teamAPoints),
    );
  }
  for (const userId of team_b) {
    stmts.push(
      context.env.DB.prepare(
        "INSERT INTO match_participants (match_id, user_id, team, outcome, points_earned) VALUES (?, ?, 'B', ?, ?)",
      ).bind(matchId, userId, teamBOutcome, teamBPoints),
    );
  }

  await context.env.DB.batch(stmts);

  if (context.env.SCOREBOARD_DO) {
    const doId = context.env.SCOREBOARD_DO.idFromName("global");
    const doStub = context.env.SCOREBOARD_DO.get(doId);
    await doStub.fetch("https://do/broadcast", {
      method: "POST",
      body: JSON.stringify({
        type: "match_created",
        payload: { matchId, game_name, outcome, team_a, team_b },
      }),
    });
  }

  return Response.json({ matchId }, { status: 201 });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const matches = await context.env.DB.prepare(
    `
    SELECT m.id, m.game_name, m.outcome, m.played_at,
           u.name as created_by_name
    FROM matches m
    JOIN users u ON u.id = m.created_by
    ORDER BY m.played_at DESC
    LIMIT 100
    `,
  ).all<{
    id: number;
    game_name: string;
    outcome: string;
    played_at: string;
    created_by_name: string;
  }>();

  const matchIds = matches.results.map((m) => m.id);
  if (matchIds.length === 0) {
    return Response.json({ matches: [] });
  }

  const placeholders = matchIds.map(() => "?").join(",");
  const participants = await context.env.DB.prepare(
    `
    SELECT mp.match_id, mp.team, mp.outcome as player_outcome, mp.points_earned,
           u.id as user_id, u.name as user_name
    FROM match_participants mp
    JOIN users u ON u.id = mp.user_id
    WHERE mp.match_id IN (${placeholders})
    ORDER BY mp.team, u.name
    `,
  )
    .bind(...matchIds)
    .all<{
      match_id: number;
      team: string;
      player_outcome: string;
      points_earned: number;
      user_id: number;
      user_name: string;
    }>();

  const participantsByMatch = new Map<
    number,
    { team_a: string[]; team_b: string[] }
  >();
  for (const p of participants.results) {
    if (!participantsByMatch.has(p.match_id)) {
      participantsByMatch.set(p.match_id, { team_a: [], team_b: [] });
    }
    const entry = participantsByMatch.get(p.match_id)!;
    if (p.team === "A") {
      entry.team_a.push(p.user_name);
    } else {
      entry.team_b.push(p.user_name);
    }
  }

  const result = matches.results.map((m) => ({
    ...m,
    team_a: participantsByMatch.get(m.id)?.team_a ?? [],
    team_b: participantsByMatch.get(m.id)?.team_b ?? [],
  }));

  return Response.json({ matches: result });
};
