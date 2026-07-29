import { describe, it, expect } from 'vitest'
import { formatGold, formatPrice, formatShipStatus, formatQuantity, formatCurrency, sortPriceEntries } from './formatters'

describe('lib/formatters', () => {
  describe('formatGold', () => {
    it('formats a positive number with thousands separator', () => {
      expect(formatGold(1500)).toBe('1,500')
    })

    it('formats zero as "0"', () => {
      expect(formatGold(0)).toBe('0')
    })

    it('returns "0" for null', () => {
      expect(formatGold(null)).toBe('0')
    })

    it('returns "0" for undefined', () => {
      expect(formatGold(undefined)).toBe('0')
    })

    it('returns "0" for NaN', () => {
      expect(formatGold(NaN)).toBe('0')
    })

    it('formats large numbers correctly', () => {
      expect(formatGold(1000000)).toBe('1,000,000')
    })
  })

  describe('formatPrice', () => {
    it('formats a positive price with thousands separator', () => {
      expect(formatPrice(2500)).toBe('2,500')
    })

    it('returns em-dash for null', () => {
      expect(formatPrice(null)).toBe('—')
    })

    it('returns em-dash for undefined', () => {
      expect(formatPrice(undefined)).toBe('—')
    })

    it('returns em-dash for NaN', () => {
      expect(formatPrice(NaN)).toBe('—')
    })

    it('formats zero as "0"', () => {
      expect(formatPrice(0)).toBe('0')
    })
  })

  describe('formatShipStatus', () => {
    it('capitalizes first letter of status', () => {
      expect(formatShipStatus('ready')).toBe('Ready')
    })

    it('handles uppercase input', () => {
      expect(formatShipStatus('TRAVELING')).toBe('Traveling')
    })

    it('returns "Unknown" for null', () => {
      expect(formatShipStatus(null)).toBe('Unknown')
    })

    it('returns "Unknown" for undefined', () => {
      expect(formatShipStatus(undefined)).toBe('Unknown')
    })

    it('returns "Unknown" for empty string', () => {
      expect(formatShipStatus('')).toBe('Unknown')
    })
  })

  describe('formatQuantity', () => {
    it('formats a positive integer', () => {
      expect(formatQuantity(5)).toBe('x5')
    })

    it('floors decimal quantities', () => {
      expect(formatQuantity(3.7)).toBe('x3')
    })

    it('returns "x0" for null', () => {
      expect(formatQuantity(null)).toBe('x0')
    })

    it('returns "x0" for undefined', () => {
      expect(formatQuantity(undefined)).toBe('x0')
    })

    it('returns "x0" for negative numbers', () => {
      expect(formatQuantity(-1)).toBe('x0')
    })

    it('returns "x0" for NaN', () => {
      expect(formatQuantity(NaN)).toBe('x0')
    })
  })

  describe('formatCurrency', () => {
    it('formats an integer with two decimal places', () => {
      expect(formatCurrency(10)).toBe('$10.00')
    })

    it('formats a decimal with one digit to two decimal places', () => {
      expect(formatCurrency(0.5)).toBe('$0.50')
    })

    it('formats a number already with two decimal places', () => {
      expect(formatCurrency(1234.56)).toBe('$1234.56')
    })

    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('$0.00')
    })

    it('formats a large number', () => {
      expect(formatCurrency(99999.99)).toBe('$99999.99')
    })

    it('rounds to two decimal places', () => {
      expect(formatCurrency(1.999)).toBe('$2.00')
    })
  })

  describe('sortPriceEntries', () => {
    it('sorts entries alphabetically by itemName', () => {
      const entries = [
        { itemName: 'Copper', price: 5 },
        { itemName: 'Apple', price: 2 },
        { itemName: 'Bread', price: 3 },
      ]
      const sorted = sortPriceEntries(entries)
      expect(sorted[0].itemName).toBe('Apple')
      expect(sorted[1].itemName).toBe('Bread')
      expect(sorted[2].itemName).toBe('Copper')
    })

    it('does not mutate the original array', () => {
      const entries = [
        { itemName: 'Zinc', price: 10 },
        { itemName: 'Iron', price: 8 },
      ]
      const sorted = sortPriceEntries(entries)
      expect(entries[0].itemName).toBe('Zinc')
      expect(sorted[0].itemName).toBe('Iron')
    })

    it('handles an empty array', () => {
      expect(sortPriceEntries([])).toEqual([])
    })

    it('handles a single entry', () => {
      const entries = [{ itemName: 'Gold', price: 100 }]
      const sorted = sortPriceEntries(entries)
      expect(sorted).toEqual([{ itemName: 'Gold', price: 100 }])
    })
  })
})
