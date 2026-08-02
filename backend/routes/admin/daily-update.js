const { Router } = require('express')
const adminAuth = require('../../middleware/admin')
const { buildAuditRecord } = require('../../utils/audit')
const supabase = require('../../lib/supabase')
const { createChildLogger } = require('../../lib/logger')
const { normalizeJsonb } = require('../../utils/validators')

const log = createChildLogger('daily-update')

const router = Router()

router.use(adminAuth)

// ============================================================
// POST /api/admin/daily-update
// Orchestrator — runs all three steps in sequence
// ============================================================
router.post('/', async (req, res) => {
  const startTime = Date.now()
  const results = { market: null, transactions: null, factories: null, errors: [] }

  try {
    results.market = await runMarketUpdate()
  } catch (err) {
    log.error({ operation: 'runMarketUpdate', err }, `Market update failed: ${err.message}`)
    results.errors.push(`Market update failed: ${err.message}`)
  }

  try {
    results.transactions = await runTransactionProcessing()
  } catch (err) {
    log.error({ operation: 'runTransactionProcessing', err }, `Transaction processing failed: ${err.message}`)
    results.errors.push(`Transaction processing failed: ${err.message}`)
  }

  try {
    results.factories = await runFactoryProcessing()
  } catch (err) {
    log.error({ operation: 'runFactoryProcessing', err }, `Factory processing failed: ${err.message}`)
    results.errors.push(`Factory processing failed: ${err.message}`)
  }

  const elapsed = Date.now() - startTime

  // Audit log
  try {
    const auditRecord = buildAuditRecord(req.userId, 'CREATE', 'daily_update', 'manual', {
      elapsed_ms: elapsed,
      results,
    })
    await supabase.from('admin_audit_log').insert(auditRecord)
  } catch { /* non-critical */ }

  if (results.errors.length > 0) {
    log.warn({ operation: 'runDailyUpdate', elapsed_ms: elapsed, errorCount: results.errors.length }, 'Daily update completed with errors')
  } else {
    log.info({ operation: 'runDailyUpdate', elapsed_ms: elapsed, market: results.market, transactions: results.transactions, factories: results.factories }, 'Daily update completed successfully')
  }

  return res.status(results.errors.length === 0 ? 200 : 207).json({
    success: results.errors.length === 0,
    elapsed_ms: elapsed,
    ...results,
  })
})

// ============================================================
// POST /api/admin/daily-update/market
// Batch market price update
// ============================================================
router.post('/market', async (req, res) => {
  try {
    const result = await runMarketUpdate()
    log.info({ operation: 'runMarketUpdate', itemsUpdated: result.itemsUpdated, tagsRemoved: result.tagsRemoved, tagsAdded: result.tagsAdded }, 'Market update completed')
    return res.status(200).json(result)
  } catch (err) {
    log.error({ operation: 'runMarketUpdate', err }, `Market update failed: ${err.message}`)
    return res.status(500).json({ error: err.message })
  }
})

// ============================================================
// POST /api/admin/daily-update/transactions
// Batch transaction processing
// ============================================================
router.post('/transactions', async (req, res) => {
  try {
    const result = await runTransactionProcessing()
    log.info({ operation: 'runTransactionProcessing', processed: result.processed, failed: result.failed }, 'Transaction processing completed')
    return res.status(200).json(result)
  } catch (err) {
    log.error({ operation: 'runTransactionProcessing', err }, `Transaction processing failed: ${err.message}`)
    return res.status(500).json({ error: err.message })
  }
})

// ============================================================
// POST /api/admin/daily-update/factories
// Batch factory processing
// ============================================================
router.post('/factories', async (req, res) => {
  try {
    const result = await runFactoryProcessing()
    log.info({ operation: 'runFactoryProcessing', processed: result.processed }, 'Factory processing completed')
    return res.status(200).json(result)
  } catch (err) {
    log.error({ operation: 'runFactoryProcessing', err }, `Factory processing failed: ${err.message}`)
    return res.status(500).json({ error: err.message })
  }
})

