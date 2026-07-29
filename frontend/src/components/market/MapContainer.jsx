import { useState } from 'react'
import CityMarker from './CityMarker'
import { toPercent, isInBounds } from '../../lib/coordinateScaler'

/**
 * MapContainer — Renders the world map image with absolutely positioned city markers.
 *
 * Filters cities using isInBounds, logs warnings for out-of-bounds cities,
 * and displays a fallback placeholder if the map image fails to load.
 *
 * Props:
 *   cities         — Array of { id, name, location: { x, y } | null }
 *   mapConfig      — { xMin, xMax, yMin, yMax }
 *   pricesByCityId — Record<string, PriceEntry[]>
 *   onCityClick    — (cityId: string) => void
 */
export default function MapContainer({ cities, mapConfig, pricesByCityId, onCityClick }) {
  const [imageError, setImageError] = useState(false)

  const handleImageError = () => {
    setImageError(true)
  }

  // Filter cities to only those within the map bounds
  const visibleCities = cities.filter((city) => {
    if (!city.location) {
      console.warn(`City "${city.name}" (id: ${city.id}) has no location and will not be displayed on the map.`)
      return false
    }
    const inBounds = isInBounds(city.location, mapConfig)
    if (!inBounds) {
      console.warn(
        `City "${city.name}" (id: ${city.id}) is out of bounds (x: ${city.location.x}, y: ${city.location.y}) and will not be displayed on the map.`
      )
    }
    return inBounds
  })

  return (
    <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
      {imageError ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-200 rounded border border-gray-300">
          <span className="text-gray-500 text-lg font-medium">Map unavailable</span>
        </div>
      ) : (
        <img
          src="/Lanae'tu v3.01 (2).png"
          alt="World map"
          className="w-full h-full object-contain"
          onError={handleImageError}
        />
      )}

      {visibleCities.map((city) => {
        const style = toPercent(city.location, mapConfig)
        return (
          <CityMarker
            key={city.id}
            city={city}
            style={style}
            onClick={() => onCityClick(city.id)}
          />
        )
      })}
    </div>
  )
}
