-- Migration 001: Add onboarding columns to guild_configs
--
-- The original automod.sql created guild_configs without welcome/onboarding
-- columns. This migration adds them safely if they don't already exist.
--
-- Run this ONCE in: Supabase Dashboard → SQL Editor

ALTER TABLE guild_configs
    ADD COLUMN IF NOT EXISTS welcome_channel_id TEXT,
    ADD COLUMN IF NOT EXISTS welcome_message TEXT,
    ADD COLUMN IF NOT EXISTS auto_role_id TEXT;
