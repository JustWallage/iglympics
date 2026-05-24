-- Mexen dice games table for lobby listing
CREATE TABLE IF NOT EXISTS mexen_games (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  players TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mexen_games_status ON mexen_games(status);
