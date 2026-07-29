import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiCall } from '../../lib/api'
import ConfirmDialog from './ConfirmDialog'
import InlineValidationError from './InlineValidationError'
import ShipInventoryInline from './ShipInventoryInline'

const API_URL = import.meta.env.VITE_API_URL

/**
 * Player detail panel showing full player state and management controls.
 * Displays gold, home port, ships (with expandable inventory), factories, and player inventory.
 * Provides editable gold field, home port dropdown, archive/unarchive, and delete actions.
 *
 * Validates: Requirements 2.3, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 *
 * @param {{
 *   player: { id: string, email: string, gold: number, home_port_id: string, archived: boolean, home_port: { id: string, name: string }, ships: Array, factories: Array, inventory: Array },
 *   onPlayerUpdated: (player: object) => void,
 *   onPlayerDeleted: () => void
 * }} props
 */
export default function PlayerDetailPanel({ player, onPlayerUpdated, onPlayerDeleted }) {
  const { session } = useAuth()
  const token = session?.access_token

  // Gold editing state
  const [goldValue, setGoldValue] = useState(String(player.gold ?? 0))
  const [goldError, setGoldError] = useState(null)
  const [goldSaving, setGoldSaving] = useState(false)

  // Home port editing state
  const [cities, setCities] = useState([])
  const [citiesLoading, setCitiesLoading] = useState(false)
  const [homePortId, setHomePortId] = useState(player.home_port_id || '')
  const [homePortError, setHomePortError] = useState(null)
  const [homePortSaving, setHomePortSaving] = useState(false)

  // Archive/delete state
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)

  // Ship accordion state — only one expanded at a time
  const [expandedShipId, setExpandedShipId] = useState(null)

  // Sync local state when player prop changes
  useEffect(() => {
    setGoldValue(String(player.gold ?? 0))
    setHomePortId(player.home_port_id || '')
    setGoldError(null)
    setHomePortError(null)
    setActionError(null)
  }, [player.id, player.gold, player.home_port_id])

  // Fetch cities for home port dropdown
  useEffect(() => {
    async function fetchCities() {
      setCitiesLoading(true)
      try {
        const data = await apiCall('/api/admin/cities', { token })
        setCities(Array.isArray(data) ? data : [])
      } catch {
        // Non-critical: dropdown will be empty
        setCities([])
      } finally {
        setCitiesLoading(false)
      }
    }
    if (token) {
      fetchCities()
    }
  }, [token])

  // --- Gold validation and save ---
  function validateGold(value) {
    const trimmed = value.trim()
    if (trimmed === '') return 'Gold value is required'
    const num = Number(trimmed)
    if (!Number.isInteger(num)) return 'Gold must be a whole number'
    if (num < 0 || num > 999999999) return 'Gold must be between 0 and 999,999,999'
    return null
  }

  async function handleGoldSave() {
    const error = validateGold(goldValue)
    if (error) {
      setGoldError(error)
      return
    }

    setGoldError(null)
    setGoldSaving(true)
    try {
      const updatedPlayer = await apiCall(`/api/admin/players/${player.id}`, {
        method: 'PUT',
        body: { gold: Number(goldValue) },
        token,
      })
      onPlayerUpdated(updatedPlayer)
    } catch (err) {
      setGoldError(err.message || 'Failed to update gold')
    } finally {
      setGoldSaving(false)
    }
  }

  // --- Home port save ---
  async function handleHomePortSave() {
    if (!homePortId) {
      setHomePortError('Please select a home port')
      return
    }

    setHomePortError(null)
    setHomePortSaving(true)
    try {
      const updatedPlayer = await apiCall(`/api/admin/players/${player.id}`, {
        method: 'PUT',
        body: { home_port_id: homePortId },
        token,
      })
      onPlayerUpdated(updatedPlayer)
    } catch (err) {
      setHomePortError(err.message || 'Failed to update home port')
    } finally {
      setHomePortSaving(false)
    }
  }

  // --- Archive/Unarchive ---
  async function handleArchiveConfirm() {
    setArchiveConfirmOpen(false)
    setActionLoading(true)
    setActionError(null)
    try {
      const endpoint = player.archived ? 'unarchive' : 'archive'
      const updatedPlayer = await apiCall(`/api/admin/players/${player.id}/${endpoint}`, {
        method: 'POST',
        token,
      })
      onPlayerUpdated(updatedPlayer)
    } catch (err) {
      setActionError(err.message || `Failed to ${player.archived ? 'unarchive' : 'archive'} player`)
    } finally {
      setActionLoading(false)
    }
  }

  // --- Delete ---
  async function handleDeleteConfirm() {
    setDeleteConfirmOpen(false)
    setActionLoading(true)
    setActionError(null)
    try {
      await apiCall(`/api/admin/players/${player.id}`, {
        method: 'DELETE',
        token,
      })
      onPlayerDeleted()
    } catch (err) {
      setActionError(err.message || 'Failed to delete player')
    } finally {
      setActionLoading(false)
    }
  }

  // --- Ship accordion toggle ---
  function handleShipToggle(shipId) {
    setExpandedShipId((prev) => (prev === shipId ? null : shipId))
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{player.email}</h3>
          {player.archived && (
            <span className="inline-block mt-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
              Archived
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setArchiveConfirmOpen(true)}
            disabled={actionLoading}
            className="px-3 py-1.5 text-sm font-medium rounded-md transition bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50"
          >
            {player.archived ? 'Unarchive' : 'Archive'}
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={actionLoading}
            className="px-3 py-1.5 text-sm font-medium rounded-md transition bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Action error */}
      {actionError && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {actionError}
        </p>
      )}

      {/* Gold editing */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-600 mb-1">Gold Balance</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="999999999"
            step="1"
            value={goldValue}
            onChange={(e) => {
              setGoldValue(e.target.value)
              setGoldError(null)
            }}
            className="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={goldSaving}
          />
          <button
            type="button"
            onClick={handleGoldSave}
            disabled={goldSaving}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {goldSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
        <InlineValidationError error={goldError} />
      </div>

      {/* Home port dropdown */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-600 mb-1">Home Port</label>
        <div className="flex items-center gap-2">
          <select
            value={homePortId}
            onChange={(e) => {
              setHomePortId(e.target.value)
              setHomePortError(null)
            }}
            className="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={homePortSaving || citiesLoading}
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
          <button
            type="button"
            onClick={handleHomePortSave}
            disabled={homePortSaving || citiesLoading}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {homePortSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
        <InlineValidationError error={homePortError} />
      </div>

      <hr className="border-gray-200 mb-6" />

      {/* Ships list with accordion */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Ships ({player.ships?.length ?? 0})
        </h4>
        {(!player.ships || player.ships.length === 0) ? (
          <p className="text-sm text-gray-400 italic">No ships</p>
        ) : (
          <div className="space-y-0">
            {player.ships.map((ship) => (
              <ShipInventoryInline
                key={ship.id}
                ship={ship}
                isExpanded={expandedShipId === ship.id}
                onToggle={() => handleShipToggle(ship.id)}
                token={token}
              />
            ))}
          </div>
        )}
      </div>

      <hr className="border-gray-200 mb-6" />

      {/* Factories list */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Factories ({player.factories?.length ?? 0})
        </h4>
        {(!player.factories || player.factories.length === 0) ? (
          <p className="text-sm text-gray-400 italic">No factories</p>
        ) : (
          <ul className="space-y-2">
            {player.factories.map((factory) => (
              <li
                key={factory.id}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded border border-gray-100"
              >
                <span className="text-sm text-gray-700 font-medium">{factory.factory_type}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${factory.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                  {factory.active ? 'Active' : 'Inactive'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <hr className="border-gray-200 mb-6" />

      {/* Player inventory */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Inventory ({player.inventory?.length ?? 0})
        </h4>
        {(!player.inventory || player.inventory.length === 0) ? (
          <p className="text-sm text-gray-400 italic">No items in inventory</p>
        ) : (
          <ul className="space-y-1">
            {player.inventory.map((item) => (
              <li
                key={item.item_name}
                className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded border border-gray-100"
              >
                <span className="text-sm text-gray-700">{item.item_name}</span>
                <span className="text-sm font-medium text-gray-600">{item.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Archive/Unarchive confirmation dialog */}
      <ConfirmDialog
        isOpen={archiveConfirmOpen}
        title={player.archived ? 'Unarchive Player' : 'Archive Player'}
        message={
          player.archived
            ? `Are you sure you want to unarchive ${player.email}? Their account will be reactivated.`
            : `Are you sure you want to archive ${player.email}? Their account will be deactivated but data will be preserved.`
        }
        confirmLabel={player.archived ? 'Unarchive' : 'Archive'}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveConfirmOpen(false)}
        variant="warning"
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Permanently Delete Player"
        message={`Are you sure you want to permanently delete ${player.email}? This will remove ALL associated data including ships, inventories, factories, and transactions. This action cannot be undone.`}
        confirmLabel="Delete Permanently"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmOpen(false)}
        variant="danger"
      />
    </div>
  )
}
