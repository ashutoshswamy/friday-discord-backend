-- ==========================================
-- Friday Discord Bot - Advanced Moderation Schema
-- ==========================================

-- Stores formal user warnings issued by moderators.
CREATE TABLE IF NOT EXISTS warnings (
    id TEXT PRIMARY KEY, -- Unique warning ID (e.g. warn_ABC123)
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    timestamp BIGINT NOT NULL -- Millisecond epoch timestamp
);

-- Logs general server infractions (Bans, Kicks, Timeouts, warning removals) for audit.
CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY, -- Unique log ID (e.g. log_XYZ789)
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    type TEXT NOT NULL, -- BAN, UNBAN, KICK, TIMEOUT, UNTIMEOUT, WARN, CLEAR_WARN
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    timestamp BIGINT NOT NULL
);

-- Optimization indexes for fast lookup
CREATE INDEX IF NOT EXISTS warnings_guild_user_idx ON warnings (guild_id, user_id);
CREATE INDEX IF NOT EXISTS logs_guild_user_idx ON logs (guild_id, user_id);
