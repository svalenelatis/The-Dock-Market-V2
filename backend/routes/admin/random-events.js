const { Router } = require('express')
const adminAuth = require('../../middleware/admin')
const supabase = require('../../lib/supabase')
const { buildAuditRecord } = require('../../utils/audit')

const router = Router()

// All admin event routes require authentication + admin role
router.use(adminAuth)

// GET / — List all temporary (event) tag assignments with city and tag info
router.get('/', async (req, res) => {
  try {
    req.log.info({ module: 'admin', operation: 'listRandomEvents' }, 'Listing random events')

    const { data, error } = await supabase
      .from('city_tag_assignments')
      .select('id, city_id, tag_id, is_permanent, expires_at, active, assigned_at, cities(name), city_tags(name, description)')
      .eq('is_permanent', false)
      .order('assigned_at', { ascending: false })

    if (error) {
      req.log.error({ module: 'admin', operation: 'listRandomEvents', code: error.code || 'UNKNOWN' }, 'Database error fetching random events')
      return res.status(500).json({ error: 'Internal server error' })
    }

    req.log.info({ module: 'admin', operation: 'listRandomEvents', result: { count: data.length } }, 'Random events listed successfully')
    return res.status(200).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'listRandomEvents', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST / — Manually assign a temporary event tag to a city
router.post('/', async (req, res) => {
  try {
    req.log.info({ module: 'admin', operation: 'createRandomEvent' }, 'Creating random event')

    const { city_id, tag_id, expires_at } = req.body

    if (!city_id || typeof city_id !== 'string') {
      req.log.warn({ module: 'admin', operation: 'createRandomEvent', field: 'city_id', reason: 'city_id is required' }, 'Validation failed')
      return res.status(400).json({ error: 'city_id is required' })
    }
    if (!tag_id || typeof tag_id !== 'string') {
      req.log.warn({ module: 'admin', operation: 'createRandomEvent', field: 'tag_id', reason: 'tag_id is required' }, 'Validation failed')
      return res.status(400).json({ error: 'tag_id is required' })
    }
    if (!expires_at || isNaN(new Date(expires_at).getTime())) {
      req.log.warn({ module: 'admin', operation: 'createRandomEvent', field: 'expires_at', reason: 'expires_at must be a valid date' }, 'Validation failed')
      return res.status(400).json({ error: 'expires_at must be a valid date' })
    }

    const { data, error } = await supabase
      .from('city_tag_assignments')
      .insert({
        city_id,
        tag_id,
        is_permanent: false,
        expires_at,
        active: true,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        req.log.warn({ module: 'admin', operation: 'createRandomEvent', field: 'city_id+tag_id', reason: 'Duplicate assignment' }, 'Conflict detected')
        return res.status(409).json({ error: 'This tag is already assigned to this city' })
      }
      req.log.error({ module: 'admin', operation: 'createRandomEvent', code: error.code || 'UNKNOWN' }, 'Database error creating random event')
      return res.status(500).json({ error: 'Internal server error' })
    }

    const auditRecord = buildAuditRecord(req.userId, 'CREATE', 'city_tag_assignment', data.id, {
      city_id, tag_id, expires_at,
    })
    await supabase.from('admin_audit_log').insert(auditRecord)

    req.log.info({ module: 'admin', operation: 'createRandomEvent', result: { assignmentId: data.id, city_id, tag_id } }, 'Random event created successfully')
    return res.status(201).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'createRandomEvent', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /:id — Update an existing event assignment (e.g., extend expiration)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { expires_at, active } = req.body
    req.log.info({ module: 'admin', operation: 'updateRandomEvent', assignmentId: id }, 'Updating random event')

    const updatePayload = {}
    if (expires_at !== undefined) {
      if (isNaN(new Date(expires_at).getTime())) {
        req.log.warn({ module: 'admin', operation: 'updateRandomEvent', field: 'expires_at', reason: 'expires_at must be a valid date' }, 'Validation failed')
        return res.status(400).json({ error: 'expires_at must be a valid date' })
      }
      updatePayload.expires_at = expires_at
    }
    if (active !== undefined) {
      updatePayload.active = active
    }

    if (Object.keys(updatePayload).length === 0) {
      req.log.warn({ module: 'admin', operation: 'updateRandomEvent', field: 'body', reason: 'No valid fields to update' }, 'Validation failed')
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const { data, error } = await supabase
      .from('city_tag_assignments')
      .update(updatePayload)
      .eq('id', id)
      .eq('is_permanent', false)
      .select()

    if (error) {
      req.log.error({ module: 'admin', operation: 'updateRandomEvent', code: error.code || 'UNKNOWN' }, 'Database error updating random event')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Event assignment not found' })
    }

    const auditRecord = buildAuditRecord(req.userId, 'UPDATE', 'city_tag_assignment', id, updatePayload)
    await supabase.from('admin_audit_log').insert(auditRecord)

    req.log.info({ module: 'admin', operation: 'updateRandomEvent', result: { assignmentId: id } }, 'Random event updated successfully')
    return res.status(200).json(data[0])
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'updateRandomEvent', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /:id — Remove a temporary event assignment
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    req.log.info({ module: 'admin', operation: 'deleteRandomEvent', assignmentId: id }, 'Deleting random event')

    const { data, error } = await supabase
      .from('city_tag_assignments')
      .delete()
      .eq('id', id)
      .eq('is_permanent', false)
      .select()

    if (error) {
      req.log.error({ module: 'admin', operation: 'deleteRandomEvent', code: error.code || 'UNKNOWN' }, 'Database error deleting random event')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Event assignment not found' })
    }

    const auditRecord = buildAuditRecord(req.userId, 'DELETE', 'city_tag_assignment', id, { id })
    await supabase.from('admin_audit_log').insert(auditRecord)

    req.log.info({ module: 'admin', operation: 'deleteRandomEvent', result: { assignmentId: id } }, 'Random event deleted successfully')
    return res.status(200).json(data[0])
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'deleteRandomEvent', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
