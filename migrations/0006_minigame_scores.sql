CREATE TABLE IF NOT EXISTS minigame_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  game TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_minigame_scores_game ON minigame_scores(game);
CREATE INDEX idx_minigame_scores_user_game ON minigame_scores(user_id, game);
