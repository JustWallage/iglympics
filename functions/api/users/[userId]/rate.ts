interface UserData {
  id: number;
  name: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const userId = parseInt(context.params.userId as string, 10);
  if (isNaN(userId)) {
    return Response.json({ error: "Invalid user ID" }, { status: 400 });
  }

  const currentUser = (context.data as { user: UserData }).user;
  if (currentUser.id === userId) {
    return Response.json({ error: "Cannot rate yourself" }, { status: 400 });
  }

  const { rating, note } = (await context.request.json()) as {
    rating: number;
    note: string;
  };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return Response.json(
      { error: "Rating must be an integer between 1 and 5" },
      { status: 400 },
    );
  }
  if (!note || !note.trim()) {
    return Response.json({ error: "Note is required" }, { status: 400 });
  }

  await context.env.DB.prepare(
    "INSERT INTO ratings (rater_id, rated_id, rating, note) VALUES (?, ?, ?, ?)",
  )
    .bind(currentUser.id, userId, rating, note.trim())
    .run();

  if (context.env.SCOREBOARD_DO) {
    const doId = context.env.SCOREBOARD_DO.idFromName("global");
    const doStub = context.env.SCOREBOARD_DO.get(doId);
    await doStub.fetch("https://do/broadcast", {
      method: "POST",
      body: JSON.stringify({
        type: "rating_updated",
        payload: { raterId: currentUser.id, ratedId: userId, rating },
      }),
    });
  }

  return Response.json({ ok: true }, { status: 201 });
};
