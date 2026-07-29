import { useFactories } from '../hooks/useFactories'

/**
 * Factories page — displays the current player's factories with
 * operating costs, production output, and a notification panel placeholder.
 */
export default function Factories() {
  const { data: factories, loading, error } = useFactories()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          Error loading factories: {error}
        </div>
      </div>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Your Factories</h1>

      {!factories || factories.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">You don't have any factories yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {factories.map((factory) => (
            <FactoryCard key={factory.id} factory={factory} />
          ))}
        </div>
      )}
    </main>
  )
}

/**
 * Individual factory card showing type, status, costs, and production.
 */
function FactoryCard({ factory }) {
  const { factory_type, input_requirements, output_production, active } = factory

  // Parse input costs
  const inputs = parseRequirements(input_requirements)
  const output = parseOutput(output_production)

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Factory header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">{factory_type} Factory</h2>
          <span
            className={`text-xs font-medium px-2 py-1 rounded ${
              active
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Costs & Production — side by side */}
      <div className="p-5">
        <div className="grid grid-cols-2 gap-4">
          {/* Input costs */}
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-2">Operating Costs</h3>
            {inputs.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No input required</p>
            ) : (
              <ul className="space-y-1">
                {inputs.map((input, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{input.item}</span>
                    <span className="text-red-600 font-medium">-{input.quantity}/day</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Output production */}
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-2">Production</h3>
            {output ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{output.item}</span>
                <span className="text-green-600 font-medium">+{output.quantity}/day</span>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No output configured</p>
            )}
          </div>
        </div>
      </div>

      {/* Notifications panel */}
      <div className="border-t border-gray-100 bg-gray-50 p-4">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notifications</span>
        </div>
        <p className="text-sm text-gray-400 italic">Notifications coming soon</p>
      </div>
    </div>
  )
}

/**
 * Parse input_requirements JSONB into a list of { item, quantity } objects.
 * Handles both object format { "Grain": 2, "Water": 1 } and single-item format { "item": "Grain", "quantity": 5 }.
 * Also handles stringified JSON (from malformed DB entries).
 */
function parseRequirements(input) {
  let data = input
  if (typeof data === 'string') {
    try { data = JSON.parse(data) } catch { return [] }
  }
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return []
  }
  // Single-item format: { item, quantity }
  if (data.item) {
    return [{ item: data.item, quantity: data.quantity || 1 }]
  }
  // Object format: { "Grain": 2, "Water": 1 }
  return Object.entries(data).map(([item, quantity]) => ({ item, quantity }))
}

/**
 * Parse output_production JSONB into { item, quantity } or null.
 * Also handles stringified JSON (from malformed DB entries).
 */
function parseOutput(output) {
  let data = output
  if (typeof data === 'string') {
    try { data = JSON.parse(data) } catch { return null }
  }
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return null
  }
  if (data.item) {
    return { item: data.item, quantity: data.quantity || 1 }
  }
  // Fallback: first key-value pair
  const entries = Object.entries(data)
  if (entries.length > 0) {
    return { item: entries[0][0], quantity: entries[0][1] }
  }
  return null
}
