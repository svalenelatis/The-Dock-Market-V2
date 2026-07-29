const { Router } = require('express')
const adminAuth = require('../../middleware/admin')
const supabase = require('../../lib/supabase')
const { filterPlayersByEmail } = require('../../utils/admin-helpers')
const { validatePlayerUpdate } = require('../../utils/admin-validators')
const { buildAuditRecord } = require('../../utils/audit')

const router = Router()

// All admin player routes require authentication + admin role
router.use(adminAuth)

// GET /search — Search players by email (partial match, max 10 results)
router.get('/search', async (req, res) => {
  try {
    const { q, includeArchived } = req.query
    req.log.info({ module: 'admin', operation: 'searchPlayers', query: q }, 'Searching players')

    // Validate query length (minimum 2 characters)
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' })
    }

    // Parse includeArchived flag (defaults to false)
    const showArchived = includeArchived === 'true'

    // Fetch all players (email + archived status) and filter in-memory
    const { data: players, error } = await supabase
      .from('players')
      .select('id, email, gold, home_port_id, archived, created_at')

    if (error) {
      req.log.error({ module: 'admin', operation: 'searchPlayers', code: error.code || 'UNKNOWN' }, 'Database error searching players')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Use the pure helper function for filtering
    const results = filterPlayersByEmail(players || [], q, showArchived)

    req.log.info({ module: 'admin', operation: 'searchPlayers', result: { count: results.length } }, 'Player search completed')
    return res.status(200).json(results)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'searchPlayers', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /:id — Get full player details (ships, factories, inventories, home port)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    req.log.info({ module: 'admin', operation: 'getPlayerDetail', playerId: id }, 'Fetching player details')

    // Fetch player base data
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, email, gold, home_port_id, archived, created_at')
      .eq('id', id)
      .single()

    if (playerError) {
      if (playerError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Player not found' })
      }
      req.log.error({ module: 'admin', operation: 'getPlayerDetail', code: playerError.code || 'UNKNOWN' }, 'Database error fetching player')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!player) {
      return res.status(404).json({ error: 'Player not found' })
    }

    // Fetch related data in parallel
    const [shipsResult, factoriesResult, inventoryResult, homePortResult] = await Promise.all([
      supabase
        .from('ships')
        .select('id, name, speed, cargo_capacity, status')
        .eq('player_id', id),
      supabase
        .from('factories')
        .select('id, factory_type, input_requirements, output_production, active')
        .eq('player_id', id),
      supabase
        .from('player_inventories')
        .select('item_name, quantity')
        .eq('player_id', id),
      player.home_port_id
        ? supabase
            .from('cities')
            .select('id, name')
            .eq('id', player.home_port_id)
            .single()
        : Promise.resolve({ data: null, error: null })
    ])

    if (shipsResult.error) {
      req.log.error({ module: 'admin', operation: 'getPlayerDetail', code: shipsResult.error.code || 'UNKNOWN' }, 'Database error fetching ships')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (factoriesResult.error) {
      req.log.error({ module: 'admin', operation: 'getPlayerDetail', code: factoriesResult.error.code || 'UNKNOWN' }, 'Database error fetching factories')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (inventoryResult.error) {
      req.log.error({ module: 'admin', operation: 'getPlayerDetail', code: inventoryResult.error.code || 'UNKNOWN' }, 'Database error fetching inventory')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Build full response
    const response = {
      ...player,
      home_port: homePortResult.data || null,
      ships: shipsResult.data || [],
      factories: factoriesResult.data || [],
      inventory: inventoryResult.data || []
    }

    req.log.info({
      module: 'admin',
      operation: 'getPlayerDetail',
      result: {
        playerId: id,
        ships: response.ships.length,
        factories: response.factories.length,
        inventory: response.inventory.length
      }
    }, 'Player details fetched successfully')

    return res.status(200).json(response)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'getPlayerDetail', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /:id — Update player gold and/or home_port_id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    req.log.info({ module: 'admin', operation: 'updatePlayer', playerId: id }, 'Updating player')

    const { isValid, errors } = validatePlayerUpdate(req.body)
    if (!isValid) {
      req.log.warn({ module: 'admin', operation: 'updatePlayer', field: 'body', reason: errors.join(', ') }, 'Validation failed')
      return res.status(400).json({ errors })
    }

    // Build update object with only provided fields
    const updateFields = {}
    if (req.body.gold !== undefined) {
      updateFields.gold = req.body.gold
    }
    if (req.body.home_port_id !== undefined) {
      updateFields.home_port_id = req.body.home_port_id
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const { data, error } = await supabase
      .from('players')
      .update(updateFields)
      .eq('id', id)
      .select()

    if (error) {
      req.log.error({ module: 'admin', operation: 'updatePlayer', code: error.code || 'UNKNOWN' }, 'Database error updating player')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Player not found' })
    }

    // Write audit log — return 500 if audit write fails
    const auditRecord = buildAuditRecord(req.userId, 'UPDATE', 'player', id, updateFields)
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'updatePlayer', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'updatePlayer', result: { playerId: id, fields: Object.keys(updateFields) } }, 'Player updated successfully')
    return res.status(200).json(data[0])
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'updatePlayer', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /:id/archive — Soft-delete player by setting archived flag to true
router.post('/:id/archive', async (req, res) => {
  try {
    const { id } = req.params
    req.log.info({ module: 'admin', operation: 'archivePlayer', playerId: id }, 'Archiving player')

    const { data, error } = await supabase
      .from('players')
      .update({ archived: true })
      .eq('id', id)
      .select()

    if (error) {
      req.log.error({ module: 'admin', operation: 'archivePlayer', code: error.code || 'UNKNOWN' }, 'Database error archiving player')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Player not found' })
    }

    // Write audit log — return 500 if audit write fails
    const auditRecord = buildAuditRecord(req.userId, 'UPDATE', 'player', id, { archived: true })
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'archivePlayer', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'archivePlayer', result: { playerId: id } }, 'Player archived successfully')
    return res.status(200).json(data[0])
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'archivePlayer', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /:id/unarchive — Restore archived player by setting archived flag to false
router.post('/:id/unarchive', async (req, res) => {
  try {
    const { id } = req.params
    req.log.info({ module: 'admin', operation: 'unarchivePlayer', playerId: id }, 'Unarchiving player')

    const { data, error } = await supabase
      .from('players')
      .update({ archived: false })
      .eq('id', id)
      .select()

    if (error) {
      req.log.error({ module: 'admin', operation: 'unarchivePlayer', code: error.code || 'UNKNOWN' }, 'Database error unarchiving player')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Player not found' })
    }

    // Write audit log — return 500 if audit write fails
    const auditRecord = buildAuditRecord(req.userId, 'UPDATE', 'player', id, { archived: false })
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'unarchivePlayer', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'unarchivePlayer', result: { playerId: id } }, 'Player unarchived successfully')
    return res.status(200).json(data[0])
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'unarchivePlayer', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /:id — Permanently delete player and all associated data (cascading)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    req.log.info({ module: 'admin', operation: 'deletePlayer', playerId: id }, 'Permanently deleting player')

    // Verify player exists first
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, email')
      .eq('id', id)
      .single()

    if (playerError) {
      if (playerError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Player not found' })
      }
      req.log.error({ module: 'admin', operation: 'deletePlayer', code: playerError.code || 'UNKNOWN' }, 'Database error checking player')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!player) {
      return res.status(404).json({ error: 'Player not found' })
    }

    // Cascading delete order:
    // 1. Delete ship_inventories for all player's ships
    const { data: ships } = await supabase
      .from('ships')
      .select('id')
      .eq('player_id', id)

    if (ships && ships.length > 0) {
      const shipIds = ships.map(s => s.id)
      const { error: shipInvError } = await supabase
        .from('ship_inventories')
        .delete()
        .in('ship_id', shipIds)

      if (shipInvError) {
        req.log.error({ module: 'admin', operation: 'deletePlayer', step: 'ship_inventories', code: shipInvError.code || 'UNKNOWN' }, 'Error deleting ship inventories')
        return res.status(500).json({ error: 'Internal server error' })
      }
    }

    // 2. Delete ships
    const { error: shipsError } = await supabase
      .from('ships')
      .delete()
      .eq('player_id', id)

    if (shipsError) {
      req.log.error({ module: 'admin', operation: 'deletePlayer', step: 'ships', code: shipsError.code || 'UNKNOWN' }, 'Error deleting ships')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // 3. Delete player_inventories
    const { error: invError } = await supabase
      .from('player_inventories')
      .delete()
      .eq('player_id', id)

    if (invError) {
      req.log.error({ module: 'admin', operation: 'deletePlayer', step: 'player_inventories', code: invError.code || 'UNKNOWN' }, 'Error deleting player inventories')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // 4. Delete factories
    const { error: factoriesError } = await supabase
      .from('factories')
      .delete()
      .eq('player_id', id)

    if (factoriesError) {
      req.log.error({ module: 'admin', operation: 'deletePlayer', step: 'factories', code: factoriesError.code || 'UNKNOWN' }, 'Error deleting factories')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // 5. Delete transactions
    const { error: transactionsError } = await supabase
      .from('transactions')
      .delete()
      .eq('player_id', id)

    if (transactionsError) {
      req.log.error({ module: 'admin', operation: 'deletePlayer', step: 'transactions', code: transactionsError.code || 'UNKNOWN' }, 'Error deleting transactions')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // 6. Delete the player
    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .eq('id', id)

    if (deleteError) {
      req.log.error({ module: 'admin', operation: 'deletePlayer', step: 'player', code: deleteError.code || 'UNKNOWN' }, 'Error deleting player')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Write audit log — return 500 if audit write fails
    const auditRecord = buildAuditRecord(req.userId, 'DELETE', 'player', id, { email: player.email })
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'deletePlayer', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'deletePlayer', result: { playerId: id, email: player.email } }, 'Player permanently deleted')
    return res.status(200).json({ message: 'Player permanently deleted', id })
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'deletePlayer', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
