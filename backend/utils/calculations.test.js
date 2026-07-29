import { describe, it, expect } from 'vitest'
import { calculateTravelTime } from './calculations.js'

describe('calculateTravelTime', () => {
  it('returns 1 for same origin and destination', () => {
    expect(calculateTravelTime(0, 0, 0, 0, 1)).toBe(1)
  })

  it('calculates correct travel time for known distance', () => {
    // Distance = sqrt((3-0)^2 + (4-0)^2) = 5, speed = 2 → ceil(5/2) = 3
    expect(calculateTravelTime(0, 0, 3, 4, 2)).toBe(3)
  })

  it('rounds up to next whole day', () => {
    // Distance = sqrt((1-0)^2 + (0-0)^2) = 1, speed = 3 → ceil(1/3) = 1
    expect(calculateTravelTime(0, 0, 1, 0, 3)).toBe(1)
  })

  it('returns minimum of 1 even for zero distance', () => {
    expect(calculateTravelTime(5, 5, 5, 5, 10)).toBe(1)
  })

  it('is symmetric (swapping origin and destination gives same result)', () => {
    const t1 = calculateTravelTime(1, 2, 7, 9, 2)
    const t2 = calculateTravelTime(7, 9, 1, 2, 2)
    expect(t1).toBe(t2)
  })

  it('handles negative coordinates', () => {
    // Distance = sqrt((-3-3)^2 + (-4-4)^2) = sqrt(36+64) = 10, speed = 5 → ceil(10/5) = 2
    expect(calculateTravelTime(3, 4, -3, -4, 5)).toBe(2)
  })

  it('handles large distances', () => {
    // Distance = sqrt((1000-0)^2 + (1000-0)^2) = sqrt(2000000) ≈ 1414.21, speed = 100 → ceil(1414.21/100) = 15
    expect(calculateTravelTime(0, 0, 1000, 1000, 100)).toBe(15)
  })
})
