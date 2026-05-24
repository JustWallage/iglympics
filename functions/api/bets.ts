interface UserData {
  id: number;
  name: string;
}

interface CreateMarketInput {
  question: string;
  description?: string;
  closes_at: string;
}

// POST /api/bets - Create a new bet market
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const currentUser = (context.data as { user: UserData }).user;

  const { question, description, closes_at } =
    (await context.request.json()) as CreateMarketInput;

  if (!question || !closes_at) {
    return Response.json(
      { error: "question and closes_at are required" },
      { status: 400 },
    );
  }

  const closesDate = new Date(closes_at);
  if (isNaN(closesDate.getTime()) || closesDate <= new Date()) {
    return Response.json(
      { error: "closes_at must be a valid future date" },
      { status: 400 },
    );
  }

  const result = await context.env.DB.prepare(
    "INSERT INTO bet_markets (question, description, created_by, closes_at) VALUES (?, ?, ?, ?) RETURNING id",
  )
    .bind(question, description || null, currentUser.id, closes_at)
    .first<{ id: number }>();

  if (!result) {
    return Response.json(
      { error: "Failed to create market" },
      { status: 500 },
    );
  }

  return Response.json({ id: result.id }, { status: 201 });
};

// GET /api/bets - List all bet markets
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const currentUser = (context.data as { user?: UserData }).user;

  const markets = await context.env.DB.prepare(
    `
    SELECT bm.id, bm.question, bm.description, bm.closes_at, bm.resolved_outcome, bm.resolved_at, bm.created_at,
           bm.created_by,
           u.name as created_by_name,
           COALESCE(SUM(CASE WHEN bp.position = 'yes' THEN bp.amount ELSE 0 END), 0) as yes_total,
           COALESCE(SUM(CASE WHEN bp.position = 'no' THEN bp.amount ELSE 0 END), 0) as no_total,
           COUNT(DISTINCT bp.user_id) as participant_count,
           CASE WHEN bm.resolved_outcome IS NULL AND bm.closes_at > datetime('now') THEN 1 ELSE 0 END as is_open
    FROM bet_markets bm
    JOIN users u ON u.id = bm.created_by
    LEFT JOIN bet_positions bp ON bp.market_id = bm.id
    GROUP BY bm.id
    ORDER BY
      CASE WHEN bm.resolved_outcome IS NULL AND bm.closes_at > datetime('now') THEN 0 ELSE 1 END,
      bm.closes_at ASC
    `,
  ).all<{
    id: number;
    question: string;
    description: string | null;
    closes_at: string;
    resolved_outcome: string | null;
    resolved_at: string | null;
    created_at: string;
    created_by: number;
    created_by_name: string;
    yes_total: number;
    no_total: number;
    participant_count: number;
    is_open: number;
  }>();

  // Get current user's positions if authenticated
  const userPositions = new Map<number, { position: string; amount: number }>();
  if (currentUser) {
    const positions = await context.env.DB.prepare(
      "SELECT market_id, position, amount FROM bet_positions WHERE user_id = ?",
    )
      .bind(currentUser.id)
      .all<{ market_id: number; position: string; amount: number }>();

    for (const p of positions.results) {
      userPositions.set(p.market_id, {
        position: p.position,
        amount: p.amount,
      });
    }
  }

  const result = markets.results.map((m) => {
    const total = m.yes_total + m.no_total;
    const yesPercent = total > 0 ? Math.round((m.yes_total / total) * 100) : 50;

    return {
      ...m,
      is_open: m.is_open === 1,
      yes_percent: yesPercent,
      no_percent: 100 - yesPercent,
      my_position: userPositions.get(m.id) ?? null,
    };
  });

  return Response.json({ markets: result });
};
