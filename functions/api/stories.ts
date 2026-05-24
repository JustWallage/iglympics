/**
 * GET  /api/stories  — list all active (non-expired) stories, grouped by user
 * POST /api/stories  — create a new image or video story (multipart/form-data, auth required)
 */

interface StoryRow {
  id: number;
  user_id: number;
  user_name: string;
  image_key: string;
  media_type: string;
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
    `SELECT s.id, s.user_id, u.name AS user_name, s.image_key, s.media_type,
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
      media_type: row.media_type,
      caption: row.caption,
      created_at: row.created_at,
      expires_at: row.expires_at,
    });
  }

  return Response.json({ story_groups: Array.from(byUser.values()) });
};

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;  // 5 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = (context.data as { user?: { id: number; name: string } }).user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await context.request.formData();
  const file = formData.get("image") ?? formData.get("media");
  const caption = (formData.get("caption") as string | null)?.trim() || null;

  if (!(file instanceof File) || !file.size) {
    return Response.json({ error: "A photo or video is required" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json(
      { error: "Only JPEG, PNG, WebP, GIF images and MP4/WebM/MOV videos are allowed" },
      { status: 400 },
    );
  }

  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    return Response.json(
      { error: isVideo ? "Video must be under 50 MB" : "Image must be under 5 MB" },
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
  const normalizedExt = ext === "jpeg" ? "jpg" : ext === "quicktime" ? "mov" : ext;
  const mediaKey = `stories/${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${normalizedExt}`;
  const mediaType = isVideo ? "video" : "image";

  await context.env.STORY_IMAGES.put(mediaKey, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const result = await context.env.DB.prepare(
    `INSERT INTO stories (user_id, image_key, media_type, caption) VALUES (?, ?, ?, ?)`,
  )
    .bind(user.id, mediaKey, mediaType, caption)
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
    image_key: mediaKey,
    media_type: mediaType,
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
