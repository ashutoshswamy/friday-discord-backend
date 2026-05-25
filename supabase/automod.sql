-- ==========================================
-- Friday Discord Bot - AutoModeration Schema
-- ==========================================

-- Guild Configurations (toggles for links, caps, and spam filters)
CREATE TABLE IF NOT EXISTS guild_configs (
    guild_id TEXT PRIMARY KEY,
    automod_spam BOOLEAN DEFAULT FALSE,
    automod_links BOOLEAN DEFAULT FALSE,
    automod_caps BOOLEAN DEFAULT FALSE,
    xp_multiplier DOUBLE PRECISION DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom Blocked Words and regex patterns
CREATE TABLE IF NOT EXISTS blocked_words (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    pattern TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(guild_id, pattern)
);

-- Whitelisted Channels and Roles that bypass AutoMod scanning
CREATE TABLE IF NOT EXISTS automod_exemptions (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'CHANNEL' or 'ROLE'
    target_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(guild_id, type, target_id)
);

-- Punishment Escalation Rules (e.g., mute after 3 warnings)
CREATE TABLE IF NOT EXISTS automod_rules (
    guild_id TEXT PRIMARY KEY,
    warn_threshold INT DEFAULT 3,
    punishment_type TEXT DEFAULT 'TIMEOUT', -- 'TIMEOUT', 'KICK', 'BAN'
    duration_ms BIGINT DEFAULT 3600000, -- 1 hour in ms
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast query evaluations
CREATE INDEX IF NOT EXISTS blocked_words_guild_idx ON blocked_words (guild_id);
