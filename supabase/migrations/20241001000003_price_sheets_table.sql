-- Migration: Extract price_sheet JSONB and city tags into proper relational tables
-- Part 1: price_sheets junction table (one row per city/item)
-- Part 2: city_tag_assignments junction table (one row per city/tag relationship)

-- ============================================================
-- ============================================================
-- PART 1: PRICE SHEETS TABLE
-- ============================================================
-- ============================================================

-- ============================================================
-- 1. CREATE THE NEW price_sheets TABLE
-- ============================================================

CREATE TABLE public.price_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    price NUMERIC NOT NULL,
    demand_setpoint NUMERIC NOT NULL DEFAULT 1.0,
    integral NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city_id, item_id)
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX idx_price_sheets_city_id ON public.price_sheets(city_id);
CREATE INDEX idx_price_sheets_item_id ON public.price_sheets(item_id);

-- ============================================================
-- 3. AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE TRIGGER update_price_sheets_updated_at
    BEFORE UPDATE ON public.price_sheets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. TRIGGERS TO AUTO-GENERATE ROWS ON CITY/ITEM INSERT
-- ============================================================

-- When a new city is added, create a price_sheet row for every existing item
CREATE OR REPLACE FUNCTION generate_price_sheets_for_city()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.price_sheets (city_id, item_id, price)
    SELECT NEW.id, i.id, i.base_price
    FROM public.items i
    WHERE i.active = true;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_city_insert_price_sheets
    AFTER INSERT ON public.cities
    FOR EACH ROW EXECUTE FUNCTION generate_price_sheets_for_city();

-- When a new item is added, create a price_sheet row for every existing city
CREATE OR REPLACE FUNCTION generate_price_sheets_for_item()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.price_sheets (city_id, item_id, price)
    SELECT c.id, NEW.id, NEW.base_price
    FROM public.cities c;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_item_insert_price_sheets
    AFTER INSERT ON public.items
    FOR EACH ROW EXECUTE FUNCTION generate_price_sheets_for_item();

-- ============================================================
-- 5. DROP THE OLD price_sheet JSONB COLUMN FROM cities
-- ============================================================

ALTER TABLE public.cities DROP COLUMN price_sheet;

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.price_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view price sheets" ON public.price_sheets
    FOR SELECT USING (true);

CREATE POLICY "Service role full access to price sheets" ON public.price_sheets
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- 7. TABLE-LEVEL GRANTS
-- ============================================================

GRANT SELECT ON public.price_sheets TO anon;
GRANT SELECT ON public.price_sheets TO authenticated;

-- ============================================================
-- ============================================================
-- PART 2: CITY TAG ASSIGNMENTS
-- ============================================================
-- ============================================================

-- ============================================================
-- 8. DROP THE random_events TABLE (replaced by city_tag_assignments)
-- ============================================================

DROP INDEX IF EXISTS idx_random_events_city_id;
DROP INDEX IF EXISTS idx_random_events_active;
DROP INDEX IF EXISTS idx_random_events_dates;

DROP POLICY IF EXISTS "Anyone can view random events" ON public.random_events;
DROP POLICY IF EXISTS "Service role full access to random events" ON public.random_events;

DROP TABLE public.random_events;

-- ============================================================
-- 9. REPLACE tag_type ENUM with two booleans on city_tags
--    A tag can be permanent-eligible, event-eligible, or both.
-- ============================================================

ALTER TABLE public.city_tags DROP COLUMN tag_type;
ALTER TABLE public.city_tags ADD COLUMN can_be_permanent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.city_tags ADD COLUMN can_be_event BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 10. CREATE THE city_tag_assignments TABLE
-- ============================================================

CREATE TABLE public.city_tag_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.city_tags(id) ON DELETE CASCADE,
    is_permanent BOOLEAN NOT NULL DEFAULT true,
    expires_at DATE,
    active BOOLEAN NOT NULL DEFAULT true,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city_id, tag_id)
);

-- ============================================================
-- 11. INDEXES
-- ============================================================

CREATE INDEX idx_city_tag_assignments_city_id ON public.city_tag_assignments(city_id);
CREATE INDEX idx_city_tag_assignments_tag_id ON public.city_tag_assignments(tag_id);
CREATE INDEX idx_city_tag_assignments_active ON public.city_tag_assignments(active);
CREATE INDEX idx_city_tag_assignments_expires_at ON public.city_tag_assignments(expires_at)
    WHERE expires_at IS NOT NULL;

-- ============================================================
-- 12. DROP the tags TEXT[] column from cities
-- ============================================================

ALTER TABLE public.cities DROP COLUMN tags;

-- ============================================================
-- 13. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.city_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view city tag assignments" ON public.city_tag_assignments
    FOR SELECT USING (true);

CREATE POLICY "Service role full access to city tag assignments" ON public.city_tag_assignments
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- 14. TABLE-LEVEL GRANTS
-- ============================================================

GRANT SELECT ON public.city_tag_assignments TO anon;
GRANT SELECT ON public.city_tag_assignments TO authenticated;
