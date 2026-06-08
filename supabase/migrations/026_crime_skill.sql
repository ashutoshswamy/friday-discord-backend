-- ==========================================
-- Friday Discord Bot - Crime Skill Stats Schema
-- ==========================================

-- Create user crime stats table
CREATE TABLE IF NOT EXISTS user_crime_stats (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    xp INT DEFAULT 0,
    level INT DEFAULT 1,
    PRIMARY KEY (guild_id, user_id)
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS user_crime_stats_guild_user_idx ON user_crime_stats (guild_id, user_id);
