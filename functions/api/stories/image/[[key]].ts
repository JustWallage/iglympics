/**
 * GET /api/stories/image/[...key] — serve a story image from R2
 *
 * The key is the full R2 object key (e.g. stories/1/1234567890-abcd1234.jpg)
 * passed as a catch-all param.
 */

export const onRequestGet: PagesFunction<Env, "key"> = async (context) => {
  const key = context.params.key;
  if (!key) {
    return Response.json({ error: "Missing image key" }, { status: 400 });
  }

  // key comes as an array for catch-all routes — join segments
  const imageKey = Array.isArray(key) ? key.join("/") : key;

  const object = await context.env.STORY_IMAGES.get(imageKey);
  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType ?? "image/jpeg",
  );
  headers.set("Cache-Control", "public, max-age=3600");

  return new Response(object.body, { headers });
};
