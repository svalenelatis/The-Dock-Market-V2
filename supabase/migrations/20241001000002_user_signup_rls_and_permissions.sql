-- ============================================================
-- CONSOLIDATED MIGRATION: User signup, RLS fixes, and table permissions
-- Combines: handle_new_user_signup, fix_rls_and_inventory_fk, grant_table_permissions
-- ============================================================


-- ============================================================
-- PART 1: Auto-create player account on auth signup
-- Creates: player record, default ship, 1 grain factory
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_city_id UUID;
    new_ship_id UUID;
BEGIN
    -- Pick Katu as the default home port (central hub city)
    SELECT id INTO default_city_id FROM cities WHERE name = 'Katu' LIMIT 1;

    -- Create the player record with auth.uid as the primary key
    INSERT INTO players (id, email, username, gold, home_port_id)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
        1000,  -- STARTING_GOLD
        default_city_id
    );

    -- Create a default starter ship docked at the home port
    INSERT INTO ships (id, player_id, name, speed, cargo_capacity, status, current_city_id)
    VALUES (
        gen_random_uuid(),
        NEW.id,
        'Starter Sloop',
        1,    -- STARTING_SHIP_SPEED
        100,  -- STARTING_SHIP_CAPACITY
        'READY',
        default_city_id
    )
    RETURNING id INTO new_ship_id;

    -- Create 1 Grain factory for the new player
    INSERT INTO factories (player_id, factory_type, input_requirements, output_production, active)
    VALUES (
        NEW.id,
        'Grain',
        '{}',                          -- Grain has no input requirements
        '{"item": "Grain", "quantity": 5}',  -- Produces 5 grain per cycle
        true
    );

    RETURN NEW;
END;
$$;

-- Trigger fires after a new user is inserted into auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();


-- ============================================================
-- PART 2: Add FK from inventory tables -> items.name
-- Enables PostgREST embedded queries like select('*, items(name)')
-- ============================================================

ALTER TABLE player_inventories
    ADD CONSTRAINT fk_player_inventories_item
    FOREIGN KEY (item_name) REFERENCES items(name);

ALTER TABLE ship_inventories
    ADD CONSTRAINT fk_ship_inventories_item
    FOREIGN KEY (item_name) REFERENCES items(name);


-- ============================================================
-- PART 3: Simplify RLS policies to use direct auth.uid() comparison
-- ============================================================

-- Players
DROP POLICY IF EXISTS "Users can view own player profile" ON players;
DROP POLICY IF EXISTS "Users can update own player profile" ON players;
DROP POLICY IF EXISTS "Users can insert own player profile" ON players;

CREATE POLICY "Users can view own player profile" ON players
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own player profile" ON players
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own player profile" ON players
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Player inventories
DROP POLICY IF EXISTS "Users can view own inventory" ON player_inventories;
DROP POLICY IF EXISTS "Users can modify own inventory" ON player_inventories;

CREATE POLICY "Users can view own inventory" ON player_inventories
    FOR SELECT USING (player_id = auth.uid());

CREATE POLICY "Users can modify own inventory" ON player_inventories
    FOR ALL USING (player_id = auth.uid());

-- Ships
DROP POLICY IF EXISTS "Users can view own ships" ON ships;
DROP POLICY IF EXISTS "Users can modify own ships" ON ships;

CREATE POLICY "Users can view own ships" ON ships
    FOR SELECT USING (player_id = auth.uid());

CREATE POLICY "Users can modify own ships" ON ships
    FOR ALL USING (player_id = auth.uid());

-- Ship inventories
DROP POLICY IF EXISTS "Users can view own ship inventories" ON ship_inventories;
DROP POLICY IF EXISTS "Users can modify own ship inventories" ON ship_inventories;

CREATE POLICY "Users can view own ship inventories" ON ship_inventories
    FOR SELECT USING (
        ship_id IN (SELECT id FROM ships WHERE player_id = auth.uid())
    );

CREATE POLICY "Users can modify own ship inventories" ON ship_inventories
    FOR ALL USING (
        ship_id IN (SELECT id FROM ships WHERE player_id = auth.uid())
    );

-- Transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can modify own transactions" ON transactions;

CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (player_id = auth.uid());

CREATE POLICY "Users can modify own transactions" ON transactions
    FOR ALL USING (player_id = auth.uid());

-- Factories
DROP POLICY IF EXISTS "Users can view own factories" ON factories;
DROP POLICY IF EXISTS "Users can modify own factories" ON factories;

CREATE POLICY "Users can view own factories" ON factories
    FOR SELECT USING (player_id = auth.uid());

CREATE POLICY "Users can modify own factories" ON factories
    FOR ALL USING (player_id = auth.uid());


-- ============================================================
-- PART 4: Table-level grants
-- RLS defines WHO can see WHICH rows, but the role needs base
-- permission to access the table at all.
-- ============================================================

-- Anon role (public data)
GRANT SELECT ON public.cities TO anon;
GRANT SELECT ON public.items TO anon;
GRANT SELECT ON public.city_tags TO anon;
GRANT SELECT ON public.random_events TO anon;

-- Authenticated role - public data
GRANT SELECT ON public.cities TO authenticated;
GRANT SELECT ON public.items TO authenticated;
GRANT SELECT ON public.city_tags TO authenticated;
GRANT SELECT ON public.random_events TO authenticated;

-- Authenticated role - player-owned data (RLS restricts to own rows)
GRANT SELECT, INSERT, UPDATE ON public.players TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_inventories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ship_inventories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.factories TO authenticated;

-- Admin tables - restricted via RLS, but role needs base access
GRANT SELECT ON public.admin_users TO authenticated;
GRANT SELECT ON public.admin_audit_log TO authenticated;
