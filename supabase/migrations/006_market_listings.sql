-- Create player-driven market listings table
CREATE TABLE IF NOT EXISTS market_listings (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    seller_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    price BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for speedy listing queries
CREATE INDEX IF NOT EXISTS market_listings_guild_idx ON market_listings (guild_id);
