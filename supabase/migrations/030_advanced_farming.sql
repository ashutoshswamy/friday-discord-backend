-- ==========================================
-- Friday Discord Bot - Advanced Farming Schema
-- ==========================================

-- Alter user_crops to add plot_index, fertilizer, pests
ALTER TABLE user_crops ADD COLUMN IF NOT EXISTS plot_index INT DEFAULT 1;
ALTER TABLE user_crops ADD COLUMN IF NOT EXISTS fertilizer TEXT DEFAULT NULL;
ALTER TABLE user_crops ADD COLUMN IF NOT EXISTS pests BOOLEAN DEFAULT FALSE;

-- Create user farming stats table
CREATE TABLE IF NOT EXISTS user_farming_stats (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    level INT DEFAULT 1,
    xp INT DEFAULT 0,
    max_plots INT DEFAULT 3,
    PRIMARY KEY (guild_id, user_id)
);

-- Index for user_farming_stats
CREATE INDEX IF NOT EXISTS user_farming_stats_guild_user_idx ON user_farming_stats (guild_id, user_id);
