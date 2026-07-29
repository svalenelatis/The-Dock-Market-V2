import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiCall } from '../lib/api'
import supabase from '../lib/supabase'

/**
 * Inventories page with drag-and-drop transfers and optimistic updates.
 *
 * Each item card is draggable. Dropping onto a different inventory section
 * triggers an optimistic transfer (immediate visual move, background API call,
 * rollback on failure).
 */
export default function Inventories() {
  const { user, session } = useAuth()
  const [playerInventory, setPlayerInventory] = useState([])
  const [ships, setShips] = useState([])
  const [shipInventories, setShipInventories] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  // Drag state
  const [dragItem, setDragItem] = useState(null) // { itemName, quantity, sourceType: 'player'|'ship', sourceShipId?: string }
  const [dropTarget, setDropTarget] = useState(null) // { type: 'player'|'ship', shipId?: string }

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: inventory, error: invError } = await supabase
        .from('player_inventories')
        .select('*, items(name)')
        .eq('player_id', user.id)

      if (invError) throw invError
      setPlayerInventory(inventory || [])

      const { data: playerShips, error: shipsError } = await supabase
        .from('ships')
        .select('*')
        .eq('player_id', user.id)
        .order('created_at', { ascending: false })

      if (shipsError) throw shipsError
      setShips(playerShips || [])

      const inventoriesByShip = {}
      for (const ship of (playerShips || [])) {
        const { data: shipInv, error: shipInvError } = await supabase
          .from('ship_inventories')
          .select('*, items(name)')
          .eq('ship_id', ship.id)

        if (shipInvError) throw shipInvError
        inventoriesByShip[ship.id] = shipInv || []
      }
      setShipInventories(inventoriesByShip)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function showToast(message, type = 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // --- Drag handlers ---

  function handleDragStart(itemName, quantity, sourceType, sourceShipId) {
    setDragItem({ itemName, quantity, sourceType, sourceShipId })
  }

  function handleDragEnd() {
    setDragItem(null)
    setDropTarget(null)
  }

  function handleDragEnter(targetType, targetShipId) {
    // Can't drop onto same source
    if (dragItem) {
      const sameSource =
        (targetType === 'player' && dragItem.sourceType === 'player') ||
        (targetType === 'ship' && dragItem.sourceType === 'ship' && targetShipId === dragItem.sourceShipId)
      if (!sameSource) {
        setDropTarget({ type: targetType, shipId: targetShipId })
      }
    }
  }

  function handleDragLeave(e, targetType, targetShipId) {
    // Only clear if actually leaving the container (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      if (dropTarget?.type === targetType && dropTarget?.shipId === targetShipId) {
        setDropTarget(null)
      }
    }
  }

  function handleDrop(targetType, targetShipId) {
    if (!dragItem) return

    const sameSource =
      (targetType === 'player' && dragItem.sourceType === 'player') ||
      (targetType === 'ship' && dragItem.sourceType === 'ship' && targetShipId === dragItem.sourceShipId)

    if (sameSource) {
      setDropTarget(null)
      return
    }

    // Determine direction and shipId for the API
    let shipId, direction
    if (dragItem.sourceType === 'player' && targetType === 'ship') {
      shipId = targetShipId
      direction = 'to_ship'
    } else if (dragItem.sourceType === 'ship' && targetType === 'player') {
      shipId = dragItem.sourceShipId
      direction = 'to_player'
    } else if (dragItem.sourceType === 'ship' && targetType === 'ship') {
      shipId = dragItem.sourceShipId
      direction = 'ship_to_ship'
    }

    // Calculate how much the target ship can accept
    let transferQuantity = dragItem.quantity
    if (targetType === 'ship') {
      const targetShip = ships.find((s) => s.id === targetShipId)
      if (targetShip) {
        const currentCargo = (shipInventories[targetShipId] || []).reduce(
          (sum, item) => sum + item.quantity, 0
        )
        const availableSpace = targetShip.cargo_capacity - currentCargo
        transferQuantity = Math.min(dragItem.quantity, availableSpace)
      }
    }

    if (transferQuantity <= 0) {
      showToast('No cargo space available on that ship.')
      setDropTarget(null)
      return
    }

    if (direction === 'ship_to_ship') {
      executeTransfer(shipId, dragItem.itemName, transferQuantity, direction, targetShipId)
    } else {
      executeTransfer(shipId, dragItem.itemName, transferQuantity, direction)
    }

    setDropTarget(null)
  }

  /**
   * Optimistic transfer — applies immediately, rolls back on failure.
   */
  async function executeTransfer(shipId, itemName, quantity, direction, destinationShipId) {
    const prevPlayerInventory = [...playerInventory]
    const prevShipInventory = [...(shipInventories[shipId] || [])]
    const prevDestShipInventory = destinationShipId ? [...(shipInventories[destinationShipId] || [])] : null

    // Apply optimistic update
    if (direction === 'to_ship') {
      setPlayerInventory((prev) => subtractItem(prev, itemName, quantity))
      setShipInventories((prev) => ({
        ...prev,
        [shipId]: addItem(prev[shipId] || [], itemName, quantity),
      }))
    } else if (direction === 'to_player') {
      setShipInventories((prev) => ({
        ...prev,
        [shipId]: subtractItem(prev[shipId] || [], itemName, quantity),
      }))
      setPlayerInventory((prev) => addItem(prev, itemName, quantity))
    } else if (direction === 'ship_to_ship') {
      setShipInventories((prev) => ({
        ...prev,
        [shipId]: subtractItem(prev[shipId] || [], itemName, quantity),
        [destinationShipId]: addItem(prev[destinationShipId] || [], itemName, quantity),
      }))
    }

    try {
      const body = { ship_id: shipId, item_name: itemName, quantity, direction }
      if (direction === 'ship_to_ship') {
        body.destination_ship_id = destinationShipId
      }
      await apiCall('/api/inventory/transfer', {
        method: 'POST',
        body,
        token: session?.access_token,
      })
    } catch (err) {
      // Rollback
      setPlayerInventory(prevPlayerInventory)
      if (prevDestShipInventory) {
        setShipInventories((prev) => ({
          ...prev,
          [shipId]: prevShipInventory,
          [destinationShipId]: prevDestShipInventory,
        }))
      } else {
        setShipInventories((prev) => ({ ...prev, [shipId]: prevShipInventory }))
      }
      showToast(err.message)
    }
  }

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          Error loading inventories: {error}
        </div>
      </main>
    )
  }

  const isDropTarget = (type, shipId) =>
    dropTarget?.type === type && dropTarget?.shipId === shipId

  const canReceiveDrop = (type, shipId) => {
    if (!dragItem) return false
    if (type === 'player' && dragItem.sourceType === 'player') return false
    if (type === 'ship' && dragItem.sourceType === 'ship' && shipId === dragItem.sourceShipId) return false
    // Only docked ships can receive
    if (type === 'ship') {
      const ship = ships.find((s) => s.id === shipId)
      if (!ship || ship.status !== 'READY') return false
    }
    return true
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Inventories</h1>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Player Inventory Drop Zone */}
      <DropZone
        label="Personal Inventory"
        isOver={isDropTarget('player')}
        canReceive={canReceiveDrop('player')}
        dropLabel="Transfer to Personal Inventory?"
        onDragEnter={() => handleDragEnter('player')}
        onDragLeave={(e) => handleDragLeave(e, 'player')}
        onDrop={() => handleDrop('player')}
      >
        <InventoryGrid
          items={playerInventory}
          sourceType="player"
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      </DropZone>

      {/* Ship Inventories */}
      <h2 className="text-lg font-semibold text-gray-700 mb-4">Ship Cargo</h2>

      {!ships || ships.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-400 italic">No ships found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ships.map((ship) => (
            <DropZone
              key={ship.id}
              label={ship.name}
              isOver={isDropTarget('ship', ship.id)}
              canReceive={canReceiveDrop('ship', ship.id)}
              dropLabel={`Transfer to ${ship.name}?`}
              onDragEnter={() => handleDragEnter('ship', ship.id)}
              onDragLeave={(e) => handleDragLeave(e, 'ship', ship.id)}
              onDrop={() => handleDrop('ship', ship.id)}
              header={
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-md font-semibold text-gray-800">{ship.name}</h3>
                  <span
                    className={`text-xs px-2 py-1 rounded font-medium ${
                      ship.status === 'READY' || ship.status === 'docked'
                        ? 'bg-green-100 text-green-700'
                        : ship.status === 'sailing' || ship.status === 'IN_TRANSIT'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {ship.status}
                  </span>
                </div>
              }
              subheader={
                <div className="flex gap-4 text-sm text-gray-500 mb-4">
                  <span>Speed: <span className="font-medium text-gray-700">{ship.speed}</span></span>
                  <span>Cargo: <span className="font-medium text-gray-700">{(shipInventories[ship.id] || []).reduce((sum, item) => sum + item.quantity, 0)} / {ship.cargo_capacity}</span></span>
                  {ship.current_city && (
                    <span>Location: <span className="font-medium text-gray-700">{ship.current_city}</span></span>
                  )}
                </div>
              }
            >
              <InventoryGrid
                items={shipInventories[ship.id] || []}
                sourceType="ship"
                sourceShipId={ship.id}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                isDocked={ship.status === 'READY'}
              />
            </DropZone>
          ))}
        </div>
      )}
    </main>
  )
}

// --- Components ---

/**
 * A drop zone wrapper that shows an overlay when a dragged item hovers over it.
 */
function DropZone({ label, isOver, canReceive, dropLabel, onDragEnter, onDragLeave, onDrop, header, subheader, children }) {
  return (
    <section
      className={`relative bg-white rounded-lg shadow p-6 mb-6 transition-all ${
        isOver && canReceive ? 'ring-2 ring-blue-400' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = canReceive ? 'move' : 'none'
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        onDragEnter()
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault()
        onDrop()
      }}
    >
      {/* Drop overlay */}
      {isOver && canReceive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-blue-50/80 backdrop-blur-sm rounded-lg">
          <p className="text-lg font-semibold text-blue-700">{dropLabel}</p>
        </div>
      )}

      {header || (
        <h2 className="text-lg font-semibold text-gray-700 mb-4">{label}</h2>
      )}
      {subheader}
      {children}
    </section>
  )
}

