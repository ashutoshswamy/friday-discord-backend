-- ==========================================
-- Friday Discord Bot - Custom Commands Schema
-- ==========================================

-- Stores custom triggers (e.g. !rules) and their mapped text or rich embed JSON metadata.
CREATE TABLE IF NOT EXISTS custom_commands (
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    content TEXT,
    is_embed BOOLEAN DEFAULT FALSE,
    embed_data JSONB, -- Stores title, description, color, image, thumbnail in JSONB format
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (guild_id, name)
);
