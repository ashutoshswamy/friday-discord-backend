-- Migration 002: Support multiple punishment escalation rules per guild
--
-- The original automod_rules table used guild_id as the sole primary key,
-- which allowed only ONE rule per guild. This migration:
--   1. Backs up existing rules into a temporary table.
--   2. Drops and recreates automod_rules with a composite PK (guild_id, warn_threshold).
--   3. Restores the backed-up rules.
--
-- Run this ONCE in: Supabase Dashboard → SQL Editor
-- WARNING: Existing rules are preserved. Verify data after running.

-- Step 1: Preserve existing rules
CREATE TEMP TABLE automod_rules_backup AS
    SELECT guild_id, warn_threshold, punishment_type, duration_ms
    FROM automod_rules;

-- Step 2: Drop the old table (single PK on guild_id)
DROP TABLE automod_rules;

-- Step 3: Recreate with composite PK (guild_id, warn_threshold)
CREATE TABLE automod_rules (
    guild_id      TEXT NOT NULL,
    warn_threshold INT  NOT NULL,
    punishment_type TEXT NOT NULL DEFAULT 'TIMEOUT', -- 'TIMEOUT', 'KICK', 'BAN'
    duration_ms   BIGINT NOT NULL DEFAULT 3600000,    -- milliseconds (used for TIMEOUT)
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (guild_id, warn_threshold)
);

-- Step 4: Restore backed-up rules
INSERT INTO automod_rules (guild_id, warn_threshold, punishment_type, duration_ms)
    SELECT guild_id, warn_threshold, punishment_type, duration_ms
    FROM automod_rules_backup;

-- Step 5: Index for fast per-guild lookup
CREATE INDEX IF NOT EXISTS automod_rules_guild_idx ON automod_rules (guild_id);
