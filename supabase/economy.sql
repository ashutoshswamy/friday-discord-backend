-- ==========================================
-- Friday Discord Bot - Economy & Currency Schema
-- ==========================================

-- User Profiles (Wallet balances and Daily/Work cooldown timers)
CREATE TABLE IF NOT EXISTS user_profiles (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    coins BIGINT DEFAULT 100,
    bank BIGINT DEFAULT 0,
    daily_cooldown BIGINT DEFAULT 0,
    work_cooldown BIGINT DEFAULT 0,
    xp BIGINT DEFAULT 0,
    level INT DEFAULT 1,
    last_xp_gain BIGINT DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
);

-- Virtual Server Shop Items Catalog
CREATE TABLE IF NOT EXISTS shop_items (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    cost BIGINT NOT NULL,
    role_reward_id TEXT, -- Role awarded on buy
    UNIQUE(guild_id, name)
);

-- User Inventories (Purchased virtual shop items)
CREATE TABLE IF NOT EXISTS user_inventory (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    purchased_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast query lookups
CREATE INDEX IF NOT EXISTS inventory_guild_user_idx ON user_inventory (guild_id, user_id);
