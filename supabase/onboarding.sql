-- ==========================================
-- Friday Discord Bot - Onboarding & Welcome Schema
-- ==========================================

-- Extends the guild_configs table to support welcome channels, custom text, and auto-roles.
CREATE TABLE IF NOT EXISTS guild_configs (
    guild_id TEXT PRIMARY KEY,
    automod_spam BOOLEAN DEFAULT FALSE,
    automod_links BOOLEAN DEFAULT FALSE,
    automod_caps BOOLEAN DEFAULT FALSE,
    xp_multiplier DOUBLE PRECISION DEFAULT 1.0,
    welcome_channel_id TEXT,
    welcome_message TEXT,
    auto_role_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