module.exports = router
module.exports.runMarketUpdate = runMarketUpdate
module.exports.runTransactionProcessing = runTransactionProcessing
module.exports.runFactoryProcessing = runFactoryProcessing


// ============================================================
// MARKET UPDATE — batched
// ============================================================

// Market tuning constants
const PRICE_MULTIPLIER_BASE = 0.2
const PRICE_MULTIPLIER_SCALE = 0.9
const DAILY_MOMENTUM = 0.3
const INTEGRAL_CONTRIBUTION = 0.2
const INTEGRAL_DECAY = 0.9
const JITTER_INTENSITY = 0.1
const MIN_PRICE = 0.01
const MIN_DEMAND_SETPOINT = 0.1

async function runMarketUpdate() {
  // 1. Batch-fetch all data in parallel
  const [citiesRes, itemsRes, priceSheetsRes, assignmentsRes] = await Promise.all([
    supabase.from('cities').select('id, name, volatility'),
    supabase.from('items').select('id, name, base_price, tags').eq('active', true),
    supabase.from('price_sheets').select('id, city_id, item_id, price, demand_setpoint, integral'),
    supabase.from('city_tag_assignments').select('city_id, tag_id, city_tags(id, name, effects)').eq('active', true),
  ])

  if (citiesRes.error) throw new Error(`Fetch cities: ${citiesRes.error.message}`)
  if (itemsRes.error) throw new Error(`Fetch items: ${itemsRes.error.message}`)
  if (priceSheetsRes.error) throw new Error(`Fetch price_sheets: ${priceSheetsRes.error.message}`)
  if (assignmentsRes.error) throw new Error(`Fetch assignments: ${assignmentsRes.error.message}`)

  const cities = citiesRes.data
  const items = itemsRes.data
  const priceSheets = priceSheetsRes.data
  const assignments = assignmentsRes.data || []

  // 2. Index data for fast lookup
  const cityMap = Object.fromEntries(cities.map((c) => [c.id, c]))
  const itemMap = Object.fromEntries(items.map((i) => [i.id, i]))

  // Group tag effects by city_id
  const cityTagEffects = {}
  for (const a of assignments) {
    if (!cityTagEffects[a.city_id]) cityTagEffects[a.city_id] = []
    if (a.city_tags) cityTagEffects[a.city_id].push(a.city_tags)
  }

  // 3. Calculate all new prices in memory
  const updates = []

  for (const ps of priceSheets) {
    const city = cityMap[ps.city_id]
    const item = itemMap[ps.item_id]
    if (!city || !item) continue

    const tags = cityTagEffects[ps.city_id] || []

    // Calculate demand setpoint from active tags
    let demandSetpoint = 1.0
    for (const tag of tags) {
      const effects = tag.effects
      if (!effects) continue
      if (effects.goods && effects.goods[item.name]) {
        demandSetpoint += effects.goods[item.name]
      }
      if (effects.tags && item.tags) {
        for (const [category, effect] of Object.entries(effects.tags)) {
          if (item.tags.includes(category)) {
            demandSetpoint += effect
          }
        }
      }
    }
    demandSetpoint = Math.max(demandSetpoint, MIN_DEMAND_SETPOINT)

    // Price algorithm
    const targetPrice = item.base_price * (PRICE_MULTIPLIER_BASE + demandSetpoint * PRICE_MULTIPLIER_SCALE)
    const priceError = targetPrice - ps.price
    const integralNew = (ps.integral * INTEGRAL_DECAY) + (priceError * INTEGRAL_CONTRIBUTION)
    let newPrice = Math.max(ps.price + (priceError * DAILY_MOMENTUM) + integralNew, MIN_PRICE)

    // Jitter
    const jitter = city.volatility * JITTER_INTENSITY * (Math.random() * 2 - 1)
    newPrice = Math.max(newPrice * (1 + jitter), MIN_PRICE)

    updates.push({
      id: ps.id,
      city_id: ps.city_id,
      item_id: ps.item_id,
      price: Math.round(newPrice * 100) / 100,
      demand_setpoint: Math.round(demandSetpoint * 1000) / 1000,
      integral: Math.round(integralNew * 1000) / 1000,
    })
  }

  // 4. Write all updates in batches via upsert
  let itemsUpdated = 0
  const BATCH_SIZE = 100
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('price_sheets')
      .upsert(batch, { onConflict: 'id' })

    if (error) throw new Error(`Batch upsert failed: ${error.message}`)
    itemsUpdated += batch.length
  }

  // 5. Handle expired tags + random events
  const todayNow = new Date()
  const today = `${todayNow.getFullYear()}-${String(todayNow.getMonth() + 1).padStart(2, '0')}-${String(todayNow.getDate()).padStart(2, '0')}`
  const { data: expired } = await supabase
    .from('city_tag_assignments')
    .select('id')
    .eq('is_permanent', false)
    .eq('active', true)
    .lte('expires_at', today)

  let tagsRemoved = 0
  if (expired && expired.length > 0) {
    const ids = expired.map((r) => r.id)
    await supabase.from('city_tag_assignments').delete().in('id', ids)
    tagsRemoved = ids.length
  }

  // Random event tags (25% chance per city)
  const { data: eventTags } = await supabase
    .from('city_tags')
    .select('id, name')
    .eq('can_be_event', true)
    .eq('active', true)

  let tagsAdded = 0
  if (eventTags && eventTags.length > 0) {
    const { data: currentAssignments } = await supabase
      .from('city_tag_assignments')
      .select('city_id, tag_id')
      .eq('active', true)

    const assignedSet = new Set(
      (currentAssignments || []).map((a) => `${a.city_id}|${a.tag_id}`)
    )

    const newAssignments = []
    for (const city of cities) {
      if (Math.random() < 0.25) {
        const tag = eventTags[Math.floor(Math.random() * eventTags.length)]
        if (assignedSet.has(`${city.id}|${tag.id}`)) continue

        const daysUntilExpiry = 3 + Math.floor(Math.random() * 5)
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + daysUntilExpiry)

        newAssignments.push({
          city_id: city.id,
          tag_id: tag.id,
          is_permanent: false,
          expires_at: expiresAt.toISOString().split('T')[0],
          active: true,
        })
      }
    }

    if (newAssignments.length > 0) {
      const { error } = await supabase
        .from('city_tag_assignments')
        .insert(newAssignments)
      if (!error) tagsAdded = newAssignments.length
    }
  }

  return { itemsUpdated, tagsRemoved, tagsAdded }
}


