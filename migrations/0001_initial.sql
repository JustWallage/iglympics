-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_name TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('team_a', 'team_b', 'tie')),
  played_at TEXT DEFAULT (datetime('now')),
  created_by INTEGER NOT NULL REFERENCES users(id)
);

-- Match participants
CREATE TABLE IF NOT EXISTS match_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  team TEXT NOT NULL CHECK (team IN ('A', 'B')),
  outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'tie')),
  points_earned INTEGER NOT NULL DEFAULT 0
);

-- Ratings
CREATE TABLE IF NOT EXISTS ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rater_id INTEGER NOT NULL REFERENCES users(id),
  rated_id INTEGER NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(rater_id, rated_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_match_participants_match ON match_participants(match_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_user ON match_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rated ON ratings(rated_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rater_rated ON ratings(rater_id, rated_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Mock users (14 friends)
-- Password for all: "iglympics2024"
-- Hash generated via PBKDF2 with WebCrypto - these are placeholder hashes that
-- will be replaced by the seed script. For local dev, use the /api/seed endpoint.
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO users (name, password_hash, salt) VALUES
  ('just', 'placeholder', 'placeholder'),
  ('alice', 'placeholder', 'placeholder'),
  ('bob', 'placeholder', 'placeholder'),
  ('charlie', 'placeholder', 'placeholder'),
  ('diana', 'placeholder', 'placeholder'),
  ('edward', 'placeholder', 'placeholder'),
  ('fiona', 'placeholder', 'placeholder'),
  ('george', 'placeholder', 'placeholder'),
  ('hannah', 'placeholder', 'placeholder'),
  ('ivan', 'placeholder', 'placeholder'),
  ('julia', 'placeholder', 'placeholder'),
  ('kevin', 'placeholder', 'placeholder'),
  ('laura', 'placeholder', 'placeholder'),
  ('mike', 'placeholder', 'placeholder');
