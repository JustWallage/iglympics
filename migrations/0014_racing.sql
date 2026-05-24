-- Racing games table for lobby listing
CREATE TABLE IF NOT EXISTS racing_games (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  players TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_racing_games_status ON racing_games(status);
