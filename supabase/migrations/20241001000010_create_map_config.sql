-- Migration: Create map_config table
-- Stores coordinate bounds for the interactive map marketboard.
-- Singleton pattern — only one row exists. The frontend fetches the first row.

-- ============================================================
-- 1. CREATE THE map_config TABLE
-- ============================================================

CREATE TABLE public.map_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    x_min FLOAT8 NOT NULL DEFAULT -5,
    x_max FLOAT8 NOT NULL DEFAULT 5,
    y_min FLOAT8 NOT NULL DEFAULT -5,
    y_max FLOAT8 NOT NULL DEFAULT 5,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE TRIGGER update_map_config_updated_at
    BEFORE UPDATE ON public.map_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.map_config ENABLE ROW LEVEL SECURITY;

-- Public read: anyone (including anon) can view the map config
CREATE POLICY "Anyone can view map config" ON public.map_config
    FOR SELECT USING (true);

-- Admin-only write: only authenticated users with an admin_users row can modify
CREATE POLICY "Admins can update map config" ON public.map_config
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can insert map config" ON public.map_config
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can delete map config" ON public.map_config
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid()
        )
    );

-- Service role full access (for backend operations)
CREATE POLICY "Service role full access to map config" ON public.map_config
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- 4. TABLE-LEVEL GRANTS
-- ============================================================

GRANT SELECT ON public.map_config TO anon;
GRANT SELECT ON public.map_config TO authenticated;

-- ============================================================
-- 5. INSERT DEFAULT ROW
-- ============================================================

INSERT INTO public.map_config (x_min, x_max, y_min, y_max)
VALUES (-5, 5, -5, 5);
