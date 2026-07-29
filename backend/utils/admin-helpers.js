/**
 * Admin helper utilities for player search, cargo checks, and config derivation.
 * All functions are pure — no side effects or external dependencies.
 */

/**
 * Filters players by email with case-insensitive partial matching.
 * Returns at most 10 results. Query must be at least 2 characters.
 *
 * @param {Array<{ email: string, archived: boolean }>} players - Array of player objects
 * @param {string} query - Search string (minimum 2 chars to produce results)
 * @param {boolean} [includeArchived=false] - When false, excludes archived players
 * @returns {Array<{ email: string, archived: boolean }>} Matching players (max 10)
 */
function filterPlayersByEmail(players, query, includeArchived) {
  if (!query || typeof query !== 'string' || query.length < 2) return []
  if (!Array.isArray(players)) return []

  const lowerQuery = query.toLowerCase()

  return players
    .filter(player => {
      if (!includeArchived && player.archived) return false
      return typeof player.email === 'string' && player.email.toLowerCase().includes(lowerQuery)
    })
    .slice(0, 10)
}

/**
 * Checks whether adding cargo would exceed ship capacity.
 *
 * @param {number} currentCargo - Current total items in ship
 * @param {number} addQuantity - Quantity being added
 * @param {number} shipCapacity - Maximum cargo capacity
 * @returns {{ allowed: boolean, remaining: number }} Whether the add is allowed and remaining space before the add
 */
function checkCargoCapacity(currentCargo, addQuantity, shipCapacity) {
  const allowed = currentCargo + addQuantity <= shipCapacity
  const remaining = shipCapacity - currentCargo

  return { allowed, remaining }
}

/**
 * Merges two inventory quantities into a single total.
 *
 * @param {number} existingQty - Current quantity in inventory
 * @param {number} addQty - Quantity to add
 * @returns {number} The merged total
 */
function mergeInventoryQuantity(existingQty, addQty) {
  return existingQty + addQty
}

/**
 * Derives the appropriate input type for an admin config value.
 *
 * @param {*} value - The config value to inspect
 * @returns {'number' | 'boolean' | 'string'} The derived input type
 */
function deriveConfigInputType(value) {
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'string'
}

module.exports = {
  filterPlayersByEmail,
  checkCargoCapacity,
  mergeInventoryQuantity,
  deriveConfigInputType,
}
