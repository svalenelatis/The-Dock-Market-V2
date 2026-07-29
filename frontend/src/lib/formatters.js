/**
 * UI formatting helpers for the Naval Trading Simulator frontend.
 * Pure functions for displaying game data in a human-readable format.
 */

/**
 * Formats a gold amount for display with locale-aware thousands separators.
 * Returns '0' for null/undefined/NaN values.
 *
 * @param {number|null|undefined} amount - Gold amount to format
 * @returns {string} Formatted gold string (e.g., "1,500")
 */
export function formatGold(amount) {
  if (amount == null || Number.isNaN(amount)) {
    return '0'
  }
  return Number(amount).toLocaleString('en-US')
}

/**
 * Formats a price value for display, returning '—' for missing values.
 *
 * @param {number|null|undefined} price - Price to format
 * @returns {string} Formatted price or em-dash placeholder
 */
export function formatPrice(price) {
  if (price == null || Number.isNaN(price)) {
    return '—'
  }
  return Number(price).toLocaleString('en-US')
}

/**
 * Formats a ship status string for display (capitalizes first letter).
 *
 * @param {string|null|undefined} status - Ship status (e.g., 'ready', 'traveling')
 * @returns {string} Display-friendly status
 */
export function formatShipStatus(status) {
  if (!status || typeof status !== 'string') {
    return 'Unknown'
  }
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

/**
 * Formats a quantity for cargo/inventory display (e.g., "x5").
 *
 * @param {number|null|undefined} quantity - Item quantity
 * @returns {string} Formatted quantity string
 */
export function formatQuantity(quantity) {
  if (quantity == null || Number.isNaN(quantity) || quantity < 0) {
    return 'x0'
  }
  return `x${Math.floor(quantity)}`
}

/**
 * Formats a numeric price value as a currency string with exactly two decimal places.
 * Returns a string in the format `$X.XX`.
 *
 * @param {number} price - Numeric price value
 * @returns {string} Formatted currency string (e.g., "$10.00", "$0.50", "$1234.56")
 */
export function formatCurrency(price) {
  return `$${Number(price).toFixed(2)}`
}

/**
 * Sorts an array of price entries alphabetically by item name.
 *
 * @param {Array<{itemName: string, price: number}>} entries - Price entries to sort
 * @returns {Array<{itemName: string, price: number}>} New array sorted alphabetically by itemName
 */
export function sortPriceEntries(entries) {
  return [...entries].sort((a, b) => a.itemName.localeCompare(b.itemName))
}