/**
 * Grid of draggable inventory item cards.
 */
function InventoryGrid({ items, sourceType, sourceShipId, onDragStart, onDragEnd, isDocked = true }) {
  if (!items || items.length === 0) {
    return <p className="text-gray-400 italic">Empty</p>
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {items.map((item) => {
        const name = item.items?.name ?? item.item_name
        const draggable = isDocked
        return (
          <div
            key={item.id || `${name}_${item.quantity}`}
            draggable={draggable}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', name) // Required for Firefox
              onDragStart(name, item.quantity, sourceType, sourceShipId)
            }}
            onDragEnd={onDragEnd}
            className={`flex justify-between items-center bg-gray-50 rounded px-3 py-2 select-none ${
              draggable ? 'cursor-grab active:cursor-grabbing hover:bg-gray-100 hover:shadow-sm transition' : ''
            }`}
          >
            <span className="text-gray-800 text-sm">{name}</span>
            <span className="text-sm font-medium text-gray-600">x{item.quantity}</span>
          </div>
        )
      })}
    </div>
  )
}

// --- State Helpers ---

function subtractItem(inventory, itemName, quantity) {
  const result = []
  for (const item of inventory) {
    const name = item.items?.name ?? item.item_name
    if (name === itemName) {
      const newQty = item.quantity - quantity
      if (newQty > 0) {
        result.push({ ...item, quantity: newQty })
      }
    } else {
      result.push(item)
    }
  }
  return result
}

function addItem(inventory, itemName, quantity) {
  const exists = inventory.some((item) => (item.items?.name ?? item.item_name) === itemName)
  if (exists) {
    return inventory.map((item) => {
      const name = item.items?.name ?? item.item_name
      if (name === itemName) {
        return { ...item, quantity: item.quantity + quantity }
      }
      return item
    })
  }
  return [...inventory, { id: `temp_${itemName}_${Date.now()}`, item_name: itemName, items: { name: itemName }, quantity }]
}
