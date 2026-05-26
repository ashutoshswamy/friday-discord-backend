-- Per-filter channel opt-outs for AutoMod
-- Allows admins to exempt a channel from a specific filter without fully whitelisting it
CREATE TABLE IF NOT EXISTS automod_filter_optouts (
    guild_id   TEXT NOT NULL,
    filter     TEXT NOT NULL, -- 'spam' | 'links' | 'caps' | 'invites'
    channel_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (guild_id, filter, channel_id)
);

CREATE INDEX IF NOT EXISTS automod_filter_optouts_guild_idx ON automod_filter_optouts (guild_id);
