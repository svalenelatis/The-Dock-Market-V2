const { createUserClient } = require('../lib/supabase')

/**
 * Creates the auth middleware function.
 * Accepts an optional client factory for testing purposes.
 *
 * @param {Function} [clientFactory] - Factory that returns a scoped Supabase client given a JWT
 * @returns {function} Express middleware
 */
function createAuthMiddleware(clientFactory) {
  const getClient = clientFactory || createUserClient

  /**
   * Extracts Bearer token from Authorization header.
   * Creates a per-request Supabase client scoped to the user's JWT.
   * Calls getClaims() for local JWT verification (asymmetric keys)
   * or server-side verification (symmetric keys).
   *
   * On success: attaches req.userId (string UUID) and req.userClient (scoped client).
   * On failure: responds 401 on missing/invalid token, 500 on service failure.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  return async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization

    // Missing Authorization header
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header is required' })
    }

    // Invalid format — must be "Bearer <non-empty-string>"
    if (!authHeader.startsWith('Bearer ') || authHeader.length <= 7) {
      return res.status(401).json({ error: 'Invalid token format' })
    }

    // Extract token
    const token = authHeader.slice(7)

    // Guard against tokens that are only whitespace
    if (!token.trim()) {
      return res.status(401).json({ error: 'Invalid token format' })
    }

    try {
      // Create a client scoped to this request's token
      const userClient = getClient(token)

      // Verify the JWT and extract claims
      // - With asymmetric keys (default for new projects): verified locally via JWKS cache
      // - With symmetric keys: falls back to a server request
      const { data, error } = await userClient.auth.getClaims(token)

      if (error) {
        // Network/service errors
        if (
          error.status === 0 ||
          error.message?.toLowerCase().includes('fetch') ||
          error.message?.toLowerCase().includes('network') ||
          error.code === 'ECONNREFUSED' ||
          error.code === 'ETIMEDOUT'
        ) {
          return res.status(500).json({ error: 'Authentication service temporarily unavailable' })
        }

        // Invalid/expired/revoked token
        return res.status(401).json({ error: 'Invalid token' })
      }

      // Extract user ID from claims
      const userId = data?.claims?.sub
      if (!userId) {
        return res.status(401).json({ error: 'Invalid token' })
      }

      // Attach user context for downstream handlers
      req.userId = userId
      req.userClient = userClient
      next()
    } catch (err) {
      // Catch unexpected errors (network failures, service unreachable)
      return res.status(500).json({ error: 'Authentication service temporarily unavailable' })
    }
  }
}

// Export the default middleware instance for use in routes
// and the factory for testing
const authMiddleware = createAuthMiddleware()
module.exports = authMiddleware
module.exports.createAuthMiddleware = createAuthMiddleware
