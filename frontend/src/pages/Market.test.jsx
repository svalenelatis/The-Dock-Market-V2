import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Market from './Market'
import { useMapConfig, useCities, usePriceSheets } from '../hooks'

vi.mock('../hooks', () => ({
  useMapConfig: vi.fn(),
  useCities: vi.fn(),
  usePriceSheets: vi.fn(),
}))

vi.mock('../components/market/MapContainer', () => ({
  default: ({ cities, mapConfig, pricesByCityId, onCityClick }) => (
    <div data-testid="map-container">MapContainer</div>
  ),
}))

vi.mock('../components/market/PriceModal', () => ({
  default: ({ cityName, prices, onClose }) => (
    <div data-testid="price-modal">{cityName}</div>
  ),
}))

describe('Market (Marketboard_Page)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Loading state (Requirement 5.3)', () => {
    it('shows a loading indicator when mapConfig is loading', () => {
      useMapConfig.mockReturnValue({ data: null, loading: true, error: null, refetch: vi.fn() })
      useCities.mockReturnValue({ data: [], loading: false, error: null, refetch: vi.fn() })
      usePriceSheets.mockReturnValue({ data: {}, loading: false, error: null, refetch: vi.fn() })

      const { container } = render(<Market />)
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).not.toBeNull()
    })

    it('shows a loading indicator when cities is loading', () => {
      useMapConfig.mockReturnValue({ data: {}, loading: false, error: null, refetch: vi.fn() })
      useCities.mockReturnValue({ data: null, loading: true, error: null, refetch: vi.fn() })
      usePriceSheets.mockReturnValue({ data: {}, loading: false, error: null, refetch: vi.fn() })

      const { container } = render(<Market />)
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).not.toBeNull()
    })

    it('shows a loading indicator when priceSheets is loading', () => {
      useMapConfig.mockReturnValue({ data: {}, loading: false, error: null, refetch: vi.fn() })
      useCities.mockReturnValue({ data: [], loading: false, error: null, refetch: vi.fn() })
      usePriceSheets.mockReturnValue({ data: null, loading: true, error: null, refetch: vi.fn() })

      const { container } = render(<Market />)
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).not.toBeNull()
    })
  })

  describe('Error state with retry (Requirements 5.4, 5.5)', () => {
    it('shows error message when mapConfig fetch fails', () => {
      useMapConfig.mockReturnValue({ data: null, loading: false, error: 'Network error', refetch: vi.fn() })
      useCities.mockReturnValue({ data: [], loading: false, error: null, refetch: vi.fn() })
      usePriceSheets.mockReturnValue({ data: {}, loading: false, error: null, refetch: vi.fn() })

      render(<Market />)
      expect(screen.getByText(/network error/i)).not.toBeNull()
      expect(screen.getByRole('button', { name: /retry/i })).not.toBeNull()
    })

    it('retry button calls all three refetch functions', () => {
      const refetchMapConfig = vi.fn()
      const refetchCities = vi.fn()
      const refetchPrices = vi.fn()

      useMapConfig.mockReturnValue({ data: null, loading: false, error: 'Failed', refetch: refetchMapConfig })
      useCities.mockReturnValue({ data: [], loading: false, error: null, refetch: refetchCities })
      usePriceSheets.mockReturnValue({ data: {}, loading: false, error: null, refetch: refetchPrices })

      render(<Market />)
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))

      expect(refetchMapConfig).toHaveBeenCalledTimes(1)
      expect(refetchCities).toHaveBeenCalledTimes(1)
      expect(refetchPrices).toHaveBeenCalledTimes(1)
    })

    it('treats partial failure (cities ok, prices fail) as full error state', () => {
      useMapConfig.mockReturnValue({ data: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, loading: false, error: null, refetch: vi.fn() })
      useCities.mockReturnValue({ data: [{ id: '1', name: 'City' }], loading: false, error: null, refetch: vi.fn() })
      usePriceSheets.mockReturnValue({ data: null, loading: false, error: 'Price fetch failed', refetch: vi.fn() })

      render(<Market />)
      // Should show error state, not the map
      expect(screen.getByText(/price fetch failed/i)).not.toBeNull()
      expect(screen.getByRole('button', { name: /retry/i })).not.toBeNull()
      expect(screen.queryByTestId('map-container')).toBeNull()
    })

    it('treats partial failure (mapConfig ok, cities fail) as full error state', () => {
      useMapConfig.mockReturnValue({ data: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, loading: false, error: null, refetch: vi.fn() })
      useCities.mockReturnValue({ data: null, loading: false, error: 'Cities unavailable', refetch: vi.fn() })
      usePriceSheets.mockReturnValue({ data: {}, loading: false, error: null, refetch: vi.fn() })

      render(<Market />)
      expect(screen.getByText(/cities unavailable/i)).not.toBeNull()
      expect(screen.getByRole('button', { name: /retry/i })).not.toBeNull()
    })
  })

  describe('No header/nav elements (Requirement 6.2)', () => {
    it('does not render a header element', () => {
      useMapConfig.mockReturnValue({ data: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, loading: false, error: null, refetch: vi.fn() })
      useCities.mockReturnValue({ data: [], loading: false, error: null, refetch: vi.fn() })
      usePriceSheets.mockReturnValue({ data: {}, loading: false, error: null, refetch: vi.fn() })

      const { container } = render(<Market />)
      expect(container.querySelector('header')).toBeNull()
    })

    it('does not render a nav element', () => {
      useMapConfig.mockReturnValue({ data: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, loading: false, error: null, refetch: vi.fn() })
      useCities.mockReturnValue({ data: [], loading: false, error: null, refetch: vi.fn() })
      usePriceSheets.mockReturnValue({ data: {}, loading: false, error: null, refetch: vi.fn() })

      const { container } = render(<Market />)
      expect(container.querySelector('nav')).toBeNull()
    })
  })

  describe('Accessible without auth session (Requirement 6.3)', () => {
    it('renders content without any auth context or session', () => {
      useMapConfig.mockReturnValue({ data: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, loading: false, error: null, refetch: vi.fn() })
      useCities.mockReturnValue({ data: [{ id: '1', name: 'TestCity', location: { x: 0, y: 0 } }], loading: false, error: null, refetch: vi.fn() })
      usePriceSheets.mockReturnValue({ data: {}, loading: false, error: null, refetch: vi.fn() })

      // Renders without wrapping in auth provider — proves no auth dependency
      render(<Market />)
      expect(screen.getByRole('main')).not.toBeNull()
      expect(screen.getByTestId('map-container')).not.toBeNull()
    })
  })

  describe('Success state rendering', () => {
    it('renders a main element with MapContainer when data loads successfully', () => {
      useMapConfig.mockReturnValue({ data: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, loading: false, error: null, refetch: vi.fn() })
      useCities.mockReturnValue({ data: [{ id: '1', name: 'Port', location: { x: 1, y: 2 } }], loading: false, error: null, refetch: vi.fn() })
      usePriceSheets.mockReturnValue({ data: { '1': [{ itemName: 'Iron', price: 10 }] }, loading: false, error: null, refetch: vi.fn() })

      render(<Market />)
      expect(screen.getByRole('main')).not.toBeNull()
      expect(screen.getByTestId('map-container')).not.toBeNull()
    })
  })
})
