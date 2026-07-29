-- Naval Trading Simulator - Complete Database Schema
-- Single consolidated migration for fresh Supabase instances

-- ============================================================
-- TABLES
-- ============================================================

-- Players table
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    gold INTEGER NOT NULL DEFAULT 1000,
    home_port_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cities table
CREATE TABLE cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    volatility DECIMAL(3,2) NOT NULL DEFAULT 0.1,
    location JSONB NOT NULL,
    price_sheet JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Items table
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    base_price INTEGER NOT NULL,
    components TEXT[] DEFAULT '{}',
    tags TEXT[] NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT true
);

-- Ships table
CREATE TABLE ships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    speed INTEGER NOT NULL DEFAULT 1,
    cargo_capacity INTEGER NOT NULL DEFAULT 100,
    status TEXT NOT NULL DEFAULT 'READY' CHECK (status IN ('READY', 'TRAVELING', 'RETURNING')),
    current_city_id UUID REFERENCES cities(id),
    inventory JSONB NOT NULL DEFAULT '[]',
    eta TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Factories table
CREATE TABLE factories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    factory_type TEXT NOT NULL,
    input_requirements JSONB NOT NULL DEFAULT '{}',
    output_production JSONB NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    ship_id UUID NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('BUY', 'SELL', 'TRANSFER')),
    actions JSONB NOT NULL DEFAULT '[]',
    target_city_id UUID NOT NULL REFERENCES cities(id),
    scheduled_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'EXECUTING', 'COMPLETED', 'FAILED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player inventories table
CREATE TABLE player_inventories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(player_id, item_name)
);

-- Ship inventories table
CREATE TABLE ship_inventories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ship_id UUID NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(ship_id, item_name)
);

-- City tags table
CREATE TABLE city_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    effects JSONB NOT NULL DEFAULT '{"goods": {}, "tags": {}}',
    tag_type TEXT NOT NULL DEFAULT 'PERMANENT' CHECK (tag_type IN ('PERMANENT', 'TEMPORARY')),
    active BOOLEAN NOT NULL DEFAULT true
);

