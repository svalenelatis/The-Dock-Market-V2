const { Router } = require('express')
const adminAuth = require('../../middleware/admin')
const supabase = require('../../lib/supabase')
const { buildAuditRecord } = require('../../utils/audit')

const router = Router()

// All admin user routes require authentication + admin role
router.use(adminAuth)

// Super admin check — all routes in this file require super_admin
router.use((req, res, next) => {
  if (req.adminRole !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin privileges required' })
  }
  next()
})

// GET / — List all admin users ordered by created_at descending
router.get('/', async (req, res) => {
  try {
    req.log.info({ module: 'admin', operation: 'listAdminUsers' }, 'Listing admin users')

    const { data, error } = await supabase
      .from('admin_users')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      req.log.error({ module: 'admin', operation: 'listAdminUsers', code: error.code || 'UNKNOWN' }, 'Database error fetching admin users')
      return res.status(500).json({ error: 'Internal server error' })
    }

    req.log.info({ module: 'admin', operation: 'listAdminUsers', result: { count: data.length } }, 'Admin users listed successfully')
    return res.status(200).json(data)
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'listAdminUsers', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /:id — Update an admin user's role
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { role } = req.body
    req.log.info({ module: 'admin', operation: 'updateAdminRole', userId: id }, 'Updating admin user role')

    // Validate role is one of the allowed values
    const allowedRoles = ['admin', 'super_admin']
    if (!role || !allowedRoles.includes(role)) {
      req.log.warn({ module: 'admin', operation: 'updateAdminRole', field: 'role', reason: 'Role must be one of: admin, super_admin' }, 'Validation failed')
      return res.status(400).json({ error: 'Role must be one of: admin, super_admin' })
    }

    // Update the admin user's role
    const { data, error } = await supabase
      .from('admin_users')
      .update({ role })
      .eq('id', id)
      .select('id, email, role, created_at')

    if (error) {
      req.log.error({ module: 'admin', operation: 'updateAdminRole', code: error.code || 'UNKNOWN' }, 'Database error updating admin role')
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Admin user not found' })
    }

    // Log audit record
    const auditRecord = buildAuditRecord(req.userId, 'UPDATE', 'admin_user', id, { role })
    await supabase.from('admin_audit_log').insert(auditRecord)

    req.log.info({ module: 'admin', operation: 'updateAdminRole', result: { userId: id, role } }, 'Admin role updated successfully')
    return res.status(200).json(data[0])
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'updateAdminRole', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
