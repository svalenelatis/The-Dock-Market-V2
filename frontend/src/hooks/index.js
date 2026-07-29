/**
 * Data-fetching hooks for the Naval Trading Simulator frontend.
 *
 * Public hooks (anon key — no auth required):
 * - useCities: All cities with location and market data
 * - useItems: All tradeable items
 * - useCityTags: All city tags and their effects
 * - useRandomEvents: Active random events
 *
 * Player-scoped hooks (user JWT — requires authentication):
 * - usePlayer: Current player profile (gold, home port)
 * - usePlayerInventory: Current player's item inventory
 * - useShips: Current player's fleet
 * - useTransactions: Current player's transaction history
 *
 * All hooks return: { data, loading, error, refetch }
 *
 * Validates: Requirements 2.3, 2.4, 2.5, 2.6, 2.7
 */

// Public data hooks
export { useCities } from './useCities'
export { useItems } from './useItems'
export { useCityTags } from './useCityTags'
export { useRandomEvents } from './useRandomEvents'
export { useMapConfig } from './useMapConfig'
export { usePriceSheets } from './usePriceSheets'

// Player-scoped hooks
export { usePlayer } from './usePlayer'
export { usePlayerInventory } from './usePlayerInventory'
export { useShips } from './useShips'
export { useTransactions } from './useTransactions'
export { useFactories } from './useFactories'
export { useOnboardingStatus } from './useOnboardingStatus'
