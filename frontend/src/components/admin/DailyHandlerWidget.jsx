import { useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL

/**
 * Daily Handler Widget — provides buttons to trigger the full daily handler
 * or individual steps (market update, transaction processing, factory processing).
 * Shows a loading spinner on the triggered button, disables all buttons during a run,
 * and displays results or errors upon completion.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6
 *
 * @param {{ token: string }} props
 */
export default function DailyHandlerWidget({ token }) {
  const [loading, setLoading] = useState(null) // 'full' | 'market' | 'transactions' | 'factories' | null
  const [results, setResults] = useState(null)
  const [errors, setErrors] = useState([])

  const buttons = [
    { id: 'full', label: 'Run Full Handler', endpoint: '/api/admin/daily-update' },
    { id: 'market', label: 'Market Update', endpoint: '/api/admin/daily-update/market' },
    { id: 'transactions', label: 'Process Transactions', endpoint: '/api/admin/daily-update/transactions' },
    { id: 'factories', label: 'Process Factories', endpoint: '/api/admin/daily-update/factories' },
  ]

  async function handleTrigger(id, endpoint) {
    setLoading(id)
    setResults(null)
    setErrors([])

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await res.json()

      if (!res.ok && res.status !== 207) {
        // Complete failure (non-partial)
        setErrors([data.error || `Request failed with status ${res.status}`])
        setResults(null)
      } else if (id === 'full') {
        // Full handler response includes all sections
        setResults(data)
        setErrors(data.errors || [])
      } else {
        // Individual step response — wrap into the full result shape for consistent display
        const stepResults = { success: true, elapsed_ms: null, market: null, transactions: null, factories: null, errors: [] }
        if (id === 'market') stepResults.market = data
        if (id === 'transactions') stepResults.transactions = data
        if (id === 'factories') stepResults.factories = data
        setResults(stepResults)
      }
    } catch (err) {
      setErrors([err.message || 'Network error — check your connection'])
      setResults(null)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Trigger Buttons */}
      <div className="flex flex-wrap gap-3">
        {buttons.map((btn) => (
          <button
            key={btn.id}
            onClick={() => handleTrigger(btn.id, btn.endpoint)}
            disabled={loading !== null}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading === btn.id && <Spinner />}
            {btn.label}
          </button>
        ))}
      </div>

      {/* Error Display */}
      {errors.length > 0 && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4" role="alert">
          <h4 className="text-sm font-semibold text-red-800 mb-1">
            {results ? 'Partial Failure — some steps encountered errors:' : 'Error'}
          </h4>
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4">
          <h4 className="text-sm font-semibold text-green-800 mb-2">Results</h4>

          {results.elapsed_ms != null && (
            <p className="text-xs text-gray-500 mb-2">Completed in {results.elapsed_ms}ms</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            {/* Market Results */}
            {results.market && (
              <div>
                <p className="font-medium text-gray-700">Market Update</p>
                <ul className="text-gray-600 mt-1 space-y-0.5">
                  <li>Items updated: {results.market.itemsUpdated}</li>
                  <li>Tags added: {results.market.tagsAdded}</li>
                  <li>Tags removed: {results.market.tagsRemoved}</li>
                </ul>
              </div>
            )}

            {/* Transaction Results */}
            {results.transactions && (
              <div>
                <p className="font-medium text-gray-700">Transactions</p>
                <ul className="text-gray-600 mt-1 space-y-0.5">
                  <li>Processed: {results.transactions.processed}</li>
                  <li>Failed: {results.transactions.failed}</li>
                </ul>
              </div>
            )}

            {/* Factory Results */}
            {results.factories && (
              <div>
                <p className="font-medium text-gray-700">Factories</p>
                <ul className="text-gray-600 mt-1 space-y-0.5">
                  <li>Processed: {results.factories.processed}</li>
                  {results.factories.skipped != null && (
                    <li>Skipped: {results.factories.skipped}</li>
                  )}
                  {results.factories.failed != null && (
                    <li>Failed: {results.factories.failed}</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Small inline spinner SVG component for button loading state.
 */
function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