// ============================================================
// TRANSACTION PROCESSING — batched
// ============================================================

async function runTransactionProcessing() {
  // Use local date to avoid UTC offset causing off-by-one errors.
  // toISOString() returns UTC which can be a day ahead depending on timezone.
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // 1. Fetch all pending transactions due today (with ship info)
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('status', 'PENDING')
    .lte('scheduled_date', today)

  if (txError) throw new Error(`Fetch transactions: ${txError.message}`)
  if (!transactions || transactions.length === 0) return { processed: 0, failed: 0 }

  // 2. Batch-fetch all players and ships involved
  const playerIds = [...new Set(transactions.map((t) => t.player_id))]
  const shipIds = [...new Set(transactions.map((t) => t.ship_id))]
  const cityIds = [...new Set(transactions.map((t) => t.target_city_id))]

  const [playersRes, shipsRes] = await Promise.all([
    supabase.from('players').select('id, gold, home_port_id').in('id', playerIds),
    supabase.from('ships').select('id, player_id, speed').in('id', shipIds),
  ])

  const playerMap = Object.fromEntries((playersRes.data || []).map((p) => [p.id, { ...p }]))
  const shipMap = Object.fromEntries((shipsRes.data || []).map((s) => [s.id, s]))

  // 3. Fetch all price sheets for involved cities (for price lookups)
  const { data: priceData } = await supabase
    .from('price_sheets')
    .select('city_id, price, items!inner(name)')
    .in('city_id', cityIds)

  // Index: cityId -> itemName -> price
  const priceIndex = {}
  for (const row of (priceData || [])) {
    if (!priceIndex[row.city_id]) priceIndex[row.city_id] = {}
    priceIndex[row.city_id][row.items.name] = row.price
  }

  // 4. Fetch all ship inventories for involved ships
  const { data: allShipInv } = await supabase
    .from('ship_inventories')
    .select('ship_id, item_name, quantity')
    .in('ship_id', shipIds)

  // Index: shipId -> { itemName: quantity }
  const shipInvMap = {}
  for (const row of (allShipInv || [])) {
    if (!shipInvMap[row.ship_id]) shipInvMap[row.ship_id] = {}
    shipInvMap[row.ship_id][row.item_name] = row.quantity
  }

  // 5. Process each transaction in memory
  let processed = 0
  let failed = 0
  const completedTxIds = []
  const failedTxIds = []
  const shipInvWrites = {} // shipId -> { itemName: newQuantity }
  const goldUpdates = {}   // playerId -> newGold
  const returnTrips = []   // transactions to create for return voyages

  for (const tx of transactions) {
    try {
      const actions = tx.actions?.action
      if (!actions || !Array.isArray(actions)) throw new Error('Invalid actions')

      const player = playerMap[tx.player_id]
      if (!player) throw new Error('Player not found')

      const cityPrices = priceIndex[tx.target_city_id] || {}
      const shipInv = shipInvMap[tx.ship_id] || {}

      // Use running gold from playerMap (so multiple tx for same player chain correctly)
      let currentGold = goldUpdates[tx.player_id] !== undefined ? goldUpdates[tx.player_id] : player.gold

      for (const action of actions) {
        if (action.type === 'return') {
          // Return trip: transfer ship inventory to player inventory (handled after DB writes)
          // Just mark as completed — the return logic runs below
          continue
        }

        const price = cityPrices[action.itemName]
        if (price === undefined) {
          throw new Error(`No price for ${action.itemName} in target city`)
        }

        if (action.type === 'buy') {
          const cost = price * action.quantity
          if (currentGold < cost) {
            // Partial fill: buy as much as the player can afford
            const affordableQty = Math.floor(currentGold / price)
            if (affordableQty > 0) {
              currentGold -= price * affordableQty
              shipInv[action.itemName] = (shipInv[action.itemName] || 0) + affordableQty
              log.info({ item: action.itemName, requested: action.quantity, filled: affordableQty, gold: currentGold }, 'Partial fill — insufficient gold for full quantity')
            } else {
              log.info({ item: action.itemName, requested: action.quantity, gold: currentGold }, 'Skipped buy — cannot afford even 1 unit')
            }
          } else {
            currentGold -= cost
            shipInv[action.itemName] = (shipInv[action.itemName] || 0) + action.quantity
          }
        } else if (action.type === 'sell') {
          const available = shipInv[action.itemName] || 0
          const sellQty = Math.min(action.quantity, available)
          if (sellQty > 0) {
            shipInv[action.itemName] -= sellQty
            currentGold += price * sellQty
            if (sellQty < action.quantity) {
              log.info({ item: action.itemName, requested: action.quantity, filled: sellQty }, 'Partial fill — insufficient inventory for full sell quantity')
            }
          } else {
            log.info({ item: action.itemName, requested: action.quantity, available: 0 }, 'Skipped sell — no inventory available')
          }
        }
      }

      // Commit changes to in-memory state
      goldUpdates[tx.player_id] = currentGold
      shipInvMap[tx.ship_id] = { ...shipInv }
      shipInvWrites[tx.ship_id] = { ...shipInv }
      completedTxIds.push(tx.id)

      // If this is a return trip, ship goes to READY. Otherwise, schedule a return.
      const isReturnTrip = actions.some((a) => a.type === 'return')
      if (!isReturnTrip) {
        returnTrips.push(tx)
      }
      processed++
    } catch (err) {
      log.warn({
        operation: 'processTransaction',
        transactionId: tx.id,
        playerId: tx.player_id,
        shipId: tx.ship_id,
        targetCityId: tx.target_city_id,
        err,
      }, `Transaction failed: ${err.message}`)
      failedTxIds.push(tx.id)
      failed++
    }
  }

  // 6. Write all changes to the database in batches

  // Update gold for all affected players
  for (const [playerId, newGold] of Object.entries(goldUpdates)) {
    await supabase.from('players').update({ gold: newGold }).eq('id', playerId)
  }

  // Update ship inventories
  for (const [shipId, inv] of Object.entries(shipInvWrites)) {
    // Delete all current rows and re-insert (simpler than diffing)
    await supabase.from('ship_inventories').delete().eq('ship_id', shipId)

    const rows = Object.entries(inv)
      .filter(([, qty]) => qty > 0)
      .map(([itemName, quantity]) => ({ ship_id: shipId, item_name: itemName, quantity }))

    if (rows.length > 0) {
      await supabase.from('ship_inventories').insert(rows)
    }
  }

  // Mark completed transactions
  if (completedTxIds.length > 0) {
    await supabase.from('transactions').update({ status: 'COMPLETED' }).in('id', completedTxIds)
  }

  // Mark failed transactions and recover ships
  if (failedTxIds.length > 0) {
    await supabase.from('transactions').update({ status: 'FAILED' }).in('id', failedTxIds)
  }

  // Set completed trade ships to RETURNING and create return trips
  for (const tx of returnTrips) {
    await supabase.from('ships').update({ status: 'RETURNING' }).eq('id', tx.ship_id)
  }

  // Handle completed return trips — transfer ship inv to player, set READY
  const returnTripTxs = transactions.filter(
    (tx) => completedTxIds.includes(tx.id) && (tx.actions?.action || []).some((a) => a.type === 'return')
  )
  for (const tx of returnTripTxs) {
    // Move ship inventory to player inventory
    const shipInv = shipInvWrites[tx.ship_id] || {}
    for (const [itemName, qty] of Object.entries(shipInv)) {
      if (qty <= 0) continue
      // Check if player already has this item
      const { data: existing } = await supabase
        .from('player_inventories')
        .select('quantity')
        .eq('player_id', tx.player_id)
        .eq('item_name', itemName)
        .single()

      if (existing) {
        await supabase
          .from('player_inventories')
          .update({ quantity: existing.quantity + qty })
          .eq('player_id', tx.player_id)
          .eq('item_name', itemName)
      } else {
        await supabase
          .from('player_inventories')
          .insert({ player_id: tx.player_id, item_name: itemName, quantity: qty })
      }
    }
    // Clear ship inventory
    await supabase.from('ship_inventories').delete().eq('ship_id', tx.ship_id)
    // Set ship to READY
    await supabase.from('ships').update({ status: 'READY' }).eq('id', tx.ship_id)
  }

  // Create return trip transactions in batch
  if (returnTrips.length > 0) {
    const returnTxRows = await buildReturnTrips(returnTrips, shipMap, playerMap)
    if (returnTxRows.length > 0) {
      await supabase.from('transactions').insert(returnTxRows)
    }
  }

  // Recover failed ships — set to RETURNING and create return trips
  for (const txId of failedTxIds) {
    const tx = transactions.find((t) => t.id === txId)
    if (!tx) continue
    await supabase.from('ships').update({ status: 'RETURNING' }).eq('id', tx.ship_id)
    const returnRows = await buildReturnTrips([tx], shipMap, playerMap)
    if (returnRows.length > 0) {
      await supabase.from('transactions').insert(returnRows)
    }
  }

  return { processed, failed }
}

