-- Migration 015: Add poller tracking columns to alert tables
-- last_video_id: prevents duplicate YouTube upload pings
-- is_live: prevents duplicate Twitch go-live pings

ALTER TABLE youtube_alerts ADD COLUMN IF NOT EXISTS last_video_id TEXT DEFAULT NULL;
ALTER TABLE twitch_alerts  ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;
