-- ============================================================
-- MIGRATION: Move player creation from signup to email verification
-- 
-- Problem: The old trigger fires on INSERT into auth.users, which
-- happens at signup BEFORE email verification. This creates player
-- records for unverified accounts.
--
-- Solution: Replace with a trigger on UPDATE that checks when
-- email_confirmed_at transitions from NULL to a timestamp,
-- meaning the user just verified their email.
-- ============================================================

-- Drop the old trigger that fires on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create a new trigger function that only fires on email verification
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
    -- Only proceed if email_confirmed_at just changed from NULL to a value
    -- This means the user just verified their email
    IF OLD.email_confirmed_at IS NOT NULL THEN
        -- Already verified before, skip (prevents duplicate player creation)
        RETURN NEW;
    END IF;

    IF NEW.email_confirmed_at IS NULL THEN
        -- Still not verified, skip
        RETURN NEW;
    END IF;

    -- Check if player record already exists (safety guard)
    IF EXISTS (SELECT 1 FROM players WHERE id = NEW.id) THEN
        RETURN NEW;
    END IF;

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

-- New trigger fires on UPDATE (email verification updates the row)
CREATE TRIGGER on_auth_user_email_verified
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
    EXECUTE FUNCTION public.handle_new_user_signup();
