import { useState, useEffect, useCallback } from 'react'
import { apiCall } from '../../lib/api'
import InlineValidationError from './InlineValidationError'
import ConfirmDialog from './ConfirmDialog'

/**
 * Admin Cities Manager component.
 * Lists all cities sorted alphabetically, supports create, inline edit, and soft-delete.
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 *
 * @param {{ token: string }} props
 */
export default function CitiesManager({ token }) {
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    volatility: '',
    location_x: '',
    location_y: '',
    tags: '',
  })
  const [createErrors, setCreateErrors] = useState({})
  const [creating, setCreating] = useState(false)

  // Inline edit state
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    volatility: '',
    location_x: '',
    location_y: '',
    tags: '',
  })
  const [editErrors, setEditErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    cityId: null,
    cityName: '',
  })

  const fetchCities = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiCall('/api/admin/cities', { token })
      // Sort alphabetically by name
      const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name))
      setCities(sorted)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchCities()
  }, [fetchCities])

  // --- Validation ---

  function validateCityForm(form) {
    const errors = {}

    // Name: 1-100 chars
    const name = form.name.trim()
    if (!name) {
      errors.name = 'Name is required'
    } else if (name.length > 100) {
      errors.name = 'Name must be 1-100 characters'
    }

    // Volatility: number 0-1
    const volatility = parseFloat(form.volatility)
    if (form.volatility === '' || isNaN(volatility)) {
      errors.volatility = 'Volatility is required and must be a number'
    } else if (volatility < 0 || volatility > 1) {
      errors.volatility = 'Volatility must be between 0 and 1'
    }

    // Location X: number -1000 to 1000
    const x = parseFloat(form.location_x)
    if (form.location_x === '' || isNaN(x)) {
      errors.location_x = 'Location X is required and must be a number'
    } else if (x < -1000 || x > 1000) {
      errors.location_x = 'Location X must be between -1000 and 1000'
    }

    // Location Y: number -1000 to 1000
    const y = parseFloat(form.location_y)
    if (form.location_y === '' || isNaN(y)) {
      errors.location_y = 'Location Y is required and must be a number'
    } else if (y < -1000 || y > 1000) {
      errors.location_y = 'Location Y must be between -1000 and 1000'
    }

    // Tags: optional, up to 20 non-empty strings
    const tags = parseListField(form.tags)
    if (tags.length > 20) {
      errors.tags = 'Maximum 20 tags allowed'
    } else if (tags.some(t => t.trim() === '')) {
      errors.tags = 'Tag entries must not be empty'
    }

    return errors
  }

  function parseListField(value) {
    if (!value || value.trim() === '') return []
    return value.split(',').map(s => s.trim()).filter(s => s !== '')
  }

  // --- Create ---

  async function handleCreate(e) {
    e.preventDefault()
    setCreateErrors({})

    const errors = validateCityForm(createForm)
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors)
      return
    }

    const body = {
      name: createForm.name.trim(),
      volatility: parseFloat(createForm.volatility),
      location: {
        x: parseFloat(createForm.location_x),
        y: parseFloat(createForm.location_y),
      },
    }

    const tags = parseListField(createForm.tags)
    if (tags.length > 0) body.tags = tags

    setCreating(true)
    try {
      const newCity = await apiCall('/api/admin/cities', {
        method: 'POST',
        body,
        token,
      })
      setCities(prev => [...prev, newCity].sort((a, b) => a.name.localeCompare(b.name)))
      setCreateForm({ name: '', volatility: '', location_x: '', location_y: '', tags: '' })
      setShowCreateForm(false)
    } catch (err) {
      setCreateErrors({ _general: err.message })
    } finally {
      setCreating(false)
    }
  }

  // --- Edit ---

  function startEdit(city) {
    setEditingId(city.id)
    setEditForm({
      name: city.name || '',
      volatility: String(city.volatility ?? ''),
      location_x: String(city.location?.x ?? ''),
      location_y: String(city.location?.y ?? ''),
      tags: (city.tags || []).join(', '),
    })
    setEditErrors({})
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm({ name: '', volatility: '', location_x: '', location_y: '', tags: '' })
    setEditErrors({})
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    setEditErrors({})

    const errors = validateCityForm(editForm)
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors)
      return
    }

    const body = {
      name: editForm.name.trim(),
      volatility: parseFloat(editForm.volatility),
      location: {
        x: parseFloat(editForm.location_x),
        y: parseFloat(editForm.location_y),
      },
    }

    const tags = parseListField(editForm.tags)
    body.tags = tags

    setSaving(true)
    try {
      const updatedCity = await apiCall(`/api/admin/cities/${editingId}`, {
        method: 'PUT',
        body,
        token,
      })
      setCities(prev =>
        prev.map(city => (city.id === editingId ? updatedCity : city))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      setEditingId(null)
    } catch (err) {
      if (err.message === 'City not found') {
        setEditErrors({ _general: 'City not found — it may have been deleted' })
      } else {
        setEditErrors({ _general: err.message })
      }
    } finally {
      setSaving(false)
    }
  }

  // --- Soft-delete ---

  function requestDelete(city) {
    setConfirmDialog({
      isOpen: true,
      cityId: city.id,
      cityName: city.name,
    })
  }

  async function confirmDelete() {
    const { cityId } = confirmDialog
    setConfirmDialog({ isOpen: false, cityId: null, cityName: '' })

    try {
      const updatedCity = await apiCall(`/api/admin/cities/${cityId}`, {
        method: 'DELETE',
        token,
      })
      setCities(prev =>
        prev.map(city => (city.id === cityId ? updatedCity : city))
      )
    } catch (err) {
      if (err.message === 'City not found') {
        setError('City not found — it may have already been deleted')
      } else {
        setError(err.message)
      }
    }
  }

  function cancelDelete() {
    setConfirmDialog({ isOpen: false, cityId: null, cityName: '' })
  }

  // --- Render ---

  if (loading) {
    return <div className="text-gray-500 text-sm py-4">Loading cities...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-700">Cities</h3>
        <button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition"
        >
          {showCreateForm ? 'Cancel' : 'Add City'}
        </button>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md" role="alert">
          {error}
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="p-4 bg-gray-50 border border-gray-200 rounded-md space-y-3">
          <h4 className="text-sm font-semibold text-gray-600">New City</h4>

          <div>
            <label htmlFor="create-city-name" className="block text-sm font-medium text-gray-600 mb-1">
              Name
            </label>
            <input
              id="create-city-name"
              type="text"
              value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={100}
              disabled={creating}
            />
            <InlineValidationError error={createErrors.name} />
          </div>

          <div>
            <label htmlFor="create-city-volatility" className="block text-sm font-medium text-gray-600 mb-1">
              Volatility
            </label>
            <input
              id="create-city-volatility"
              type="number"
              step="any"
              min="0"
              max="1"
              value={createForm.volatility}
              onChange={e => setCreateForm(f => ({ ...f, volatility: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={creating}
            />
            <InlineValidationError error={createErrors.volatility} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="create-city-x" className="block text-sm font-medium text-gray-600 mb-1">
                Location X
              </label>
              <input
                id="create-city-x"
                type="number"
                step="any"
                min="-1000"
                max="1000"
                value={createForm.location_x}
                onChange={e => setCreateForm(f => ({ ...f, location_x: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={creating}
              />
              <InlineValidationError error={createErrors.location_x} />
            </div>
            <div>
              <label htmlFor="create-city-y" className="block text-sm font-medium text-gray-600 mb-1">
                Location Y
              </label>
              <input
                id="create-city-y"
                type="number"
                step="any"
                min="-1000"
                max="1000"
                value={createForm.location_y}
                onChange={e => setCreateForm(f => ({ ...f, location_y: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={creating}
              />
              <InlineValidationError error={createErrors.location_y} />
            </div>
          </div>

          <div>
            <label htmlFor="create-city-tags" className="block text-sm font-medium text-gray-600 mb-1">
              Tags <span className="text-gray-400">(comma-separated, optional, max 20)</span>
            </label>
            <input
              id="create-city-tags"
              type="text"
              value={createForm.tags}
              onChange={e => setCreateForm(f => ({ ...f, tags: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Agricultural, Industrial, Mining"
              disabled={creating}
            />
            <InlineValidationError error={createErrors.tags} />
          </div>

          <InlineValidationError error={createErrors._general} />

          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {creating ? 'Creating...' : 'Create City'}
          </button>
        </form>
      )}

      {/* Cities List */}
      {cities.length === 0 ? (
        <p className="text-sm text-gray-500">No cities found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-md">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Volatility</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Location</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Tags</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {cities.map(city => (
                editingId === city.id ? (
                  <tr key={city.id} className="bg-yellow-50">
                    <td className="px-3 py-2" colSpan={6}>
                      <form onSubmit={handleSaveEdit} className="space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <label htmlFor={`edit-city-name-${city.id}`} className="block text-xs font-medium text-gray-600">
                              Name
                            </label>
                            <input
                              id={`edit-city-name-${city.id}`}
                              type="text"
                              value={editForm.name}
                              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              maxLength={100}
                              disabled={saving}
                            />
                            <InlineValidationError error={editErrors.name} />
                          </div>
                          <div>
                            <label htmlFor={`edit-city-volatility-${city.id}`} className="block text-xs font-medium text-gray-600">
                              Volatility
                            </label>
                            <input
                              id={`edit-city-volatility-${city.id}`}
                              type="number"
                              step="any"
                              min="0"
                              max="1"
                              value={editForm.volatility}
                              onChange={e => setEditForm(f => ({ ...f, volatility: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={saving}
                            />
                            <InlineValidationError error={editErrors.volatility} />
                          </div>
                          <div>
                            <label htmlFor={`edit-city-x-${city.id}`} className="block text-xs font-medium text-gray-600">
                              Location X
                            </label>
                            <input
                              id={`edit-city-x-${city.id}`}
                              type="number"
                              step="any"
                              min="-1000"
                              max="1000"
                              value={editForm.location_x}
                              onChange={e => setEditForm(f => ({ ...f, location_x: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={saving}
                            />
                            <InlineValidationError error={editErrors.location_x} />
                          </div>
                          <div>
                            <label htmlFor={`edit-city-y-${city.id}`} className="block text-xs font-medium text-gray-600">
                              Location Y
                            </label>
                            <input
                              id={`edit-city-y-${city.id}`}
                              type="number"
                              step="any"
                              min="-1000"
                              max="1000"
                              value={editForm.location_y}
                              onChange={e => setEditForm(f => ({ ...f, location_y: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={saving}
                            />
                            <InlineValidationError error={editErrors.location_y} />
                          </div>
                        </div>
                        <div>
                          <label htmlFor={`edit-city-tags-${city.id}`} className="block text-xs font-medium text-gray-600">
                            Tags (comma-separated, max 20)
                          </label>
                          <input
                            id={`edit-city-tags-${city.id}`}
                            type="text"
                            value={editForm.tags}
                            onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={saving}
                          />
                          <InlineValidationError error={editErrors.tags} />
                        </div>
                        <InlineValidationError error={editErrors._general} />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={saving}
                            className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={saving}
                            className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={city.id}
                    className={city.active === false ? 'bg-gray-100 text-gray-400' : ''}
                  >
                    <td className="px-3 py-2">
                      <span className={city.active === false ? 'line-through' : ''}>
                        {city.name}
                      </span>
                    </td>
                    <td className="px-3 py-2">{city.volatility}</td>
                    <td className="px-3 py-2">
                      ({city.location?.x}, {city.location?.y})
                    </td>
                    <td className="px-3 py-2">{(city.tags || []).join(', ') || '—'}</td>
                    <td className="px-3 py-2">
                      {city.active === false ? (
                        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-500 rounded">
                          Inactive
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(city)}
                          className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
                        >
                          Edit
                        </button>
                        {city.active !== false && (
                          <button
                            type="button"
                            onClick={() => requestDelete(city)}
                            className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm Dialog for soft-delete */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Deactivate City"
        message={`Are you sure you want to deactivate "${confirmDialog.cityName}"? It will no longer appear in player-facing views but will remain in the database.`}
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="warning"
      />
    </div>
  )
}
