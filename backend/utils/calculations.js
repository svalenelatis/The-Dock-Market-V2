/**
 * Pure utility functions for game calculations.
 * No side effects, no database access — just math.
 */

/**
 * Calculates travel time in days between two coordinate points at a given speed.
 *
 * @param {number} x1 - Origin X coordinate
 * @param {number} y1 - Origin Y coordinate
 * @param {number} x2 - Destination X coordinate
 * @param {number} y2 - Destination Y coordinate
 * @param {number} speed - Ship speed (units per day)
 * @returns {number} Travel time in days (minimum 1, rounded up)
 */
function calculateTravelTime(x1, y1, x2, y2, speed) {
  const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
  return Math.max(1, Math.ceil(distance / speed))
}

module.exports = {
  calculateTravelTime,
}