/**
 * Build return trip transaction rows for a set of completed transactions.
 */
async function buildReturnTrips(transactions, shipMap, playerMap) {
  // Fetch all city locations in one query
  const cityIds = new Set()
  for (const tx of transactions) {
    cityIds.add(tx.target_city_id)
    const player = playerMap[tx.player_id]
    if (player) cityIds.add(player.home_port_id)
  }

  const { data: cityData } = await supabase
    .from('cities')
    .select('id, location')
    .in('id', [...cityIds])

  const cityLocationMap = Object.fromEntries((cityData || []).map((c) => [c.id, c.location]))

  const rows = []
  for (const tx of transactions) {
    const ship = shipMap[tx.ship_id]
    const player = playerMap[tx.player_id]
    if (!ship || !player) continue

    const target = cityLocationMap[tx.target_city_id]
    const home = cityLocationMap[player.home_port_id]
    if (!target || !home) continue

    const distance = Math.sqrt(Math.pow(home.x - target.x, 2) + Math.pow(home.y - target.y, 2))
    const travelDays = Math.max(1, Math.ceil(distance / ship.speed))

    // TODO: PLAYTEST OVERRIDE — return trips resolve immediately.
    // Revert by removing the next line to restore real travel times.
    const playtestTravelDays = 0
    const returnDate = new Date()
    returnDate.setDate(returnDate.getDate() + playtestTravelDays)
    // Use local date to stay consistent with the daily handler's date comparison
    const returnDateStr = `${returnDate.getFullYear()}-${String(returnDate.getMonth() + 1).padStart(2, '0')}-${String(returnDate.getDate()).padStart(2, '0')}`

    rows.push({
      player_id: tx.player_id,
      ship_id: tx.ship_id,
      transaction_type: 'TRANSFER',
      actions: { action: [{ type: 'return' }] },
      target_city_id: player.home_port_id,
      scheduled_date: returnDateStr,
      status: 'PENDING',
    })
  }

  return rows
}


