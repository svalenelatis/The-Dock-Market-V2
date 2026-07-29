-- ============================================================
-- MIGRATION 009: Fix cascade deletion from auth.users to player data
--
-- Problem: The players table uses auth.users.id as its primary key
-- (inserted by the signup trigger), but has no foreign key reference
-- back to auth.users. When an auth user is deleted, their player
-- record (and all downstream data) is orphaned.
--
-- The child tables (ships, factories, transactions, player_inventories)
-- already cascade from players(id). Ships cascade to ship_inventories.
-- So the only missing link is auth.users → players.
--
-- Fix: Add a FK constraint from players.id to auth.users(id) ON DELETE CASCADE.
-- This ensures deleting an auth user cascades through:
--   auth.users → players → ships → ship_inventories
--                        → factories
--                        → transactions
--                        → player_inventories
-- ============================================================

ALTER TABLE players
    ADD CONSTRAINT fk_players_auth_user
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
