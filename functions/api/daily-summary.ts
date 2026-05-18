export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = (context.data as { user?: { id: number; name: string } }).user;
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();

  const [
    { results: activities },
    { results: matches },
    { results: minigames },
    { results: topPlayers },
  ] = await Promise.all([
    context.env.DB.prepare(
      `SELECT id, title, date, time, hint, release_at
         FROM activities WHERE date >= ? OR date IS NULL ORDER BY date ASC, time ASC`,
    )
      .bind(today)
      .all<{
        id: number;
        title: string | null;
        date: string | null;
        time: string | null;
        hint: string | null;
        release_at: number | null;
      }>(),

    context.env.DB.prepare(
      `SELECT m.game_name, m.outcome,
           GROUP_CONCAT(CASE WHEN mp.team = 'A' THEN u.name END) as team_a,
           GROUP_CONCAT(CASE WHEN mp.team = 'B' THEN u.name END) as team_b,
           MAX(CASE WHEN mp.user_id = ? THEN mp.team ELSE NULL END) as user_team
         FROM matches m
         JOIN match_participants mp ON mp.match_id = m.id
         JOIN users u ON u.id = mp.user_id
         WHERE date(m.played_at) = ?
         GROUP BY m.id ORDER BY m.played_at DESC`,
    )
      .bind(user.id, today)
      .all<{
        game_name: string;
        outcome: string;
        team_a: string | null;
        team_b: string | null;
        user_team: string | null;
      }>(),

    context.env.DB.prepare(
      `SELECT ms.game, u.name as user_name, ms.score
         FROM minigame_scores ms JOIN users u ON u.id = ms.user_id
         WHERE ms.score = (SELECT MAX(s2.score) FROM minigame_scores s2 WHERE s2.game = ms.game)
         GROUP BY ms.game ORDER BY ms.game`,
    ).all<{ game: string; user_name: string; score: number }>(),

    context.env.DB.prepare(
      `SELECT u.name, SUM(mp.points_earned) as points
         FROM match_participants mp JOIN users u ON u.id = mp.user_id
         GROUP BY mp.user_id ORDER BY points DESC LIMIT 3`,
    ).all<{ name: string; points: number }>(),
  ]);

  // Build context strings
  const todayActs = activities.filter((a) => a.date === today);
  const upcomingActs = activities.filter((a) => a.date && a.date > today);

  const todayActText =
    todayActs.length === 0
      ? "No activities today."
      : todayActs
          .map((a) => {
            const released = !a.release_at || Number(a.release_at) <= now;
            return released && a.title
              ? `"${a.title}"${a.time ? ` at ${a.time}` : ""}`
              : `[Hidden${a.hint ? `: hint "${a.hint}"` : ""}]`;
          })
          .join(", ");

  const upcomingActText =
    upcomingActs.length === 0
      ? "Nothing coming up."
      : upcomingActs
          .map((a) => {
            const released = !a.release_at || Number(a.release_at) <= now;
            return released && a.title
              ? `"${a.title}" on ${a.date}`
              : `[Mystery${a.hint ? ` "${a.hint}"` : ""}] on ${a.date}`;
          })
          .join(", ");

  const matchesText =
    matches.length === 0
      ? "No matches today."
      : matches
          .map((m) => {
            const a = (m.team_a ?? "").split(",").filter(Boolean);
            const b = (m.team_b ?? "").split(",").filter(Boolean);
            const winner =
              m.outcome === "team_a"
                ? a.join(" & ")
                : m.outcome === "team_b"
                  ? b.join(" & ")
                  : "draw";
            const userWon =
              (m.user_team === "A" && m.outcome === "team_a") ||
              (m.user_team === "B" && m.outcome === "team_b");
            const userNote = m.user_team
              ? ` (${user.name} ${userWon ? "WON" : "lost"})`
              : "";
            return `${m.game_name}: ${a.join("+")} vs ${b.join("+")} → ${winner}${userNote}`;
          })
          .join("; ");

  const minigamesText =
    minigames.length === 0
      ? "No records yet."
      : minigames
          .map((g) => `${g.game}: ${g.user_name} (${g.score})`)
          .join(", ");

  const topPlayersText =
    topPlayers.length === 0
      ? "No ranked players yet."
      : topPlayers
          .map((p, i) => `${i + 1}. ${p.name} (${p.points} pts)`)
          .join(", ");

  const dateLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const systemPrompt = `You are the Iglympics Daily Briefing host — a dry, sarcastic narrator who speaks to the listener as if they are simultaneously very important and deeply disappointing.
You sprinkle in occasional Belgian references (comme ci comme ça, moules-frites, Belgian waffles, Belgian rain, the inexplicable number of Belgian governments, etc.) but don't overdo it — one or two per briefing.
Your delivery is deadpan sports-newsreader energy. Include one or two unexpected jokes or absurd observations but keep them punchy and related to the actual data.
Keep the entire briefing under 180 words. No markdown, no asterisks, no bullet points — this will be read aloud as audio. Speak naturally and directly.`;

  const userPrompt = `Deliver the Iglympics daily briefing for ${user.name}.

Today: ${dateLabel}

Today's activities: ${todayActText}
Coming up: ${upcomingActText}
Today's matches: ${matchesText}
Minigame champions (all time): ${minigamesText}
Top 3 players: ${topPlayersText}`;

  // Generate text with LLM
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const llmRes = (await (context.env.AI as any).run(
    "@cf/meta/llama-3.1-8b-instruct-fast",
    {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    },
  )) as { response?: string };

  const summaryText = llmRes.response?.trim();
  if (!summaryText)
    return Response.json({ error: "AI generation failed" }, { status: 500 });

  // Convert to speech
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audio = await (context.env.AI as any).run("@cf/deepgram/aura-2-en", {
    text: summaryText,
    speaker: "asteria",
    encoding: "mp3",
  });

  return new Response(audio as ArrayBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "X-Briefing-Text": encodeURIComponent(summaryText),
    },
  });
};
