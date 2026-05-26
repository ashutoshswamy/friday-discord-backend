-- Migration 018: Add custom emojis column to polls

ALTER TABLE polls ADD COLUMN IF NOT EXISTS emojis TEXT[] DEFAULT '{}';
