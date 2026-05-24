-- Add media_type column to distinguish image vs video stories
ALTER TABLE stories ADD COLUMN media_type TEXT NOT NULL DEFAULT 'image';
