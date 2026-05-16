import { isAdmin } from "../_lib/auth";

interface Activity {
  id: number;
  title: string;
  date: string | null;
  time: string | null;
  description: string | null;
  image_url: string | null;
  release_at: number | null;
  created_at: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { results } = await context.env.DB.prepare(
    "SELECT * FROM activities ORDER BY date ASC, time ASC",
  ).all<Activity>();

  const user = (context.data as { user?: { id: number; name: string } }).user;
  const userIsAdmin = user && isAdmin(user.name, context.env.ADMIN_NAMES);
  const now = Date.now();

  const activities = results.map((a) => {
    const releaseAt = a.release_at ? Number(a.release_at) || null : null;
    const released = !releaseAt || releaseAt <= now;
    if (released || userIsAdmin) {
      return { ...a, release_at: releaseAt, released };
    }
    // Unreleased: only return image_url (for blurred preview) and id
    return {
      id: a.id,
      title: null,
      date: null,
      time: null,
      description: null,
      image_url: a.image_url,
      release_at: releaseAt,
      created_at: a.created_at,
      released: false,
    };
  });

  return Response.json({ activities });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = (context.data as { user?: { id: number; name: string } }).user;
  if (!user || !isAdmin(user.name, context.env.ADMIN_NAMES)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await context.request.json()) as {
    title?: string;
    date?: string;
    time?: string;
    description?: string;
    image_url?: string;
    release_at?: number;
  };

  if (!body.title?.trim()) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  const result = await context.env.DB.prepare(
    `INSERT INTO activities (title, date, time, description, image_url, release_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      body.title.trim(),
      body.date || null,
      body.time || null,
      body.description || null,
      body.image_url || null,
      body.release_at || null,
    )
    .run();

  return Response.json({ id: result.meta.last_row_id });
};
