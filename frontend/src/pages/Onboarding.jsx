import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiCall } from '../lib/api'

/**
 * New player onboarding flow.
 *
 * Step 1: Name your first ship (cargo 15, speed 1)
 * Step 2: Confirmation / welcome summary
 *
 * This is structured as a multi-step flow so tutorial steps
 * can be inserted between or after the current steps.
 */
export default function Onboarding() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [shipName, setShipName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  const totalSteps = 2

  async function handleSubmitShipName(e) {
    e.preventDefault()
    setError('')

    const trimmed = shipName.trim()
    if (!trimmed) {
      setError('Your ship needs a name, Captain!')
      return
    }
    if (trimmed.length > 50) {
      setError('Ship name must be 50 characters or fewer.')
      return
    }

    setSubmitting(true)
    try {
      const data = await apiCall('/api/onboarding/complete', {
        method: 'POST',
        body: { ship_name: trimmed },
        token: session?.access_token,
      })
      setResult(data)
      setStep(2)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleFinish() {
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        {/* Progress indicator */}
        <div className="flex items-center justify-center mb-8 gap-2">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i + 1 <= step ? 'bg-blue-600 w-8' : 'bg-blue-200 w-6'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Name your ship */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">⚓</div>
              <h1 className="text-2xl font-bold text-gray-800">
                Welcome to Dock Market
              </h1>
              <p className="text-gray-600 mt-2">
                Every captain needs a ship. Name yours to begin your trading journey.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-blue-800 mb-2">Your Starter Ship</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Cargo capacity: <strong>15 units</strong></li>
                <li>• Speed: <strong>1</strong></li>
                <li>• Docked at: <strong>Katu</strong> (your home port)</li>
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-amber-800 mb-2">You also receive</h3>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• <strong>100 gold</strong> to start trading</li>
                <li>• <strong>Grain Factory</strong> — produces 2 grain per day</li>
              </ul>
            </div>

            <form onSubmit={handleSubmitShipName}>
              <label
                htmlFor="ship-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Ship Name
              </label>
              <input
                id="ship-name"
                type="text"
                value={shipName}
                onChange={(e) => setShipName(e.target.value)}
                placeholder="e.g. The Sea Wanderer"
                maxLength={50}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition mb-1"
                autoFocus
                disabled={submitting}
              />
              <p className="text-xs text-gray-400 mb-4">
                {shipName.trim().length}/50 characters
              </p>

              {error && (
                <p className="text-red-600 text-sm mb-4" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {submitting ? 'Setting sail...' : 'Christen Your Ship'}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Welcome confirmation */}
        {step === 2 && result && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-5xl mb-4">🚢</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Welcome Aboard, Captain!
            </h1>
            <p className="text-gray-600 mb-6">
              The <strong>{result.ship?.name}</strong> is ready to set sail from Katu.
              Your Grain Factory is producing goods. Time to start trading!
            </p>

            <div className="bg-green-50 border border-green-100 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-medium text-green-800 mb-2">Your Starting Setup</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>🚢 <strong>{result.ship?.name}</strong> — Cargo: 15, Speed: 1</li>
                <li>🏭 <strong>Grain Factory</strong> — 2 grain/day</li>
                <li>💰 <strong>100 gold</strong></li>
              </ul>
            </div>

            <button
              onClick={handleFinish}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition"
            >
              Enter Dock Market
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
