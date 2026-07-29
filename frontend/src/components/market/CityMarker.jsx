/**
 * CityMarker — Interactive marker placed on the map at a city's geographic position.
 *
 * Renders as a <button> for native keyboard accessibility (focus, Enter/Space activation).
 * Positioned absolutely using percentage-based left/bottom values from the Coordinate_Scaler.
 *
 * Props:
 *   city    — { id, name, location: { x, y } }
 *   style   — { left: string, bottom: string } (percentage positions)
 *   onClick — callback when the marker is activated
 */
export default function CityMarker({ city, style, onClick }) {
  return (
    <button
      type="button"
      aria-label={city.name}
      onClick={onClick}
      className="absolute flex flex-col items-center cursor-pointer transition-transform duration-150 hover:scale-110 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded"
      style={{ left: style.left, bottom: style.bottom }}
    >
      <span className="text-xs font-semibold whitespace-nowrap bg-white/80 px-1 rounded shadow">
        {city.name}
      </span>
    </button>
  )
}
