import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiCall } from '../lib/api'
import { useShips, useTransactions, usePlayer } from '../hooks/usePlayerData'
import { useCities, useItems } from '../hooks/usePublicData'
import supabase from '../lib/supabase'

/**
 * Transactions page — pending transactions front and center,
 * completed history below, and a multi-action modal for creating new transactions.
 */
export default function Transactions() {
  const { session, user } = useAuth()
  const { data: transactions, loading: txLoading, error: txError, refetch: refetchTransactions } = useTransactions()
  const { data: ships, loading: shipsLoading } = useShips()
  const { data: player, loading: playerLoading } = usePlayer()
  const { data: cities, loading: citiesLoading } = useCities()
  const { data: items, loading: itemsLoading } = useItems()

  const [showModal, setShowModal] = useState(() => {
    try {
      const draft = sessionStorage.getItem('tx-draft')
      return draft ? JSON.parse(draft).showModal ?? false : false
    } catch { return false }
  })
  const loading = txLoading || shipsLoading || citiesLoading || itemsLoading || playerLoading

  // Split transactions into pending and history
  const pending = (transactions || []).filter(
    (tx) => tx.status === 'PENDING' || tx.status === 'EXECUTING'
  )
  const history = (transactions || []).filter(
    (tx) => tx.status !== 'PENDING' && tx.status !== 'EXECUTING'
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Transactions</h1>
        <button
          onClick={() => {
            sessionStorage.setItem('tx-draft', JSON.stringify({ showModal: true, shipId: '', cityId: '', actions: [] }))
            setShowModal(true)
          }}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition"
        >
          + New Transaction
        </button>
      </div>

      {txError && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          Error loading data: {txError}
        </div>
      )}

      {/* Pending Transactions */}
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          En Route ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-gray-400 italic text-sm">No ships en route.</p>
        ) : (
          <TransactionTable rows={pending} />
        )}
      </section>

      {/* Transaction History */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          History ({history.length})
        </h2>
        {history.length === 0 ? (
          <p className="text-gray-400 italic text-sm">No completed transactions yet.</p>
        ) : (
          <TransactionTable rows={history} />
        )}
      </section>

      {/* Create Transaction Modal */}
      {showModal && (
        <CreateTransactionModal
          session={session}
          ships={ships}
          cities={cities}
          items={items}
          player={player}
          onClose={() => {
            sessionStorage.removeItem('tx-draft')
            setShowModal(false)
          }}
          onSuccess={() => {
            setShowModal(false)
            refetchTransactions()
          }}
        />
      )}

    </main>
  )
}

// --- Shared Components ---

function TransactionTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-medium text-gray-600">Ship</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Destination</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Actions</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Arrival</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tx) => {
            const actions = tx.actions?.action || []
            return (
              <tr key={tx.id} className="border-b hover:bg-gray-50 align-top">
                <td className="py-2 px-3 text-gray-800">
                  {tx.ships?.name ?? '—'}
                </td>
                <td className="py-2 px-3 text-gray-700">
                  {tx.cities?.name ?? '—'}
                </td>
                <td className="py-2 px-3">
                  {actions.length === 0 ? (
                    <span className="text-gray-400 italic">—</span>
                  ) : (
                    <div className="space-y-1">
                      {actions.map((a, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              a.type === 'buy' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                            }`}
                          >
                            {a.type}
                          </span>
                          <span className="text-gray-800">{a.itemName}</span>
                          <span className="text-gray-500">x{a.quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="py-2 px-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      tx.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-700'
                        : tx.status === 'EXECUTING'
                        ? 'bg-blue-100 text-blue-700'
                        : tx.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {tx.status === 'PENDING' ? 'En Route' : tx.status}
                  </span>
                </td>
                <td className="py-2 px-3 text-gray-500 text-xs">
                  {tx.scheduled_date
                    ? new Date(tx.scheduled_date + 'T12:00:00').toLocaleDateString()
                    : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// --- Multi-Action Transaction Modal ---

/**
 * Modal for creating a transaction with multiple actions.
 *
 * Flow:
 * 1. Select a ship (locks in the starting inventory for validation)
 * 2. Select a target city
 * 3. Add actions (buy/sell) — validated against a running virtual inventory
 * 4. Submit the full transaction
 *
 * Virtual inventory tracks what the ship will have at each step,
 * so sell actions can't exceed what's available after prior actions.
 */
function CreateTransactionModal({ session, ships, cities, items, player, onClose, onSuccess }) {
  const { user } = useAuth()

  // Hydrate from sessionStorage draft if available
  const savedDraft = (() => {
    try {
      const raw = sessionStorage.getItem('tx-draft')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })()

  // Step 1 state: ship + city selection
  const [shipId, setShipId] = useState(savedDraft?.shipId ?? '')
  const [cityId, setCityId] = useState(savedDraft?.cityId ?? '')

  // Ship inventory (fetched when ship is selected)
  const [shipInventory, setShipInventory] = useState([])
  const [shipCargo, setShipCargo] = useState({ current: 0, capacity: 0 })
  const [loadingInventory, setLoadingInventory] = useState(false)

  // Price sheet for selected city (fetched when city is selected)
  const [priceSheet, setPriceSheet] = useState({}) // { itemName: price }
  const [loadingPrices, setLoadingPrices] = useState(false)

  // Travel time estimate
  const [travelInfo, setTravelInfo] = useState(null) // { days, arrivalDate }
  const [loadingTravel, setLoadingTravel] = useState(false)

  // Actions list
  const [actions, setActions] = useState(savedDraft?.actions ?? [])

  // Current action being composed
  const [currentAction, setCurrentAction] = useState({ type: 'buy', itemName: '', quantity: 1 })

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const selectedShip = ships.find((s) => s.id === shipId)

  // Persist draft to sessionStorage so navigating away doesn't lose progress
  useEffect(() => {
    const draft = { showModal: true, shipId, cityId, actions }
    sessionStorage.setItem('tx-draft', JSON.stringify(draft))
  }, [shipId, cityId, actions])

  // Fetch ship inventory when ship is selected
  useEffect(() => {
    if (!shipId) {
      setShipInventory([])
      setShipCargo({ current: 0, capacity: 0 })
      return
    }

    async function fetchShipInventory() {
      setLoadingInventory(true)
      const { data, error } = await supabase
        .from('ship_inventories')
        .select('item_name, quantity')
        .eq('ship_id', shipId)

      if (!error && data) {
        setShipInventory(data)
        const total = data.reduce((sum, row) => sum + row.quantity, 0)
        const ship = ships.find((s) => s.id === shipId)
        setShipCargo({ current: total, capacity: ship?.cargo_capacity || 0 })
      }
      setLoadingInventory(false)
    }

    fetchShipInventory()
  }, [shipId, ships])

  // Fetch price sheet when city is selected
  useEffect(() => {
    if (!cityId) {
      setPriceSheet({})
      return
    }

    async function fetchPrices() {
      setLoadingPrices(true)
      const { data, error } = await supabase
        .from('price_sheets')
        .select('price, items!inner(name)')
        .eq('city_id', cityId)

      if (!error && data) {
        const sheet = {}
        for (const row of data) {
          sheet[row.items.name] = row.price
        }
        setPriceSheet(sheet)
      }
      setLoadingPrices(false)
    }

    fetchPrices()
  }, [cityId])

  // Fetch travel time when both ship and city are selected
  useEffect(() => {
    if (!shipId || !cityId) {
      setTravelInfo(null)
      return
    }

    async function fetchTravelTime() {
      setLoadingTravel(true)
      try {
        const data = await apiCall(
          `/api/transactions/travel-time?shipId=${shipId}&targetCityId=${cityId}`,
          { token: session?.access_token }
        )
        setTravelInfo(data)
      } catch {
        setTravelInfo(null)
      }
      setLoadingTravel(false)
    }

    fetchTravelTime()
  }, [shipId, cityId, session])

  // --- Price estimation helpers ---

  function getPrice(itemName) {
    return priceSheet[itemName] ?? null
  }

  function getActionEstimate(action) {
    const price = getPrice(action.itemName)
    if (price === null) return null
    return price * action.quantity
  }

  function getTotalEstimatedCost() {
    let total = 0
    for (const a of actions) {
      if (a.type === 'buy') {
        const est = getActionEstimate(a)
        if (est !== null) total += est
      }
    }
    return total
  }

  function getTotalEstimatedRevenue() {
    let total = 0
    for (const a of actions) {
      if (a.type === 'sell') {
        const est = getActionEstimate(a)
        if (est !== null) total += est
      }
    }
    return total
  }

  /**
   * Compute the virtual inventory after applying all queued actions.
   * Starts from the real ship inventory and applies each action in order.
   */
  function getVirtualInventory() {
    // Start from a copy of the real ship inventory
    const virtual = {}
    for (const item of shipInventory) {
      virtual[item.item_name] = item.quantity
    }

    // Apply each queued action
    for (const action of actions) {
      if (action.type === 'sell') {
        virtual[action.itemName] = (virtual[action.itemName] || 0) - action.quantity
      } else if (action.type === 'buy') {
        virtual[action.itemName] = (virtual[action.itemName] || 0) + action.quantity
      }
    }

    return virtual
  }

  /**
   * Compute remaining cargo space after all queued actions.
   */
  function getVirtualCargoUsed() {
    const virtual = getVirtualInventory()
    return Object.values(virtual).reduce((sum, qty) => sum + Math.max(0, qty), 0)
  }

  /**
   * Get available quantity for selling a specific item (considering prior actions).
   */
  function getAvailableToSell(itemName) {
    const virtual = getVirtualInventory()
    return Math.max(0, virtual[itemName] || 0)
  }

  /**
   * Get remaining cargo capacity for buying (considering prior actions).
   */
  function getRemainingCapacity() {
    return shipCargo.capacity - getVirtualCargoUsed()
  }

  /**
   * Items available for selling (have quantity > 0 in virtual inventory).
   */
  function getSellableItems() {
    const virtual = getVirtualInventory()
    return Object.entries(virtual)
      .filter(([, qty]) => qty > 0)
      .map(([name, qty]) => ({ name, quantity: qty }))
  }

  function getMaxQuantity() {
    if (currentAction.type === 'sell') {
      return currentAction.itemName ? getAvailableToSell(currentAction.itemName) : 0
    }
    // For buy, limit only by remaining cargo capacity
    return getRemainingCapacity()
  }

  /**
   * Check if the total estimated buy cost exceeds the player's current gold.
   * Used to show a warning toast (not block the action).
   */
  function wouldExceedGold(extraAction) {
    let totalCost = 0
    for (const a of actions) {
      if (a.type === 'buy') {
        const p = getPrice(a.itemName)
        if (p !== null) totalCost += p * a.quantity
      }
    }
    if (extraAction && extraAction.type === 'buy') {
      const p = getPrice(extraAction.itemName)
      if (p !== null) totalCost += p * extraAction.quantity
    }
    return totalCost > (player?.gold || 0)
  }

  // Toast state for gold warning
  const [toast, setToast] = useState(null)

  function addAction() {
    if (!currentAction.itemName || currentAction.quantity < 1) return

    const maxQty = getMaxQuantity()
    const qty = Math.min(currentAction.quantity, maxQty)
    if (qty < 1) return

    const actionToAdd = { ...currentAction, quantity: qty }

    // Show warning toast if this would exceed player's gold
    if (actionToAdd.type === 'buy' && wouldExceedGold(actionToAdd)) {
      setToast('You may be unable to purchase this full amount. Your ship will try to purchase as much as possible.')
      // Auto-dismiss after 5 seconds
      setTimeout(() => setToast(null), 5000)
    }

    setActions((prev) => [...prev, actionToAdd])
    setCurrentAction({ type: 'buy', itemName: '', quantity: 1 })
  }

  function removeAction(index) {
    setActions((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (!shipId || !cityId || actions.length === 0) return

    setSubmitError(null)
    setSubmitting(true)

    try {
      await apiCall('/api/transactions', {
        method: 'POST',
        token: session?.access_token,
        body: {
          shipId,
          targetCityId: cityId,
          playerId: user.id,
          actions: actions.map((a) => ({ type: a.type, itemName: a.itemName, quantity: a.quantity })),
        },
      })
      sessionStorage.removeItem('tx-draft')
      onSuccess()
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const readyShips = ships.filter((s) => s.status === 'READY')

  // Current action price estimate
  const currentEstimate =
    currentAction.itemName && currentAction.quantity > 0 && getPrice(currentAction.itemName) !== null
      ? getPrice(currentAction.itemName) * currentAction.quantity
      : null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">New Transaction</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {submitError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {submitError}
          </div>
        )}

        {/* Gold warning toast */}
        {toast && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded text-sm flex items-start gap-2">
            <span className="shrink-0">⚠️</span>
            <span>{toast}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-auto shrink-0 text-yellow-600 hover:text-yellow-800 text-sm font-medium"
            >
              ✕
            </button>
          </div>
        )}

        {/* Price estimation banner */}
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
          <span className="font-medium">⚠ Prices are estimates.</span> Market prices fluctuate daily. Final costs and revenues will be calculated when your ship arrives at its destination.
        </div>

        {/* Ship Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Ship</label>
          <select
            value={shipId}
            onChange={(e) => {
              setShipId(e.target.value)
              setActions([]) // Reset actions when ship changes
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a ship</option>
            {readyShips.map((ship) => (
              <option key={ship.id} value={ship.id}>
                {ship.name} (Capacity: {ship.cargo_capacity})
              </option>
            ))}
          </select>
        </div>

        {/* City Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Destination City</label>
          <select
            value={cityId}
            onChange={(e) => {
              setCityId(e.target.value)
              setActions([]) // Reset actions when city changes (prices change)
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a city</option>
            {(cities || []).map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
          {/* Travel time estimate */}
          {loadingTravel && (
            <p className="text-xs text-gray-400 mt-1">Calculating travel time...</p>
          )}
          {travelInfo && !loadingTravel && (
            <p className="text-xs text-gray-500 mt-1">
              ~{travelInfo.days} day{travelInfo.days !== 1 ? 's' : ''} travel · arrives {new Date(travelInfo.arrivalDate + 'T12:00:00').toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Ship inventory summary + cargo */}
        {shipId && !loadingInventory && (
          <div className="mb-4 p-3 bg-gray-50 rounded text-sm">
            <div className="flex justify-between text-gray-600 mb-1">
              <span>Cargo</span>
              <span className="font-medium">{getVirtualCargoUsed()} / {shipCargo.capacity}</span>
            </div>
            {shipInventory.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-2">
                {getSellableItems().map((item) => (
                  <span key={item.name} className="text-xs bg-white border rounded px-2 py-1 text-gray-700">
                    {item.name} x{item.quantity}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-xs italic mt-1">Ship cargo is empty</p>
            )}
          </div>
        )}

        {(loadingInventory || loadingPrices) && (
          <div className="mb-4 flex justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
          </div>
        )}

        {/* Queued Actions */}
        {actions.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Queued Actions ({actions.length})
            </h3>
            <div className="space-y-2">
              {actions.map((action, i) => {
                const estimate = getActionEstimate(action)
                return (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          action.type === 'buy' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {action.type}
                      </span>
                      <span className="text-sm text-gray-800">{action.itemName} x{action.quantity}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {estimate !== null && (
                        <span className={`text-xs font-medium ${action.type === 'buy' ? 'text-red-600' : 'text-green-600'}`}>
                          {action.type === 'buy' ? '−' : '+'}{estimate.toLocaleString()} g
                        </span>
                      )}
                      <button
                        onClick={() => removeAction(i)}
                        className="text-red-400 hover:text-red-600 text-sm font-medium"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Totals summary */}
            <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-sm">
              {getTotalEstimatedCost() > 0 && (
                <span className="text-red-600 font-medium">
                  Est. cost: −{getTotalEstimatedCost().toLocaleString()} g
                </span>
              )}
              {getTotalEstimatedRevenue() > 0 && (
                <span className="text-green-600 font-medium">
                  Est. revenue: +{getTotalEstimatedRevenue().toLocaleString()} g
                </span>
              )}
            </div>
          </div>
        )}

        {/* Add Action Form */}
        {shipId && cityId && !loadingPrices && (
          <div className="mb-4 p-4 border border-dashed border-gray-300 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Add Action</h3>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {/* Type */}
              <select
                value={currentAction.type}
                onChange={(e) => setCurrentAction({ type: e.target.value, itemName: '', quantity: 1 })}
                className="px-2 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>

              {/* Item */}
              <select
                value={currentAction.itemName}
                onChange={(e) => setCurrentAction({ ...currentAction, itemName: e.target.value, quantity: 1 })}
                className="px-2 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Item...</option>
                {currentAction.type === 'sell'
                  ? getSellableItems().map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name} (have {item.quantity})
                      </option>
                    ))
                  : (items || []).map((item) => (
                      <option key={item.id || item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
              </select>

              {/* Quantity + Max button */}
              <div className="flex gap-1">
                <input
                  type="number"
                  min={1}
                  max={getMaxQuantity() || undefined}
                  value={currentAction.quantity}
                  onChange={(e) =>
                    setCurrentAction({ ...currentAction, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })
                  }
                  className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const max = getMaxQuantity()
                    if (max > 0) setCurrentAction({ ...currentAction, quantity: max })
                  }}
                  disabled={!currentAction.itemName || getMaxQuantity() < 1}
                  className="px-2 py-2 bg-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition whitespace-nowrap"
                >
                  Max
                </button>
              </div>
            </div>

            {/* Price estimate + quantity hint for current action */}
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs text-gray-500">
                {currentAction.itemName && currentAction.type === 'sell'
                  ? `Available: ${getAvailableToSell(currentAction.itemName)}`
                  : currentAction.itemName
                  ? `Remaining space: ${getRemainingCapacity()}`
                  : '\u00A0'}
              </p>
              {currentEstimate !== null && (
                <p className={`text-xs font-medium ${currentAction.type === 'buy' ? 'text-red-600' : 'text-green-600'}`}>
                  ~{currentEstimate.toLocaleString()} gold
                </p>
              )}
            </div>

            <button
              onClick={addAction}
              disabled={!currentAction.itemName || getMaxQuantity() < 1}
              className="w-full py-2 px-3 bg-gray-700 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              + Add Action
            </button>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !shipId || !cityId || actions.length === 0}
          className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {submitting ? 'Submitting...' : `Submit Transaction (${actions.length} action${actions.length !== 1 ? 's' : ''})`}
        </button>
      </div>
    </div>
  )
}
