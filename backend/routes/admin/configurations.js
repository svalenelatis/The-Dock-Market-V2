const { Router } = require('express')
const adminAuth = require('../../middleware/admin')
const supabase = require('../../lib/supabase')
const { validateConfiguration, validateConfigKey } = require('../../utils/admin-validators')
const { buildAuditRecord } = require('../../utils/audit')
const { reloadSchedules, getStatus } = require('../../lib/scheduler')

const router = Router()

// All admin configuration routes require authentication + admin role
router.use(adminAuth)

// POST /reload-schedules — Reload cron schedules from DB without restart
router.post('/reload-schedules', async (req, res) => {
  try {
    req.log.info({ module: 'admin', operation: 'reloadSchedules' }, 'Reloading cron schedules')
    await reloadSchedules()
    const status = getStatus()
    return res.status(200).json({ message: 'Schedules reloaded', jobs: status })
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'reloadSchedules', err }, 'Failed to reload schedules')
    return res.status(500).json({ error: 'Failed to reload schedules' })
  }
})

// GET /schedules — Get current scheduler status
router.get('/schedules', async (req, res) => {
  try {
    const status = getStatus()
    return res.status(200).json(status)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get schedule status' })
  }
})

// GET / — List all configuration entries
router.get('/', async (req, res) => {
  try {
    req.log.info({ module: 'admin', operation: 'listConfigurations' }, 'Listing all configurations')

    const { data, error } = await supabase
      .from('configurations')
      .select('key, value, updated_at')

    if (error) {
      req.log.error({ module: 'admin', operation: 'listConfigurations', code: error.code || 'UNKNOWN' }, 'Database error listing configurations')
      return res.status(500).json({ error: 'Internal server error' })
    }

    return res.status(200).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'listConfigurations', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /:key — Update a configuration value
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params
    const { value } = req.body
    req.log.info({ module: 'admin', operation: 'updateConfiguration', key }, 'Updating configuration')

    // Fetch current value to verify key exists and for audit logging
    const { data: existing, error: fetchError } = await supabase
      .from('configurations')
      .select('key, value')
      .eq('key', key)
      .single()

    if (fetchError || !existing) {
      if (fetchError && fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Configuration key not found' })
      }
      if (fetchError) {
        req.log.error({ module: 'admin', operation: 'updateConfiguration', code: fetchError.code || 'UNKNOWN' }, 'Database error fetching configuration')
        return res.status(500).json({ error: 'Internal server error' })
      }
      return res.status(404).json({ error: 'Configuration key not found' })
    }

    // Validate the new value per-key rules
    const { isValid, errors } = validateConfiguration(key, value)
    if (!isValid) {
      req.log.warn({ module: 'admin', operation: 'updateConfiguration', field: 'value', reason: errors.join(', ') }, 'Validation failed')
      return res.status(400).json({ errors })
    }

    // Update the configuration
    const { data, error: updateError } = await supabase
      .from('configurations')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key)
      .select('key, value, updated_at')
      .single()

    if (updateError) {
      req.log.error({ module: 'admin', operation: 'updateConfiguration', code: updateError.code || 'UNKNOWN' }, 'Database error updating configuration')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Write audit log with previous and new value — return 500 if it fails (Requirement 14.5)
    const auditRecord = buildAuditRecord(req.userId, 'UPDATE', 'configuration', key, {
      previous_value: existing.value,
      new_value: value,
    })
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'updateConfiguration', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'updateConfiguration', result: { key, value } }, 'Configuration updated successfully')
    return res.status(200).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'updateConfiguration', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST / — Add a new configuration entry
router.post('/', async (req, res) => {
  try {
    const { key, value } = req.body
    req.log.info({ module: 'admin', operation: 'createConfiguration', key }, 'Creating new configuration')

    // Validate key format
    const { isValid: keyValid, errors: keyErrors } = validateConfigKey(key)
    if (!keyValid) {
      req.log.warn({ module: 'admin', operation: 'createConfiguration', field: 'key', reason: keyErrors.join(', ') }, 'Key validation failed')
      return res.status(400).json({ errors: keyErrors })
    }

    // Validate value per-key rules
    const { isValid: valueValid, errors: valueErrors } = validateConfiguration(key, value)
    if (!valueValid) {
      req.log.warn({ module: 'admin', operation: 'createConfiguration', field: 'value', reason: valueErrors.join(', ') }, 'Value validation failed')
      return res.status(400).json({ errors: valueErrors })
    }

    // Check for existing key (return 409 if duplicate)
    const { data: existing, error: checkError } = await supabase
      .from('configurations')
      .select('key')
      .eq('key', key)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      req.log.error({ module: 'admin', operation: 'createConfiguration', code: checkError.code || 'UNKNOWN' }, 'Database error checking for duplicate')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (existing) {
      req.log.warn({ module: 'admin', operation: 'createConfiguration', key }, 'Duplicate configuration key')
      return res.status(409).json({ error: 'Configuration key already exists' })
    }

    // Insert new configuration entry
    const { data, error: insertError } = await supabase
      .from('configurations')
      .insert({ key, value, updated_at: new Date().toISOString() })
      .select('key, value, updated_at')
      .single()

    if (insertError) {
      req.log.error({ module: 'admin', operation: 'createConfiguration', code: insertError.code || 'UNKNOWN' }, 'Database error creating configuration')
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Write audit log — return 500 if it fails (Requirement 14.5)
    const auditRecord = buildAuditRecord(req.userId, 'CREATE', 'configuration', key, { value })
    const { error: auditError } = await supabase.from('admin_audit_log').insert(auditRecord)

    if (auditError) {
      req.log.error({ module: 'admin', operation: 'createConfiguration', code: auditError.code || 'UNKNOWN' }, 'Audit log write failed')
      return res.status(500).json({ error: 'Action could not be completed' })
    }

    req.log.info({ module: 'admin', operation: 'createConfiguration', result: { key } }, 'Configuration created successfully')
    return res.status(201).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'createConfiguration', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
