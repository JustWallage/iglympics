-- Allow multiple ratings per user pair and add required note field.
-- SQLite does not support DROP CONSTRAINT, so we recreate the ratings table.

CREATE TABLE IF NOT EXISTS ratings_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rater_id INTEGER NOT NULL REFERENCES users(id),
  rated_id INTEGER NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  note TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Copy existing ratings (set note to empty string for any legacy data)
INSERT INTO ratings_new (id, rater_id, rated_id, rating, note, created_at)
  SELECT id, rater_id, rated_id, rating, '', created_at FROM ratings;

DROP TABLE ratings;
ALTER TABLE ratings_new RENAME TO ratings;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_ratings_rated ON ratings(rated_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rater ON ratings(rater_id);
