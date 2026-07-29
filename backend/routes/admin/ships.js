const { Router } = require('express')
const adminAuth = require('../../middleware/admin')
const supabase = require('../../lib/supabase')
const { validateShip, sanitizeString } = require('../../utils/admin-validators')
const { buildAuditRecord } = require('../../utils/audit')

const router = Router()

// All admin ship routes require authentication + admin role
router.use(adminAuth)

// POST / — Create a new ship for a player
router.post('/', async (req, res) => {
  try {
    const { player_id, name, speed, cargo_capacity } = req.body
    req.log.info({ module: 'admin', operation: 'createShip', playerId: player_id }, 'Creating new ship')

    // Validate ship fields
    const { isValid, errors } = validateShip({ name, speed, cargo_capacity })
    if (!isValid) {
      req.log.warn({ module: 'admin', operation: 'createShip', field: 'body', reason: errors.join(', ') }, 'Validation failed')
      return res.status(400).json({ errors })
    }

    // Validate player_id is provided
    if (!player_id) {
      return res.status(400).json({ error: 'player_id is required' })
    }

    // Verify the player exists
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id')
      .eq('id', player_id)
      .single()

    if (playerError || !player) {
      if (playerError && playerError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Player not found' })
      }
      if (playerError) {
        req.log.error({ module: 'admin', operation: 'createShip', code: playerError.code || 'UNKNOWN' }, 'Database error verifying player')
        return res.status(500).json({ error: 'Internal server error' })
      }
      return res.status(404).json({ error: 'Player not found' })
    }

    // Sanitize and map fields
    const shipData = {
      player_id,
      name: sanitizeString(name),
      speed,
      cargo_capacity,
      status: 'READY',
    }

    const { data, error } = await supabase
      .from('ships')
      .insert(shipData)
      .select()
      .single()

    if (error) {
      req.log.error({ module: 'admin', operation: 'createShip', code: error.code || 'UNKNOWN' }, 'Database error creating ship')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Write audit log — return 500 if it fails (Requirement 14.5)
    const auditRecord = buildAuditRecord(req.userId, 'CREATE', 'ship', data.id, shipData)
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'createShip', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'createShip', result: { shipId: data.id, name: shipData.name } }, 'Ship created successfully')
    return res.status(201).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'createShip', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /:id — Edit ship properties
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, speed, cargo_capacity, status } = req.body
    req.log.info({ module: 'admin', operation: 'updateShip', shipId: id }, 'Updating ship')

    // Validate ship fields
    const { isValid, errors } = validateShip({ name, speed, cargo_capacity })
    if (!isValid) {
      req.log.warn({ module: 'admin', operation: 'updateShip', field: 'body', reason: errors.join(', ') }, 'Validation failed')
      return res.status(400).json({ errors })
    }

    // Validate status if provided
    const validStatuses = ['READY', 'TRAVELING']
    if (status !== undefined && !validStatuses.includes(status)) {
      return res.status(400).json({ errors: ['Status must be one of: READY, TRAVELING'] })
    }

    // Build update payload
    const updateData = {
      name: sanitizeString(name),
      speed,
      cargo_capacity,
    }

    if (status !== undefined) {
      updateData.status = status
    }

    const { data, error } = await supabase
      .from('ships')
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) {
      req.log.error({ module: 'admin', operation: 'updateShip', code: error.code || 'UNKNOWN' }, 'Database error updating ship')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Ship not found' })
    }

    // Write audit log — return 500 if it fails (Requirement 14.5)
    const auditRecord = buildAuditRecord(req.userId, 'UPDATE', 'ship', id, updateData)
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'updateShip', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'updateShip', result: { shipId: id, name: updateData.name } }, 'Ship updated successfully')
    return res.status(200).json(data[0])
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'updateShip', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /:id — Delete ship and its inventory (check for pending transactions first)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    req.log.info({ module: 'admin', operation: 'deleteShip', shipId: id }, 'Deleting ship')

    // Verify the ship exists
    const { data: ship, error: shipError } = await supabase
      .from('ships')
      .select('id, name, player_id')
      .eq('id', id)
      .single()

    if (shipError || !ship) {
      if (shipError && shipError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Ship not found' })
      }
      if (shipError) {
        req.log.error({ module: 'admin', operation: 'deleteShip', code: shipError.code || 'UNKNOWN' }, 'Database error fetching ship')
        return res.status(500).json({ error: 'Internal server error' })
      }
      return res.status(404).json({ error: 'Ship not found' })
    }

    // Check for pending transactions (status !== 'completed' and status !== 'cancelled')
    const { data: pendingTransactions, error: txError } = await supabase
      .from('transactions')
      .select('id, status')
      .eq('ship_id', id)
      .not('status', 'in', '("completed","cancelled")')

    if (txError) {
      req.log.error({ module: 'admin', operation: 'deleteShip', code: txError.code || 'UNKNOWN' }, 'Database error checking transactions')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (pendingTransactions && pendingTransactions.length > 0) {
      req.log.warn({ module: 'admin', operation: 'deleteShip', shipId: id, pendingCount: pendingTransactions.length }, 'Ship has pending transactions')
      return res.status(400).json({ error: 'Ship cannot be deleted while it has pending or active transactions' })
    }

    // Delete ship inventories first
    const { error: invError } = await supabase
      .from('ship_inventories')
      .delete()
      .eq('ship_id', id)

    if (invError) {
      req.log.error({ module: 'admin', operation: 'deleteShip', code: invError.code || 'UNKNOWN' }, 'Database error deleting ship inventories')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Delete the ship
    const { error: deleteError } = await supabase
      .from('ships')
      .delete()
      .eq('id', id)

    if (deleteError) {
      req.log.error({ module: 'admin', operation: 'deleteShip', code: deleteError.code || 'UNKNOWN' }, 'Database error deleting ship')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Write audit log — return 500 if it fails (Requirement 14.5)
    const auditRecord = buildAuditRecord(req.userId, 'DELETE', 'ship', id, { name: ship.name, player_id: ship.player_id })
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'deleteShip', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'deleteShip', result: { shipId: id, name: ship.name } }, 'Ship deleted successfully')
    return res.status(200).json({ message: 'Ship deleted successfully' })
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'deleteShip', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
