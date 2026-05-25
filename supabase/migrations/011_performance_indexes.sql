-- Composite indexes for high-frequency query patterns

-- Stock portfolio lookups (buy/sell/view per user per symbol)
CREATE INDEX IF NOT EXISTS idx_user_stocks_lookup
    ON user_stocks (guild_id, user_id, symbol);

-- Intraday position lookups (open/close per user per symbol)
CREATE INDEX IF NOT EXISTS idx_user_intraday_lookup
    ON user_intraday (guild_id, user_id, symbol);

-- Warning lookups per user
CREATE INDEX IF NOT EXISTS idx_warnings_user
    ON warnings (guild_id, user_id);

-- Infraction log queries (leaderboard stats, audit log)
CREATE INDEX IF NOT EXISTS idx_logs_guild
    ON logs (guild_id);

CREATE INDEX IF NOT EXISTS idx_logs_moderator
    ON logs (guild_id, moderator_id);

-- User profile leaderboard queries (ordered by level+xp, coins)
CREATE INDEX IF NOT EXISTS idx_user_profiles_xp_lb
    ON user_profiles (guild_id, level DESC, xp DESC);

CREATE INDEX IF NOT EXISTS idx_user_profiles_coins_lb
    ON user_profiles (guild_id, coins DESC);

-- Inventory lookups
CREATE INDEX IF NOT EXISTS idx_user_inventory_user
    ON user_inventory (guild_id, user_id);

-- Market listings by guild (listing view) and by seller (cancel)
CREATE INDEX IF NOT EXISTS idx_market_listings_guild
    ON market_listings (guild_id);

CREATE INDEX IF NOT EXISTS idx_market_listings_seller
    ON market_listings (guild_id, seller_id);

-- Custom commands lookup by name
CREATE INDEX IF NOT EXISTS idx_custom_commands_name
    ON custom_commands (guild_id, name);

-- Tickets by status
CREATE INDEX IF NOT EXISTS idx_guild_tickets_status
    ON guild_tickets (guild_id, status);
