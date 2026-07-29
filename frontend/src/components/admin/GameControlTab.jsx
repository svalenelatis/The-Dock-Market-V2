import { useState, useEffect, useRef } from 'react'
import { apiCall } from '../../lib/api'
import DailyHandlerWidget from './DailyHandlerWidget'
import PriceOverrideSection from './PriceOverrideSection'
import InlineValidationError from './InlineValidationError'

/**
 * Game Control tab container component.
 * Organizes three sections vertically:
 * 1. Daily Handler Widget — manual game process triggers
 * 2. Ship & Factory Creation — forms for creating ships/factories for players
 * 3. Price Override Section — admin tag creation and assignment
 *
 * Validates: Requirements 4.1, 4.5, 6.6, 7.6
 *
 * @param {{ token: string }} props
 */
export default function GameControlTab({ token }) {
  return (
    <div className="space-y-8">
      {/* Section 1: Daily Handler */}
      <section>
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Daily Handler</h3>
        <DailyHandlerWidget token={token} />
      </section>

      <hr className="border-gray-200" />

      {/* Section 2: Ship & Factory Creation */}
      <section>
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Ship &amp; Factory Creation</h3>
        <ShipFactoryCreation token={token} />
      </section>

      <hr className="border-gray-200" />

      {/* Section 3: Price Overrides */}
      <section>
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Price Overrides</h3>
        <PriceOverrideSection token={token} />
      </section>
    </div>
  )
}

/**
 * Mini player search dropdown for selecting a target player.
 * Searches after 2+ characters typed, shows up to 10 results.
 */
function PlayerSearchDropdown({ token, selectedPlayer, onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.length < 2) {
      setResults([])
      setDropdownOpen(false)
      return
    }

    debounceRef.current = setTimeout(() => {
      searchPlayers()
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  async function searchPlayers() {
    setSearching(true)
    try {
      const params = new URLSearchParams({ q: query, includeArchived: 'false' })
      const data = await apiCall(`/api/admin/players/search?${params.toString()}`, { token })
      setResults(Array.isArray(data) ? data : [])
      setDropdownOpen(true)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  function handleSelect(player) {
    onSelect(player)
    setQuery(player.email)
    setDropdownOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Target Player
      </label>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          if (selectedPlayer) onSelect(null)
        }}
        placeholder="Search player by email..."
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        aria-label="Search player by email"
      />
      {searching && (
        <div className="absolute right-3 top-8">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
        </div>
      )}
      {dropdownOpen && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {results.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => handleSelect(player)}
              className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition border-b border-gray-100 last:border-b-0"
            >
              <span className="font-medium text-gray-800">{player.email}</span>
              <span className="block text-xs text-gray-400">
                Gold: {player.gold?.toLocaleString() ?? 'N/A'}
              </span>
            </button>
          ))}
        </div>
      )}
      {selectedPlayer && (
        <p className="mt-1 text-xs text-green-600">
          Selected: {selectedPlayer.email}
        </p>
      )}
    </div>
  )
}

/**
 * Container component for ship and factory creation forms.
 * Both forms share a player search dropdown for selecting the target player.
 */
function ShipFactoryCreation({ token }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  return (
    <div className="space-y-6">
      <PlayerSearchDropdown
        token={token}
        selectedPlayer={selectedPlayer}
        onSelect={setSelectedPlayer}
      />

      {!selectedPlayer && (
        <p className="text-sm text-gray-500 italic">
          Select a player above to create ships or factories.
        </p>
      )}

      {selectedPlayer && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ShipCreationForm token={token} playerId={selectedPlayer.id} />
          <FactoryCreationForm token={token} playerId={selectedPlayer.id} />
        </div>
      )}
    </div>
  )
}

/**
 * Ship creation form with name, speed, and cargo capacity fields.
 * Validates: name (1-50 chars), speed (1-100), cargo_capacity (1-1000).
 */
