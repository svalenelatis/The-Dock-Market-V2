const supabase = require('../lib/supabase')
const authMiddleware = require('./auth')

/**
 * Creates the admin middleware function.
 * Accepts an optional supabase client for testing purposes.
 *
 * @param {object} [client] - Supabase client (defaults to the service role client)
 * @returns {function} Express middleware
 */
function createAdminMiddleware(client) {
  const supabaseClient = client || supabase

  /**
   * Runs AFTER authMiddleware (req.userId is already set).
   * Queries admin_users WHERE id = req.userId.
   * Passes if role is 'admin' or 'super_admin'.
   * Responds 403 if not admin, 500 on DB error.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  return async function adminMiddleware(req, res, next) {
    try {
      const { data, error } = await supabaseClient
        .from('admin_users')
        .select('role')
        .eq('id', req.userId)
        .single()

      if (error) {
        // If no rows found, Supabase returns a PGRST116 error code
        if (error.code === 'PGRST116') {
          return res.status(403).json({ error: 'Admin privileges required' })
        }
        return res.status(500).json({ error: 'Internal server error' })
      }

      if (!data || (data.role !== 'admin' && data.role !== 'super_admin')) {
        return res.status(403).json({ error: 'Admin privileges required' })
      }

      // Attach admin context for downstream handlers
      req.adminRole = data.role
      next()
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}

// Export the default middleware instance for use in routes
const adminMiddleware = createAdminMiddleware()

/**
 * Combined middleware array for admin routes.
 * Handles both authentication (JWT verification) and admin role checking.
 * Use this on admin route groups: router.use(adminAuth)
 */
const adminAuth = [authMiddleware, adminMiddleware]

module.exports = adminAuth
module.exports.adminMiddleware = adminMiddleware
module.exports.createAdminMiddleware = createAdminMiddleware
