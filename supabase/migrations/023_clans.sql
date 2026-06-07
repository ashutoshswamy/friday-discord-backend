-- Migration 023: Clans and clan members tables

CREATE TABLE IF NOT EXISTS clans (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id    TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  owner_id    TEXT        NOT NULL,
  treasury    BIGINT      NOT NULL DEFAULT 0,
  xp_total    BIGINT      NOT NULL DEFAULT 0,
  level       INT         NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clans_guild_id ON clans (guild_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clans_guild_name ON clans (guild_id, lower(name));

CREATE TABLE IF NOT EXISTS clan_members (
  clan_id     UUID        NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  guild_id    TEXT        NOT NULL,
  user_id     TEXT        NOT NULL,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_clan_members_clan_id ON clan_members (clan_id);
