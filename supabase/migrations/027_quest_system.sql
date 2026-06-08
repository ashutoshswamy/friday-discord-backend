-- ==========================================
-- Friday Discord Bot - Daily Quest System Schema
-- ==========================================

-- Create user quests table
CREATE TABLE IF NOT EXISTS user_quests (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    quest_index INT NOT NULL, -- 0, 1, or 2 for the three daily quests
    quest_type TEXT NOT NULL, -- e.g. 'chop', 'fish', 'mine', 'sell', 'water'
    target_item TEXT,        -- optional target item name (e.g. 'Pine Log')
    target_amount INT NOT NULL,
    current_amount INT DEFAULT 0,
    reward_coins INT NOT NULL,
    reward_xp INT NOT NULL,
    claimed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast daily quest queries
CREATE INDEX IF NOT EXISTS user_quests_guild_user_idx ON user_quests (guild_id, user_id);
