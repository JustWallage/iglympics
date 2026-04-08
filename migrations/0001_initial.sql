-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
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
INSERT INTO users (name, email, password_hash, salt) VALUES
  ('Alice Johnson', 'alice@iglympics.nl', 'placeholder', 'placeholder'),
  ('Bob Smith', 'bob@iglympics.nl', 'placeholder', 'placeholder'),
  ('Charlie Brown', 'charlie@iglympics.nl', 'placeholder', 'placeholder'),
  ('Diana Prince', 'diana@iglympics.nl', 'placeholder', 'placeholder'),
  ('Edward Norton', 'edward@iglympics.nl', 'placeholder', 'placeholder'),
  ('Fiona Apple', 'fiona@iglympics.nl', 'placeholder', 'placeholder'),
  ('George Lucas', 'george@iglympics.nl', 'placeholder', 'placeholder'),
  ('Hannah Montana', 'hannah@iglympics.nl', 'placeholder', 'placeholder'),
  ('Ivan Drago', 'ivan@iglympics.nl', 'placeholder', 'placeholder'),
  ('Julia Roberts', 'julia@iglympics.nl', 'placeholder', 'placeholder'),
  ('Kevin Hart', 'kevin@iglympics.nl', 'placeholder', 'placeholder'),
  ('Laura Croft', 'laura@iglympics.nl', 'placeholder', 'placeholder'),
  ('Mike Tyson', 'mike@iglympics.nl', 'placeholder', 'placeholder'),
  ('Nina Simone', 'nina@iglympics.nl', 'placeholder', 'placeholder');
