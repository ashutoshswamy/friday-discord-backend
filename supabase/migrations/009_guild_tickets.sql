-- Migration 009: Ticket tracking table
-- Stores open and closed support ticket records per guild

CREATE TABLE IF NOT EXISTS guild_tickets (
    id          BIGSERIAL PRIMARY KEY,
    guild_id    TEXT        NOT NULL,
    channel_id  TEXT        NOT NULL,
    channel_name TEXT       NOT NULL,
    opener_id   TEXT        NOT NULL,
    opener_tag  TEXT,
    status      TEXT        NOT NULL DEFAULT 'open',
    opened_at   BIGINT      NOT NULL,
    closed_at   BIGINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_tickets_guild_id ON guild_tickets (guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_tickets_status   ON guild_tickets (guild_id, status);
