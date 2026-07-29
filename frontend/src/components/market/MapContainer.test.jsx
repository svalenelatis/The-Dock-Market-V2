import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MapContainer from './MapContainer'

const mapConfig = { xMin: 0, xMax: 10, yMin: 0, yMax: 10 }

describe('MapContainer', () => {
  it('renders the map image with correct alt text', () => {
    render(
      <MapContainer
        cities={[]}
        mapConfig={mapConfig}
        pricesByCityId={{}}
        onCityClick={() => {}}
      />
    )

    const img = screen.getByAltText('World map')
    expect(img).toBeDefined()
    expect(img.tagName).toBe('IMG')
  })

  it('shows fallback placeholder when image fails to load', () => {
    render(
      <MapContainer
        cities={[]}
        mapConfig={mapConfig}
        pricesByCityId={{}}
        onCityClick={() => {}}
      />
    )

    const img = screen.getByAltText('World map')
    fireEvent.error(img)

    expect(screen.getByText('Map unavailable')).toBeDefined()
    expect(screen.queryByAltText('World map')).toBeNull()
  })

  it('renders markers for cities with valid in-bounds locations', () => {
    const cities = [
      { id: '1', name: 'Port Aldera', location: { x: 5, y: 5 } },
      { id: '2', name: 'Ironhaven', location: { x: 2, y: 8 } },
    ]

    render(
      <MapContainer
        cities={cities}
        mapConfig={mapConfig}
        pricesByCityId={{}}
        onCityClick={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: 'Port Aldera' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Ironhaven' })).toBeDefined()
  })

  it('does not render a marker for cities with null location', () => {
    const cities = [
      { id: '1', name: 'Port Aldera', location: null },
    ]

    render(
      <MapContainer
        cities={cities}
        mapConfig={mapConfig}
        pricesByCityId={{}}
        onCityClick={() => {}}
      />
    )

    expect(screen.queryByRole('button', { name: 'Port Aldera' })).toBeNull()
  })

  it('does not render markers for cities with out-of-bounds coordinates', () => {
    const cities = [
      { id: '1', name: 'Far Away City', location: { x: 50, y: 50 } },
      { id: '2', name: 'Negative City', location: { x: -1, y: -1 } },
    ]

    render(
      <MapContainer
        cities={cities}
        mapConfig={mapConfig}
        pricesByCityId={{}}
        onCityClick={() => {}}
      />
    )

    expect(screen.queryByRole('button', { name: 'Far Away City' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Negative City' })).toBeNull()
  })

  it('calls onCityClick with the correct city id when a marker is clicked', () => {
    const cities = [
      { id: 'city-42', name: 'Trade Port', location: { x: 3, y: 7 } },
    ]
    const onCityClick = vi.fn()

    render(
      <MapContainer
        cities={cities}
        mapConfig={mapConfig}
        pricesByCityId={{}}
        onCityClick={onCityClick}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Trade Port' }))
    expect(onCityClick).toHaveBeenCalledWith('city-42')
  })
})
