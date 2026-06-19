-- ==========================================
-- Friday Discord Bot - Command Cooldowns Table
-- ==========================================

CREATE TABLE IF NOT EXISTS command_cooldowns (
    user_id     TEXT    NOT NULL,
    command     TEXT    NOT NULL,
    expires_at  BIGINT  NOT NULL,
    PRIMARY KEY (user_id, command)
);

CREATE INDEX IF NOT EXISTS idx_command_cooldowns_user ON command_cooldowns (user_id);
