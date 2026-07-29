import { useState, useCallback } from 'react'
import { useMapConfig, useCities, usePriceSheets } from '../hooks'
import MapContainer from '../components/market/MapContainer'
import PriceModal from '../components/market/PriceModal'

/**
 * Marketboard_Page — Interactive map-based marketboard.
 * Fetches cities, price sheets, and map config in parallel.
 * Renders the world map with city markers; clicking a marker opens
 * a price modal for that city.
 *
 * Public page — no auth required. Renders inside Layout (no header/nav).
 *
 * Validates: Requirements 1.1, 2.5, 2.7, 3.1, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3
 */
export default function Market() {
  const { data: mapConfig, loading: mapConfigLoading, error: mapConfigError, refetch: refetchMapConfig } = useMapConfig()
  const { data: cities, loading: citiesLoading, error: citiesError, refetch: refetchCities } = useCities()
  const { data: pricesByCityId, loading: pricesLoading, error: pricesError, refetch: refetchPrices } = usePriceSheets()

  const [selectedCityId, setSelectedCityId] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const loading = mapConfigLoading || citiesLoading || pricesLoading
  const error = mapConfigError || citiesError || pricesError

  const handleRetry = useCallback(() => {
    refetchMapConfig()
    refetchCities()
    refetchPrices()
  }, [refetchMapConfig, refetchCities, refetchPrices])

  const handleCityClick = useCallback((cityId) => {
    setSelectedCityId(cityId)
    setIsModalOpen(true)
  }, [])

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false)
    setSelectedCityId(null)
  }, [])

  // Loading state — centered spinner
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600" />
      </div>
    )
  }

  // Error state — treat partial failure as full error (Requirement 5.5)
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full text-center">
          <p className="text-red-700 mb-4">
            Failed to load market data: {error}
          </p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Determine the selected city's name and price entries for the modal
  const selectedCity = selectedCityId
    ? cities.find((c) => c.id === selectedCityId)
    : null
  const selectedCityName = selectedCity?.name ?? ''
  const selectedCityPrices = (pricesByCityId && selectedCityId)
    ? (pricesByCityId[selectedCityId] ?? [])
    : []

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <MapContainer
        cities={cities || []}
        mapConfig={mapConfig}
        pricesByCityId={pricesByCityId || {}}
        onCityClick={handleCityClick}
      />

      {isModalOpen && selectedCity && (
        <PriceModal
          cityName={selectedCityName}
          prices={selectedCityPrices}
          onClose={handleModalClose}
        />
      )}
    </main>
  )
}
