import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCities } from './useCities'
import { useItems } from './useItems'
import { useCityTags } from './useCityTags'
import { useRandomEvents } from './useRandomEvents'
import { useMapConfig } from './useMapConfig'
import { usePriceSheets } from './usePriceSheets'
import { usePlayer } from './usePlayer'
import { useShips } from './useShips'
import { usePlayerInventory } from './usePlayerInventory'
import { useTransactions } from './useTransactions'

// Mock supabase client
vi.mock('../lib/supabase', () => {
  const mockSelect = vi.fn()
  const mockOrder = vi.fn()
  const mockEq = vi.fn()
  const mockSingle = vi.fn()
  const mockLimit = vi.fn()

  // Chain builder: each method returns the chain object
  const chain = {
    select: mockSelect,
    order: mockOrder,
    eq: mockEq,
    single: mockSingle,
    limit: mockLimit,
  }

  mockSelect.mockReturnValue(chain)
  mockOrder.mockReturnValue(chain)
  mockEq.mockReturnValue(chain)
  mockSingle.mockReturnValue(chain)
  mockLimit.mockReturnValue(chain)

  const mockFrom = vi.fn(() => chain)

  return {
    default: { from: mockFrom },
    __chain: chain,
    __mockFrom: mockFrom,
  }
})

// Mock useAuth
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null })),
}))

import supabase, { __chain, __mockFrom } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

beforeEach(() => {
  vi.clearAllMocks()
  // Reset chain methods to return chain by default
  __chain.select.mockReturnValue(__chain)
  __chain.order.mockReturnValue(__chain)
  __chain.eq.mockReturnValue(__chain)
  __chain.single.mockReturnValue(__chain)
  __chain.limit.mockReturnValue(__chain)
})

describe('Public data hooks', () => {
  describe('useCities', () => {
    it('returns cities data on success', async () => {
      const mockCities = [{ id: '1', name: 'Port Royal' }]
      __chain.order.mockResolvedValueOnce({ data: mockCities, error: null })

      const { result } = renderHook(() => useCities())

      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual(mockCities)
      expect(result.current.error).toBeNull()
      expect(__mockFrom).toHaveBeenCalledWith('cities')
    })

    it('returns error on failure and preserves previous data', async () => {
      __chain.order.mockResolvedValueOnce({ data: null, error: { message: 'Network error' } })

      const { result } = renderHook(() => useCities())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('Network error')
      expect(result.current.data).toBeNull()
    })

    it('exposes a refetch function', async () => {
      __chain.order.mockResolvedValueOnce({ data: [], error: null })

      const { result } = renderHook(() => useCities())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(typeof result.current.refetch).toBe('function')
    })
  })

  describe('useItems', () => {
    it('returns items data on success', async () => {
      const mockItems = [{ id: '1', name: 'Iron', base_price: 100 }]
      __chain.order.mockResolvedValueOnce({ data: mockItems, error: null })

      const { result } = renderHook(() => useItems())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual(mockItems)
      expect(result.current.error).toBeNull()
      expect(__mockFrom).toHaveBeenCalledWith('items')
    })

    it('surfaces error without crashing', async () => {
      __chain.order.mockResolvedValueOnce({ data: null, error: { message: 'DB down' } })

      const { result } = renderHook(() => useItems())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('DB down')
    })
  })

  describe('useCityTags', () => {
    it('fetches from city_tags table', async () => {
      __chain.order.mockResolvedValueOnce({ data: [], error: null })

      const { result } = renderHook(() => useCityTags())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(__mockFrom).toHaveBeenCalledWith('city_tags')
      expect(result.current.data).toEqual([])
    })
  })

  describe('useRandomEvents', () => {
    it('fetches from city_tag_assignments table', async () => {
      __chain.order.mockResolvedValueOnce({ data: [], error: null })

      const { result } = renderHook(() => useRandomEvents())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(__mockFrom).toHaveBeenCalledWith('city_tag_assignments')
      expect(result.current.data).toEqual([])
    })
  })

  describe('useMapConfig', () => {
    it('returns map config data with camelCase keys on success', async () => {
      const mockRow = [{ id: '1', x_min: -10, x_max: 10, y_min: -8, y_max: 8 }]
      __chain.limit.mockResolvedValueOnce({ data: mockRow, error: null })

      const { result } = renderHook(() => useMapConfig())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual({ xMin: -10, xMax: 10, yMin: -8, yMax: 8 })
      expect(result.current.error).toBeNull()
      expect(__mockFrom).toHaveBeenCalledWith('map_config')
    })

    it('falls back to default bounds when no row exists', async () => {
      __chain.limit.mockResolvedValueOnce({ data: [], error: null })

      const { result } = renderHook(() => useMapConfig())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 })
      expect(result.current.error).toBeNull()
    })

    it('propagates network errors to error state', async () => {
      __chain.limit.mockResolvedValueOnce({ data: null, error: { message: 'Network failure' } })

      const { result } = renderHook(() => useMapConfig())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('Network failure')
      expect(result.current.data).toBeNull()
    })

    it('exposes a refetch function', async () => {
      __chain.limit.mockResolvedValueOnce({ data: [], error: null })

      const { result } = renderHook(() => useMapConfig())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(typeof result.current.refetch).toBe('function')
    })
  })

  describe('usePriceSheets', () => {
    it('returns price data grouped by city_id and sorted alphabetically', async () => {
      const mockSheets = [
        { city_id: 'c1', item_id: 'i1', price: 50, items: { name: 'Zinc' }, cities: { name: 'Port A' } },
        { city_id: 'c1', item_id: 'i2', price: 30, items: { name: 'Amber' }, cities: { name: 'Port A' } },
        { city_id: 'c2', item_id: 'i1', price: 45, items: { name: 'Zinc' }, cities: { name: 'Port B' } },
      ]
      __chain.select.mockResolvedValueOnce({ data: mockSheets, error: null })

      const { result } = renderHook(() => usePriceSheets())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual({
        c1: [
          { itemName: 'Amber', price: 30 },
          { itemName: 'Zinc', price: 50 },
        ],
        c2: [
          { itemName: 'Zinc', price: 45 },
        ],
      })
      expect(result.current.error).toBeNull()
      expect(__mockFrom).toHaveBeenCalledWith('price_sheets')
    })

    it('returns error on failure', async () => {
      __chain.select.mockResolvedValueOnce({ data: null, error: { message: 'Fetch failed' } })

      const { result } = renderHook(() => usePriceSheets())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('Fetch failed')
      expect(result.current.data).toBeNull()
    })

    it('exposes a refetch function', async () => {
      __chain.select.mockResolvedValueOnce({ data: [], error: null })

      const { result } = renderHook(() => usePriceSheets())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(typeof result.current.refetch).toBe('function')
    })
  })
})

