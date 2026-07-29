/**
 * JSDoc type definitions for all database entities.
 * This file contains no runtime code — it exists solely for editor intellisense support.
 */

// ─── Cities Table ───────────────────────────────────────────────────────────────

/** @typedef {object} City
 * @property {string} id - UUID
 * @property {string} name
 * @property {number} volatility - 0 to 1
 * @property {{ x: number, y: number }} location
 * @property {string} updated_at - ISO timestamp
 */

// ─── Items Table ────────────────────────────────────────────────────────────────

/** @typedef {object} Item
 * @property {string} id - UUID
 * @property {string} name
 * @property {number} base_price
 * @property {string[]} [components] - Array of component item names
 * @property {string[]} [tags] - Array of item tag names
 * @property {boolean} active
 */

// ─── Price Sheets Table (one row per city/item combination) ─────────────────────

/** @typedef {object} PriceSheet
 * @property {string} id - UUID
 * @property {string} city_id - UUID
 * @property {string} item_id - UUID
 * @property {number} price - Current market price
 * @property {number} demand_setpoint - Target demand value from tags
 * @property {number} integral - PID integral accumulator
 * @property {string} updated_at - ISO timestamp
 */

// ─── Players Table ──────────────────────────────────────────────────────────────

/** @typedef {object} Player
 * @property {string} id - UUID (matches Supabase auth.uid())
 * @property {string} email
 * @property {number} gold
 * @property {string} home_port_id - UUID reference to cities
 * @property {string} created_at
 */

// ─── Ships Table ────────────────────────────────────────────────────────────────

/** @typedef {object} Ship
 * @property {string} id - UUID
 * @property {string} player_id - UUID
 * @property {string} name
 * @property {number} speed
 * @property {number} cargo_space
 * @property {string} status - 'READY' | 'TRAVELING'
 * @property {string} created_at
 */

// ─── Transactions Table ─────────────────────────────────────────────────────────

/** @typedef {object} Transaction
 * @property {string} id - UUID
 * @property {string} player_id - UUID
 * @property {string} ship_id - UUID
 * @property {string} transaction_type - 'BUY' | 'SELL' | 'TRANSFER'
 * @property {TransactionActionSet} actions - Wrapped action array
 * @property {string} target_city_id - UUID
 * @property {string} scheduled_date - YYYY-MM-DD (arrival date)
 * @property {string} status - 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED'
 * @property {string} created_at
 */

/** @typedef {object} TransactionActionSet
 * @property {TransactionAction[]} action
 */

/** @typedef {object} TransactionAction
 * @property {'buy'|'sell'|'return'|'changeGold'|'add'|'subtract'} type
 * @property {string} [itemName]
 * @property {number} [quantity]
 * @property {number} [amount]
 */

// ─── City Tags Table (tag definitions) ──────────────────────────────────────────

/** @typedef {object} CityTag
 * @property {string} id - UUID
 * @property {string} name
 * @property {string} description
 * @property {{ goods: Object<string, number>, tags: Object<string, number> }} effects
 * @property {boolean} can_be_permanent - Eligible as a base-layer city trait
 * @property {boolean} can_be_event - Eligible for random event assignment
 * @property {boolean} active
 */

// ─── City Tag Assignments Table (junction: city ↔ tag) ──────────────────────────

/** @typedef {object} CityTagAssignment
 * @property {string} id - UUID
 * @property {string} city_id - UUID
 * @property {string} tag_id - UUID
 * @property {boolean} is_permanent - true for base-layer, false for events
 * @property {string|null} expires_at - YYYY-MM-DD or null for permanent
 * @property {boolean} active
 * @property {string} assigned_at - ISO timestamp
 */

// ─── Admin Users Table ──────────────────────────────────────────────────────────

/** @typedef {object} AdminUser
 * @property {string} id - UUID (matches Supabase auth user)
 * @property {string} email
 * @property {'admin'|'super_admin'} role
 * @property {string} created_at
 */
