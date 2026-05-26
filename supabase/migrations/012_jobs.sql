-- Migration 012: Add job columns to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS current_job TEXT DEFAULT NULL;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS job_applied_at BIGINT DEFAULT 0;
