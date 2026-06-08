-- ==========================================
-- Friday Discord Bot - Farming System Schema
-- ==========================================

-- Create user crops table
CREATE TABLE IF NOT EXISTS user_crops (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    crop_name TEXT NOT NULL,
    planted_at TIMESTAMPTZ DEFAULT NOW(),
    growth_time INT NOT NULL, -- growth duration in seconds
    last_watered TIMESTAMPTZ DEFAULT NOW(),
    water_count INT DEFAULT 1,
    harvest_ready TIMESTAMPTZ NOT NULL
);

-- Index for fast crop queries
CREATE INDEX IF NOT EXISTS user_crops_guild_user_idx ON user_crops (guild_id, user_id);
