-- ============================================================
-- MIGRATION: Restrict inventory tables to SELECT-only for authenticated users
--
-- Problem: Players currently have INSERT/UPDATE/DELETE on their own inventory
-- rows via RLS. This means a malicious client can directly call Supabase
-- and conjure items out of thin air.
--
-- Solution: Drop the permissive "ALL" policies and replace with SELECT-only.
-- All mutations now go through the Express backend using the service role key.
-- ============================================================

-- === Player Inventories ===

-- Drop the old permissive policy that allowed full CRUD
DROP POLICY IF EXISTS "Users can modify own inventory" ON player_inventories;

-- Keep the SELECT policy (already exists, but recreate to be explicit)
DROP POLICY IF EXISTS "Users can view own inventory" ON player_inventories;
CREATE POLICY "Users can view own inventory" ON player_inventories
    FOR SELECT USING (player_id = auth.uid());

-- === Ship Inventories ===

-- Drop the old permissive policy that allowed full CRUD
DROP POLICY IF EXISTS "Users can modify own ship inventories" ON ship_inventories;

-- Keep the SELECT policy (already exists, but recreate to be explicit)
DROP POLICY IF EXISTS "Users can view own ship inventories" ON ship_inventories;
CREATE POLICY "Users can view own ship inventories" ON ship_inventories
    FOR SELECT USING (
        ship_id IN (SELECT id FROM ships WHERE player_id = auth.uid())
    );

-- === Revoke direct DML grants (mutations go through service role) ===

-- Player inventories: remove INSERT, UPDATE, DELETE from authenticated role
REVOKE INSERT, UPDATE, DELETE ON public.player_inventories FROM authenticated;

-- Ship inventories: remove INSERT, UPDATE, DELETE from authenticated role
REVOKE INSERT, UPDATE, DELETE ON public.ship_inventories FROM authenticated;
