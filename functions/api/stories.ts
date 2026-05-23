/**
 * GET  /api/stories  — list all active (non-expired) stories, grouped by user
 * POST /api/stories  — create a new image story (multipart/form-data, auth required)
 */

interface StoryRow {
  id: number;
  user_id: number;
  user_name: string;
  image_key: string;
  caption: string | null;
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
    `SELECT s.id, s.user_id, u.name AS user_name, s.image_key,
            s.caption, s.created_at, s.expires_at
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
      image_key: row.image_key,
      caption: row.caption,
      created_at: row.created_at,
      expires_at: row.expires_at,
    });
  }

  return Response.json({ story_groups: Array.from(byUser.values()) });
};

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = (context.data as { user?: { id: number; name: string } }).user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await context.request.formData();
  const file = formData.get("image");
  const caption = (formData.get("caption") as string | null)?.trim() || null;

  if (!(file instanceof File) || !file.size) {
    return Response.json({ error: "Image is required" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json(
      { error: "Only JPEG, PNG, WebP, and GIF images are allowed" },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE) {
    return Response.json(
      { error: "Image must be under 5 MB" },
      { status: 400 },
    );
  }

  if (caption && caption.length > 200) {
    return Response.json(
      { error: "Caption too long (max 200 chars)" },
      { status: 400 },
    );
  }

  // Generate unique key and upload to R2
  const ext = file.type.split("/")[1];
  const normalizedExt = ext === "jpeg" ? "jpg" : ext;
  const imageKey = `stories/${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${normalizedExt}`;

  await context.env.STORY_IMAGES.put(imageKey, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const result = await context.env.DB.prepare(
    `INSERT INTO stories (user_id, image_key, caption) VALUES (?, ?, ?)`,
  )
    .bind(user.id, imageKey, caption)
    .run();

  const inserted = await context.env.DB.prepare(
    `SELECT created_at FROM stories WHERE id = ?`,
  )
    .bind(result.meta.last_row_id)
    .first<{ created_at: string }>();

  const story = {
    id: result.meta.last_row_id,
    user_id: user.id,
    user_name: user.name,
    image_key: imageKey,
    caption,
    created_at: inserted?.created_at ?? new Date().toISOString().replace("T", " ").slice(0, 19),
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
