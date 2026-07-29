# Admin Panel Implementation Notes

Post-implementation fixes and decisions made during the admin panel buildout. This doc covers schema mismatches that were discovered at runtime, routing quirks, and architectural decisions future devs should be aware of.

---

## Schema Mismatches (Column Name Fixes)

The admin panel spec was written against an assumed schema. When routes hit the actual database, PostgreSQL returned `42703` (undefined column) errors. Here's the complete mapping of what the routes originally referenced vs what actually exists:

| Table | Route originally used | Actual DB column | Notes |
|-------|----------------------|------------------|-------|
| `ships` | `cargo_space` | `cargo_capacity` | The initial schema uses `cargo_capacity`. Migration 006 dropped `inventory` and `eta` columns but never renamed this. |
| `factories` | `type` | `factory_type` | Every migration and trigger uses `factory_type`. |
| `admin_audit_log` | `audit_logs` | `admin_audit_log` | The design doc called it `audit_logs` but the actual table created in migration 001 is `admin_audit_log`. |
| `players` | `archived` | *(didn't exist)* | Added via migration 012. |
| `city_tag_assignments` | `is_admin_override` | *(doesn't exist on this table)* | `is_admin_override` lives on `city_tags`, not on the assignment junction table. |

**Files affected by these fixes:** `players.js`, `ships.js`, `inventory.js`, `factories.js`, `price-overrides.js`, `configurations.js`, `items.js`, `cities.js`, `city-tags.js`, `random-events.js`, `users.js`, `daily-update.js` — basically every route file that writes audit logs.

**Frontend files affected:** `ShipInventoryInline.jsx` (`cargo_space` → `cargo_capacity`), `PlayerDetailPanel.jsx` (`factory.type` → `factory.factory_type`).

---

## Migration 012: `archived` Column

```sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_players_archived ON players (archived);
```

This was missing entirely. The player search and archive/unarchive functionality depends on it. Must be applied before admin panel features work.

---

## Route Architecture Decisions

### City Tag Assignments: Dual Access Paths

The `city_tag_assignments` table is accessed through **two different route files** depending on context:

1. **`/api/admin/random-events`** — The original route (pre-admin-panel). Manages temporary event assignments only (`is_permanent: false`). Used by the random events management UI.

2. **`/api/admin/city-tags/assignments`** — Added during admin panel work. Manages both permanent and temporary assignments. Used by the Game Objects → Tags tab. Supports `is_permanent: true` assignments that the random-events route doesn't.

This is intentional duplication — the random-events route has stricter validation (requires `expires_at`, forces `is_permanent: false`) because it's specifically for temporary market events. The city-tags assignments route is more general-purpose.

### Price Overrides: How Admin Tags Work

The price override system doesn't have its own table. It works by:

1. Creating a `city_tag` with `is_admin_override: true` (column on `city_tags` table)
2. Creating a `city_tag_assignment` linking that tag to a city
3. The daily handler processes admin tags identically to regular tags — the override flag is just for filtering in the admin UI

**Querying admin overrides** requires an `!inner` join in Supabase:
```js
supabase
  .from('city_tag_assignments')
  .select('*, city_tags!inner(*)')
  .eq('active', true)
  .eq('city_tags.is_admin_override', true)
```

Without `!inner`, PostgREST ignores the foreign table filter and returns all rows with `city_tags` as null. This is a Supabase/PostgREST gotcha.

### Ship Inventory: Missing GET Endpoint

The inventory route (`/api/admin/inventory`) was built with only mutation endpoints (POST, PUT, DELETE). The `ShipInventoryInline` frontend component needed a GET endpoint to fetch inventory when expanding a ship. Added:

```
GET /api/admin/inventory/ship/:shipId → returns [{ item_name, quantity }]
```

Player inventory doesn't need a separate GET because it's included in the player detail response (`GET /api/admin/players/:id`).

---

## Security: UUIDs in URLs

Player/ship/factory UUIDs appear in request URLs (e.g., `/api/admin/players/ea311836-c1f7-4b5c-...`). This is safe because:

- All admin routes sit behind the `adminAuth` middleware array (`[authMiddleware, adminMiddleware]`)
- `authMiddleware` verifies the JWT token
- `adminMiddleware` checks the `admin_users` table for `admin` or `super_admin` role
- UUIDs are 128-bit random — not enumerable or guessable
- The service role Supabase client bypasses RLS, so row-level policies don't interfere with admin queries

The security boundary is authentication + authorization, not URL obscurity.

---

## Supabase Client: Service Role vs User Client

The backend uses the **service role client** (`SUPABASE_SERVICE_ROLE_KEY`) for all admin operations. This bypasses RLS entirely. The auth middleware still validates the user's JWT and checks admin status before any route handler runs — the service role is just for database access without row-level restrictions getting in the way.

Never expose the service role key to the frontend or use it in user-facing code paths.

---

## Effects Object Structure

City tag effects use a nested structure in the database:
```json
{
  "goods": { "Iron": 3, "Wood": -2 },
  "tags": { "luxury": -1 }
}
```

The frontend effects display logic (in `PriceOverrideSection` and `TagsManager`) handles both this nested format and a potential flat format as a fallback. When creating admin tags, the `PriceOverrideSection` form builds a flat key-value object — this works because `validateAdminTag` checks that all values are between -10 and 10 regardless of nesting.

---

## Frontend: API Call Patterns

Two patterns exist in the frontend for making API calls:

1. **`apiCall()` from `../../lib/api`** — Used by most components. Handles auth token injection, JSON parsing, and error extraction. Preferred.

2. **Direct `fetch()` with `import.meta.env.VITE_API_URL`** — Used by `ShipInventoryInline`, `DailyHandlerWidget`, and `PriceOverrideSection`. These were written before the `apiCall` utility was consistently adopted.

Both work fine. If consolidating, migrate the direct `fetch()` calls to use `apiCall()`.

---

## Test Coverage

After all fixes: **71 backend tests + 180 frontend tests = 251 total**, all passing.

The optional property-based tests and route unit tests (tasks marked `*` in the spec) were not implemented during this round. They're still available as future work for hardening.
