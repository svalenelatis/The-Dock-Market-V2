const { Router } = require('express')
const adminAuth = require('../../middleware/admin')
const supabase = require('../../lib/supabase')
const { validateItem, sanitizeString } = require('../../utils/admin-validators')
const { buildAuditRecord } = require('../../utils/audit')

const router = Router()

// All admin item routes require authentication + admin role
router.use(adminAuth)

// GET / — List all items ordered by name
router.get('/', async (req, res) => {
  try {
    req.log.info({ module: 'admin', operation: 'listItems' }, 'Listing all items')

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      req.log.error({ module: 'admin', operation: 'listItems', code: error.code || 'UNKNOWN' }, 'Database error fetching items')
      return res.status(500).json({ error: 'Internal server error' })
    }

    req.log.info({ module: 'admin', operation: 'listItems', result: { count: data.length } }, 'Items listed successfully')
    return res.status(200).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'listItems', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST / — Create a new item
router.post('/', async (req, res) => {
  try {
    req.log.info({ module: 'admin', operation: 'createItem' }, 'Creating new item')

    const { isValid, errors } = validateItem(req.body)
    if (!isValid) {
      req.log.warn({ module: 'admin', operation: 'createItem', field: 'body', reason: errors.join(', ') }, 'Validation failed')
      return res.status(400).json({ errors })
    }

    // Sanitize string fields
    const sanitizedItem = {
      name: sanitizeString(req.body.name),
      base_price: req.body.base_price,
    }

    if (req.body.components !== undefined) {
      sanitizedItem.components = req.body.components.map(c => sanitizeString(c))
    }

    if (req.body.tags !== undefined) {
      sanitizedItem.tags = req.body.tags.map(t => sanitizeString(t))
    }

    const { data, error } = await supabase
      .from('items')
      .insert(sanitizedItem)
      .select()
      .single()

    if (error) {
      req.log.error({ module: 'admin', operation: 'createItem', code: error.code || 'UNKNOWN' }, 'Database error creating item')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Log audit record
    const auditRecord = buildAuditRecord(req.userId, 'CREATE', 'item', data.id, sanitizedItem)
    await supabase.from('admin_audit_log').insert(auditRecord)

    req.log.info({ module: 'admin', operation: 'createItem', result: { itemId: data.id, name: sanitizedItem.name } }, 'Item created successfully')
    return res.status(201).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'createItem', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /:id — Update an existing item
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    req.log.info({ module: 'admin', operation: 'updateItem', itemId: id }, 'Updating item')

    const { isValid, errors } = validateItem(req.body)
    if (!isValid) {
      req.log.warn({ module: 'admin', operation: 'updateItem', field: 'body', reason: errors.join(', ') }, 'Validation failed')
      return res.status(400).json({ errors })
    }

    // Sanitize string fields
    const sanitizedItem = {
      name: sanitizeString(req.body.name),
      base_price: req.body.base_price,
    }

    if (req.body.components !== undefined) {
      sanitizedItem.components = req.body.components.map(c => sanitizeString(c))
    }

    if (req.body.tags !== undefined) {
      sanitizedItem.tags = req.body.tags.map(t => sanitizeString(t))
    }

    const { data, error } = await supabase
      .from('items')
      .update(sanitizedItem)
      .eq('id', id)
      .select()

    if (error) {
      req.log.error({ module: 'admin', operation: 'updateItem', code: error.code || 'UNKNOWN' }, 'Database error updating item')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Item not found' })
    }

    // Log audit record
    const auditRecord = buildAuditRecord(req.userId, 'UPDATE', 'item', id, sanitizedItem)
    await supabase.from('admin_audit_log').insert(auditRecord)

    req.log.info({ module: 'admin', operation: 'updateItem', result: { itemId: id, name: sanitizedItem.name } }, 'Item updated successfully')
    return res.status(200).json(data[0])
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'updateItem', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /:id — Soft-delete an item (set active=false)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    req.log.info({ module: 'admin', operation: 'deleteItem', itemId: id }, 'Deleting item')

    const { data, error } = await supabase
      .from('items')
      .update({ active: false })
      .eq('id', id)
      .select()

    if (error) {
      req.log.error({ module: 'admin', operation: 'deleteItem', code: error.code || 'UNKNOWN' }, 'Database error deleting item')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Item not found' })
    }

    // Log audit record
    const auditRecord = buildAuditRecord(req.userId, 'DELETE', 'item', id, { active: false })
    await supabase.from('admin_audit_log').insert(auditRecord)

    req.log.info({ module: 'admin', operation: 'deleteItem', result: { itemId: id } }, 'Item deleted successfully')
    return res.status(200).json(data[0])
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'deleteItem', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
