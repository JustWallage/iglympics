export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const before = url.searchParams.get("before");
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 100);

  let query = `
    SELECT m.id, m.content, m.created_at, m.user_id, u.name AS user_name
    FROM chat_messages m
    JOIN users u ON u.id = m.user_id
  `;
  const params: (string | number)[] = [];

  if (before) {
    query += ` WHERE m.id < ?`;
    params.push(Number(before));
  }

  query += ` ORDER BY m.id DESC LIMIT ?`;
  params.push(limit);

  const { results } = await context.env.DB.prepare(query)
    .bind(...params)
    .all();

  return Response.json({ messages: results.reverse() });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = (context.data as { user?: { id: number; name: string } }).user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await context.request.json()) as { content?: string };
  const content = body.content?.trim();

  if (!content || content.length === 0) {
    return Response.json({ error: "Message cannot be empty" }, { status: 400 });
  }

  if (content.length > 1000) {
    return Response.json(
      { error: "Message too long (max 1000 chars)" },
      { status: 400 },
    );
  }

  const result = await context.env.DB.prepare(
    `INSERT INTO chat_messages (user_id, content) VALUES (?, ?)`,
  )
    .bind(user.id, content)
    .run();

  const message = {
    id: result.meta.last_row_id,
    content,
    user_id: user.id,
    user_name: user.name,
    created_at: new Date().toISOString().replace("T", " ").slice(0, 19),
  };

  // Broadcast via Durable Object if available
  if (context.env.SCOREBOARD_DO) {
    const doId = context.env.SCOREBOARD_DO.idFromName("scoreboard");
    const stub = context.env.SCOREBOARD_DO.get(doId);
    await stub.fetch("https://do/broadcast", {
      method: "POST",
      body: JSON.stringify({ type: "chat_message", data: message }),
    });
  }

  return Response.json({ message });
};
