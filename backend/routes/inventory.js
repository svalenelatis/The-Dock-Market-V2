const { Router } = require('express')
const authMiddleware = require('../middleware/auth')
const supabase = require('../lib/supabase')
const { SHIP_STATUS } = require('../utils/constants')

const router = Router()

// All inventory routes require authentication
router.use(authMiddleware)

/**
 * POST /api/inventory/transfer
 *
 * Moves items between a player's personal inventory and a ship's cargo hold.
 * The ship must belong to the player and be in READY status (docked at home port).
 *
 * Body:
 *   - ship_id (string, UUID): The ship to transfer to/from
 *   - item_name (string): The item to move
 *   - quantity (number, integer > 0): How many to move
 *   - direction ("to_ship" | "to_player"): Which way to move items
 *
 * Validations:
 *   1. All fields present and valid types
 *   2. Ship exists and belongs to authenticated player
 *   3. Ship is in READY status (docked)
 *   4. Source inventory has sufficient quantity
 *   5. If direction is "to_ship", ship has enough cargo capacity
 *
 * On success: subtracts from source, adds to destination (upsert), returns 200.
 * All mutations use the service role client (bypasses RLS).
 */
router.post('/transfer', async (req, res) => {
  try {
    req.log.info({ operation: 'transferInventory' }, 'Transfer inventory operation started')

    const { ship_id, item_name, quantity, direction } = req.body

    // --- Input validation ---
    if (!ship_id || !item_name || quantity === undefined || !direction) {
      req.log.warn({ field: 'body', reason: 'Missing required fields: ship_id, item_name, quantity, direction' }, 'Validation failed')
      return res.status(400).json({
        error: 'Missing required fields: ship_id, item_name, quantity, direction',
      })
    }

    if (typeof item_name !== 'string' || item_name.trim().length === 0) {
      req.log.warn({ field: 'item_name', reason: 'Must be a non-empty string' }, 'Validation failed')
      return res.status(400).json({ error: 'item_name must be a non-empty string' })
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      req.log.warn({ field: 'quantity', reason: 'Must be a positive integer' }, 'Validation failed')
      return res.status(400).json({ error: 'quantity must be a positive integer' })
    }

    if (direction !== 'to_ship' && direction !== 'to_player' && direction !== 'ship_to_ship') {
      req.log.warn({ field: 'direction', reason: 'Must be "to_ship", "to_player", or "ship_to_ship"' }, 'Validation failed')
      return res.status(400).json({ error: 'direction must be "to_ship", "to_player", or "ship_to_ship"' })
    }

    if (direction === 'ship_to_ship' && !req.body.destination_ship_id) {
      req.log.warn({ field: 'destination_ship_id', reason: 'Required for ship_to_ship transfers' }, 'Validation failed')
      return res.status(400).json({ error: 'destination_ship_id is required for ship_to_ship transfers' })
    }

    // --- Verify ship belongs to player and is docked ---
    const { data: ship, error: shipError } = await supabase
      .from('ships')
      .select('id, player_id, status, cargo_capacity')
      .eq('id', ship_id)
      .single()

    if (shipError || !ship) {
      req.log.warn({ field: 'ship_id', reason: 'Ship not found' }, 'Validation failed')
      return res.status(404).json({ error: 'Ship not found' })
    }

    if (ship.player_id !== req.userId) {
      req.log.warn({ field: 'ship_id', reason: 'Ship does not belong to player' }, 'Validation failed')
      return res.status(403).json({ error: 'Ship does not belong to you' })
    }

    if (ship.status !== SHIP_STATUS.READY) {
      req.log.warn({ field: 'ship_id', reason: 'Ship must be docked (READY status)' }, 'Validation failed')
      return res.status(400).json({
        error: 'Ship must be docked (READY status) to transfer inventory',
      })
    }

    // --- Validate source has enough quantity ---
    if (direction === 'to_ship') {
      // Source: player_inventories
      const { data: playerItem, error: piError } = await supabase
        .from('player_inventories')
        .select('id, quantity')
        .eq('player_id', req.userId)
        .eq('item_name', item_name)
        .single()

      if (piError || !playerItem || playerItem.quantity < quantity) {
        req.log.warn({ field: 'quantity', reason: `Insufficient "${item_name}" in personal inventory` }, 'Validation failed')
        return res.status(400).json({
          error: `Insufficient "${item_name}" in personal inventory`,
        })
      }

      // Check ship cargo capacity
      const { data: shipCargo, error: cargoError } = await supabase
        .from('ship_inventories')
        .select('quantity')
        .eq('ship_id', ship_id)

      if (cargoError) {
        req.log.error({ operation: 'transferInventory', code: cargoError.code || 'UNKNOWN' }, 'Failed to check ship cargo')
        return res.status(500).json({ error: 'Failed to check ship cargo' })
      }

      const currentCargo = (shipCargo || []).reduce((sum, row) => sum + row.quantity, 0)
      if (currentCargo + quantity > ship.cargo_capacity) {
        req.log.warn({ field: 'quantity', reason: `Not enough cargo space. Current: ${currentCargo}/${ship.cargo_capacity}, trying to add: ${quantity}` }, 'Validation failed')
        return res.status(400).json({
          error: `Not enough cargo space. Current: ${currentCargo}/${ship.cargo_capacity}, trying to add: ${quantity}`,
        })
      }

      // --- Execute transfer: player → ship ---

      // Subtract from player inventory
      const newPlayerQty = playerItem.quantity - quantity
      if (newPlayerQty === 0) {
        // Remove the row entirely
        const { error: deleteError } = await supabase
          .from('player_inventories')
          .delete()
          .eq('id', playerItem.id)

        if (deleteError) {
          req.log.error({ operation: 'transferInventory', code: deleteError.code || 'UNKNOWN' }, 'Failed to update personal inventory')
          return res.status(500).json({ error: 'Failed to update personal inventory' })
        }
      } else {
        const { error: updateError } = await supabase
          .from('player_inventories')
          .update({ quantity: newPlayerQty })
          .eq('id', playerItem.id)

        if (updateError) {
          req.log.error({ operation: 'transferInventory', code: updateError.code || 'UNKNOWN' }, 'Failed to update personal inventory')
          return res.status(500).json({ error: 'Failed to update personal inventory' })
        }
      }

      // Add to ship inventory
      const { data: existingShipItem } = await supabase
        .from('ship_inventories')
        .select('id, quantity')
        .eq('ship_id', ship_id)
        .eq('item_name', item_name)
        .single()

      if (existingShipItem) {
        const { error: updateError } = await supabase
          .from('ship_inventories')
          .update({ quantity: existingShipItem.quantity + quantity })
          .eq('id', existingShipItem.id)

        if (updateError) {
          req.log.error({ operation: 'transferInventory', code: updateError.code || 'UNKNOWN' }, 'Failed to update ship inventory')
          return res.status(500).json({ error: 'Failed to update ship inventory' })
        }
      } else {
        const { error: insertError } = await supabase
          .from('ship_inventories')
          .insert({ ship_id, item_name, quantity })

        if (insertError) {
          req.log.error({ operation: 'transferInventory', code: insertError.code || 'UNKNOWN' }, 'Failed to update ship inventory')
          return res.status(500).json({ error: 'Failed to update ship inventory' })
        }
      }

      req.log.info({ operation: 'transferInventory', result: { direction, item_name, quantity } }, 'Transfer completed')
      return res.status(200).json({ message: 'Transfer complete', direction, item_name, quantity })
    }

    if (direction === 'to_player') {
      // Source: ship_inventories
      const { data: shipItem, error: siError } = await supabase
        .from('ship_inventories')
        .select('id, quantity')
        .eq('ship_id', ship_id)
        .eq('item_name', item_name)
        .single()

      if (siError || !shipItem || shipItem.quantity < quantity) {
        req.log.warn({ field: 'quantity', reason: `Insufficient "${item_name}" in ship cargo` }, 'Validation failed')
        return res.status(400).json({
          error: `Insufficient "${item_name}" in ship cargo`,
        })
      }

      // --- Execute transfer: ship → player ---

      // Subtract from ship inventory
      const newShipQty = shipItem.quantity - quantity
      if (newShipQty === 0) {
        const { error: deleteError } = await supabase
          .from('ship_inventories')
          .delete()
          .eq('id', shipItem.id)

        if (deleteError) {
          req.log.error({ operation: 'transferInventory', code: deleteError.code || 'UNKNOWN' }, 'Failed to update ship inventory')
          return res.status(500).json({ error: 'Failed to update ship inventory' })
        }
      } else {
        const { error: updateError } = await supabase
          .from('ship_inventories')
          .update({ quantity: newShipQty })
          .eq('id', shipItem.id)

        if (updateError) {
          req.log.error({ operation: 'transferInventory', code: updateError.code || 'UNKNOWN' }, 'Failed to update ship inventory')
          return res.status(500).json({ error: 'Failed to update ship inventory' })
        }
      }

      // Add to player inventory (upsert)
      const { data: existingPlayerItem } = await supabase
        .from('player_inventories')
        .select('id, quantity')
        .eq('player_id', req.userId)
        .eq('item_name', item_name)
        .single()

      if (existingPlayerItem) {
        const { error: updateError } = await supabase
          .from('player_inventories')
          .update({ quantity: existingPlayerItem.quantity + quantity })
          .eq('id', existingPlayerItem.id)

        if (updateError) {
          req.log.error({ operation: 'transferInventory', code: updateError.code || 'UNKNOWN' }, 'Failed to update personal inventory')
          return res.status(500).json({ error: 'Failed to update personal inventory' })
        }
      } else {
        const { error: insertError } = await supabase
          .from('player_inventories')
          .insert({ player_id: req.userId, item_name, quantity })

        if (insertError) {
          req.log.error({ operation: 'transferInventory', code: insertError.code || 'UNKNOWN' }, 'Failed to update personal inventory')
          return res.status(500).json({ error: 'Failed to update personal inventory' })
        }
      }

      req.log.info({ operation: 'transferInventory', result: { direction, item_name, quantity } }, 'Transfer completed')
      return res.status(200).json({ message: 'Transfer complete', direction, item_name, quantity })
    }

    if (direction === 'ship_to_ship') {
      const { destination_ship_id } = req.body

      // Verify source ship (already validated above as `ship`)
      // ship_id is the source, destination_ship_id is the target

      // Verify destination ship belongs to player and is docked
      const { data: destShip, error: destShipError } = await supabase
        .from('ships')
        .select('id, player_id, status, cargo_capacity')
        .eq('id', destination_ship_id)
        .single()

      if (destShipError || !destShip) {
        req.log.warn({ field: 'destination_ship_id', reason: 'Destination ship not found' }, 'Validation failed')
        return res.status(404).json({ error: 'Destination ship not found' })
      }

      if (destShip.player_id !== req.userId) {
        req.log.warn({ field: 'destination_ship_id', reason: 'Destination ship does not belong to player' }, 'Validation failed')
        return res.status(403).json({ error: 'Destination ship does not belong to you' })
      }

      if (destShip.status !== SHIP_STATUS.READY) {
        req.log.warn({ field: 'destination_ship_id', reason: 'Destination ship must be docked (READY status)' }, 'Validation failed')
        return res.status(400).json({ error: 'Destination ship must be docked (READY status) to receive cargo' })
      }

      // Verify source ship has enough of the item
      const { data: srcItem, error: srcItemError } = await supabase
        .from('ship_inventories')
        .select('id, quantity')
        .eq('ship_id', ship_id)
        .eq('item_name', item_name)
        .single()

      if (srcItemError || !srcItem || srcItem.quantity < quantity) {
        req.log.warn({ field: 'quantity', reason: `Insufficient "${item_name}" in source ship cargo` }, 'Validation failed')
        return res.status(400).json({ error: `Insufficient "${item_name}" in source ship cargo` })
      }

      // Check destination ship cargo capacity
      const { data: destCargo, error: destCargoError } = await supabase
        .from('ship_inventories')
        .select('quantity')
        .eq('ship_id', destination_ship_id)

      if (destCargoError) {
        req.log.error({ operation: 'transferInventory', code: destCargoError.code || 'UNKNOWN' }, 'Failed to check destination ship cargo')
        return res.status(500).json({ error: 'Failed to check destination ship cargo' })
      }

      const destCurrentCargo = (destCargo || []).reduce((sum, row) => sum + row.quantity, 0)
      if (destCurrentCargo + quantity > destShip.cargo_capacity) {
        req.log.warn({ field: 'quantity', reason: `Not enough cargo space on destination ship. Current: ${destCurrentCargo}/${destShip.cargo_capacity}, trying to add: ${quantity}` }, 'Validation failed')
        return res.status(400).json({
          error: `Not enough cargo space on destination ship. Current: ${destCurrentCargo}/${destShip.cargo_capacity}, trying to add: ${quantity}`,
        })
      }

      // --- Execute transfer: source ship → destination ship ---

      // Subtract from source ship
      const newSrcQty = srcItem.quantity - quantity
      if (newSrcQty === 0) {
        const { error: deleteError } = await supabase
          .from('ship_inventories')
          .delete()
          .eq('id', srcItem.id)

        if (deleteError) {
          req.log.error({ operation: 'transferInventory', code: deleteError.code || 'UNKNOWN' }, 'Failed to update source ship inventory')
          return res.status(500).json({ error: 'Failed to update source ship inventory' })
        }
      } else {
        const { error: updateError } = await supabase
          .from('ship_inventories')
          .update({ quantity: newSrcQty })
          .eq('id', srcItem.id)

        if (updateError) {
          req.log.error({ operation: 'transferInventory', code: updateError.code || 'UNKNOWN' }, 'Failed to update source ship inventory')
          return res.status(500).json({ error: 'Failed to update source ship inventory' })
        }
      }

      // Add to destination ship
      const { data: existingDestItem } = await supabase
        .from('ship_inventories')
        .select('id, quantity')
        .eq('ship_id', destination_ship_id)
        .eq('item_name', item_name)
        .single()

      if (existingDestItem) {
        const { error: updateError } = await supabase
          .from('ship_inventories')
          .update({ quantity: existingDestItem.quantity + quantity })
          .eq('id', existingDestItem.id)

        if (updateError) {
          req.log.error({ operation: 'transferInventory', code: updateError.code || 'UNKNOWN' }, 'Failed to update destination ship inventory')
          return res.status(500).json({ error: 'Failed to update destination ship inventory' })
        }
      } else {
        const { error: insertError } = await supabase
          .from('ship_inventories')
          .insert({ ship_id: destination_ship_id, item_name, quantity })

        if (insertError) {
          req.log.error({ operation: 'transferInventory', code: insertError.code || 'UNKNOWN' }, 'Failed to update destination ship inventory')
          return res.status(500).json({ error: 'Failed to update destination ship inventory' })
        }
      }

      req.log.info({ operation: 'transferInventory', result: { direction, item_name, quantity, destination_ship_id } }, 'Transfer completed')
      return res.status(200).json({ message: 'Transfer complete', direction, item_name, quantity })
    }
  } catch (err) {
    req.log.error({ operation: 'transferInventory', err }, 'Unhandled error in transfer inventory')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