// ============================================================
// FACTORY PROCESSING — batched
// ============================================================

async function runFactoryProcessing() {
  // 1. Fetch all active factories
  const { data: factories, error: factError } = await supabase
    .from('factories')
    .select('*')
    .eq('active', true)

  if (factError) throw new Error(`Fetch factories: ${factError.message}`)
  if (!factories || factories.length === 0) return { processed: 0 }

  // 2. Fetch all player inventories and gold for factory owners in one query
  const playerIds = [...new Set(factories.map((f) => f.player_id))]
  const [invRes, playersRes] = await Promise.all([
    supabase.from('player_inventories').select('player_id, item_name, quantity').in('player_id', playerIds),
    supabase.from('players').select('id, gold').in('id', playerIds),
  ])

  const allInv = invRes.data
  const allPlayers = playersRes.data

  // Index: playerId -> { itemName: quantity }
  const invMap = {}
  for (const row of (allInv || [])) {
    if (!invMap[row.player_id]) invMap[row.player_id] = {}
    invMap[row.player_id][row.item_name] = row.quantity
  }

  // Index: playerId -> current gold (mutable during processing)
  const goldMap = {}
  for (const p of (allPlayers || [])) {
    goldMap[p.id] = p.gold
  }

  // 3. Process factories in memory
  let processed = 0
  let skipped = 0
  let failed = 0

  log.info({ operation: 'runFactoryProcessing', totalFactories: factories.length }, `Processing ${factories.length} active factories`)

  for (const factory of factories) {
    try {
      // Validate factory data structure (normalize stringified JSON if needed)
      const output = normalizeJsonb(factory.output_production)
      if (!output || !output.item || typeof output.quantity !== 'number') {
        log.warn({
          operation: 'runFactoryProcessing',
          factoryId: factory.id,
          playerId: factory.player_id,
          outputProduction: factory.output_production,
        }, `Skipping malformed factory: invalid output_production`)
        failed++
        continue
      }

      const rawInputReqs = normalizeJsonb(factory.input_requirements) || {}
      const inv = invMap[factory.player_id] || {}

      // Normalize input_requirements to an array of { item, quantity } objects.
      // Supports:
      //   - Array of objects: [{ item: "Grain", quantity: 10 }, ...]
      //   - Single object:    { item: "Grain", quantity: 10 }
      //   - Legacy map:       { "Grain": 10, "Iron": 5 }
      let inputList
      if (Array.isArray(rawInputReqs)) {
        inputList = rawInputReqs
      } else if (rawInputReqs.item && rawInputReqs.quantity !== undefined) {
        // Single {item, quantity} object
        inputList = [rawInputReqs]
      } else {
        // Legacy map format: { "Grain": 10, "Iron": 5 }
        inputList = Object.entries(rawInputReqs).map(([item, quantity]) => ({ item, quantity }))
      }

      // Check all inputs are satisfied (Gold checked against player gold, others against inventory)
      const playerGold = goldMap[factory.player_id] || 0
      let canProduce = true
      let missingItem = null
      let missingHave = 0
      let missingNeed = 0
      for (const req of inputList) {
        if (req.item === 'Gold') {
          if (playerGold < req.quantity) {
            canProduce = false
            missingItem = 'Gold'
            missingHave = playerGold
            missingNeed = req.quantity
            break
          }
        } else {
          const available = inv[req.item] || 0
          if (available < req.quantity) {
            canProduce = false
            missingItem = req.item
            missingHave = available
            missingNeed = req.quantity
            break
          }
        }
      }

      if (!canProduce) {
        log.debug({
          operation: 'runFactoryProcessing',
          factoryId: factory.id,
          playerId: factory.player_id,
          missingItem,
          have: missingHave,
          need: missingNeed,
        }, `Factory skipped: insufficient input "${missingItem}" (have ${missingHave}, need ${missingNeed})`)
        skipped++
        continue
      }

      // Consume inputs (Gold subtracted from player gold, others from inventory)
      for (const req of inputList) {
        if (req.item === 'Gold') {
          goldMap[factory.player_id] = (goldMap[factory.player_id] || 0) - req.quantity
        } else {
          inv[req.item] = (inv[req.item] || 0) - req.quantity
        }
      }

      // Produce output (Gold added to player gold, others to inventory)
      if (output.item === 'Gold') {
        goldMap[factory.player_id] = (goldMap[factory.player_id] || 0) + output.quantity
      } else {
        inv[output.item] = (inv[output.item] || 0) + output.quantity
      }

      // Update the map so subsequent factories for same player see the change
      invMap[factory.player_id] = inv
      processed++

      log.debug({
        operation: 'runFactoryProcessing',
        factoryId: factory.id,
        playerId: factory.player_id,
        outputItem: output.item,
        outputQuantity: output.quantity,
      }, `Factory produced ${output.quantity}x ${output.item}`)
    } catch (err) {
      log.error({
        operation: 'runFactoryProcessing',
        factoryId: factory.id,
        playerId: factory.player_id,
        err,
      }, `Factory processing error: ${err.message}`)
      failed++
    }
  }

  log.info({
    operation: 'runFactoryProcessing',
    processed,
    skipped,
    failed,
    total: factories.length,
  }, `Factory processing complete: ${processed} produced, ${skipped} skipped (insufficient inputs), ${failed} failed`)

  // 4. Write updated inventories back to database
  for (const playerId of playerIds) {
    const inv = invMap[playerId] || {}

    // Delete all current rows and re-insert
    await supabase.from('player_inventories').delete().eq('player_id', playerId)

    const rows = Object.entries(inv)
      .filter(([, qty]) => qty > 0)
      .map(([itemName, quantity]) => ({ player_id: playerId, item_name: itemName, quantity }))

    if (rows.length > 0) {
      await supabase.from('player_inventories').insert(rows)
    }
  }

  // 5. Write updated gold balances back to database
  for (const playerId of playerIds) {
    const originalGold = (allPlayers || []).find((p) => p.id === playerId)?.gold
    const newGold = goldMap[playerId]
    if (newGold !== undefined && newGold !== originalGold) {
      await supabase.from('players').update({ gold: newGold }).eq('id', playerId)
    }
  }

  return { processed, skipped, failed }
}
