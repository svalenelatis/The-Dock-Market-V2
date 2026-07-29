import { useState, useEffect, useCallback } from 'react'
import InlineValidationError from './InlineValidationError'

const API_URL = import.meta.env.VITE_API_URL

/**
 * Price Override Section — Admin tag creation and assignment management.
 * Allows admins to create tags with custom goods/tag category effects,
 * assign them to cities (permanent or with expiry), and manage active assignments.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.7
 *
 * @param {{ token: string }} props
 */
export default function PriceOverrideSection({ token }) {
  // --- State: Form ---
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [effects, setEffects] = useState([{ key: '', value: 0 }])
  const [cityId, setCityId] = useState('')
  const [isPermanent, setIsPermanent] = useState(true)
  const [expiresAt, setExpiresAt] = useState('')

  // --- State: Cities dropdown ---
  const [cities, setCities] = useState([])
  const [citiesLoading, setCitiesLoading] = useState(false)

  // --- State: Active assignments list ---
  const [assignments, setAssignments] = useState([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)

  // --- State: Errors and submission ---
  const [formErrors, setFormErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [duplicateError, setDuplicateError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [removingId, setRemovingId] = useState(null)

  // --- Fetch cities for dropdown ---
  const fetchCities = useCallback(async () => {
    setCitiesLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/admin/cities`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setCities(data)
      }
    } catch {
      // Silently fail — cities dropdown will be empty
    } finally {
      setCitiesLoading(false)
    }
  }, [token])

  // --- Fetch active admin tag assignments ---
  const fetchAssignments = useCallback(async () => {
    setAssignmentsLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/admin/price-overrides`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setAssignments(data)
      }
    } catch {
      // Silently fail
    } finally {
      setAssignmentsLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchCities()
    fetchAssignments()
  }, [fetchCities, fetchAssignments])

  // --- Client-side validation ---
  function validate() {
    const errors = {}

    if (!name.trim() || name.length > 100) {
      errors.name = 'Name must be between 1 and 100 characters'
    }

    if (!description.trim() || description.length > 500) {
      errors.description = 'Description must be between 1 and 500 characters'
    }

    // Validate effects
    const validEffects = effects.filter(e => e.key.trim() !== '')
    if (validEffects.length === 0) {
      errors.effects = 'At least one effect is required'
    } else {
      for (const effect of validEffects) {
        const val = Number(effect.value)
        if (isNaN(val) || val < -10 || val > 10) {
          errors.effects = 'All effect modifiers must be between -10 and 10'
          break
        }
      }
    }

    if (!cityId) {
      errors.cityId = 'A city must be selected'
    }

    if (!isPermanent) {
      if (!expiresAt) {
        errors.expiresAt = 'Expiry date is required for non-permanent assignments'
      } else {
        const expiryDate = new Date(expiresAt)
        const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000)
        if (expiryDate < oneDayFromNow) {
          errors.expiresAt = 'Expiry date must be at least 1 day in the future'
        }
      }
    }

    return errors
  }

  // --- Handle effect row changes ---
  function handleEffectKeyChange(index, value) {
    const updated = [...effects]
    updated[index] = { ...updated[index], key: value }
    setEffects(updated)
  }

  function handleEffectValueChange(index, value) {
    const updated = [...effects]
    updated[index] = { ...updated[index], value: Number(value) }
    setEffects(updated)
  }

  function addEffectRow() {
    setEffects([...effects, { key: '', value: 0 }])
  }

  function removeEffectRow(index) {
    const updated = effects.filter((_, i) => i !== index)
    setEffects(updated.length === 0 ? [{ key: '', value: 0 }] : updated)
  }

  // --- Build effects object for API ---
  function buildEffectsPayload() {
    const obj = {}
    for (const effect of effects) {
      if (effect.key.trim()) {
        obj[effect.key.trim()] = Number(effect.value)
      }
    }
    return obj
  }

  // --- Submit form ---
  async function handleSubmit(e) {
    e.preventDefault()
    setFormErrors({})
    setSubmitError('')
    setDuplicateError('')

    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      const body = {
        name: name.trim(),
        description: description.trim(),
        effects: buildEffectsPayload(),
        city_id: cityId,
        is_permanent: isPermanent,
        expires_at: isPermanent ? null : new Date(expiresAt).toISOString(),
      }

      const res = await fetch(`${API_URL}/api/admin/price-overrides`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (res.status === 409) {
        const data = await res.json()
        setDuplicateError(data.error || 'This admin tag is already assigned to that city')
        return
      }

      if (!res.ok) {
        const data = await res.json()
        const errorMsg = data.errors
          ? data.errors.join(', ')
          : data.error || 'Failed to create price override'
        setSubmitError(errorMsg)
        return
      }

      // Success — reset form and refresh list
      setName('')
      setDescription('')
      setEffects([{ key: '', value: 0 }])
      setCityId('')
      setIsPermanent(true)
      setExpiresAt('')
      fetchAssignments()
    } catch {
      setSubmitError('Network error — check your connection')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Remove/expire assignment ---
  async function handleRemove(assignmentId, mode) {
    setRemovingId(assignmentId)
    try {
      const res = await fetch(
        `${API_URL}/api/admin/price-overrides/${assignmentId}?mode=${mode}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      if (res.ok) {
        fetchAssignments()
      }
    } catch {
      // Silently fail
    } finally {
      setRemovingId(null)
    }
  }

  // --- Compute minimum date for expiry input (1 day from now) ---
  function getMinExpiryDate() {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    return tomorrow.toISOString().slice(0, 16) // datetime-local format
  }

  return (
    <div className="space-y-6">
      {/* --- Creation Form --- */}
      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <h4 className="text-md font-medium text-gray-700">Create Admin Tag Override</h4>

        {/* Name */}
        <div>
          <label htmlFor="override-name" className="block text-sm font-medium text-gray-600 mb-1">
            Name
          </label>
          <input
            id="override-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Tag name (1-100 chars)"
            disabled={submitting}
          />
          <InlineValidationError error={formErrors.name} />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="override-description" className="block text-sm font-medium text-gray-600 mb-1">
            Description
          </label>
          <textarea
            id="override-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Tag description (1-500 chars)"
            disabled={submitting}
          />
          <InlineValidationError error={formErrors.description} />
        </div>

        {/* Effects */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Effects (goods/category modifiers, -10 to 10)
          </label>
          <div className="space-y-2">
            {effects.map((effect, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={effect.key}
                  onChange={(e) => handleEffectKeyChange(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Item or category name"
                  disabled={submitting}
                />
                <input
                  type="number"
                  value={effect.value}
                  onChange={(e) => handleEffectValueChange(index, e.target.value)}
                  min={-10}
                  max={10}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => removeEffectRow(index)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium"
                  disabled={submitting}
                  aria-label={`Remove effect ${index + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addEffectRow}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            disabled={submitting}
          >
            + Add effect
          </button>
          <InlineValidationError error={formErrors.effects} />
        </div>

        {/* City Dropdown */}
        <div>
          <label htmlFor="override-city" className="block text-sm font-medium text-gray-600 mb-1">
            City
          </label>
          <select
            id="override-city"
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={submitting || citiesLoading}
          >
            <option value="">
              {citiesLoading ? 'Loading cities...' : 'Select a city'}
            </option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
          <InlineValidationError error={formErrors.cityId} />
        </div>

        {/* Permanent / Expiry */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <input
              id="override-permanent"
              type="checkbox"
              checked={isPermanent}
              onChange={(e) => setIsPermanent(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              disabled={submitting}
            />
            <label htmlFor="override-permanent" className="text-sm font-medium text-gray-600">
              Permanent
            </label>
          </div>

          {!isPermanent && (
            <div>
              <label htmlFor="override-expiry" className="block text-sm font-medium text-gray-600 mb-1">
                Expiry Date (must be ≥ 1 day in the future)
              </label>
              <input
                id="override-expiry"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={getMinExpiryDate()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              />
              <InlineValidationError error={formErrors.expiresAt} />
            </div>
          )}
        </div>

        {/* Duplicate error (409) */}
        {duplicateError && (
          <p className="text-sm text-orange-600 font-medium" role="alert">
            {duplicateError}
          </p>
        )}

        {/* General submit error */}
        {submitError && (
          <p className="text-sm text-red-600" role="alert">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {submitting ? 'Creating...' : 'Create Override'}
        </button>
      </form>

      <hr className="border-gray-200" />

      {/* --- Active Assignments List --- */}
      <div>
        <h4 className="text-md font-medium text-gray-700 mb-3">Active Admin Tag Assignments</h4>

        {assignmentsLoading ? (
          <p className="text-sm text-gray-500">Loading assignments...</p>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No active admin tag assignments.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-gray-200 rounded-md">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Tag Name</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">City</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Effects</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Expires</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assignments.map((assignment) => {
                  const tag = assignment.city_tags || {}
                  const cityName = cities.find(c => c.id === assignment.city_id)?.name || assignment.city_id
                  let effectsStr = '—'
                  if (tag.effects && typeof tag.effects === 'object') {
                    const parts = []
                    if (tag.effects.goods && typeof tag.effects.goods === 'object') {
                      for (const [k, v] of Object.entries(tag.effects.goods)) {
                        parts.push(`${k}: ${v > 0 ? '+' : ''}${v}`)
                      }
                    }
                    if (tag.effects.tags && typeof tag.effects.tags === 'object') {
                      for (const [k, v] of Object.entries(tag.effects.tags)) {
                        parts.push(`[${k}]: ${v > 0 ? '+' : ''}${v}`)
                      }
                    }
                    // Fallback: if effects is a flat object (not nested goods/tags)
                    if (parts.length === 0) {
                      for (const [k, v] of Object.entries(tag.effects)) {
                        if (typeof v === 'number') {
                          parts.push(`${k}: ${v > 0 ? '+' : ''}${v}`)
                        }
                      }
                    }
                    if (parts.length > 0) effectsStr = parts.join(', ')
                  }

                  return (
                    <tr key={assignment.id}>
                      <td className="px-3 py-2 font-medium">{tag.name || '—'}</td>
                      <td className="px-3 py-2">{cityName}</td>
                      <td className="px-3 py-2 text-xs font-mono">{effectsStr}</td>
                      <td className="px-3 py-2">
                        {assignment.is_permanent ? (
                          <span className="text-green-700 font-medium">Permanent</span>
                        ) : (
                          <span className="text-amber-700">Temporary</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {assignment.expires_at
                          ? new Date(assignment.expires_at).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRemove(assignment.id, 'immediate')}
                            disabled={removingId === assignment.id}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 transition"
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => handleRemove(assignment.id, 'expire')}
                            disabled={removingId === assignment.id}
                            className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50 transition"
                          >
                            Expire
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
