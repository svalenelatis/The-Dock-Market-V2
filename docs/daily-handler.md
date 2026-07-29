# Daily Handler Documentation

## Overview

The Daily Handler is an Express endpoint that orchestrates all daily automated processes in Dock Market. It is triggered manually by an admin (or scheduled externally via cron/Railway cron) and performs three operations in sequence:

1. **Market Price Updates** — Recalculates all city price sheets using a PID-style market simulation algorithm
2. **Transaction Processing** — Resolves all pending transactions whose scheduled date has arrived
3. **Factory Production** — Runs all active factories, consuming inputs and producing outputs

## Architecture

### Endpoint Location
- **File**: `backend/routes/admin/daily-update.js`
- **Base URL**: `POST /api/admin/daily-update`
- **Authentication**: Admin middleware (requires valid admin session)

### Sub-Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/daily-update` | Run all three steps sequentially |
| POST | `/api/admin/daily-update/market` | Market update only |
| POST | `/api/admin/daily-update/transactions` | Transaction processing only |
| POST | `/api/admin/daily-update/factories` | Factory processing only |

## Parallel Data Fetching

Each processing step uses `Promise.all` to batch-fetch all required data in a single parallel round-trip before performing calculations in memory. This minimizes database latency.

### Market Update — Data Fetching
```javascript
const [citiesRes, itemsRes, priceSheetsRes, assignmentsRes] = await Promise.all([
  supabase.from('cities').select('id, name, volatility'),
  supabase.from('items').select('id, name, base_price, tags').eq('active', true),
  supabase.from('price_sheets').select('id, city_id, item_id, price, demand_setpoint, integral'),
  supabase.from('city_tag_assignments').select('city_id, tag_id, city_tags(id, name, effects)').eq('active', true),
])
```

### Transaction Processing — Data Fetching
```javascript
const [playersRes, shipsRes] = await Promise.all([
  supabase.from('players').select('id, gold, home_port_id').in('id', playerIds),
  supabase.from('ships').select('id, player_id, speed').in('id', shipIds),
])
```

### Factory Processing — Data Fetching
```javascript
const [invRes, playersRes] = await Promise.all([
  supabase.from('player_inventories').select('player_id, item_name, quantity').in('player_id', playerIds),
  supabase.from('players').select('id, gold').in('id', playerIds),
])
```

## Processing Pattern

All three steps follow the same pattern:

1. **Parallel fetch** — Grab all needed data in one round-trip
2. **Index in memory** — Build lookup maps for O(1) access
3. **Calculate in memory** — Run all logic without touching the database
4. **Batch write** — Flush results back to the database in batched upserts/inserts

This keeps network round-trips to a minimum and allows the handler to process hundreds of entities efficiently.

## Market Price Algorithm

The market simulation uses a PID-inspired controller to move prices toward demand-driven targets:

```
targetPrice = basePrice × (PRICE_MULTIPLIER_BASE + demandSetpoint × PRICE_MULTIPLIER_SCALE)
priceError  = targetPrice - currentPrice
integral    = (oldIntegral × INTEGRAL_DECAY) + (priceError × INTEGRAL_CONTRIBUTION)
newPrice    = currentPrice + (priceError × DAILY_MOMENTUM) + integral
```

### Tuning Constants
| Constant | Value | Purpose |
|----------|-------|---------|
| `PRICE_MULTIPLIER_BASE` | 0.2 | Floor multiplier on base price |
| `PRICE_MULTIPLIER_SCALE` | 0.9 | How much demand amplifies the target |
| `DAILY_MOMENTUM` | 0.3 | Proportional response to price error |
| `INTEGRAL_CONTRIBUTION` | 0.2 | Integral accumulation rate |
| `INTEGRAL_DECAY` | 0.9 | Integral decay per tick |
| `JITTER_INTENSITY` | 0.1 | Per-city volatility noise multiplier |

### Demand Setpoint
The demand setpoint starts at 1.0 and is modified by active city tag effects. Tags can boost or suppress demand for specific items or item categories.

### Jitter
Each city has a `volatility` field. After computing the new price, a random jitter of `±(volatility × JITTER_INTENSITY)` is applied as a percentage, preventing prices from feeling deterministic.

## Transaction Processing

### Lifecycle
1. Player creates a transaction with actions (buy/sell) and a `scheduled_date`
2. Transaction sits as `PENDING` until the daily handler runs on or after that date
3. Handler processes buys/sells against current city prices
4. Ship is set to `RETURNING` and a return-trip transaction is created
5. On the return date, the return transaction transfers ship inventory to the player

### Partial Fills
- **Buy**: If the player can't afford the full quantity, the handler buys as many as gold allows
- **Sell**: If the ship doesn't have enough of an item, it sells whatever is available
- Transactions are never marked `FAILED` for insufficient resources — they partial-fill instead

### Return Trips
After a trade completes, the handler:
1. Calculates the Euclidean distance between the target city and the player's home port
2. Divides by ship speed to get travel days
3. Creates a new `PENDING` transaction with `{ type: 'return' }` for that future date

## Factory Processing

### Requirements Check
Each factory has `input_requirements` (items/gold consumed) and `output_production` (item/gold produced). The handler supports multiple input formats for backwards compatibility:
- Array: `[{ item: "Grain", quantity: 10 }]`
- Single object: `{ item: "Grain", quantity: 10 }`
- Legacy map: `{ "Grain": 10, "Iron": 5 }`

Gold requirements are checked against the player's gold balance rather than inventory.

### Production
If all inputs are satisfied, the factory consumes them and produces the output. Multiple factories for the same player are processed sequentially so that one factory's output can feed another's input within the same tick.

## Response Format

```json
{
  "success": true,
  "elapsed_ms": 1234,
  "market": { "itemsUpdated": 252, "tagsRemoved": 2, "tagsAdded": 3 },
  "transactions": { "processed": 5, "failed": 0 },
  "factories": { "processed": 8, "skipped": 2, "failed": 0 },
  "errors": []
}
```

Status code is `200` on full success, `207` if any step had errors.

## Error Handling

- Each of the three top-level steps is wrapped in its own try/catch — a failure in one does not block the others
- Within transaction processing, individual transaction failures are caught and logged; the transaction is marked `FAILED` and its ship is recovered with a return trip
- All errors are collected in the response `errors` array
- Structured logging via Pino provides full context for debugging

## Audit Trail

Every daily update invocation is recorded in the `admin_audit_log` table with:
- The admin user who triggered it
- Elapsed time
- Full results object
