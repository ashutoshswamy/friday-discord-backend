ALTER TABLE guild_configs
    ADD COLUMN IF NOT EXISTS welcome_card_theme TEXT DEFAULT 'cyber',
    ADD COLUMN IF NOT EXISTS welcome_card_accent TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS welcome_card_enabled BOOLEAN DEFAULT false;
