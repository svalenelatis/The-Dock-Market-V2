const { Router } = require('express')
const adminAuth = require('../../middleware/admin')
const supabase = require('../../lib/supabase')
const { validateFactory, sanitizeString } = require('../../utils/admin-validators')
const { buildAuditRecord } = require('../../utils/audit')

const router = Router()

// All admin factory routes require authentication + admin role
router.use(adminAuth)

// POST / — Create a new factory for a player
router.post('/', async (req, res) => {
  try {
    const { player_id, type, input_requirements, output_production } = req.body
    req.log.info({ module: 'admin', operation: 'createFactory', playerId: player_id }, 'Creating new factory')

    // Validate player_id is provided
    if (!player_id) {
      return res.status(400).json({ error: 'player_id is required' })
    }

    // Validate factory fields
    const { isValid, errors } = validateFactory({ type, input_requirements, output_production })
    if (!isValid) {
      req.log.warn({ module: 'admin', operation: 'createFactory', field: 'body', reason: errors.join(', ') }, 'Validation failed')
      return res.status(400).json({ errors })
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
        req.log.error({ module: 'admin', operation: 'createFactory', code: playerError.code || 'UNKNOWN' }, 'Database error verifying player')
        return res.status(500).json({ error: 'Internal server error' })
      }
      return res.status(404).json({ error: 'Player not found' })
    }

    // Build factory data with sanitized type, defaults to active
    const factoryData = {
      player_id,
      factory_type: sanitizeString(type),
      input_requirements,
      output_production,
      active: true,
    }

    const { data, error } = await supabase
      .from('factories')
      .insert(factoryData)
      .select()
      .single()

    if (error) {
      req.log.error({ module: 'admin', operation: 'createFactory', code: error.code || 'UNKNOWN' }, 'Database error creating factory')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Write audit log — return 500 if it fails (Requirement 14.5)
    const auditRecord = buildAuditRecord(req.userId, 'CREATE', 'factory', data.id, factoryData)
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'createFactory', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'createFactory', result: { factoryId: data.id, type: factoryData.type } }, 'Factory created successfully')
    return res.status(201).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'createFactory', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /:id — Edit factory properties
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { type, input_requirements, output_production, active } = req.body
    req.log.info({ module: 'admin', operation: 'updateFactory', factoryId: id }, 'Updating factory')

    // Validate factory fields
    const { isValid, errors } = validateFactory({ type, input_requirements, output_production })
    if (!isValid) {
      req.log.warn({ module: 'admin', operation: 'updateFactory', field: 'body', reason: errors.join(', ') }, 'Validation failed')
      return res.status(400).json({ errors })
    }

    // Validate active if provided
    if (active !== undefined && typeof active !== 'boolean') {
      return res.status(400).json({ errors: ['active must be a boolean'] })
    }

    // Build update payload
    const updateData = {
      factory_type: sanitizeString(type),
      input_requirements,
      output_production,
    }

    if (active !== undefined) {
      updateData.active = active
    }

    const { data, error } = await supabase
      .from('factories')
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) {
      req.log.error({ module: 'admin', operation: 'updateFactory', code: error.code || 'UNKNOWN' }, 'Database error updating factory')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Factory not found' })
    }

    // Write audit log — return 500 if it fails (Requirement 14.5)
    const auditRecord = buildAuditRecord(req.userId, 'UPDATE', 'factory', id, updateData)
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'updateFactory', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'updateFactory', result: { factoryId: id, type: updateData.type } }, 'Factory updated successfully')
    return res.status(200).json(data[0])
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'updateFactory', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /:id — Delete factory
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    req.log.info({ module: 'admin', operation: 'deleteFactory', factoryId: id }, 'Deleting factory')

    // Verify the factory exists
    const { data: factory, error: factoryError } = await supabase
      .from('factories')
      .select('id, factory_type, player_id')
      .eq('id', id)
      .single()

    if (factoryError || !factory) {
      if (factoryError && factoryError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Factory not found' })
      }
      if (factoryError) {
        req.log.error({ module: 'admin', operation: 'deleteFactory', code: factoryError.code || 'UNKNOWN' }, 'Database error fetching factory')
        return res.status(500).json({ error: 'Internal server error' })
      }
      return res.status(404).json({ error: 'Factory not found' })
    }

    // Delete the factory
    const { error: deleteError } = await supabase
      .from('factories')
      .delete()
      .eq('id', id)

    if (deleteError) {
      req.log.error({ module: 'admin', operation: 'deleteFactory', code: deleteError.code || 'UNKNOWN' }, 'Database error deleting factory')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Write audit log — return 500 if it fails (Requirement 14.5)
    const auditRecord = buildAuditRecord(req.userId, 'DELETE', 'factory', id, { factory_type: factory.factory_type, player_id: factory.player_id })
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'deleteFactory', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'deleteFactory', result: { factoryId: id, type: factory.type } }, 'Factory deleted successfully')
    return res.status(200).json({ message: 'Factory deleted successfully' })
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'deleteFactory', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
