ALTER TABLE guild_configs
    ADD COLUMN IF NOT EXISTS rank_card_theme TEXT DEFAULT 'cyber',
    ADD COLUMN IF NOT EXISTS rank_card_accent TEXT DEFAULT NULL;
