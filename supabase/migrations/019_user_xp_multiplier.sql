-- Migration 019: Per-user XP multiplier
-- Adds an optional per-user XP multiplier to user_profiles.
-- The value stacks with the guild-wide xp_multiplier in guild_configs.
-- Default 1.0 = no change to XP rate.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS xp_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.0;
