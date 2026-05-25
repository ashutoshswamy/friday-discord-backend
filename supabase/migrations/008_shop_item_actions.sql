-- Add action columns to shop_items table to allow custom consumables/prizes
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS action_type TEXT;
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS action_value INT;

-- Comment describing usage:
-- action_type: 'XP' (adds XP to user), 'COINS' (adds coins to wallet), or null (regular item)
-- action_value: The amount of XP or coins to grant
