-- Stories: ephemeral Snapchat-style posts that auto-expire after 24 hours
CREATE TABLE IF NOT EXISTS stories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  content    TEXT    NOT NULL,
  bg_color   TEXT    NOT NULL DEFAULT 'violet',
  emoji      TEXT    DEFAULT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT    NOT NULL DEFAULT (datetime('now', '+1 day'))
);

CREATE INDEX idx_stories_user    ON stories(user_id);
CREATE INDEX idx_stories_expires ON stories(expires_at);
