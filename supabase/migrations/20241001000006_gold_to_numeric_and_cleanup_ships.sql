-- ============================================================
-- MIGRATION: Change player gold to NUMERIC, drop unused ships columns
--
-- 1. players.gold: INTEGER → NUMERIC(12,2) to support decimal prices
-- 2. ships.inventory: JSONB column no longer used (ship_inventories table replaced it)
-- 3. ships.eta: TIMESTAMP column no longer used (scheduled_date on transactions replaced it)
-- ============================================================

-- Change gold from INTEGER to NUMERIC(12,2) to support decimal market prices
ALTER TABLE players
    ALTER COLUMN gold TYPE NUMERIC(12,2);

-- Drop the legacy inventory JSONB column (replaced by ship_inventories table)
ALTER TABLE ships
    DROP COLUMN IF EXISTS inventory;

-- Drop the legacy eta column (replaced by scheduled_date on transactions)
ALTER TABLE ships
    DROP COLUMN IF EXISTS eta;
