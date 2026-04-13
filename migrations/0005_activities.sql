-- Activities for the schedule
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  date TEXT,
  time TEXT,
  description TEXT,
  image_url TEXT,
  release_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
