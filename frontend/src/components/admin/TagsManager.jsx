import { useState, useEffect, useCallback } from 'react'
import { apiCall } from '../../lib/api'
import InlineValidationError from './InlineValidationError'
import ConfirmDialog from './ConfirmDialog'

/**
 * Admin Tags Manager component.
 * Two sections: City Tags (list, create, edit, soft-delete, assignment management)
 * and Item Tags (read-only list derived from items).
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5
 *
 * @param {{ token: string }} props
 */
export default function TagsManager({ token }) {
  // --- City Tags State ---
  const [cityTags, setCityTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    effects: '',
  })
  const [createErrors, setCreateErrors] = useState({})
  const [creating, setCreating] = useState(false)

  // Inline edit state
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    effects: '',
  })
  const [editErrors, setEditErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    tagId: null,
    tagName: '',
  })

  // --- Item Tags State ---
  const [items, setItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(true)

  // --- City Tag Assignments State ---
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [cities, setCities] = useState([])
  const [assignForm, setAssignForm] = useState({
    city_id: '',
    tag_id: '',
    is_permanent: true,
    expires_at: '',
  })
  const [assignErrors, setAssignErrors] = useState({})
  const [assigning, setAssigning] = useState(false)
  const [assignments, setAssignments] = useState([])

  // --- Fetch City Tags ---
  const fetchCityTags = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiCall('/api/admin/city-tags', { token })
      setCityTags(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  // --- Fetch Items (for item tags) ---
  const fetchItems = useCallback(async () => {
    setItemsLoading(true)
    try {
      const data = await apiCall('/api/admin/items', { token })
      setItems(data)
    } catch {
      // silently fail for item tags section
    } finally {
      setItemsLoading(false)
    }
  }, [token])

  // --- Fetch Cities (for assignments) ---
  const fetchCities = useCallback(async () => {
    try {
      const data = await apiCall('/api/admin/cities', { token })
      setCities(data)
    } catch {
      // silently fail
    }
  }, [token])

  useEffect(() => {
    fetchCityTags()
    fetchItems()
    fetchCities()
  }, [fetchCityTags, fetchItems, fetchCities])

  // --- Validation ---

  function parseEffects(effectsStr) {
    if (!effectsStr || effectsStr.trim() === '') return {}
    try {
      return JSON.parse(effectsStr)
    } catch {
      return null
    }
  }

  function validateCityTagForm(form) {
    const errors = {}

    // Name: 1-100 chars
    const name = form.name.trim()
    if (!name) {
      errors.name = 'Name is required'
    } else if (name.length > 100) {
      errors.name = 'Name must be 1-100 characters'
    }

    // Description: 1-500 chars
    const description = form.description.trim()
    if (!description) {
      errors.description = 'Description is required'
    } else if (description.length > 500) {
      errors.description = 'Description must be 1-500 characters'
    }

    // Effects: JSON object with modifiers -10 to 10
    const effects = parseEffects(form.effects)
    if (form.effects.trim() !== '' && effects === null) {
      errors.effects = 'Effects must be valid JSON (e.g. {"goods":{"Wood":2},"tags":{"luxury":-1}})'
    } else if (effects !== null && typeof effects === 'object') {
      const allValues = []
      if (effects.goods && typeof effects.goods === 'object') {
        allValues.push(...Object.values(effects.goods))
      }
      if (effects.tags && typeof effects.tags === 'object') {
        allValues.push(...Object.values(effects.tags))
      }
      for (const val of allValues) {
        if (typeof val !== 'number' || val < -10 || val > 10) {
          errors.effects = 'All effect modifiers must be numbers between -10 and 10'
          break
        }
      }
    }

    return errors
  }

  // --- Create City Tag ---

  async function handleCreate(e) {
    e.preventDefault()
    setCreateErrors({})

    const errors = validateCityTagForm(createForm)
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors)
      return
    }

    const body = {
      name: createForm.name.trim(),
      description: createForm.description.trim(),
    }

    const effects = parseEffects(createForm.effects)
    if (effects && Object.keys(effects).length > 0) {
      body.effects = effects
    }

    setCreating(true)
    try {
      const newTag = await apiCall('/api/admin/city-tags', {
        method: 'POST',
        body,
        token,
      })
      setCityTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)))
      setCreateForm({ name: '', description: '', effects: '' })
      setShowCreateForm(false)
    } catch (err) {
      setCreateErrors({ _general: err.message })
    } finally {
      setCreating(false)
    }
  }

  // --- Edit City Tag ---

  function startEdit(tag) {
    setEditingId(tag.id)
    setEditForm({
      name: tag.name || '',
      description: tag.description || '',
      effects: tag.effects ? JSON.stringify(tag.effects, null, 2) : '',
    })
    setEditErrors({})
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm({ name: '', description: '', effects: '' })
    setEditErrors({})
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    setEditErrors({})

    const errors = validateCityTagForm(editForm)
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors)
      return
    }

    const body = {
      name: editForm.name.trim(),
      description: editForm.description.trim(),
    }

    const effects = parseEffects(editForm.effects)
    if (effects !== null) {
      body.effects = effects
    }

    setSaving(true)
    try {
      const updatedTag = await apiCall(`/api/admin/city-tags/${editingId}`, {
        method: 'PUT',
        body,
        token,
      })
      setCityTags(prev =>
        prev.map(tag => (tag.id === editingId ? updatedTag : tag))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      setEditingId(null)
    } catch (err) {
      setEditErrors({ _general: err.message })
    } finally {
      setSaving(false)
    }
  }

  // --- Soft-delete City Tag ---

  function requestDelete(tag) {
    setConfirmDialog({
      isOpen: true,
      tagId: tag.id,
      tagName: tag.name,
    })
  }

  async function confirmDelete() {
    const { tagId } = confirmDialog
    setConfirmDialog({ isOpen: false, tagId: null, tagName: '' })

    try {
      await apiCall(`/api/admin/city-tags/${tagId}`, {
        method: 'DELETE',
        token,
      })
      setCityTags(prev =>
        prev.map(tag => (tag.id === tagId ? { ...tag, active: false } : tag))
      )
    } catch (err) {
      setError(err.message)
    }
  }

  function cancelDelete() {
    setConfirmDialog({ isOpen: false, tagId: null, tagName: '' })
  }

  // --- City Tag Assignments ---

  function validateAssignForm() {
    const errors = {}
    if (!assignForm.city_id) {
      errors.city_id = 'City is required'
    }
    if (!assignForm.tag_id) {
      errors.tag_id = 'Tag is required'
    }
    if (!assignForm.is_permanent) {
      if (!assignForm.expires_at) {
        errors.expires_at = 'Expiry date is required for temporary assignments'
      } else {
        const expiryDate = new Date(assignForm.expires_at)
        const minDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
        if (expiryDate < minDate) {
          errors.expires_at = 'Expiry must be at least 1 day in the future'
        }
      }
    }
    return errors
  }

  async function handleAssign(e) {
    e.preventDefault()
    setAssignErrors({})

    const errors = validateAssignForm()
    if (Object.keys(errors).length > 0) {
      setAssignErrors(errors)
      return
    }

    const body = {
      city_id: assignForm.city_id,
      tag_id: assignForm.tag_id,
      is_permanent: assignForm.is_permanent,
    }

    if (!assignForm.is_permanent && assignForm.expires_at) {
      body.expires_at = new Date(assignForm.expires_at).toISOString()
    }

    setAssigning(true)
    try {
      const newAssignment = await apiCall('/api/admin/city-tags/assignments', {
        method: 'POST',
        body,
        token,
      })
      setAssignments(prev => [...prev, newAssignment])
      setAssignForm({ city_id: '', tag_id: '', is_permanent: true, expires_at: '' })
      setShowAssignForm(false)
    } catch (err) {
      setAssignErrors({ _general: err.message })
    } finally {
      setAssigning(false)
    }
  }

  async function removeAssignment(assignmentId) {
    try {
      await apiCall(`/api/admin/city-tags/assignments/${assignmentId}`, {
        method: 'DELETE',
        token,
      })
      setAssignments(prev => prev.filter(a => a.id !== assignmentId))
    } catch (err) {
      setError(err.message)
    }
  }

  // Fetch assignments on mount
  useEffect(() => {
    async function fetchAssignments() {
      try {
        const data = await apiCall('/api/admin/city-tags/assignments', { token })
        setAssignments(data)
      } catch {
        // endpoint may not exist yet
      }
    }
    fetchAssignments()
  }, [token])

  // --- Derive Item Tags from items ---

  function deriveItemTags() {
    const tagMap = {}
    for (const item of items) {
      if (item.tags && Array.isArray(item.tags)) {
        for (const tag of item.tags) {
          if (!tagMap[tag]) {
            tagMap[tag] = []
          }
          tagMap[tag].push(item.name)
        }
      }
    }
    return Object.entries(tagMap)
      .map(([name, goods]) => ({ name, goods }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  // --- Helper: format effects for display ---

  function formatEffects(effects) {
    if (!effects || typeof effects !== 'object') return '—'
    const parts = []
    if (effects.goods && typeof effects.goods === 'object') {
      for (const [key, val] of Object.entries(effects.goods)) {
        parts.push(`${key}: ${val > 0 ? '+' : ''}${val}`)
      }
    }
    if (effects.tags && typeof effects.tags === 'object') {
      for (const [key, val] of Object.entries(effects.tags)) {
        parts.push(`[${key}]: ${val > 0 ? '+' : ''}${val}`)
      }
    }
    return parts.length > 0 ? parts.join(', ') : '—'
  }

  // --- Render ---

  if (loading) {
    return <div className="text-gray-500 text-sm py-4">Loading tags...</div>
  }

  const itemTags = deriveItemTags()

  return (
    <div className="space-y-8">
      {/* =============== CITY TAGS SECTION =============== */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-700">City Tags</h3>
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition"
          >
            {showCreateForm ? 'Cancel' : 'Add City Tag'}
          </button>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md mb-4" role="alert">
            {error}
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <form onSubmit={handleCreate} className="p-4 bg-gray-50 border border-gray-200 rounded-md space-y-3 mb-4">
            <h4 className="text-sm font-semibold text-gray-600">New City Tag</h4>

            <div>
              <label htmlFor="ct-create-name" className="block text-sm font-medium text-gray-600 mb-1">
                Name
              </label>
              <input
                id="ct-create-name"
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
              <label htmlFor="ct-create-desc" className="block text-sm font-medium text-gray-600 mb-1">
                Description
              </label>
              <textarea
                id="ct-create-desc"
                value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={500}
                rows={2}
                disabled={creating}
              />
              <InlineValidationError error={createErrors.description} />
            </div>

            <div>
              <label htmlFor="ct-create-effects" className="block text-sm font-medium text-gray-600 mb-1">
                Effects <span className="text-gray-400">(JSON, e.g. {`{"goods":{"Wood":2},"tags":{"luxury":-1}}`})</span>
              </label>
              <textarea
                id="ct-create-effects"
                value={createForm.effects}
                onChange={e => setCreateForm(f => ({ ...f, effects: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                disabled={creating}
              />
              <InlineValidationError error={createErrors.effects} />
            </div>

            <InlineValidationError error={createErrors._general} />

            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {creating ? 'Creating...' : 'Create City Tag'}
            </button>
          </form>
        )}

        {/* City Tags List */}
        {cityTags.length === 0 ? (
          <p className="text-sm text-gray-500">No city tags found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-md">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Effects</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {cityTags.map(tag => (
                  editingId === tag.id ? (
                    <tr key={tag.id} className="bg-yellow-50">
                      <td className="px-3 py-2" colSpan={5}>
                        <form onSubmit={handleSaveEdit} className="space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                              <label htmlFor={`edit-name-${tag.id}`} className="block text-xs font-medium text-gray-600">
                                Name
                              </label>
                              <input
                                id={`edit-name-${tag.id}`}
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
                              <label htmlFor={`edit-desc-${tag.id}`} className="block text-xs font-medium text-gray-600">
                                Description
                              </label>
                              <textarea
                                id={`edit-desc-${tag.id}`}
                                value={editForm.description}
                                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                maxLength={500}
                                rows={2}
                                disabled={saving}
                              />
                              <InlineValidationError error={editErrors.description} />
                            </div>
                          </div>
                          <div>
                            <label htmlFor={`edit-effects-${tag.id}`} className="block text-xs font-medium text-gray-600">
                              Effects (JSON)
                            </label>
                            <textarea
                              id={`edit-effects-${tag.id}`}
                              value={editForm.effects}
                              onChange={e => setEditForm(f => ({ ...f, effects: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={3}
                              disabled={saving}
                            />
                            <InlineValidationError error={editErrors.effects} />
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
                      key={tag.id}
                      className={tag.active === false ? 'bg-gray-100 text-gray-400' : ''}
                    >
                      <td className="px-3 py-2">
                        <span className={tag.active === false ? 'line-through' : ''}>
                          {tag.name}
                        </span>
                      </td>
                      <td className="px-3 py-2 max-w-xs truncate">{tag.description || '—'}</td>
                      <td className="px-3 py-2 text-xs">{formatEffects(tag.effects)}</td>
                      <td className="px-3 py-2">
                        {tag.active === false ? (
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
                            onClick={() => startEdit(tag)}
                            className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
                          >
                            Edit
                          </button>
                          {tag.active !== false && (
                            <button
                              type="button"
                              onClick={() => requestDelete(tag)}
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
      </section>

      {/* =============== CITY TAG ASSIGNMENTS SECTION =============== */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-700">City Tag Assignments</h3>
          <button
            type="button"
            onClick={() => setShowAssignForm(!showAssignForm)}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition"
          >
            {showAssignForm ? 'Cancel' : 'Assign Tag'}
          </button>
        </div>

        {/* Assign Form */}
        {showAssignForm && (
          <form onSubmit={handleAssign} className="p-4 bg-gray-50 border border-gray-200 rounded-md space-y-3 mb-4">
            <h4 className="text-sm font-semibold text-gray-600">Assign City Tag</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="assign-city" className="block text-sm font-medium text-gray-600 mb-1">
                  City
                </label>
                <select
                  id="assign-city"
                  value={assignForm.city_id}
                  onChange={e => setAssignForm(f => ({ ...f, city_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={assigning}
                >
                  <option value="">Select a city...</option>
                  {cities.map(city => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
                <InlineValidationError error={assignErrors.city_id} />
              </div>

              <div>
                <label htmlFor="assign-tag" className="block text-sm font-medium text-gray-600 mb-1">
                  Tag
                </label>
                <select
                  id="assign-tag"
                  value={assignForm.tag_id}
                  onChange={e => setAssignForm(f => ({ ...f, tag_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={assigning}
                >
                  <option value="">Select a tag...</option>
                  {cityTags.filter(t => t.active !== false).map(tag => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
                <InlineValidationError error={assignErrors.tag_id} />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={assignForm.is_permanent}
                  onChange={e => setAssignForm(f => ({ ...f, is_permanent: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={assigning}
                />
                Permanent
              </label>
            </div>

            {!assignForm.is_permanent && (
              <div>
                <label htmlFor="assign-expiry" className="block text-sm font-medium text-gray-600 mb-1">
                  Expiry Date
                </label>
                <input
                  id="assign-expiry"
                  type="datetime-local"
                  value={assignForm.expires_at}
                  onChange={e => setAssignForm(f => ({ ...f, expires_at: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={assigning}
                />
                <InlineValidationError error={assignErrors.expires_at} />
              </div>
            )}

            <InlineValidationError error={assignErrors._general} />

            <button
              type="submit"
              disabled={assigning}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {assigning ? 'Assigning...' : 'Assign Tag'}
            </button>
          </form>
        )}

        {/* Assignments List */}
        {assignments.length === 0 ? (
          <p className="text-sm text-gray-500">No active assignments.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-md">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">City</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Tag</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Expires</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assignments.map(a => {
                  const cityName = a.cities?.name || cities.find(c => c.id === a.city_id)?.name || a.city_id
                  const tagName = a.city_tags?.name || cityTags.find(t => t.id === a.tag_id)?.name || a.tag_id
                  return (
                    <tr key={a.id}>
                      <td className="px-3 py-2">{cityName}</td>
                      <td className="px-3 py-2">{tagName}</td>
                      <td className="px-3 py-2">
                        {a.is_permanent ? (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                            Permanent
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">
                            Temporary
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {a.expires_at ? new Date(a.expires_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeAssignment(a.id)}
                          className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* =============== ITEM TAGS SECTION =============== */}
      <section>
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Item Tags</h3>

        {itemsLoading ? (
          <p className="text-sm text-gray-500">Loading item tags...</p>
        ) : itemTags.length === 0 ? (
          <p className="text-sm text-gray-500">No item tags found. Tags are derived from item definitions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-md">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Tag Name</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Associated Goods</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {itemTags.map(tag => (
                  <tr key={tag.name}>
                    <td className="px-3 py-2 font-medium">{tag.name}</td>
                    <td className="px-3 py-2 text-gray-500">—</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {tag.goods.map(good => (
                          <span
                            key={good}
                            className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded"
                          >
                            {good}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Confirm Dialog for soft-delete */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Deactivate City Tag"
        message={`Are you sure you want to deactivate "${confirmDialog.tagName}"? It will be marked as inactive but not permanently removed.`}
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="warning"
      />
    </div>
  )
}
