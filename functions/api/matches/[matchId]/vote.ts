interface UserData {
  id: number;
  name: string;
}

interface VoteInput {
  vote: "confirm" | "reject";
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const currentUser = (context.data as { user: UserData }).user;
  const matchId = parseInt(context.params.matchId as string, 10);

  if (isNaN(matchId)) {
    return Response.json({ error: "Invalid match ID" }, { status: 400 });
  }

  const { vote } = (await context.request.json()) as VoteInput;
  if (!["confirm", "reject"].includes(vote)) {
    return Response.json(
      { error: "vote must be confirm or reject" },
      { status: 400 },
    );
  }

  // Verify match exists
  const match = await context.env.DB.prepare(
    "SELECT id FROM matches WHERE id = ?",
  )
    .bind(matchId)
    .first();

  if (!match) {
    return Response.json({ error: "Match not found" }, { status: 404 });
  }

  // Upsert vote (allows changing votes)
  await context.env.DB.prepare(
    `INSERT INTO match_votes (match_id, user_id, vote)
     VALUES (?, ?, ?)
     ON CONFLICT(match_id, user_id)
     DO UPDATE SET vote = excluded.vote`,
  )
    .bind(matchId, currentUser.id, vote)
    .run();

  // Get updated vote counts
  const counts = await context.env.DB.prepare(
    `SELECT
       SUM(CASE WHEN vote = 'confirm' THEN 1 ELSE 0 END) as confirms,
       SUM(CASE WHEN vote = 'reject' THEN 1 ELSE 0 END) as rejects
     FROM match_votes WHERE match_id = ?`,
  )
    .bind(matchId)
    .first<{ confirms: number; rejects: number }>();

  if (context.env.SCOREBOARD_DO) {
    const doId = context.env.SCOREBOARD_DO.idFromName("global");
    const doStub = context.env.SCOREBOARD_DO.get(doId);
    await doStub.fetch("https://do/broadcast", {
      method: "POST",
      body: JSON.stringify({
        type: "match_created",
        payload: { matchId },
      }),
    });
  }

  return Response.json({
    confirms: counts?.confirms ?? 0,
    rejects: counts?.rejects ?? 0,
  });
};
