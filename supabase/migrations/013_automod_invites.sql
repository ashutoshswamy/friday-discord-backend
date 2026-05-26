-- Add Discord invite filter toggle to guild_configs
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS automod_invites BOOLEAN DEFAULT false;