function ShipCreationForm({ token, playerId }) {
  const [name, setName] = useState('')
  const [speed, setSpeed] = useState('')
  const [cargoCapacity, setCargoCapacity] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)
  const [apiError, setApiError] = useState(null)

  function validate() {
    const newErrors = {}
    if (!name || name.length < 1 || name.length > 50) {
      newErrors.name = 'Name must be 1–50 characters'
    }
    const speedNum = Number(speed)
    if (!speed || isNaN(speedNum) || speedNum < 1 || speedNum > 100 || !Number.isInteger(speedNum)) {
      newErrors.speed = 'Speed must be an integer between 1 and 100'
    }
    const cargoNum = Number(cargoCapacity)
    if (!cargoCapacity || isNaN(cargoNum) || cargoNum < 1 || cargoNum > 1000 || !Number.isInteger(cargoNum)) {
      newErrors.cargo_capacity = 'Cargo capacity must be an integer between 1 and 1000'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSuccess(null)
    setApiError(null)

    if (!validate()) return

    setSubmitting(true)
    try {
      await apiCall('/api/admin/ships', {
        method: 'POST',
        token,
        body: {
          player_id: playerId,
          name: name.trim(),
          speed: Number(speed),
          cargo_capacity: Number(cargoCapacity),
        },
      })
      setSuccess(`Ship "${name.trim()}" created successfully`)
      setName('')
      setSpeed('')
      setCargoCapacity('')
      setErrors({})
    } catch (err) {
      setApiError(err.message || 'Failed to create ship')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <h4 className="font-medium text-gray-700 mb-3">Create Ship</h4>

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1" htmlFor="ship-name">
            Name <span className="text-gray-400">(1–50 chars)</span>
          </label>
          <input
            id="ship-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <InlineValidationError error={errors.name} />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1" htmlFor="ship-speed">
            Speed <span className="text-gray-400">(1–100)</span>
          </label>
          <input
            id="ship-speed"
            type="number"
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
            min={1}
            max={100}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <InlineValidationError error={errors.speed} />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1" htmlFor="ship-cargo">
            Cargo Capacity <span className="text-gray-400">(1–1000)</span>
          </label>
          <input
            id="ship-cargo"
            type="number"
            value={cargoCapacity}
            onChange={(e) => setCargoCapacity(e.target.value)}
            min={1}
            max={1000}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <InlineValidationError error={errors.cargo_capacity} />
        </div>
      </div>

      {apiError && (
        <p className="mt-3 text-sm text-red-600" role="alert">{apiError}</p>
      )}
      {success && (
        <p className="mt-3 text-sm text-green-600" role="status">{success}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {submitting ? 'Creating...' : 'Create Ship'}
      </button>
    </form>
  )
}

/**
 * Factory creation form with type, input requirements, and output production fields.
 * Validates: type (1-100 chars), inputs (array of item_name + quantity 1-10,000),
 * output (item_name + quantity 1-10,000).
 */
function FactoryCreationForm({ token, playerId }) {
  const [type, setType] = useState('')
  const [inputs, setInputs] = useState([{ item_name: '', quantity: '' }])
  const [outputItemName, setOutputItemName] = useState('')
  const [outputQuantity, setOutputQuantity] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)
  const [apiError, setApiError] = useState(null)

  function validate() {
    const newErrors = {}

    if (!type || type.length < 1 || type.length > 100) {
      newErrors.type = 'Type must be 1–100 characters'
    }

    // Validate input requirements
    const inputErrors = []
    inputs.forEach((input, idx) => {
      const errs = {}
      if (!input.item_name || input.item_name.trim().length === 0) {
        errs.item_name = 'Item name is required'
      }
      const qty = Number(input.quantity)
      if (!input.quantity || isNaN(qty) || qty < 1 || qty > 10000 || !Number.isInteger(qty)) {
        errs.quantity = 'Quantity must be 1–10,000'
      }
      if (Object.keys(errs).length > 0) {
        inputErrors[idx] = errs
      }
    })
    if (inputErrors.length > 0 || inputErrors.some(e => e)) {
      newErrors.inputs = inputErrors
    }

    // Validate output
    if (!outputItemName || outputItemName.trim().length === 0) {
      newErrors.output_item_name = 'Output item name is required'
    }
    const outQty = Number(outputQuantity)
    if (!outputQuantity || isNaN(outQty) || outQty < 1 || outQty > 10000 || !Number.isInteger(outQty)) {
      newErrors.output_quantity = 'Output quantity must be 1–10,000'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function addInput() {
    if (inputs.length >= 10) return
    setInputs([...inputs, { item_name: '', quantity: '' }])
  }

  function removeInput(idx) {
    if (inputs.length <= 1) return
    setInputs(inputs.filter((_, i) => i !== idx))
  }

  function updateInput(idx, field, value) {
    const updated = [...inputs]
    updated[idx] = { ...updated[idx], [field]: value }
    setInputs(updated)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSuccess(null)
    setApiError(null)

    if (!validate()) return

    setSubmitting(true)
    try {
      const inputRequirements = inputs.map((inp) => ({
        item_name: inp.item_name.trim(),
        quantity: Number(inp.quantity),
      }))

      await apiCall('/api/admin/factories', {
        method: 'POST',
        token,
        body: {
          player_id: playerId,
          type: type.trim(),
          input_requirements: inputRequirements,
          output_production: {
            item_name: outputItemName.trim(),
            quantity: Number(outputQuantity),
          },
        },
      })
      setSuccess(`Factory "${type.trim()}" created successfully`)
      setType('')
      setInputs([{ item_name: '', quantity: '' }])
      setOutputItemName('')
      setOutputQuantity('')
      setErrors({})
    } catch (err) {
      setApiError(err.message || 'Failed to create factory')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <h4 className="font-medium text-gray-700 mb-3">Create Factory</h4>

      <div className="space-y-3">
        {/* Factory type */}
        <div>
          <label className="block text-sm text-gray-600 mb-1" htmlFor="factory-type">
            Type <span className="text-gray-400">(1–100 chars)</span>
          </label>
          <input
            id="factory-type"
            type="text"
            value={type}
            onChange={(e) => setType(e.target.value)}
            maxLength={100}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <InlineValidationError error={errors.type} />
        </div>

        {/* Input requirements */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm text-gray-600">
              Input Requirements <span className="text-gray-400">(max 10)</span>
            </label>
            <button
              type="button"
              onClick={addInput}
              disabled={inputs.length >= 10}
              className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              + Add Input
            </button>
          </div>

          <div className="space-y-2">
            {inputs.map((input, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <div className="flex-1">
                  <input
                    type="text"
                    value={input.item_name}
                    onChange={(e) => updateInput(idx, 'item_name', e.target.value)}
                    placeholder="Item name"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label={`Input item ${idx + 1} name`}
                  />
                  <InlineValidationError error={errors.inputs?.[idx]?.item_name} />
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    value={input.quantity}
                    onChange={(e) => updateInput(idx, 'quantity', e.target.value)}
                    placeholder="Qty"
                    min={1}
                    max={10000}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label={`Input item ${idx + 1} quantity`}
                  />
                  <InlineValidationError error={errors.inputs?.[idx]?.quantity} />
                </div>
                <button
                  type="button"
                  onClick={() => removeInput(idx)}
                  disabled={inputs.length <= 1}
                  className="mt-1 text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                  aria-label={`Remove input ${idx + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Output production */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Output Production</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={outputItemName}
                onChange={(e) => setOutputItemName(e.target.value)}
                placeholder="Output item name"
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Output item name"
              />
              <InlineValidationError error={errors.output_item_name} />
            </div>
            <div className="w-24">
              <input
                type="number"
                value={outputQuantity}
                onChange={(e) => setOutputQuantity(e.target.value)}
                placeholder="Qty"
                min={1}
                max={10000}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Output quantity"
              />
              <InlineValidationError error={errors.output_quantity} />
            </div>
          </div>
        </div>
      </div>

      {apiError && (
        <p className="mt-3 text-sm text-red-600" role="alert">{apiError}</p>
      )}
      {success && (
        <p className="mt-3 text-sm text-green-600" role="status">{success}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {submitting ? 'Creating...' : 'Create Factory'}
      </button>
    </form>
  )
}
