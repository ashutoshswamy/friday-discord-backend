-- Migration 024: Add ends_at to giveaways for restart rehydration
ALTER TABLE giveaways ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ DEFAULT NULL;
