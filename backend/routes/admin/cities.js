const { Router } = require('express')
const adminAuth = require('../../middleware/admin')
const supabase = require('../../lib/supabase')
const { validateCity, sanitizeString } = require('../../utils/admin-validators')
const { buildAuditRecord } = require('../../utils/audit')

const router = Router()

// All city admin routes require admin authentication
router.use(adminAuth)

// --- GET /api/admin/cities ---
// Returns all cities with their active tag assignments and price sheets
router.get('/', async (req, res) => {
  try {
    req.log.info({ module: 'admin', operation: 'listCities' }, 'Listing all cities')

    const { data, error } = await supabase
      .from('cities')
      .select('id, name, volatility, location, updated_at, city_tag_assignments(id, tag_id, is_permanent, expires_at, city_tags(id, name))')
      .order('name', { ascending: true })

    if (error) {
      req.log.error({ module: 'admin', operation: 'listCities', code: error.code || 'UNKNOWN' }, 'Failed to fetch cities')
      return res.status(500).json({ error: 'Failed to fetch cities' })
    }

    req.log.info({ module: 'admin', operation: 'listCities', result: { count: data.length } }, 'Cities listed successfully')
    return res.status(200).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'listCities', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// --- GET /api/admin/cities/:id/price-sheet ---
// Returns all price_sheet rows for a specific city
router.get('/:id/price-sheet', async (req, res) => {
  try {
    const { id } = req.params
    req.log.info({ module: 'admin', operation: 'getCityPriceSheet', cityId: id }, 'Fetching city price sheet')

    const { data, error } = await supabase
      .from('price_sheets')
      .select('id, price, demand_setpoint, integral, updated_at, items(id, name, base_price)')
      .eq('city_id', id)

    if (error) {
      req.log.error({ module: 'admin', operation: 'getCityPriceSheet', code: error.code || 'UNKNOWN' }, 'Failed to fetch price sheet')
      return res.status(500).json({ error: 'Failed to fetch price sheet' })
    }

    req.log.info({ module: 'admin', operation: 'getCityPriceSheet', result: { cityId: id, itemCount: data.length } }, 'Price sheet fetched successfully')
    return res.status(200).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'getCityPriceSheet', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// --- POST /api/admin/cities ---
// Create a new city (price_sheets auto-populated via DB trigger)
router.post('/', async (req, res) => {
  try {
    req.log.info({ module: 'admin', operation: 'createCity' }, 'Creating new city')

    const body = req.body

    const { isValid, errors } = validateCity(body)
    if (!isValid) {
      req.log.warn({ module: 'admin', operation: 'createCity', field: 'body', reason: errors.join(', ') }, 'Validation failed')
      return res.status(400).json({ error: errors.join(', ') })
    }

    const sanitizedName = sanitizeString(body.name)

    const insertPayload = {
      name: sanitizedName,
      volatility: body.volatility,
      location: body.location,
    }

    const { data, error } = await supabase
      .from('cities')
      .insert(insertPayload)
      .select('id, name, volatility, location')
      .single()

    if (error) {
      req.log.error({ module: 'admin', operation: 'createCity', code: error.code || 'UNKNOWN' }, 'Failed to create city')
      return res.status(500).json({ error: 'Failed to create city' })
    }

    // If tags were provided, create tag assignments
    if (body.tags && Array.isArray(body.tags) && body.tags.length > 0) {
      // Look up tag IDs by name
      const { data: tagRows } = await supabase
        .from('city_tags')
        .select('id, name')
        .in('name', body.tags)

      if (tagRows && tagRows.length > 0) {
        const assignments = tagRows.map(tag => ({
          city_id: data.id,
          tag_id: tag.id,
          is_permanent: true,
          active: true,
        }))
        await supabase.from('city_tag_assignments').insert(assignments)
      }
    }

    // Audit logging
    const auditRecord = buildAuditRecord(req.userId, 'CREATE', 'city', data.id, {
      name: data.name,
    })
    await supabase.from('admin_audit_log').insert(auditRecord)

    req.log.info({ module: 'admin', operation: 'createCity', result: { cityId: data.id, name: data.name } }, 'City created successfully')
    return res.status(201).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'createCity', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// --- PUT /api/admin/cities/:id ---
// Update a city's core fields (name, volatility, location)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const body = req.body
    req.log.info({ module: 'admin', operation: 'updateCity', cityId: id }, 'Updating city')

    const { isValid, errors } = validateCity(body)
    if (!isValid) {
      req.log.warn({ module: 'admin', operation: 'updateCity', field: 'body', reason: errors.join(', ') }, 'Validation failed')
      return res.status(400).json({ error: errors.join(', ') })
    }

    const sanitizedName = sanitizeString(body.name)

    const updatePayload = {
      name: sanitizedName,
      volatility: body.volatility,
      location: body.location,
    }

    const { data, error } = await supabase
      .from('cities')
      .update(updatePayload)
      .eq('id', id)
      .select('id, name, volatility, location')

    if (error) {
      req.log.error({ module: 'admin', operation: 'updateCity', code: error.code || 'UNKNOWN' }, 'Failed to update city')
      return res.status(500).json({ error: 'Failed to update city' })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'City not found' })
    }

    // Audit logging
    const auditRecord = buildAuditRecord(req.userId, 'UPDATE', 'city', id, {
      name: sanitizedName,
    })
    await supabase.from('admin_audit_log').insert(auditRecord)

    req.log.info({ module: 'admin', operation: 'updateCity', result: { cityId: id, name: sanitizedName } }, 'City updated successfully')
    return res.status(200).json(data[0])
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'updateCity', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// --- PUT /api/admin/cities/:id/tags ---
// Replace all permanent tag assignments for a city
router.put('/:id/tags', async (req, res) => {
  try {
    const { id } = req.params
    const { tags } = req.body // Array of tag names
    req.log.info({ module: 'admin', operation: 'updateCityTags', cityId: id }, 'Updating city tags')

    if (!tags || !Array.isArray(tags)) {
      req.log.warn({ module: 'admin', operation: 'updateCityTags', field: 'tags', reason: 'tags must be an array of tag names' }, 'Validation failed')
      return res.status(400).json({ error: 'tags must be an array of tag names' })
    }

    // Remove existing permanent assignments for this city
    await supabase
      .from('city_tag_assignments')
      .delete()
      .eq('city_id', id)
      .eq('is_permanent', true)

    // Look up tag IDs
    const { data: tagRows } = await supabase
      .from('city_tags')
      .select('id, name')
      .in('name', tags)

    if (tagRows && tagRows.length > 0) {
      const assignments = tagRows.map(tag => ({
        city_id: id,
        tag_id: tag.id,
        is_permanent: true,
        active: true,
      }))
      await supabase.from('city_tag_assignments').insert(assignments)
    }

    // Audit logging
    const auditRecord = buildAuditRecord(req.userId, 'UPDATE', 'city', id, {
      field: 'tags',
      tags,
    })
    await supabase.from('admin_audit_log').insert(auditRecord)

    req.log.info({ module: 'admin', operation: 'updateCityTags', result: { cityId: id, tagCount: tags.length } }, 'City tags updated successfully')
    return res.status(200).json({ message: 'Tags updated', tags })
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'updateCityTags', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
