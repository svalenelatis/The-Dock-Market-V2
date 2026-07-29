import { useState, useEffect, useCallback } from 'react'
import { apiCall } from '../../lib/api'
import InlineValidationError from './InlineValidationError'
import ConfirmDialog from './ConfirmDialog'

/**
 * Admin Items Manager component.
 * Lists all items (including soft-deleted), supports create, inline edit, and soft-delete.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 *
 * @param {{ token: string }} props
 */
export default function ItemsManager({ token }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    base_price: '',
    components: '',
    tags: '',
  })
  const [createErrors, setCreateErrors] = useState({})
  const [creating, setCreating] = useState(false)

  // Inline edit state
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    base_price: '',
    components: '',
    tags: '',
  })
  const [editErrors, setEditErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    itemId: null,
    itemName: '',
  })

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiCall('/api/admin/items', { token })
      setItems(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // --- Validation ---

  function validateItemForm(form) {
    const errors = {}

    // Name: 1-100 chars
    const name = form.name.trim()
    if (!name) {
      errors.name = 'Name is required'
    } else if (name.length > 100) {
      errors.name = 'Name must be 1-100 characters'
    }

    // Base price: number 0-1,000,000
    const price = parseFloat(form.base_price)
    if (form.base_price === '' || isNaN(price)) {
      errors.base_price = 'Base price is required and must be a number'
    } else if (price < 0 || price > 1000000) {
      errors.base_price = 'Base price must be between 0 and 1,000,000'
    }

    // Components: up to 10 non-empty strings (optional)
    const components = parseListField(form.components)
    if (components.length > 10) {
      errors.components = 'Maximum 10 components allowed'
    } else if (components.some(c => c.trim() === '')) {
      errors.components = 'Component entries must not be empty'
    }

    // Tags: up to 10 non-empty strings (optional)
    const tags = parseListField(form.tags)
    if (tags.length > 10) {
      errors.tags = 'Maximum 10 tags allowed'
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

    const errors = validateItemForm(createForm)
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors)
      return
    }

    const body = {
      name: createForm.name.trim(),
      base_price: parseFloat(createForm.base_price),
    }

    const components = parseListField(createForm.components)
    if (components.length > 0) body.components = components

    const tags = parseListField(createForm.tags)
    if (tags.length > 0) body.tags = tags

    setCreating(true)
    try {
      const newItem = await apiCall('/api/admin/items', {
        method: 'POST',
        body,
        token,
      })
      setItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)))
      setCreateForm({ name: '', base_price: '', components: '', tags: '' })
      setShowCreateForm(false)
    } catch (err) {
      setCreateErrors({ _general: err.message })
    } finally {
      setCreating(false)
    }
  }

  // --- Edit ---

  function startEdit(item) {
    setEditingId(item.id)
    setEditForm({
      name: item.name || '',
      base_price: String(item.base_price ?? ''),
      components: (item.components || []).join(', '),
      tags: (item.tags || []).join(', '),
    })
    setEditErrors({})
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm({ name: '', base_price: '', components: '', tags: '' })
    setEditErrors({})
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    setEditErrors({})

    const errors = validateItemForm(editForm)
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors)
      return
    }

    const body = {
      name: editForm.name.trim(),
      base_price: parseFloat(editForm.base_price),
    }

    const components = parseListField(editForm.components)
    body.components = components

    const tags = parseListField(editForm.tags)
    body.tags = tags

    setSaving(true)
    try {
      const updatedItem = await apiCall(`/api/admin/items/${editingId}`, {
        method: 'PUT',
        body,
        token,
      })
      setItems(prev =>
        prev.map(item => (item.id === editingId ? updatedItem : item))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      setEditingId(null)
    } catch (err) {
      if (err.message === 'Item not found') {
        setEditErrors({ _general: 'Item not found — it may have been deleted' })
      } else {
        setEditErrors({ _general: err.message })
      }
    } finally {
      setSaving(false)
    }
  }

  // --- Soft-delete ---

  function requestDelete(item) {
    setConfirmDialog({
      isOpen: true,
      itemId: item.id,
      itemName: item.name,
    })
  }

  async function confirmDelete() {
    const { itemId } = confirmDialog
    setConfirmDialog({ isOpen: false, itemId: null, itemName: '' })

    try {
      const updatedItem = await apiCall(`/api/admin/items/${itemId}`, {
        method: 'DELETE',
        token,
      })
      setItems(prev =>
        prev.map(item => (item.id === itemId ? updatedItem : item))
      )
    } catch (err) {
      if (err.message === 'Item not found') {
        setError('Item not found — it may have already been deleted')
      } else {
        setError(err.message)
      }
    }
  }

  function cancelDelete() {
    setConfirmDialog({ isOpen: false, itemId: null, itemName: '' })
  }

  // --- Render ---

  if (loading) {
    return <div className="text-gray-500 text-sm py-4">Loading items...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-700">Items</h3>
        <button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition"
        >
          {showCreateForm ? 'Cancel' : 'Add Item'}
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
          <h4 className="text-sm font-semibold text-gray-600">New Item</h4>

          <div>
            <label htmlFor="create-name" className="block text-sm font-medium text-gray-600 mb-1">
              Name
            </label>
            <input
              id="create-name"
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
            <label htmlFor="create-base-price" className="block text-sm font-medium text-gray-600 mb-1">
              Base Price
            </label>
            <input
              id="create-base-price"
              type="number"
              step="any"
              min="0"
              max="1000000"
              value={createForm.base_price}
              onChange={e => setCreateForm(f => ({ ...f, base_price: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={creating}
            />
            <InlineValidationError error={createErrors.base_price} />
          </div>

          <div>
            <label htmlFor="create-components" className="block text-sm font-medium text-gray-600 mb-1">
              Components <span className="text-gray-400">(comma-separated, optional)</span>
            </label>
            <input
              id="create-components"
              type="text"
              value={createForm.components}
              onChange={e => setCreateForm(f => ({ ...f, components: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Wood, Iron, Cloth"
              disabled={creating}
            />
            <InlineValidationError error={createErrors.components} />
          </div>

          <div>
            <label htmlFor="create-tags" className="block text-sm font-medium text-gray-600 mb-1">
              Tags <span className="text-gray-400">(comma-separated, optional)</span>
            </label>
            <input
              id="create-tags"
              type="text"
              value={createForm.tags}
              onChange={e => setCreateForm(f => ({ ...f, tags: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. luxury, spice, metal"
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
            {creating ? 'Creating...' : 'Create Item'}
          </button>
        </form>
      )}

      {/* Items List */}
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No items found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-md">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Base Price</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Components</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Tags</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map(item => (
                editingId === item.id ? (
                  <tr key={item.id} className="bg-yellow-50">
                    <td className="px-3 py-2" colSpan={6}>
                      <form onSubmit={handleSaveEdit} className="space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <label htmlFor={`edit-name-${item.id}`} className="block text-xs font-medium text-gray-600">
                              Name
                            </label>
                            <input
                              id={`edit-name-${item.id}`}
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
                            <label htmlFor={`edit-price-${item.id}`} className="block text-xs font-medium text-gray-600">
                              Base Price
                            </label>
                            <input
                              id={`edit-price-${item.id}`}
                              type="number"
                              step="any"
                              min="0"
                              max="1000000"
                              value={editForm.base_price}
                              onChange={e => setEditForm(f => ({ ...f, base_price: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={saving}
                            />
                            <InlineValidationError error={editErrors.base_price} />
                          </div>
                          <div>
                            <label htmlFor={`edit-components-${item.id}`} className="block text-xs font-medium text-gray-600">
                              Components (comma-separated)
                            </label>
                            <input
                              id={`edit-components-${item.id}`}
                              type="text"
                              value={editForm.components}
                              onChange={e => setEditForm(f => ({ ...f, components: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={saving}
                            />
                            <InlineValidationError error={editErrors.components} />
                          </div>
                          <div>
                            <label htmlFor={`edit-tags-${item.id}`} className="block text-xs font-medium text-gray-600">
                              Tags (comma-separated)
                            </label>
                            <input
                              id={`edit-tags-${item.id}`}
                              type="text"
                              value={editForm.tags}
                              onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={saving}
                            />
                            <InlineValidationError error={editErrors.tags} />
                          </div>
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
                    key={item.id}
                    className={item.active === false ? 'bg-gray-100 text-gray-400' : ''}
                  >
                    <td className="px-3 py-2">
                      <span className={item.active === false ? 'line-through' : ''}>
                        {item.name}
                      </span>
                    </td>
                    <td className="px-3 py-2">{item.base_price}</td>
                    <td className="px-3 py-2">{(item.components || []).length}</td>
                    <td className="px-3 py-2">{(item.tags || []).length}</td>
                    <td className="px-3 py-2">
                      {item.active === false ? (
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
                          onClick={() => startEdit(item)}
                          className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
                        >
                          Edit
                        </button>
                        {item.active !== false && (
                          <button
                            type="button"
                            onClick={() => requestDelete(item)}
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
        title="Deactivate Item"
        message={`Are you sure you want to deactivate "${confirmDialog.itemName}"? It will be marked as inactive but not permanently removed.`}
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="warning"
      />
    </div>
  )
}
