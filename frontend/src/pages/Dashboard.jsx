import { usePlayer, usePlayerInventory, useShips } from '../hooks/usePlayerData'

/**
 * Player dashboard showing gold, ships, and inventory.
 * Reads player data from Supabase using the authenticated session JWT.
 * Validates: Requirements 5.1, 5.2, 5.3
 */
export default function Dashboard() {
  const { data: player, loading: playerLoading, error: playerError } = usePlayer()
  const { data: ships, loading: shipsLoading } = useShips()
  const { data: inventory, loading: inventoryLoading } = usePlayerInventory()

  const loading = playerLoading || shipsLoading || inventoryLoading
  const error = playerError

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
            Error loading dashboard: {error}
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>
        {/* Gold Display */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Treasury</h2>
          <p className="text-3xl font-bold text-yellow-600">
            {player?.gold?.toLocaleString() ?? 0} Gold
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ships */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              Ships ({ships?.length ?? 0})
            </h2>
            {!ships || ships.length === 0 ? (
              <p className="text-gray-500 text-sm">No ships yet.</p>
            ) : (
              <ul className="space-y-3">
                {ships.map((ship) => (
                  <li key={ship.id} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <span className="font-medium text-gray-800">{ship.name}</span>
                      <span className="text-xs text-gray-500 ml-2">({ship.status})</span>
                    </div>
                    <span className="text-sm text-gray-600">
                      Cargo: {ship.cargo_capacity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Inventory */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              Inventory ({inventory?.length ?? 0} items)
            </h2>
            {!inventory || inventory.length === 0 ? (
              <p className="text-gray-500 text-sm">No items in inventory.</p>
            ) : (
              <ul className="space-y-2">
                {inventory.map((item) => (
                  <li key={item.id} className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-800">{item.items?.name ?? 'Unknown'}</span>
                    <span className="text-sm font-medium text-gray-600">x{item.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
  )
}
