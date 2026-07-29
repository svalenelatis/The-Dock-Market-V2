const { Router } = require('express')
const authMiddleware = require('../middleware/auth')
const supabase = require('../lib/supabase')
const { calculateTravelTime } = require('../utils/calculations')
const { SHIP_STATUS, TRANSACTION_TYPE, TRANSACTION_STATUS } = require('../utils/constants')

const router = Router()

// All transaction routes require authentication
router.use(authMiddleware)

// --- GET /api/transactions/travel-time ---
// Requirement 10: Travel Time Preview Route
router.get('/travel-time', async (req, res) => {
  const { shipId, targetCityId } = req.query

  // Requirement 10.2: Validate required query parameters
  if (!shipId && !targetCityId) {
    req.log.warn({ field: 'shipId, targetCityId', reason: 'both missing' }, 'Validation failed')
    return res.status(400).json({ error: 'Query parameters shipId and targetCityId are required' })
  }
  if (!shipId) {
    req.log.warn({ field: 'shipId', reason: 'missing required query parameter' }, 'Validation failed')
    return res.status(400).json({ error: 'Query parameter shipId is required' })
  }
  if (!targetCityId) {
    req.log.warn({ field: 'targetCityId', reason: 'missing required query parameter' }, 'Validation failed')
    return res.status(400).json({ error: 'Query parameter targetCityId is required' })
  }

  try {
    req.log.info({ operation: 'getTravelTime' }, 'Getting travel time preview')

    // Requirement 10.3: Look up the ship (get player_id and speed)
    const { data: ship, error: shipError } = await supabase
      .from('ships')
      .select('id, player_id, speed')
      .eq('id', shipId)
      .single()

    if (shipError || !ship) {
      if (shipError) {
        req.log.error({ operation: 'getTravelTime', code: shipError.code || 'UNKNOWN' }, 'Database error looking up ship')
      }
      return res.status(404).json({ error: 'Ship not found' })
    }

    // Requirement 10.3: Look up the player's home port
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('home_port_id')
      .eq('id', ship.player_id)
      .single()

    if (playerError || !player) {
      if (playerError) {
        req.log.error({ operation: 'getTravelTime', code: playerError.code || 'UNKNOWN' }, 'Database error looking up player')
      }
      return res.status(404).json({ error: 'Player not found' })
    }

    // Requirement 10.3: Get home port city coordinates
    const { data: homeCity, error: homeCityError } = await supabase
      .from('cities')
      .select('id, location')
      .eq('id', player.home_port_id)
      .single()

    if (homeCityError || !homeCity) {
      if (homeCityError) {
        req.log.error({ operation: 'getTravelTime', code: homeCityError.code || 'UNKNOWN' }, 'Database error looking up home city')
      }
      return res.status(404).json({ error: 'Home port city not found' })
    }

    // Requirement 10.6: Get target city coordinates
    const { data: targetCity, error: targetCityError } = await supabase
      .from('cities')
      .select('id, location')
      .eq('id', targetCityId)
      .single()

    if (targetCityError || !targetCity) {
      if (targetCityError) {
        req.log.error({ operation: 'getTravelTime', code: targetCityError.code || 'UNKNOWN' }, 'Database error looking up target city')
      }
      return res.status(404).json({ error: 'Target city not found' })
    }

    // Requirement 10.4: Calculate travel time
    const days = calculateTravelTime(
      homeCity.location.x,
      homeCity.location.y,
      targetCity.location.x,
      targetCity.location.y,
      ship.speed
    )

    // Requirement 10.5: Calculate arrival date (YYYY-MM-DD)
    const today = new Date()
    const arrival = new Date(today)
    arrival.setDate(arrival.getDate() + days)
    // Use local date to stay consistent with the daily handler's date comparison
    const arrivalDate = `${arrival.getFullYear()}-${String(arrival.getMonth() + 1).padStart(2, '0')}-${String(arrival.getDate()).padStart(2, '0')}`

    // Requirement 10.1 & 10.5: Return travel time and arrival date
    req.log.info({ operation: 'getTravelTime', result: { days, arrivalDate } }, 'Travel time calculated')
    return res.status(200).json({ days, arrivalDate })
  } catch (err) {
    req.log.error({ operation: 'getTravelTime', err }, 'Unexpected error in getTravelTime')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// --- POST /api/transactions ---
// Multi-action transaction creation.
//
// Body:
//   - shipId (UUID): ship to send
//   - targetCityId (UUID): destination city
//   - playerId (UUID): must match authenticated user
//   - actions (array): [{ type: 'buy'|'sell', itemName: string, quantity: number }]
//
// Validation runs each action in sequence against a virtual state
// (ship inventory, cargo capacity) to ensure cargo space is feasible.
// Gold is NOT deducted at submission — the daily handler resolves purchases
// at arrival prices, buying as much as the player can afford (partial fill).
// On success, the ship is set to TRAVELING.
router.post('/', async (req, res) => {
  try {
    req.log.info({ operation: 'createTransaction' }, 'Creating transaction')

    const { shipId, targetCityId, playerId, actions } = req.body

    // --- Basic field validation ---
    if (!shipId) {
      req.log.warn({ field: 'shipId', reason: 'missing required field' }, 'Validation failed')
      return res.status(400).json({ error: 'shipId is required' })
    }
    if (!targetCityId) {
      req.log.warn({ field: 'targetCityId', reason: 'missing required field' }, 'Validation failed')
      return res.status(400).json({ error: 'targetCityId is required' })
    }
    if (!playerId) {
      req.log.warn({ field: 'playerId', reason: 'missing required field' }, 'Validation failed')
      return res.status(400).json({ error: 'playerId is required' })
    }
    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      req.log.warn({ field: 'actions', reason: 'must be a non-empty array' }, 'Validation failed')
      return res.status(400).json({ error: 'actions must be a non-empty array' })
    }

    // Validate each action's structure
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i]
      if (!a || typeof a !== 'object') {
        req.log.warn({ field: `actions[${i}]`, reason: 'must be an object' }, 'Validation failed')
        return res.status(400).json({ error: `actions[${i}] must be an object` })
      }
      if (a.type !== 'buy' && a.type !== 'sell') {
        req.log.warn({ field: `actions[${i}].type`, reason: 'must be "buy" or "sell"' }, 'Validation failed')
        return res.status(400).json({ error: `actions[${i}].type must be "buy" or "sell"` })
      }
      if (!a.itemName || typeof a.itemName !== 'string' || a.itemName.trim() === '') {
        req.log.warn({ field: `actions[${i}].itemName`, reason: 'required non-empty string' }, 'Validation failed')
        return res.status(400).json({ error: `actions[${i}].itemName is required` })
      }
      if (!Number.isInteger(a.quantity) || a.quantity < 1) {
        req.log.warn({ field: `actions[${i}].quantity`, reason: 'must be a positive integer' }, 'Validation failed')
        return res.status(400).json({ error: `actions[${i}].quantity must be a positive integer` })
      }
    }

    // playerId must match authenticated user
    if (playerId !== req.userId) {
      req.log.warn({ field: 'playerId', reason: 'does not match authenticated user' }, 'Validation failed')
      return res.status(400).json({ error: 'playerId must match the authenticated user' })
    }

    // --- Fetch ship and validate ownership/status ---
    const { data: ship, error: shipError } = await supabase
      .from('ships')
      .select('id, player_id, speed, cargo_capacity, status')
      .eq('id', shipId)
      .single()

    if (shipError || !ship) {
      if (shipError) {
        req.log.error({ operation: 'createTransaction', code: shipError.code || 'UNKNOWN' }, 'Database error looking up ship')
      }
      req.log.warn({ field: 'shipId', reason: 'ship not found' }, 'Validation failed')
      return res.status(400).json({ error: 'Ship not found' })
    }
    if (ship.player_id !== req.userId) {
      req.log.warn({ field: 'shipId', reason: 'ship does not belong to authenticated player' }, 'Validation failed')
      return res.status(400).json({ error: 'Ship does not belong to the authenticated player' })
    }
    if (ship.status !== SHIP_STATUS.READY) {
      req.log.warn({ field: 'shipId', reason: `ship status is "${ship.status}", expected READY` }, 'Validation failed')
      return res.status(400).json({ error: 'Ship is not in READY status' })
    }

    // --- Fetch target city ---
    const { data: targetCity, error: cityError } = await supabase
      .from('cities')
      .select('id, name, location')
      .eq('id', targetCityId)
      .single()

    if (cityError || !targetCity) {
      if (cityError) {
        req.log.error({ operation: 'createTransaction', code: cityError.code || 'UNKNOWN' }, 'Database error looking up target city')
      }
      req.log.warn({ field: 'targetCityId', reason: 'target city not found' }, 'Validation failed')
      return res.status(404).json({ error: 'Target city not found' })
    }

    // --- Fetch player data ---
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('id, gold, home_port_id')
      .eq('id', req.userId)
      .single()

    if (playerError || !playerData) {
      if (playerError) {
        req.log.error({ operation: 'createTransaction', code: playerError.code || 'UNKNOWN' }, 'Database error looking up player')
      }
      req.log.warn({ field: 'playerId', reason: 'player not found' }, 'Validation failed')
      return res.status(400).json({ error: 'Player not found' })
    }

    // --- Fetch current ship inventory ---
    const { data: shipInventoryRows } = await supabase
      .from('ship_inventories')
      .select('item_name, quantity')
      .eq('ship_id', shipId)

    // Build virtual state
    const virtualInventory = {}
    for (const row of (shipInventoryRows || [])) {
      virtualInventory[row.item_name] = row.quantity
    }
    let virtualGold = playerData.gold
    let virtualCargoUsed = Object.values(virtualInventory).reduce((sum, q) => sum + q, 0)

    // --- Fetch prices for all items involved in buy actions ---
    const buyItemNames = [...new Set(actions.filter((a) => a.type === 'buy').map((a) => a.itemName))]
    const priceCache = {}

    for (const itemName of buyItemNames) {
      const { data: priceRow, error: priceError } = await supabase
        .from('price_sheets')
        .select('price, items!inner(name)')
        .eq('city_id', targetCityId)
        .eq('items.name', itemName)
        .single()

      if (priceError || !priceRow) {
        req.log.warn({ field: 'itemName', reason: `item "${itemName}" not available in target city` }, 'Validation failed')
        return res.status(400).json({ error: `Item "${itemName}" is not available in ${targetCity.name}` })
      }
      priceCache[itemName] = priceRow.price
    }

    // --- Validate each action against virtual state ---
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i]

      if (a.type === 'sell') {
        // Must have enough in virtual inventory
        const available = virtualInventory[a.itemName] || 0
        if (available < a.quantity) {
          req.log.warn({ field: `actions[${i}]`, reason: `insufficient "${a.itemName}" in ship (have ${available}, need ${a.quantity})` }, 'Validation failed')
          return res.status(400).json({
            error: `Action ${i + 1}: insufficient "${a.itemName}" in ship (have ${available}, need ${a.quantity})`,
          })
        }
        // Apply: subtract from inventory, add to gold (gold from sell is gained on arrival, not here)
        // Actually for sell, gold is gained on arrival — we don't add gold now.
        // But we DO subtract from the virtual inventory to track what's left.
        virtualInventory[a.itemName] -= a.quantity
        virtualCargoUsed -= a.quantity
      }

      if (a.type === 'buy') {
        const price = priceCache[a.itemName]
        const cost = price * a.quantity

        // Must have cargo capacity (hard limit — can't exceed physical space)
        if (virtualCargoUsed + a.quantity > ship.cargo_capacity) {
          req.log.warn({ field: `actions[${i}]`, reason: `insufficient cargo space (used ${virtualCargoUsed}/${ship.cargo_capacity}, need ${a.quantity} more)` }, 'Validation failed')
          return res.status(400).json({
            error: `Action ${i + 1}: insufficient cargo space (used ${virtualCargoUsed}/${ship.cargo_capacity}, need ${a.quantity} more)`,
          })
        }

        // Track virtual gold (allow overdraft — ship will buy as much as possible at arrival)
        virtualGold -= cost
        virtualInventory[a.itemName] = (virtualInventory[a.itemName] || 0) + a.quantity
        virtualCargoUsed += a.quantity
      }
    }

    // --- Calculate travel time ---
    const { data: homePort, error: homePortError } = await supabase
      .from('cities')
      .select('location')
      .eq('id', playerData.home_port_id)
      .single()

    if (homePortError || !homePort) {
      if (homePortError) {
        req.log.error({ operation: 'createTransaction', code: homePortError.code || 'UNKNOWN' }, 'Database error looking up home port')
      }
      req.log.warn({ field: 'home_port_id', reason: 'home port not found' }, 'Validation failed')
      return res.status(400).json({ error: 'Home port not found' })
    }

    const travelDays = calculateTravelTime(
      homePort.location.x,
      homePort.location.y,
      targetCity.location.x,
      targetCity.location.y,
      ship.speed
    )

    const now = new Date()
    const scheduledDate = new Date(now)
    scheduledDate.setDate(scheduledDate.getDate() + travelDays)
    // Use local date to stay consistent with the daily handler's date comparison
    const scheduledDateStr = `${scheduledDate.getFullYear()}-${String(scheduledDate.getMonth() + 1).padStart(2, '0')}-${String(scheduledDate.getDate()).padStart(2, '0')}`

    // --- Calculate total estimated gold cost (for logging only — actual price at arrival may differ) ---
    let estimatedGoldCost = 0
    for (const a of actions) {
      if (a.type === 'buy') {
        estimatedGoldCost += priceCache[a.itemName] * a.quantity
      }
    }

    // Log if player may not have enough gold — the system handles partial purchases at arrival
    if (estimatedGoldCost > playerData.gold) {
      req.log.info({ estimatedGoldCost, playerGold: playerData.gold }, 'Transaction submitted with estimated cost exceeding current gold — ship will buy as much as possible')
    }

    // --- Determine transaction type ---
    const hasBuy = actions.some((a) => a.type === 'buy')
    const hasSell = actions.some((a) => a.type === 'sell')
    let transactionType
    if (hasBuy && hasSell) {
      transactionType = 'TRANSFER' // Mixed buy+sell
    } else if (hasBuy) {
      transactionType = TRANSACTION_TYPE.BUY
    } else {
      transactionType = TRANSACTION_TYPE.SELL
    }

    // --- Insert transaction record ---
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        player_id: req.userId,
        ship_id: shipId,
        transaction_type: transactionType,
        actions: { action: actions },
        target_city_id: targetCityId,
        scheduled_date: scheduledDateStr,
        status: TRANSACTION_STATUS.PENDING,
      })
      .select('id')
      .single()

    if (txError || !transaction) {
      req.log.error({ operation: 'createTransaction', code: txError?.code || 'UNKNOWN' }, 'Database error inserting transaction')
      return res.status(500).json({ error: 'Failed to create transaction' })
    }

    // --- Update ship status to TRAVELING ---
    const { error: shipUpdateError } = await supabase
      .from('ships')
      .update({ status: SHIP_STATUS.TRAVELING })
      .eq('id', shipId)

    if (shipUpdateError) {
      req.log.error({ operation: 'createTransaction', code: shipUpdateError.code || 'UNKNOWN' }, 'Database error updating ship status')
      return res.status(500).json({ error: 'Failed to update ship status' })
    }

    req.log.info({ operation: 'createTransaction', result: { transactionId: transaction.id, actionsCount: actions.length, travelDays } }, 'Transaction created')
    return res.status(201).json({
      transactionId: transaction.id,
      estimatedGoldCost,
      travelDays,
      arrivalDate: scheduledDateStr,
      actionsCount: actions.length,
    })
  } catch (err) {
    req.log.error({ operation: 'createTransaction', err }, 'Unexpected error in createTransaction')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
