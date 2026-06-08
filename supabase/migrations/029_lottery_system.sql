-- ==========================================
-- Friday Discord Bot - Daily Lottery Schema
-- ==========================================

-- Table to store current lottery configurations per guild
CREATE TABLE IF NOT EXISTS lottery_config (
    guild_id TEXT PRIMARY KEY,
    ticket_cost INT NOT NULL DEFAULT 100,
    jackpot BIGINT NOT NULL DEFAULT 1000,
    last_draw TIMESTAMPTZ DEFAULT NOW()
);

-- Table to store active tickets purchased by players
CREATE TABLE IF NOT EXISTS lottery_tickets (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    ticket_count INT NOT NULL DEFAULT 1
);

-- Index for fast query of active tickets
CREATE INDEX IF NOT EXISTS lottery_tickets_guild_idx ON lottery_tickets (guild_id);

-- Table to log lottery draws history
CREATE TABLE IF NOT EXISTS lottery_history (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    winner_id TEXT NOT NULL,
    jackpot_won BIGINT NOT NULL,
    draw_date TIMESTAMPTZ DEFAULT NOW()
);
