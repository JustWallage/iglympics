interface UserData {
  id: number;
  name: string;
}

interface PlaceBetInput {
  position: "yes" | "no";
  amount?: number;
}

// POST /api/bets/[id] - Place a bet on a market
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const currentUser = (context.data as { user: UserData }).user;
  const marketId = parseInt(context.params.id as string, 10);

  if (isNaN(marketId)) {
    return Response.json({ error: "Invalid market ID" }, { status: 400 });
  }

  const { position, amount = 1 } =
    (await context.request.json()) as PlaceBetInput;

  if (!["yes", "no"].includes(position)) {
    return Response.json(
      { error: "position must be 'yes' or 'no'" },
      { status: 400 },
    );
  }

  if (amount < 1 || amount > 10) {
    return Response.json(
      { error: "amount must be between 1 and 10" },
      { status: 400 },
    );
  }

  // Check market exists and is open
  const market = await context.env.DB.prepare(
    "SELECT id, closes_at, resolved_outcome FROM bet_markets WHERE id = ?",
  )
    .bind(marketId)
    .first<{ id: number; closes_at: string; resolved_outcome: string | null }>();

  if (!market) {
    return Response.json({ error: "Market not found" }, { status: 404 });
  }

  if (market.resolved_outcome) {
    return Response.json(
      { error: "Market is already resolved" },
      { status: 400 },
    );
  }

  if (new Date(market.closes_at) <= new Date()) {
    return Response.json({ error: "Market is closed" }, { status: 400 });
  }

  // Upsert position
  await context.env.DB.prepare(
    `INSERT INTO bet_positions (market_id, user_id, position, amount)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(market_id, user_id) DO UPDATE SET position = excluded.position, amount = excluded.amount`,
  )
    .bind(marketId, currentUser.id, position, amount)
    .run();

  return Response.json({ success: true });
};