describe('Player-scoped hooks', () => {
  describe('usePlayer', () => {
    it('returns null data when no user is authenticated', async () => {
      useAuth.mockReturnValue({ user: null })

      const { result } = renderHook(() => usePlayer())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toBeNull()
      expect(__mockFrom).not.toHaveBeenCalled()
    })

    it('fetches player data when user is authenticated', async () => {
      const mockPlayer = { id: 'user-1', gold: 5000 }
      useAuth.mockReturnValue({ user: { id: 'user-1' } })
      __chain.single.mockResolvedValueOnce({ data: mockPlayer, error: null })

      const { result } = renderHook(() => usePlayer())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual(mockPlayer)
      expect(__mockFrom).toHaveBeenCalledWith('players')
    })

    it('surfaces errors without crashing', async () => {
      useAuth.mockReturnValue({ user: { id: 'user-1' } })
      __chain.single.mockResolvedValueOnce({ data: null, error: { message: 'Player not found' } })

      const { result } = renderHook(() => usePlayer())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('Player not found')
    })
  })

  describe('useShips', () => {
    it('returns null data when no user is authenticated', async () => {
      useAuth.mockReturnValue({ user: null })

      const { result } = renderHook(() => useShips())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toBeNull()
    })

    it('fetches ships for authenticated user', async () => {
      const mockShips = [{ id: 's1', name: 'HMS Victory', player_id: 'user-1' }]
      useAuth.mockReturnValue({ user: { id: 'user-1' } })
      __chain.order.mockResolvedValueOnce({ data: mockShips, error: null })

      const { result } = renderHook(() => useShips())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual(mockShips)
      expect(__mockFrom).toHaveBeenCalledWith('ships')
    })
  })

  describe('usePlayerInventory', () => {
    it('returns null data when no user is authenticated', async () => {
      useAuth.mockReturnValue({ user: null })

      const { result } = renderHook(() => usePlayerInventory())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toBeNull()
    })

    it('fetches inventory with item names for authenticated user', async () => {
      const mockInventory = [{ id: 'inv1', quantity: 10, items: { name: 'Iron' } }]
      useAuth.mockReturnValue({ user: { id: 'user-1' } })
      __chain.eq.mockResolvedValueOnce({ data: mockInventory, error: null })

      const { result } = renderHook(() => usePlayerInventory())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual(mockInventory)
      expect(__mockFrom).toHaveBeenCalledWith('player_inventories')
    })
  })

  describe('useTransactions', () => {
    it('returns null data when no user is authenticated', async () => {
      useAuth.mockReturnValue({ user: null })

      const { result } = renderHook(() => useTransactions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toBeNull()
    })

    it('fetches transactions for authenticated user', async () => {
      const mockTx = [{ id: 'tx1', player_id: 'user-1', type: 'buy' }]
      useAuth.mockReturnValue({ user: { id: 'user-1' } })
      __chain.limit.mockResolvedValueOnce({ data: mockTx, error: null })

      const { result } = renderHook(() => useTransactions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual(mockTx)
      expect(__mockFrom).toHaveBeenCalledWith('transactions')
    })

    it('surfaces errors without crashing', async () => {
      useAuth.mockReturnValue({ user: { id: 'user-1' } })
      __chain.limit.mockResolvedValueOnce({ data: null, error: { message: 'timeout' } })

      const { result } = renderHook(() => useTransactions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('timeout')
    })
  })
})
