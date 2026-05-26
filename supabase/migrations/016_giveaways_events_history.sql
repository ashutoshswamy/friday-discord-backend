-- Migration 016: Persistent history for giveaways and server events

CREATE TABLE IF NOT EXISTS giveaways (
    id TEXT PRIMARY KEY,           -- Discord message ID
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    prize TEXT NOT NULL,
    winners_count INT NOT NULL DEFAULT 1,
    entrants_count INT NOT NULL DEFAULT 0,
    winner_ids TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active', -- active | ended | cancelled
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_giveaways_guild ON giveaways(guild_id);

CREATE TABLE IF NOT EXISTS guild_events (
    id TEXT PRIMARY KEY,           -- Discord message ID
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    location TEXT NOT NULL,
    rsvp_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_events_guild ON guild_events(guild_id);
