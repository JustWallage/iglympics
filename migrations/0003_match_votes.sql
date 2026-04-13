-- Match votes (confirm/reject consensus)
CREATE TABLE IF NOT EXISTS match_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  vote TEXT NOT NULL CHECK (vote IN ('confirm', 'reject')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_votes_match ON match_votes(match_id);

-- App settings (admin-configurable thresholds)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default thresholds
INSERT OR IGNORE INTO settings (key, value) VALUES ('confirm_threshold', '4');
INSERT OR IGNORE INTO settings (key, value) VALUES ('reject_threshold', '8');
