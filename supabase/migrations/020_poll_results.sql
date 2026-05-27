-- Migration 020: Store poll results when a poll is closed
ALTER TABLE polls ADD COLUMN IF NOT EXISTS results JSONB;
-- results shape: [{ text: string, count: number, pct: number, winner: boolean }]
