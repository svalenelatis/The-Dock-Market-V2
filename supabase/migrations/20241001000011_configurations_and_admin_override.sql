-- Migration: Create configurations table and add is_admin_override to city_tags
-- Requirements: 12.1, 12.2, 12.3, 8.2

-- ============================================================
-- CREATE CONFIGURATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS configurations (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at on row modification
CREATE TRIGGER update_configurations_updated_at
    BEFORE UPDATE ON configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED INITIAL CONFIGURATION ENTRIES
-- ============================================================

INSERT INTO configurations (key, value)
VALUES
    ('ship_speed_scalar', '1.0'::jsonb),
    ('random_tag_chance', '0.25'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ADD is_admin_override COLUMN TO city_tags
-- ============================================================

ALTER TABLE city_tags
    ADD COLUMN IF NOT EXISTS is_admin_override BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- ROW LEVEL SECURITY FOR CONFIGURATIONS
-- ============================================================

ALTER TABLE configurations ENABLE ROW LEVEL SECURITY;

-- Anyone can read configurations (needed for game logic)
CREATE POLICY "Anyone can view configurations" ON configurations
    FOR SELECT USING (true);

-- Service role full access for admin operations
CREATE POLICY "Service role full access to configurations" ON configurations
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
