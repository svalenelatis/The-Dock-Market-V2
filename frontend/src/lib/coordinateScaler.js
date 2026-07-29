/**
 * Coordinate Scaler utility module.
 *
 * Converts map coordinates to CSS percentage positions using a linear formula,
 * checks if coordinates fall within configured bounds, and validates bounds config.
 *
 * Uses `bottom` (not `top`) because yMin maps to the bottom of the container
 * and yMax maps to the top (standard Cartesian orientation).
 */

/**
 * Converts coordinates to CSS percentage position strings.
 *
 * @param {{ x: number, y: number }} coords - The coordinate pair to convert
 * @param {{ xMin: number, xMax: number, yMin: number, yMax: number }} config - Map bounds config
 * @returns {{ left: string, bottom: string }} Percentage position strings (e.g. "42.50%")
 */
export function toPercent(coords, config) {
  const leftPercent = ((coords.x - config.xMin) / (config.xMax - config.xMin)) * 100
  const bottomPercent = ((coords.y - config.yMin) / (config.yMax - config.yMin)) * 100

  return {
    left: `${leftPercent.toFixed(2)}%`,
    bottom: `${bottomPercent.toFixed(2)}%`,
  }
}

/**
 * Checks whether coordinates fall within the configured map bounds.
 * Returns false for null, undefined, or missing coordinate values.
 *
 * @param {{ x: number, y: number } | null | undefined} coords - The coordinate pair to check
 * @param {{ xMin: number, xMax: number, yMin: number, yMax: number }} config - Map bounds config
 * @returns {boolean} True if both x and y are within [min, max] inclusive
 */
export function isInBounds(coords, config) {
  if (coords == null) return false
  if (typeof coords.x !== 'number' || typeof coords.y !== 'number') return false
  if (!isFinite(coords.x) || !isFinite(coords.y)) return false

  return (
    coords.x >= config.xMin &&
    coords.x <= config.xMax &&
    coords.y >= config.yMin &&
    coords.y <= config.yMax
  )
}

/**
 * Validates that a map bounds configuration is valid.
 * Returns true if and only if xMin < xMax AND yMin < yMax.
 *
 * @param {{ xMin: number, xMax: number, yMin: number, yMax: number }} config - Map bounds config
 * @returns {boolean} True if bounds are valid
 */
export function isValidBounds(config) {
  if (config == null) return false
  if (
    typeof config.xMin !== 'number' ||
    typeof config.xMax !== 'number' ||
    typeof config.yMin !== 'number' ||
    typeof config.yMax !== 'number'
  ) {
    return false
  }
  if (!isFinite(config.xMin) || !isFinite(config.xMax) || !isFinite(config.yMin) || !isFinite(config.yMax)) {
    return false
  }

  return config.xMin < config.xMax && config.yMin < config.yMax
}
