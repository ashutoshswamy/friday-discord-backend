-- Alter user_profiles table to add bank column if it doesn't already exist
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bank BIGINT DEFAULT 0;
