/**
 * GET  /api/stories  — list all active (non-expired) stories, grouped by user
 * POST /api/stories  — create a new story (auth required)
 */

interface StoryRow {
  id: number;
  user_id: number;
  user_name: string;
  content: string;
  bg_color: string;
  emoji: string | null;
  created_at: string;
  expires_at: string;
}

interface UserStories {
  user_id: number;
  user_name: string;
  stories: Omit<StoryRow, "user_id" | "user_name">[];
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { results } = await context.env.DB.prepare(
    `SELECT s.id, s.user_id, u.name AS user_name, s.content,
            s.bg_color, s.emoji, s.created_at, s.expires_at
     FROM stories s
     JOIN users u ON u.id = s.user_id
     WHERE s.expires_at > datetime('now')
     ORDER BY s.created_at DESC`,
  ).all<StoryRow>();

  // Group by user
  const byUser = new Map<number, UserStories>();
  for (const row of results) {
    let group = byUser.get(row.user_id);
    if (!group) {
      group = { user_id: row.user_id, user_name: row.user_name, stories: [] };
      byUser.set(row.user_id, group);
    }
    group.stories.push({
      id: row.id,
      content: row.content,
      bg_color: row.bg_color,
      emoji: row.emoji,
      created_at: row.created_at,
      expires_at: row.expires_at,
    });
  }

  return Response.json({ story_groups: Array.from(byUser.values()) });
};

const VALID_COLORS = [
  "violet",
  "sky",
  "rose",
  "amber",
  "emerald",
  "fuchsia",
  "orange",
  "cyan",
];

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = (context.data as { user?: { id: number; name: string } }).user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await context.request.json()) as {
    content?: string;
    bg_color?: string;
    emoji?: string;
  };

  const content = body.content?.trim();
  if (!content || content.length === 0) {
    return Response.json(
      { error: "Story content cannot be empty" },
      { status: 400 },
    );
  }
  if (content.length > 200) {
    return Response.json(
      { error: "Story content too long (max 200 chars)" },
      { status: 400 },
    );
  }

  const bgColor = VALID_COLORS.includes(body.bg_color ?? "")
    ? body.bg_color!
    : "violet";

  const emoji = body.emoji?.trim()?.slice(0, 4) || null;

  const result = await context.env.DB.prepare(
    `INSERT INTO stories (user_id, content, bg_color, emoji) VALUES (?, ?, ?, ?)`,
  )
    .bind(user.id, content, bgColor, emoji)
    .run();

  const story = {
    id: result.meta.last_row_id,
    user_id: user.id,
    user_name: user.name,
    content,
    bg_color: bgColor,
    emoji,
    created_at: new Date().toISOString().replace("T", " ").slice(0, 19),
  };

  // Broadcast via Durable Object if available
  if (context.env.SCOREBOARD_DO) {
    const doId = context.env.SCOREBOARD_DO.idFromName("global");
    const stub = context.env.SCOREBOARD_DO.get(doId);
    await stub.fetch("https://do/broadcast", {
      method: "POST",
      body: JSON.stringify({ type: "story_created", payload: story }),
    });
  }

  return Response.json({ story }, { status: 201 });
};
