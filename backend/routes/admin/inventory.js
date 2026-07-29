const { Router } = require('express')
const adminAuth = require('../../middleware/admin')
const supabase = require('../../lib/supabase')
const { validateInventoryEntry } = require('../../utils/admin-validators')
const { mergeInventoryQuantity, checkCargoCapacity } = require('../../utils/admin-helpers')
const { buildAuditRecord } = require('../../utils/audit')

const router = Router()

// All admin inventory routes require authentication + admin role
router.use(adminAuth)

// GET /ship/:shipId — List all inventory entries for a ship
router.get('/ship/:shipId', async (req, res) => {
  try {
    const { shipId } = req.params
    req.log.info({ module: 'admin', operation: 'getShipInventory', shipId }, 'Fetching ship inventory')

    const { data, error } = await supabase
      .from('ship_inventories')
      .select('item_name, quantity')
      .eq('ship_id', shipId)

    if (error) {
      req.log.error({ module: 'admin', operation: 'getShipInventory', code: error.code || 'UNKNOWN' }, 'Database error fetching ship inventory')
      return res.status(500).json({ error: 'Internal server error' })
    }

    return res.status(200).json(data || [])
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'getShipInventory', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /player/:playerId — Add item to player inventory (merge if exists)
router.post('/player/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params
    req.log.info({ module: 'admin', operation: 'addPlayerInventory', playerId }, 'Adding item to player inventory')

    const { isValid, errors } = validateInventoryEntry(req.body)
    if (!isValid) {
      req.log.warn({ module: 'admin', operation: 'addPlayerInventory', field: 'body', reason: errors.join(', ') }, 'Validation failed')
      return res.status(400).json({ errors })
    }

    const { item_name, quantity } = req.body

    // Check if entry already exists
    const { data: existing, error: fetchError } = await supabase
      .from('player_inventories')
      .select('quantity')
      .eq('player_id', playerId)
      .eq('item_name', item_name)
      .maybeSingle()

    if (fetchError) {
      req.log.error({ module: 'admin', operation: 'addPlayerInventory', code: fetchError.code || 'UNKNOWN' }, 'Database error checking existing inventory')
      return res.status(500).json({ error: 'Internal server error' })
    }

    let result
    if (existing) {
      // Merge quantities
      const mergedQuantity = mergeInventoryQuantity(existing.quantity, quantity)
      const { data, error } = await supabase
        .from('player_inventories')
        .update({ quantity: mergedQuantity })
        .eq('player_id', playerId)
        .eq('item_name', item_name)
        .select()
        .single()

      if (error) {
        req.log.error({ module: 'admin', operation: 'addPlayerInventory', code: error.code || 'UNKNOWN' }, 'Database error updating inventory')
        return res.status(500).json({ error: 'Internal server error' })
      }
      result = data
    } else {
      // Insert new entry
      const { data, error } = await supabase
        .from('player_inventories')
        .insert({ player_id: playerId, item_name, quantity })
        .select()
        .single()

      if (error) {
        req.log.error({ module: 'admin', operation: 'addPlayerInventory', code: error.code || 'UNKNOWN' }, 'Database error inserting inventory')
        return res.status(500).json({ error: 'Internal server error' })
      }
      result = data
    }

    // Write audit log
    const auditRecord = buildAuditRecord(req.userId, 'CREATE', 'player_inventory', playerId, { item_name, quantity, merged: !!existing })
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'addPlayerInventory', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'addPlayerInventory', result: { playerId, item_name, merged: !!existing } }, 'Player inventory updated')
    return res.status(201).json(result)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'addPlayerInventory', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /player/:playerId/:itemName — Edit player inventory quantity
router.put('/player/:playerId/:itemName', async (req, res) => {
  try {
    const { playerId, itemName } = req.params
    req.log.info({ module: 'admin', operation: 'editPlayerInventory', playerId, itemName }, 'Editing player inventory')

    const { isValid, errors } = validateInventoryEntry({ item_name: itemName, quantity: req.body.quantity })
    if (!isValid) {
      req.log.warn({ module: 'admin', operation: 'editPlayerInventory', field: 'body', reason: errors.join(', ') }, 'Validation failed')
      return res.status(400).json({ errors })
    }

    const { quantity } = req.body

    const { data, error } = await supabase
      .from('player_inventories')
      .update({ quantity })
      .eq('player_id', playerId)
      .eq('item_name', itemName)
      .select()

    if (error) {
      req.log.error({ module: 'admin', operation: 'editPlayerInventory', code: error.code || 'UNKNOWN' }, 'Database error updating inventory')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Inventory entry not found' })
    }

    // Write audit log
    const auditRecord = buildAuditRecord(req.userId, 'UPDATE', 'player_inventory', playerId, { item_name: itemName, quantity })
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'editPlayerInventory', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'editPlayerInventory', result: { playerId, itemName, quantity } }, 'Player inventory edited')
    return res.status(200).json(data[0])
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'editPlayerInventory', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /player/:playerId/:itemName — Delete player inventory entry
router.delete('/player/:playerId/:itemName', async (req, res) => {
  try {
    const { playerId, itemName } = req.params
    req.log.info({ module: 'admin', operation: 'deletePlayerInventory', playerId, itemName }, 'Deleting player inventory entry')

    const { data, error } = await supabase
      .from('player_inventories')
      .delete()
      .eq('player_id', playerId)
      .eq('item_name', itemName)
      .select()

    if (error) {
      req.log.error({ module: 'admin', operation: 'deletePlayerInventory', code: error.code || 'UNKNOWN' }, 'Database error deleting inventory')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Inventory entry not found' })
    }

    // Write audit log
    const auditRecord = buildAuditRecord(req.userId, 'DELETE', 'player_inventory', playerId, { item_name: itemName })
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'deletePlayerInventory', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'deletePlayerInventory', result: { playerId, itemName } }, 'Player inventory entry deleted')
    return res.status(200).json(data[0])
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'deletePlayerInventory', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /ship/:shipId — Add item to ship inventory (check cargo capacity)
router.post('/ship/:shipId', async (req, res) => {
  try {
    const { shipId } = req.params
    req.log.info({ module: 'admin', operation: 'addShipInventory', shipId }, 'Adding item to ship inventory')

    const { isValid, errors } = validateInventoryEntry(req.body)
    if (!isValid) {
      req.log.warn({ module: 'admin', operation: 'addShipInventory', field: 'body', reason: errors.join(', ') }, 'Validation failed')
      return res.status(400).json({ errors })
    }

    const { item_name, quantity } = req.body

    // Get ship cargo capacity
    const { data: ship, error: shipError } = await supabase
      .from('ships')
      .select('id, cargo_capacity')
      .eq('id', shipId)
      .single()

    if (shipError) {
      if (shipError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Ship not found' })
      }
      req.log.error({ module: 'admin', operation: 'addShipInventory', code: shipError.code || 'UNKNOWN' }, 'Database error fetching ship')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Get current total cargo on the ship
    const { data: currentItems, error: cargoError } = await supabase
      .from('ship_inventories')
      .select('item_name, quantity')
      .eq('ship_id', shipId)

    if (cargoError) {
      req.log.error({ module: 'admin', operation: 'addShipInventory', code: cargoError.code || 'UNKNOWN' }, 'Database error fetching ship cargo')
      return res.status(500).json({ error: 'Internal server error' })
    }

    const currentCargo = (currentItems || []).reduce((sum, item) => sum + item.quantity, 0)

    // Check if item already exists in ship inventory
    const existingItem = (currentItems || []).find(item => item.item_name === item_name)
    const addQuantity = quantity

    // Check cargo capacity
    const { allowed, remaining } = checkCargoCapacity(currentCargo, addQuantity, ship.cargo_capacity)
    if (!allowed) {
      req.log.warn({ module: 'admin', operation: 'addShipInventory', currentCargo, addQuantity, capacity: ship.cargo_capacity }, 'Cargo capacity exceeded')
      return res.status(400).json({ error: `Cargo capacity exceeded. Remaining capacity: ${remaining}` })
    }

    let result
    if (existingItem) {
      // Merge quantities
      const mergedQuantity = mergeInventoryQuantity(existingItem.quantity, quantity)
      const { data, error } = await supabase
        .from('ship_inventories')
        .update({ quantity: mergedQuantity })
        .eq('ship_id', shipId)
        .eq('item_name', item_name)
        .select()
        .single()

      if (error) {
        req.log.error({ module: 'admin', operation: 'addShipInventory', code: error.code || 'UNKNOWN' }, 'Database error updating ship inventory')
        return res.status(500).json({ error: 'Internal server error' })
      }
      result = data
    } else {
      // Insert new entry
      const { data, error } = await supabase
        .from('ship_inventories')
        .insert({ ship_id: shipId, item_name, quantity })
        .select()
        .single()

      if (error) {
        req.log.error({ module: 'admin', operation: 'addShipInventory', code: error.code || 'UNKNOWN' }, 'Database error inserting ship inventory')
        return res.status(500).json({ error: 'Internal server error' })
      }
      result = data
    }

    // Write audit log
    const auditRecord = buildAuditRecord(req.userId, 'CREATE', 'ship_inventory', shipId, { item_name, quantity, merged: !!existingItem })
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'addShipInventory', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'addShipInventory', result: { shipId, item_name, merged: !!existingItem } }, 'Ship inventory updated')
    return res.status(201).json(result)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'addShipInventory', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /ship/:shipId/:itemName — Edit ship inventory quantity (check capacity)
router.put('/ship/:shipId/:itemName', async (req, res) => {
  try {
    const { shipId, itemName } = req.params
    req.log.info({ module: 'admin', operation: 'editShipInventory', shipId, itemName }, 'Editing ship inventory')

    const { isValid, errors } = validateInventoryEntry({ item_name: itemName, quantity: req.body.quantity })
    if (!isValid) {
      req.log.warn({ module: 'admin', operation: 'editShipInventory', field: 'body', reason: errors.join(', ') }, 'Validation failed')
      return res.status(400).json({ errors })
    }

    const { quantity } = req.body

    // Get ship cargo capacity
    const { data: ship, error: shipError } = await supabase
      .from('ships')
      .select('id, cargo_capacity')
      .eq('id', shipId)
      .single()

    if (shipError) {
      if (shipError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Ship not found' })
      }
      req.log.error({ module: 'admin', operation: 'editShipInventory', code: shipError.code || 'UNKNOWN' }, 'Database error fetching ship')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Get current total cargo on the ship
    const { data: currentItems, error: cargoError } = await supabase
      .from('ship_inventories')
      .select('item_name, quantity')
      .eq('ship_id', shipId)

    if (cargoError) {
      req.log.error({ module: 'admin', operation: 'editShipInventory', code: cargoError.code || 'UNKNOWN' }, 'Database error fetching ship cargo')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Find the existing entry for this item
    const existingItem = (currentItems || []).find(item => item.item_name === itemName)
    if (!existingItem) {
      return res.status(404).json({ error: 'Inventory entry not found' })
    }

    // Calculate cargo excluding the current item, then check if new quantity fits
    const cargoWithoutItem = (currentItems || []).reduce((sum, item) => {
      if (item.item_name === itemName) return sum
      return sum + item.quantity
    }, 0)

    const { allowed, remaining } = checkCargoCapacity(cargoWithoutItem, quantity, ship.cargo_capacity)
    if (!allowed) {
      const availableCapacity = ship.cargo_capacity - cargoWithoutItem
      req.log.warn({ module: 'admin', operation: 'editShipInventory', cargoWithoutItem, newQuantity: quantity, capacity: ship.cargo_capacity }, 'Cargo capacity exceeded')
      return res.status(400).json({ error: `Cargo capacity exceeded. Remaining capacity: ${availableCapacity}` })
    }

    const { data, error } = await supabase
      .from('ship_inventories')
      .update({ quantity })
      .eq('ship_id', shipId)
      .eq('item_name', itemName)
      .select()

    if (error) {
      req.log.error({ module: 'admin', operation: 'editShipInventory', code: error.code || 'UNKNOWN' }, 'Database error updating ship inventory')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Inventory entry not found' })
    }

    // Write audit log
    const auditRecord = buildAuditRecord(req.userId, 'UPDATE', 'ship_inventory', shipId, { item_name: itemName, quantity })
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'editShipInventory', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'editShipInventory', result: { shipId, itemName, quantity } }, 'Ship inventory edited')
    return res.status(200).json(data[0])
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'editShipInventory', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /ship/:shipId/:itemName — Delete ship inventory entry
router.delete('/ship/:shipId/:itemName', async (req, res) => {
  try {
    const { shipId, itemName } = req.params
    req.log.info({ module: 'admin', operation: 'deleteShipInventory', shipId, itemName }, 'Deleting ship inventory entry')

    const { data, error } = await supabase
      .from('ship_inventories')
      .delete()
      .eq('ship_id', shipId)
      .eq('item_name', itemName)
      .select()

    if (error) {
      req.log.error({ module: 'admin', operation: 'deleteShipInventory', code: error.code || 'UNKNOWN' }, 'Database error deleting ship inventory')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Inventory entry not found' })
    }

    // Write audit log
    const auditRecord = buildAuditRecord(req.userId, 'DELETE', 'ship_inventory', shipId, { item_name: itemName })
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'deleteShipInventory', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'deleteShipInventory', result: { shipId, itemName } }, 'Ship inventory entry deleted')
    return res.status(200).json(data[0])
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'deleteShipInventory', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
