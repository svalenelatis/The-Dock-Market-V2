import { useShips } from '../hooks/usePlayerData'

/**
 * Ship management page showing player's fleet.
 * Reads player ships from Supabase using authenticated session JWT.
 * Validates: Requirements 5.1, 5.2, 5.3
 */
export default function Ships() {
  const { data: ships, loading, error } = useShips()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">My Ships</h1>
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded">
            Error loading ships: {error}
          </div>
        )}

        {!ships || ships.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">You don't have any ships yet.</p>
            <p className="text-sm text-gray-400 mt-2">
              Ships are assigned when you create an account.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ships.map((ship) => (
              <div key={ship.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-800">{ship.name}</h3>
                  <span
                    className={`text-xs px-2 py-1 rounded font-medium ${
                      ship.status === 'docked'
                        ? 'bg-green-100 text-green-700'
                        : ship.status === 'sailing'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {ship.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Speed</span>
                    <span className="font-medium">{ship.speed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cargo Capacity</span>
                    <span className="font-medium">{ship.cargo_capacity}</span>
                  </div>
                  {ship.current_city && (
                    <div className="flex justify-between">
                      <span>Location</span>
                      <span className="font-medium">{ship.current_city}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
  )
}
