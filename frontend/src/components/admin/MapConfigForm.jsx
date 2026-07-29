import { useState, useEffect } from 'react'
import supabase from '../../lib/supabase'

/**
 * Admin form for viewing and editing map coordinate bounds.
 * Validates constraints client-side before persisting to Supabase.
 *
 * Validates: Requirements 7.3, 7.4, 7.5, 7.6, 7.7
 *
 * @param {{ currentConfig: { xMin: number, xMax: number, yMin: number, yMax: number }, onSave: (config: { xMin: number, xMax: number, yMin: number, yMax: number }) => Promise<void> }} props
 */
export default function MapConfigForm({ currentConfig, onSave }) {
  const [xMin, setXMin] = useState('')
  const [xMax, setXMax] = useState('')
  const [yMin, setYMin] = useState('')
  const [yMax, setYMax] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // Initialize form state from currentConfig prop
  useEffect(() => {
    if (currentConfig) {
      setXMin(String(currentConfig.xMin))
      setXMax(String(currentConfig.xMax))
      setYMin(String(currentConfig.yMin))
      setYMax(String(currentConfig.yMax))
    }
  }, [currentConfig])

  function validate() {
    const xMinVal = parseFloat(xMin)
    const xMaxVal = parseFloat(xMax)
    const yMinVal = parseFloat(yMin)
    const yMaxVal = parseFloat(yMax)

    // Check all values are finite numbers
    if (!isFinite(xMinVal)) return 'xMin must be a finite number'
    if (!isFinite(xMaxVal)) return 'xMax must be a finite number'
    if (!isFinite(yMinVal)) return 'yMin must be a finite number'
    if (!isFinite(yMaxVal)) return 'yMax must be a finite number'

    // Constraint validation
    if (xMinVal >= xMaxVal) return 'xMin must be less than xMax'
    if (yMinVal >= yMaxVal) return 'yMin must be less than yMax'

    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    const config = {
      xMin: parseFloat(xMin),
      xMax: parseFloat(xMax),
      yMin: parseFloat(yMin),
      yMax: parseFloat(yMax),
    }

    setSaving(true)

    try {
      // Upsert the single map_config row
      const { error: upsertError } = await supabase
        .from('map_config')
        .upsert(
          {
            x_min: config.xMin,
            x_max: config.xMax,
            y_min: config.yMin,
            y_max: config.yMax,
          },
          { onConflict: 'id' }
        )
        .select()

      if (upsertError) {
        setError(upsertError.message)
        setSaving(false)
        return
      }

      // Call the onSave callback
      if (onSave) {
        await onSave(config)
      }

      setSuccess(true)
    } catch (err) {
      setError(err.message || 'An unexpected error occurred while saving.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <h3 className="text-lg font-semibold text-gray-700">Map Coordinate Bounds</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="xMin" className="block text-sm font-medium text-gray-600 mb-1">
            xMin
          </label>
          <input
            id="xMin"
            type="number"
            step="any"
            value={xMin}
            onChange={(e) => { setXMin(e.target.value); setError(null); setSuccess(false) }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={saving}
          />
        </div>
        <div>
          <label htmlFor="xMax" className="block text-sm font-medium text-gray-600 mb-1">
            xMax
          </label>
          <input
            id="xMax"
            type="number"
            step="any"
            value={xMax}
            onChange={(e) => { setXMax(e.target.value); setError(null); setSuccess(false) }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={saving}
          />
        </div>
        <div>
          <label htmlFor="yMin" className="block text-sm font-medium text-gray-600 mb-1">
            yMin
          </label>
          <input
            id="yMin"
            type="number"
            step="any"
            value={yMin}
            onChange={(e) => { setYMin(e.target.value); setError(null); setSuccess(false) }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={saving}
          />
        </div>
        <div>
          <label htmlFor="yMax" className="block text-sm font-medium text-gray-600 mb-1">
            yMax
          </label>
          <input
            id="yMax"
            type="number"
            step="any"
            value={yMax}
            onChange={(e) => { setYMax(e.target.value); setError(null); setSuccess(false) }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={saving}
          />
        </div>
      </div>

      {/* Inline error message */}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* Success feedback */}
      {success && (
        <p className="text-sm text-green-600" role="status">
          Map configuration saved successfully.
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {saving ? 'Saving...' : 'Save Bounds'}
      </button>
    </form>
  )
}
