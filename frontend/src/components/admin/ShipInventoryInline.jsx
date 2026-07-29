import { useState, useEffect } from 'react'
import ConfirmDialog from './ConfirmDialog'
import InlineValidationError from './InlineValidationError'

const API_URL = import.meta.env.VITE_API_URL

/**
 * Expandable ship inventory view for the player detail cascade.
 * Click a ship header to show its inventory inline; collapse the previous one.
 *
 * Props:
 * - ship: { id, name, speed, cargo_capacity, status }
 * - isExpanded: boolean — whether this ship's inventory is visible
 * - onToggle: () => void — called when the ship header is clicked
 * - token: string — auth token for API calls
 *
 * Validates: Requirements 2.6, 5.4, 5.7
 */
export default function ShipInventoryInline({ ship, isExpanded, onToggle, token }) {
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Add form state
  const [addItemName, setAddItemName] = useState('')
  const [addQuantity, setAddQuantity] = useState('')
  const [addError, setAddError] = useState(null)
  const [addLoading, setAddLoading] = useState(false)

  // Edit state
  const [editingItem, setEditingItem] = useState(null)
  const [editQuantity, setEditQuantity] = useState('')
  const [editError, setEditError] = useState(null)
  const [editLoading, setEditLoading] = useState(false)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Compute cargo usage
  const totalCargo = inventory.reduce((sum, item) => sum + item.quantity, 0)
  const remainingCapacity = ship.cargo_capacity - totalCargo

  // Fetch inventory when expanded
  useEffect(() => {
    if (isExpanded) {
      fetchInventory()
    }
  }, [isExpanded, ship.id])

  async function fetchInventory() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/admin/inventory/ship/${ship.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to fetch inventory (${res.status})`)
      }
      const data = await res.json()
      setInventory(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load ship inventory')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setAddError(null)

    const qty = parseInt(addQuantity, 10)
    if (!addItemName.trim()) {
      setAddError('Item name is required')
      return
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 99999) {
      setAddError('Quantity must be an integer between 1 and 99,999')
      return
    }

    setAddLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/admin/inventory/ship/${ship.id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ item_name: addItemName.trim(), quantity: qty }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAddError(data.error || data.errors?.join(', ') || 'Failed to add item')
        return
      }

      // Refresh inventory after successful add
      setAddItemName('')
      setAddQuantity('')
      await fetchInventory()
    } catch (err) {
      setAddError(err.message || 'Network error')
    } finally {
      setAddLoading(false)
    }
  }

  async function handleEditSave(itemName) {
    setEditError(null)

    const qty = parseInt(editQuantity, 10)
    if (!Number.isInteger(qty) || qty < 1 || qty > 99999) {
      setEditError('Quantity must be an integer between 1 and 99,999')
      return
    }

    setEditLoading(true)
    try {
      const res = await fetch(
        `${API_URL}/api/admin/inventory/ship/${ship.id}/${encodeURIComponent(itemName)}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ quantity: qty }),
        }
      )

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEditError(data.error || data.errors?.join(', ') || 'Failed to update item')
        return
      }

      setEditingItem(null)
      setEditQuantity('')
      await fetchInventory()
    } catch (err) {
      setEditError(err.message || 'Network error')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return

    setDeleteLoading(true)
    try {
      const res = await fetch(
        `${API_URL}/api/admin/inventory/ship/${ship.id}/${encodeURIComponent(deleteTarget)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to delete item')
      } else {
        await fetchInventory()
      }
    } catch (err) {
      setError(err.message || 'Network error')
    } finally {
      setDeleteTarget(null)
      setDeleteLoading(false)
    }
  }

  function startEdit(item) {
    setEditingItem(item.item_name)
    setEditQuantity(String(item.quantity))
    setEditError(null)
  }

  function cancelEdit() {
    setEditingItem(null)
    setEditQuantity('')
    setEditError(null)
  }

  return (
    <div className="border border-gray-200 rounded-md mb-2">
      {/* Ship header — clickable to toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-800">{ship.name}</span>
          <span className="text-xs text-gray-500">
            Speed: {ship.speed} | Cargo: {ship.cargo_capacity} | Status: {ship.status}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded inventory panel */}
      {isExpanded && (
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
          {/* Capacity indicator */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-gray-600">Cargo:</span>
            <span className={`text-xs font-semibold ${remainingCapacity <= 0 ? 'text-red-600' : 'text-green-700'}`}>
              {totalCargo} / {ship.cargo_capacity} used
            </span>
            <span className="text-xs text-gray-500">
              ({remainingCapacity} remaining)
            </span>
          </div>

          {/* Loading state */}
          {loading && (
            <p className="text-sm text-gray-500 italic">Loading inventory...</p>
          )}

          {/* Error state */}
          {error && (
            <p className="text-sm text-red-600 mb-2">{error}</p>
          )}

          {/* Inventory list */}
          {!loading && inventory.length === 0 && !error && (
            <p className="text-sm text-gray-400 italic mb-3">No items in this ship's inventory.</p>
          )}

          {!loading && inventory.length > 0 && (
            <ul className="space-y-1 mb-3">
              {inventory.map((item) => (
                <li
                  key={item.item_name}
                  className="flex items-center justify-between py-1 px-2 bg-white rounded border border-gray-100"
                >
                  <span className="text-sm text-gray-700">{item.item_name}</span>

                  {editingItem === item.item_name ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="99999"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(e.target.value)}
                        className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                      <button
                        type="button"
                        onClick={() => handleEditSave(item.item_name)}
                        disabled={editLoading}
                        className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {editLoading ? '...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="text-xs px-2 py-1 text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
                        title="Click to edit quantity"
                      >
                        {item.quantity}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item.item_name)}
                        className="text-xs text-red-500 hover:text-red-700"
                        title="Delete item"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Edit validation error */}
          <InlineValidationError error={editError} />

          {/* Add item form */}
          <form onSubmit={handleAdd} className="flex items-end gap-2 mt-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-600 mb-1">Item Name</label>
              <input
                type="text"
                value={addItemName}
                onChange={(e) => setAddItemName(e.target.value)}
                placeholder="e.g. Iron"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs text-gray-600 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                max="99999"
                value={addQuantity}
                onChange={(e) => setAddQuantity(e.target.value)}
                placeholder="1"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
              />
            </div>
            <button
              type="submit"
              disabled={addLoading}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {addLoading ? '...' : 'Add'}
            </button>
          </form>
          <InlineValidationError error={addError} />
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Inventory Entry"
        message={`Are you sure you want to remove "${deleteTarget}" from ${ship.name}'s inventory?`}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  )
}
