const { Router } = require('express')
const adminAuth = require('../../middleware/admin')
const supabase = require('../../lib/supabase')
const { validateAdminTag, sanitizeString } = require('../../utils/admin-validators')
const { buildAuditRecord } = require('../../utils/audit')

const router = Router()

// All price override routes require admin authentication
router.use(adminAuth)

// --- GET /api/admin/price-overrides ---
// Requirement 8.4: List all active admin tag assignments across all cities
router.get('/', async (req, res) => {
  try {
    req.log.info({ module: 'admin', operation: 'listPriceOverrides' }, 'Listing active admin tag assignments')

    const { data, error } = await supabase
      .from('city_tag_assignments')
      .select('*, city_tags!inner(*)')
      .eq('active', true)
      .eq('city_tags.is_admin_override', true)

    if (error) {
      req.log.error({ module: 'admin', operation: 'listPriceOverrides', code: error.code || 'UNKNOWN' }, 'Database error fetching price overrides')
      return res.status(500).json({ error: 'Internal server error' })
    }

    req.log.info({ module: 'admin', operation: 'listPriceOverrides', result: { count: data.length } }, 'Price overrides listed successfully')
    return res.status(200).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'listPriceOverrides', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// --- POST /api/admin/price-overrides ---
// Requirements 8.1, 8.2, 8.3, 8.7: Create admin tag and assign to city
router.post('/', async (req, res) => {
  try {
    const { name, description, effects, city_id, is_permanent, expires_at } = req.body
    req.log.info({ module: 'admin', operation: 'createPriceOverride', cityId: city_id }, 'Creating admin tag assignment')

    // Validate required fields
    if (!name || typeof name !== 'string' || name.length < 1 || name.length > 100) {
      return res.status(400).json({ errors: ['Name must be a string between 1 and 100 characters'] })
    }

    if (!description || typeof description !== 'string' || description.length < 1 || description.length > 500) {
      return res.status(400).json({ errors: ['Description must be a string between 1 and 500 characters'] })
    }

    if (!city_id) {
      return res.status(400).json({ errors: ['city_id is required'] })
    }

    // Build the body for validateAdminTag (validates effects and expiry)
    const tagValidationBody = { effects }
    if (!is_permanent && expires_at) {
      tagValidationBody.expiry = expires_at
    }

    const { isValid, errors } = validateAdminTag(tagValidationBody)
    if (!isValid) {
      req.log.warn({ module: 'admin', operation: 'createPriceOverride', field: 'body', reason: errors.join(', ') }, 'Validation failed')
      return res.status(400).json({ errors })
    }

    // Requirement 8.3: If not permanent, expires_at must be provided
    if (!is_permanent && !expires_at) {
      return res.status(400).json({ errors: ['expires_at is required for non-permanent assignments'] })
    }

    // Verify the city exists
    const { data: city, error: cityError } = await supabase
      .from('cities')
      .select('id')
      .eq('id', city_id)
      .single()

    if (cityError || !city) {
      if (cityError && cityError.code === 'PGRST116') {
        return res.status(404).json({ error: 'City not found' })
      }
      if (cityError) {
        req.log.error({ module: 'admin', operation: 'createPriceOverride', code: cityError.code || 'UNKNOWN' }, 'Database error verifying city')
        return res.status(500).json({ error: 'Internal server error' })
      }
      return res.status(404).json({ error: 'City not found' })
    }

    // Requirement 8.2: Create the city_tag with is_admin_override=true
    const tagData = {
      name: sanitizeString(name),
      description: sanitizeString(description),
      effects,
      is_admin_override: true,
      active: true,
    }

    const { data: createdTag, error: tagError } = await supabase
      .from('city_tags')
      .insert(tagData)
      .select()
      .single()

    if (tagError) {
      req.log.error({ module: 'admin', operation: 'createPriceOverride', code: tagError.code || 'UNKNOWN' }, 'Database error creating admin tag')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Requirement 8.7: Check for duplicate assignment (same tag name already active on same city)
    const { data: existingAssignment, error: dupCheckError } = await supabase
      .from('city_tag_assignments')
      .select('id, tag_id, city_tags(name, is_admin_override)')
      .eq('city_id', city_id)
      .eq('active', true)

    if (dupCheckError) {
      req.log.error({ module: 'admin', operation: 'createPriceOverride', code: dupCheckError.code || 'UNKNOWN' }, 'Database error checking duplicates')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Check if any existing active assignment on this city has the same tag name
    const duplicate = existingAssignment && existingAssignment.find(
      a => a.city_tags && a.city_tags.is_admin_override && a.city_tags.name === sanitizeString(name)
    )

    if (duplicate) {
      req.log.warn({ module: 'admin', operation: 'createPriceOverride', cityId: city_id, tagName: name }, 'Duplicate admin tag assignment')
      return res.status(409).json({ error: 'This admin tag is already assigned to that city' })
    }

    // Create the city_tag_assignment linking tag to city
    const assignmentData = {
      city_id,
      tag_id: createdTag.id,
      is_permanent: !!is_permanent,
      expires_at: is_permanent ? null : expires_at,
      active: true,
    }

    const { data: createdAssignment, error: assignError } = await supabase
      .from('city_tag_assignments')
      .insert(assignmentData)
      .select()
      .single()

    if (assignError) {
      req.log.error({ module: 'admin', operation: 'createPriceOverride', code: assignError.code || 'UNKNOWN' }, 'Database error creating assignment')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Requirement 14.1, 14.5: Write audit log — return 500 if it fails
    const auditRecord = buildAuditRecord(req.userId, 'CREATE', 'city_tag', createdTag.id, {
      tag: tagData,
      assignment: assignmentData,
    })
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'createPriceOverride', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'createPriceOverride', result: { tagId: createdTag.id, assignmentId: createdAssignment.id } }, 'Admin tag assignment created successfully')
    return res.status(201).json({
      tag: createdTag,
      assignment: createdAssignment,
    })
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'createPriceOverride', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// --- DELETE /api/admin/price-overrides/:id ---
// Requirement 8.5: Remove admin tag assignment (immediate or expire)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const mode = req.query.mode || 'immediate'
    req.log.info({ module: 'admin', operation: 'removePriceOverride', assignmentId: id, mode }, 'Removing admin tag assignment')

    // Validate mode parameter
    if (mode !== 'immediate' && mode !== 'expire') {
      return res.status(400).json({ error: 'Mode must be "immediate" or "expire"' })
    }

    // Verify the assignment exists and is an admin override
    const { data: assignment, error: fetchError } = await supabase
      .from('city_tag_assignments')
      .select('id, city_id, tag_id, active, city_tags(is_admin_override)')
      .eq('id', id)
      .single()

    if (fetchError || !assignment) {
      if (fetchError && fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Assignment not found' })
      }
      if (fetchError) {
        req.log.error({ module: 'admin', operation: 'removePriceOverride', code: fetchError.code || 'UNKNOWN' }, 'Database error fetching assignment')
        return res.status(500).json({ error: 'Internal server error' })
      }
      return res.status(404).json({ error: 'Assignment not found' })
    }

    if (!assignment.city_tags || !assignment.city_tags.is_admin_override) {
      return res.status(400).json({ error: 'Assignment is not an admin override' })
    }

    let updateError
    if (mode === 'immediate') {
      // Remove assignment immediately by setting active=false
      const { error } = await supabase
        .from('city_tag_assignments')
        .update({ active: false })
        .eq('id', id)
      updateError = error
    } else {
      // Expire: set expires_at to now so the daily handler cleans it up
      const { error } = await supabase
        .from('city_tag_assignments')
        .update({ expires_at: new Date().toISOString() })
        .eq('id', id)
      updateError = error
    }

    if (updateError) {
      req.log.error({ module: 'admin', operation: 'removePriceOverride', code: updateError.code || 'UNKNOWN' }, 'Database error removing assignment')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Requirement 14.1, 14.5: Write audit log — return 500 if it fails
    const auditRecord = buildAuditRecord(req.userId, 'DELETE', 'city_tag', assignment.tag_id, {
      assignment_id: id,
      city_id: assignment.city_id,
      mode,
    })
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'removePriceOverride', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'removePriceOverride', result: { assignmentId: id, mode } }, 'Admin tag assignment removed successfully')
    return res.status(200).json({ message: `Assignment ${mode === 'immediate' ? 'removed' : 'set to expire'}` })
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'removePriceOverride', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
