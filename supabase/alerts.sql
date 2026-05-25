-- ==========================================
-- Friday Discord Bot - Social Media Alerts Schema
-- ==========================================

-- Stores YouTube alert subscriptions linking URLs to Discord channels.
CREATE TABLE IF NOT EXISTS youtube_alerts (
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL, -- Discord channel to ping
    youtube_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (guild_id, youtube_url)
);

-- Stores Twitch alert subscriptions linking usernames to Discord channels.
CREATE TABLE IF NOT EXISTS twitch_alerts (
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL, -- Discord channel to ping
    twitch_username TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (guild_id, twitch_username)
);
