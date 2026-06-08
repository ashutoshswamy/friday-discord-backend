-- ==========================================
-- Friday Discord Bot - Player-Driven Market Schema
-- ==========================================

-- Table to store current commodity prices
CREATE TABLE IF NOT EXISTS market_commodities (
    guild_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    price INT NOT NULL,
    event_text TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (guild_id, item_name)
);

-- Table to store the last market tick timestamp per guild
CREATE TABLE IF NOT EXISTS market_ticks (
    guild_id TEXT PRIMARY KEY,
    last_tick TIMESTAMPTZ DEFAULT NOW()
);
