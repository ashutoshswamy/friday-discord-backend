-- Create user pets table
CREATE TABLE IF NOT EXISTS user_pets (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    pet_name TEXT NOT NULL DEFAULT 'Buddy',
    pet_type TEXT NOT NULL DEFAULT 'Dog',
    level INT DEFAULT 1,
    xp INT DEFAULT 0,
    hunger INT DEFAULT 50, -- 100 is perfectly fed, 0 is starving
    affection INT DEFAULT 50, -- 100 is max affection
    energy INT DEFAULT 100, -- 100 is fully energized, 0 is exhausted
    attack INT DEFAULT 5,
    defense INT DEFAULT 5,
    last_fed TIMESTAMPTZ DEFAULT NOW(),
    last_trained TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (guild_id, user_id)
);

-- Index for fast pet queries
CREATE INDEX IF NOT EXISTS user_pets_guild_user_idx ON user_pets (guild_id, user_id);
