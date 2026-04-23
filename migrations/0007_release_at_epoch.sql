-- Convert release_at from datetime string to epoch milliseconds
UPDATE activities
SET release_at = CAST(strftime('%s', replace(release_at, 'T', ' ')) AS INTEGER) * 1000
WHERE release_at IS NOT NULL;
