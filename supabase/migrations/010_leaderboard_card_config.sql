ALTER TABLE guild_configs
    ADD COLUMN IF NOT EXISTS leaderboard_theme TEXT DEFAULT 'cyber',
    ADD COLUMN IF NOT EXISTS leaderboard_accent TEXT DEFAULT NULL;
