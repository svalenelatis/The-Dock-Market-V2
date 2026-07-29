import { describe, it, expect } from 'vitest'
import { toPercent, isInBounds, isValidBounds } from './coordinateScaler'

describe('toPercent', () => {
  const config = { xMin: 0, xMax: 10, yMin: 0, yMax: 10 }

  it('converts min bounds to 0%', () => {
    const result = toPercent({ x: 0, y: 0 }, config)
    expect(result).toEqual({ left: '0.00%', bottom: '0.00%' })
  })

  it('converts max bounds to 100%', () => {
    const result = toPercent({ x: 10, y: 10 }, config)
    expect(result).toEqual({ left: '100.00%', bottom: '100.00%' })
  })

  it('converts midpoint to 50%', () => {
    const result = toPercent({ x: 5, y: 5 }, config)
    expect(result).toEqual({ left: '50.00%', bottom: '50.00%' })
  })

  it('handles negative bounds', () => {
    const negConfig = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }
    const result = toPercent({ x: 0, y: 0 }, negConfig)
    expect(result).toEqual({ left: '50.00%', bottom: '50.00%' })
  })

  it('handles floating-point coordinates', () => {
    const result = toPercent({ x: 2.5, y: 7.5 }, config)
    expect(result).toEqual({ left: '25.00%', bottom: '75.00%' })
  })

  it('uses bottom not top for y-axis', () => {
    const result = toPercent({ x: 5, y: 0 }, config)
    expect(result.bottom).toBe('0.00%')
    expect(result).not.toHaveProperty('top')
  })
})

describe('isInBounds', () => {
  const config = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }

  it('returns true for coordinates within bounds', () => {
    expect(isInBounds({ x: 0, y: 0 }, config)).toBe(true)
  })

  it('returns true for coordinates at min boundary', () => {
    expect(isInBounds({ x: -5, y: -5 }, config)).toBe(true)
  })

  it('returns true for coordinates at max boundary', () => {
    expect(isInBounds({ x: 5, y: 5 }, config)).toBe(true)
  })

  it('returns false for x out of range', () => {
    expect(isInBounds({ x: 6, y: 0 }, config)).toBe(false)
    expect(isInBounds({ x: -6, y: 0 }, config)).toBe(false)
  })

  it('returns false for y out of range', () => {
    expect(isInBounds({ x: 0, y: 6 }, config)).toBe(false)
    expect(isInBounds({ x: 0, y: -6 }, config)).toBe(false)
  })

  it('returns false for null coords', () => {
    expect(isInBounds(null, config)).toBe(false)
  })

  it('returns false for undefined coords', () => {
    expect(isInBounds(undefined, config)).toBe(false)
  })

  it('returns false for missing x or y', () => {
    expect(isInBounds({ x: 0 }, config)).toBe(false)
    expect(isInBounds({ y: 0 }, config)).toBe(false)
    expect(isInBounds({}, config)).toBe(false)
  })

  it('returns false for non-numeric values', () => {
    expect(isInBounds({ x: 'a', y: 0 }, config)).toBe(false)
    expect(isInBounds({ x: 0, y: null }, config)).toBe(false)
  })

  it('accepts floating-point coordinates within bounds', () => {
    expect(isInBounds({ x: 2.5, y: -3.7 }, config)).toBe(true)
  })
})

describe('isValidBounds', () => {
  it('returns true when xMin < xMax and yMin < yMax', () => {
    expect(isValidBounds({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 })).toBe(true)
  })

  it('returns false when xMin equals xMax', () => {
    expect(isValidBounds({ xMin: 5, xMax: 5, yMin: -5, yMax: 5 })).toBe(false)
  })

  it('returns false when yMin equals yMax', () => {
    expect(isValidBounds({ xMin: -5, xMax: 5, yMin: 5, yMax: 5 })).toBe(false)
  })

  it('returns false when xMin > xMax', () => {
    expect(isValidBounds({ xMin: 10, xMax: 5, yMin: -5, yMax: 5 })).toBe(false)
  })

  it('returns false when yMin > yMax', () => {
    expect(isValidBounds({ xMin: -5, xMax: 5, yMin: 10, yMax: 5 })).toBe(false)
  })

  it('returns false for null config', () => {
    expect(isValidBounds(null)).toBe(false)
  })

  it('returns false for non-finite values', () => {
    expect(isValidBounds({ xMin: -Infinity, xMax: 5, yMin: -5, yMax: 5 })).toBe(false)
    expect(isValidBounds({ xMin: -5, xMax: NaN, yMin: -5, yMax: 5 })).toBe(false)
  })

  it('accepts floating-point bounds', () => {
    expect(isValidBounds({ xMin: -0.5, xMax: 0.5, yMin: -100.1, yMax: 100.1 })).toBe(true)
  })
})
