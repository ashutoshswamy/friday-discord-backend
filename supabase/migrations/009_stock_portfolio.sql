-- Create user_stocks holdings table for long-term investments
CREATE TABLE IF NOT EXISTS user_stocks (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    market TEXT NOT NULL,
    shares DOUBLE PRECISION NOT NULL DEFAULT 0,
    average_buy_price DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (guild_id, user_id, symbol)
);

-- Create user_intraday positions table for short-term leveraged positions
CREATE TABLE IF NOT EXISTS user_intraday (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    market TEXT NOT NULL,
    type TEXT NOT NULL, -- 'LONG' or 'SHORT'
    shares DOUBLE PRECISION NOT NULL DEFAULT 0,
    entry_price DOUBLE PRECISION NOT NULL DEFAULT 0,
    leverage INT NOT NULL DEFAULT 5, -- 5x default leverage
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (guild_id, user_id, symbol)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS user_stocks_guild_user_idx ON user_stocks (guild_id, user_id);
CREATE INDEX IF NOT EXISTS user_intraday_guild_user_idx ON user_intraday (guild_id, user_id);
