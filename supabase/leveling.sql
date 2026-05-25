-- ==========================================
-- Friday Discord Bot - Leveling & XP Schema
-- ==========================================

-- User Profiles (Level, XP, and chat-XP gain cooldown timer)
CREATE TABLE IF NOT EXISTS user_profiles (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    coins BIGINT DEFAULT 100,
    daily_cooldown BIGINT DEFAULT 0,
    work_cooldown BIGINT DEFAULT 0,
    xp BIGINT DEFAULT 0,
    level INT DEFAULT 1,
    last_xp_gain BIGINT DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
);

-- Milestone Level Role Rewards Mapping
CREATE TABLE IF NOT EXISTS level_rewards (
    guild_id TEXT NOT NULL,
    level INT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, level)
);

-- Guild Configurations (XP generation speed multipliers)
CREATE TABLE IF NOT EXISTS guild_configs (
    guild_id TEXT PRIMARY KEY,
    automod_spam BOOLEAN DEFAULT FALSE,
    automod_links BOOLEAN DEFAULT FALSE,
    automod_caps BOOLEAN DEFAULT FALSE,
    xp_multiplier DOUBLE PRECISION DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast leaderboard rendering
CREATE INDEX IF NOT EXISTS profiles_guild_level_idx ON user_profiles (guild_id, level DESC, xp DESC);
