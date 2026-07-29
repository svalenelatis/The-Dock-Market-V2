const { Router } = require('express')
const adminAuth = require('../../middleware/admin')
const supabase = require('../../lib/supabase')
const { validateCityTag, sanitizeString } = require('../../utils/admin-validators')
const { buildAuditRecord } = require('../../utils/audit')

const router = Router()

// All city-tag routes require admin authentication
router.use(adminAuth)

// --- GET /api/admin/city-tags ---
// Requirement 13.1: Returns all city tags ordered by name
router.get('/', async (req, res) => {
  try {
    req.log.info({ module: 'admin', operation: 'listCityTags' }, 'Listing city tags')

    const { data, error } = await supabase
      .from('city_tags')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      req.log.error({ module: 'admin', operation: 'listCityTags', code: error.code || 'UNKNOWN' }, 'Database error fetching city tags')
      return res.status(500).json({ error: 'Internal server error' })
    }

    req.log.info({ module: 'admin', operation: 'listCityTags', result: { count: data.length } }, 'City tags listed successfully')
    return res.status(200).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'listCityTags', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// --- POST /api/admin/city-tags ---
// Requirement 13.2: Validates, sanitizes, inserts, and logs audit trail
router.post('/', async (req, res) => {
  try {
    req.log.info({ module: 'admin', operation: 'createCityTag' }, 'Creating city tag')

    const body = req.body

    // Requirement 13.2 & 13.5: Validate payload
    const { isValid, errors } = validateCityTag(body)
    if (!isValid) {
      req.log.warn({ module: 'admin', operation: 'createCityTag', field: 'body', reason: errors.join(', ') }, 'Validation failed')
      return res.status(400).json({ errors })
    }

    // Requirement 13.2: Sanitize name and description
    const sanitizedData = {
      ...body,
      name: sanitizeString(body.name),
      description: sanitizeString(body.description),
    }

    // Insert into city_tags table
    const { data, error } = await supabase
      .from('city_tags')
      .insert(sanitizedData)
      .select()
      .single()

    if (error) {
      req.log.error({ module: 'admin', operation: 'createCityTag', code: error.code || 'UNKNOWN' }, 'Database error creating city tag')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Requirement 13.6: Audit logging
    const auditRecord = buildAuditRecord(req.userId, 'CREATE', 'city_tag', data.id, sanitizedData)
    await supabase.from('admin_audit_log').insert(auditRecord)

    req.log.info({ module: 'admin', operation: 'createCityTag', result: { tagId: data.id, name: sanitizedData.name } }, 'City tag created successfully')
    return res.status(201).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'createCityTag', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// --- PUT /api/admin/city-tags/:id ---
// Requirement 13.3: Validates merged result, sanitizes, updates, logs audit trail
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const body = req.body
    req.log.info({ module: 'admin', operation: 'updateCityTag', tagId: id }, 'Updating city tag')

    // Fetch existing record to merge with updates
    const { data: existing, error: fetchError } = await supabase
      .from('city_tags')
      .select('*')
      .eq('id', id)
      .single()

    // Requirement 13.7: Non-existent ID returns 404
    if (fetchError || !existing) {
      return res.status(404).json({ error: 'City tag not found' })
    }

    // Merge existing data with update payload for validation
    const merged = { ...existing, ...body }

    // Requirement 13.3 & 13.5: Validate merged result
    const { isValid, errors } = validateCityTag(merged)
    if (!isValid) {
      req.log.warn({ module: 'admin', operation: 'updateCityTag', field: 'body', reason: errors.join(', ') }, 'Validation failed')
      return res.status(400).json({ errors })
    }

    // Requirement 13.3: Sanitize name and description
    const sanitizedData = {
      ...body,
    }
    if (body.name !== undefined) {
      sanitizedData.name = sanitizeString(body.name)
    }
    if (body.description !== undefined) {
      sanitizedData.description = sanitizeString(body.description)
    }

    // Update the record
    const { data, error } = await supabase
      .from('city_tags')
      .update(sanitizedData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      req.log.error({ module: 'admin', operation: 'updateCityTag', code: error.code || 'UNKNOWN' }, 'Database error updating city tag')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Requirement 13.6: Audit logging
    const auditRecord = buildAuditRecord(req.userId, 'UPDATE', 'city_tag', id, sanitizedData)
    await supabase.from('admin_audit_log').insert(auditRecord)

    req.log.info({ module: 'admin', operation: 'updateCityTag', result: { tagId: id } }, 'City tag updated successfully')
    return res.status(200).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'updateCityTag', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// --- DELETE /api/admin/city-tags/:id ---
// Requirement 13.4: Soft-deletes by setting active=false
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    req.log.info({ module: 'admin', operation: 'deleteCityTag', tagId: id }, 'Deleting city tag')

    // Check if the record exists
    const { data: existing, error: fetchError } = await supabase
      .from('city_tags')
      .select('id')
      .eq('id', id)
      .single()

    // Requirement 13.7: Non-existent ID returns 404
    if (fetchError || !existing) {
      return res.status(404).json({ error: 'City tag not found' })
    }

    // Requirement 13.4: Soft-delete (set active=false)
    const { error } = await supabase
      .from('city_tags')
      .update({ active: false })
      .eq('id', id)

    if (error) {
      req.log.error({ module: 'admin', operation: 'deleteCityTag', code: error.code || 'UNKNOWN' }, 'Database error deleting city tag')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Requirement 13.6: Audit logging
    const auditRecord = buildAuditRecord(req.userId, 'DELETE', 'city_tag', id, { active: false })
    await supabase.from('admin_audit_log').insert(auditRecord)

    req.log.info({ module: 'admin', operation: 'deleteCityTag', result: { tagId: id } }, 'City tag deleted successfully')
    return res.status(200).json({ message: 'City tag deleted' })
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'deleteCityTag', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ============================================================
// CITY TAG ASSIGNMENTS SUB-ROUTES
// ============================================================

// GET /assignments — List all active city tag assignments with joined city and tag info
router.get('/assignments', async (req, res) => {
  try {
    req.log.info({ module: 'admin', operation: 'listAssignments' }, 'Listing city tag assignments')

    const { data, error } = await supabase
      .from('city_tag_assignments')
      .select('id, city_id, tag_id, is_permanent, expires_at, active, assigned_at, cities(name), city_tags(name, description)')
      .eq('active', true)
      .order('assigned_at', { ascending: false })

    if (error) {
      req.log.error({ module: 'admin', operation: 'listAssignments', code: error.code || 'UNKNOWN' }, 'Database error fetching assignments')
      return res.status(500).json({ error: 'Internal server error' })
    }

    return res.status(200).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'listAssignments', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /assignments — Create a new city tag assignment
router.post('/assignments', async (req, res) => {
  try {
    const { city_id, tag_id, is_permanent, expires_at } = req.body
    req.log.info({ module: 'admin', operation: 'createAssignment', city_id, tag_id }, 'Creating city tag assignment')

    if (!city_id) {
      return res.status(400).json({ error: 'city_id is required' })
    }
    if (!tag_id) {
      return res.status(400).json({ error: 'tag_id is required' })
    }
    if (!is_permanent && !expires_at) {
      return res.status(400).json({ error: 'expires_at is required for non-permanent assignments' })
    }

    const { data, error } = await supabase
      .from('city_tag_assignments')
      .insert({
        city_id,
        tag_id,
        is_permanent: !!is_permanent,
        expires_at: is_permanent ? null : expires_at,
        active: true,
      })
      .select('id, city_id, tag_id, is_permanent, expires_at, active, assigned_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'This tag is already assigned to this city' })
      }
      req.log.error({ module: 'admin', operation: 'createAssignment', code: error.code || 'UNKNOWN' }, 'Database error creating assignment')
      return res.status(500).json({ error: 'Internal server error' })
    }

    const auditRecord = buildAuditRecord(req.userId, 'CREATE', 'city_tag_assignment', data.id, { city_id, tag_id, is_permanent })
    await supabase.from('admin_audit_log').insert(auditRecord)

    return res.status(201).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'createAssignment', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /assignments/:id — Remove a city tag assignment
router.delete('/assignments/:id', async (req, res) => {
  try {
    const { id } = req.params
    req.log.info({ module: 'admin', operation: 'deleteAssignment', assignmentId: id }, 'Deleting city tag assignment')

    const { data, error } = await supabase
      .from('city_tag_assignments')
      .delete()
      .eq('id', id)
      .select()

    if (error) {
      req.log.error({ module: 'admin', operation: 'deleteAssignment', code: error.code || 'UNKNOWN' }, 'Database error deleting assignment')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' })
    }

    const auditRecord = buildAuditRecord(req.userId, 'DELETE', 'city_tag_assignment', id, { id })
    await supabase.from('admin_audit_log').insert(auditRecord)

    return res.status(200).json(data[0])
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'deleteAssignment', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
