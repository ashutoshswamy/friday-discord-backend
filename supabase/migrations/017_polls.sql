-- Migration 017: Persistent poll history

CREATE TABLE IF NOT EXISTS polls (
    id TEXT PRIMARY KEY,            -- Discord message ID
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    question TEXT NOT NULL,
    options TEXT[] NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',  -- active | closed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_polls_guild ON polls(guild_id);
