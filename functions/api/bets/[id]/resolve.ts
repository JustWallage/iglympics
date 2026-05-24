import { isAdmin } from "../../../_lib/auth";

interface UserData {
  id: number;
  name: string;
}

interface ResolveInput {
  outcome: "yes" | "no";
}

// POST /api/bets/[id]/resolve - Resolve a bet market (creator or admin only)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const currentUser = (context.data as { user: UserData }).user;
  const marketId = parseInt(context.params.id as string, 10);

  if (isNaN(marketId)) {
    return Response.json({ error: "Invalid market ID" }, { status: 400 });
  }

  const { outcome } = (await context.request.json()) as ResolveInput;

  if (!["yes", "no"].includes(outcome)) {
    return Response.json(
      { error: "outcome must be 'yes' or 'no'" },
      { status: 400 },
    );
  }

  const market = await context.env.DB.prepare(
    "SELECT id, created_by, resolved_outcome FROM bet_markets WHERE id = ?",
  )
    .bind(marketId)
    .first<{ id: number; created_by: number; resolved_outcome: string | null }>();

  if (!market) {
    return Response.json({ error: "Market not found" }, { status: 404 });
  }

  if (market.resolved_outcome) {
    return Response.json(
      { error: "Market is already resolved" },
      { status: 400 },
    );
  }

  // Only the creator or an admin can resolve
  const userIsAdmin = isAdmin(currentUser.name, context.env.ADMIN_NAMES);
  if (market.created_by !== currentUser.id && !userIsAdmin) {
    return Response.json(
      { error: "Only the creator or an admin can resolve this market" },
      { status: 403 },
    );
  }

  await context.env.DB.prepare(
    "UPDATE bet_markets SET resolved_outcome = ?, resolved_at = datetime('now') WHERE id = ?",
  )
    .bind(outcome, marketId)
    .run();

  return Response.json({ success: true });
};
