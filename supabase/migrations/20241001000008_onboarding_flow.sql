-- ============================================================
-- MIGRATION: Restructure new player onboarding
-- 
-- Changes:
-- 1. Add onboarding_complete column to players table
-- 2. Update trigger to only create player record (no ship/factory)
-- 3. Player gets 100 gold to start, onboarding_complete = false
-- 4. Ship and factory creation moves to an API call after onboarding UI
-- ============================================================

-- Add onboarding_complete flag to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT true;

-- Set all existing players as onboarding complete (they already have ships/factories)
UPDATE players SET onboarding_complete = true WHERE onboarding_complete = true;

-- Drop the old trigger
DROP TRIGGER IF EXISTS on_auth_user_email_verified ON auth.users;

-- Replace the trigger function: only creates a player record now
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_city_id UUID;
BEGIN
    -- Only proceed if email_confirmed_at just changed from NULL to a value
    IF OLD.email_confirmed_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.email_confirmed_at IS NULL THEN
        RETURN NEW;
    END IF;

    -- Check if player record already exists (safety guard)
    IF EXISTS (SELECT 1 FROM players WHERE id = NEW.id) THEN
        RETURN NEW;
    END IF;

    -- Pick Katu as the default home port (central hub city)
    SELECT id INTO default_city_id FROM cities WHERE name = 'Katu' LIMIT 1;

    -- Create the player record only — ship and factory come from onboarding UI
    INSERT INTO players (id, email, username, gold, home_port_id, onboarding_complete)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
        100,   -- Reduced starting gold (was 1000)
        default_city_id,
        false  -- Must complete onboarding flow
    );

    RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_email_verified
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
    EXECUTE FUNCTION public.handle_new_user_signup();
