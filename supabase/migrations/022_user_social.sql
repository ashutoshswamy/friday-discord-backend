-- Migration 022: User social table (bio, rep, marriage)

CREATE TABLE IF NOT EXISTS user_social (
  guild_id            TEXT        NOT NULL,
  user_id             TEXT        NOT NULL,
  bio                 TEXT,
  rep_count           BIGINT      NOT NULL DEFAULT 0,
  last_rep_given_at   BIGINT      NOT NULL DEFAULT 0,
  partner_id          TEXT,
  married_at          TIMESTAMPTZ,
  PRIMARY KEY (guild_id, user_id)
);
