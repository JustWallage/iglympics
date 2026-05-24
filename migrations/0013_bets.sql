-- Prediction markets / bets
CREATE TABLE IF NOT EXISTS bet_markets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  description TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  resolved_outcome TEXT CHECK (resolved_outcome IN ('yes', 'no') OR resolved_outcome IS NULL),
  closes_at TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bet_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id INTEGER NOT NULL REFERENCES bet_markets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  position TEXT NOT NULL CHECK (position IN ('yes', 'no')),
  amount INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(market_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bet_positions_market ON bet_positions(market_id);
CREATE INDEX IF NOT EXISTS idx_bet_positions_user ON bet_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_bet_markets_closes ON bet_markets(closes_at);