-- Random events table
CREATE TABLE random_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES city_tags(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin users table
CREATE TABLE admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'super_admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin audit log table
CREATE TABLE admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- DEFERRED FOREIGN KEYS
-- ============================================================

ALTER TABLE players
    ADD CONSTRAINT fk_players_home_port
    FOREIGN KEY (home_port_id) REFERENCES cities(id);

-- ============================================================
-- INDEXES
-- ============================================================

-- Players
CREATE INDEX idx_players_email ON players(email);
CREATE INDEX idx_players_username ON players(username);

-- Ships
CREATE INDEX idx_ships_player_id ON ships(player_id);
CREATE INDEX idx_ships_current_city_id ON ships(current_city_id);
CREATE INDEX idx_ships_status ON ships(status);

-- Factories
CREATE INDEX idx_factories_player_id ON factories(player_id);

-- Transactions
CREATE INDEX idx_transactions_player_id ON transactions(player_id);
CREATE INDEX idx_transactions_ship_id ON transactions(ship_id);
CREATE INDEX idx_transactions_scheduled_date ON transactions(scheduled_date);
CREATE INDEX idx_transactions_status ON transactions(status);

-- Player inventories
CREATE INDEX idx_player_inventories_player_id ON player_inventories(player_id);
CREATE INDEX idx_player_inventories_item_name ON player_inventories(item_name);

-- Ship inventories
CREATE INDEX idx_ship_inventories_ship_id ON ship_inventories(ship_id);
CREATE INDEX idx_ship_inventories_item_name ON ship_inventories(item_name);

-- Random events
CREATE INDEX idx_random_events_city_id ON random_events(city_id);
CREATE INDEX idx_random_events_active ON random_events(active);
CREATE INDEX idx_random_events_dates ON random_events(start_date, end_date);

-- Admin audit log
CREATE INDEX idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX idx_admin_audit_log_timestamp ON admin_audit_log(timestamp);
CREATE INDEX idx_admin_audit_log_entity ON admin_audit_log(entity_type, entity_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_players_updated_at
    BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cities_updated_at
    BEFORE UPDATE ON cities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ships_updated_at
    BEFORE UPDATE ON ships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_factories_updated_at
    BEFORE UPDATE ON factories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_inventories_updated_at
    BEFORE UPDATE ON player_inventories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ship_inventories_updated_at
    BEFORE UPDATE ON ship_inventories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ships ENABLE ROW LEVEL SECURITY;
ALTER TABLE ship_inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE factories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE random_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PUBLIC READ-ONLY POLICIES (Market data accessible to anyone, including anon)
-- =============================================================================

CREATE POLICY "Anyone can view cities" ON cities
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view items" ON items
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view city tags" ON city_tags
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view random events" ON random_events
    FOR SELECT USING (true);

-- =============================================================================
-- PLAYER-SCOPED POLICIES (Users can only access their own data)
-- =============================================================================

-- Players
CREATE POLICY "Users can view own player profile" ON players
    FOR SELECT USING (auth.uid()::text = email OR auth.uid()::text = id::text);

CREATE POLICY "Users can update own player profile" ON players
    FOR UPDATE USING (auth.uid()::text = email OR auth.uid()::text = id::text);

CREATE POLICY "Users can insert own player profile" ON players
    FOR INSERT WITH CHECK (auth.uid()::text = email OR auth.uid()::text = id::text);

-- Player inventories
CREATE POLICY "Users can view own inventory" ON player_inventories
    FOR SELECT USING (
        player_id IN (
            SELECT id FROM players WHERE auth.uid()::text = email OR auth.uid()::text = id::text
        )
    );

CREATE POLICY "Users can modify own inventory" ON player_inventories
    FOR ALL USING (
        player_id IN (
            SELECT id FROM players WHERE auth.uid()::text = email OR auth.uid()::text = id::text
        )
    );

-- Ships
CREATE POLICY "Users can view own ships" ON ships
    FOR SELECT USING (
        player_id IN (
            SELECT id FROM players WHERE auth.uid()::text = email OR auth.uid()::text = id::text
        )
    );

CREATE POLICY "Users can modify own ships" ON ships
    FOR ALL USING (
        player_id IN (
            SELECT id FROM players WHERE auth.uid()::text = email OR auth.uid()::text = id::text
        )
    );

-- Ship inventories
CREATE POLICY "Users can view own ship inventories" ON ship_inventories
    FOR SELECT USING (
        ship_id IN (
            SELECT s.id FROM ships s
            JOIN players p ON s.player_id = p.id
            WHERE auth.uid()::text = p.email OR auth.uid()::text = p.id::text
        )
    );

CREATE POLICY "Users can modify own ship inventories" ON ship_inventories
    FOR ALL USING (
        ship_id IN (
            SELECT s.id FROM ships s
            JOIN players p ON s.player_id = p.id
            WHERE auth.uid()::text = p.email OR auth.uid()::text = p.id::text
        )
    );

-- Transactions
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (
        player_id IN (
            SELECT id FROM players WHERE auth.uid()::text = email OR auth.uid()::text = id::text
        )
    );

CREATE POLICY "Users can modify own transactions" ON transactions
    FOR ALL USING (
        player_id IN (
            SELECT id FROM players WHERE auth.uid()::text = email OR auth.uid()::text = id::text
        )
    );

-- Factories
CREATE POLICY "Users can view own factories" ON factories
    FOR SELECT USING (
        player_id IN (
            SELECT id FROM players WHERE auth.uid()::text = email OR auth.uid()::text = id::text
        )
    );

CREATE POLICY "Users can modify own factories" ON factories
    FOR ALL USING (
        player_id IN (
            SELECT id FROM players WHERE auth.uid()::text = email OR auth.uid()::text = id::text
        )
    );

-- =============================================================================
-- ADMIN POLICIES
-- =============================================================================

-- Admin users can read their own data
CREATE POLICY "Admin users can read own data" ON admin_users
    FOR SELECT USING (auth.uid() = id);

-- Super admins can manage admin users
CREATE POLICY "Super admins can manage admin users" ON admin_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Admins can read audit logs
CREATE POLICY "Admins can read audit logs" ON admin_audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

-- System can insert audit logs (service role)
CREATE POLICY "System can insert audit logs" ON admin_audit_log
    FOR INSERT WITH CHECK (true);

-- =============================================================================
-- SERVICE ROLE BYPASS (Server-side operations via service_role key)
-- =============================================================================

CREATE POLICY "Service role full access to players" ON players
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to player inventories" ON player_inventories
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to ships" ON ships
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to ship inventories" ON ship_inventories
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to transactions" ON transactions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to factories" ON factories
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to cities" ON cities
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to items" ON items
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to city tags" ON city_tags
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to random events" ON random_events
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to admin users" ON admin_users
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to admin audit log" ON admin_audit_log
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
