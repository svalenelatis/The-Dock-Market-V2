import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAuthMiddleware } from './auth.js'

/**
 * Creates a mock client factory for testing.
 * Returns a function that, given a JWT, produces a mock Supabase client
 * with a configurable getClaims response.
 *
 * @param {Function} getClaimsFn - The mock getClaims function
 * @returns {Function} Factory function (jwt) => mockClient
 */
function createMockClientFactory(getClaimsFn) {
  return (jwt) => ({
    auth: {
      getClaims: getClaimsFn
    }
  })
}

/**
 * Creates a mock Express request object
 * @param {object} [headers] - Request headers
 * @returns {object} Mock request
 */
function createMockReq(headers = {}) {
  return { headers }
}

/**
 * Creates a mock Express response object with chained status/json
 * @returns {object} Mock response with spy methods
 */
function createMockRes() {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('authMiddleware (getClaims)', () => {
  let req, res, next, mockGetClaims, authMiddleware

  beforeEach(() => {
    req = createMockReq()
    res = createMockRes()
    next = vi.fn()
    mockGetClaims = vi.fn()
    authMiddleware = createAuthMiddleware(createMockClientFactory(mockGetClaims))
  })

  describe('missing Authorization header', () => {
    it('returns 401 when Authorization header is absent', async () => {
      req = createMockReq({})

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Authorization header is required' })
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('invalid token format', () => {
    it('returns 401 when header does not start with "Bearer "', async () => {
      req = createMockReq({ authorization: 'Basic abc123' })

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token format' })
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 401 when header is just "Bearer " with no token', async () => {
      req = createMockReq({ authorization: 'Bearer ' })

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token format' })
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 401 when header is "Bearer" without a space', async () => {
      req = createMockReq({ authorization: 'Bearer' })

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token format' })
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 401 when token is only whitespace', async () => {
      req = createMockReq({ authorization: 'Bearer    ' })

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token format' })
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('successful verification via getClaims()', () => {
    it('attaches req.userId, req.userClient, and calls next() on valid token', async () => {
      mockGetClaims.mockResolvedValue({
        data: {
          claims: { sub: '123e4567-e89b-12d3-a456-426614174000', role: 'authenticated' }
        },
        error: null
      })

      req = createMockReq({ authorization: 'Bearer valid-token-abc' })

      await authMiddleware(req, res, next)

      expect(mockGetClaims).toHaveBeenCalledWith('valid-token-abc')
      expect(req.userId).toBe('123e4567-e89b-12d3-a456-426614174000')
      expect(req.userClient).toBeDefined()
      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })
  })

  describe('failed verification', () => {
    it('returns 401 when token is expired or invalid', async () => {
      mockGetClaims.mockResolvedValue({
        data: null,
        error: { message: 'Token expired', status: 401 }
      })

      req = createMockReq({ authorization: 'Bearer expired-token' })

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' })
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 401 when getClaims returns no claims', async () => {
      mockGetClaims.mockResolvedValue({
        data: { claims: null },
        error: null
      })

      req = createMockReq({ authorization: 'Bearer bad-token' })

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' })
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 401 when claims have no sub field', async () => {
      mockGetClaims.mockResolvedValue({
        data: { claims: { role: 'authenticated' } },
        error: null
      })

      req = createMockReq({ authorization: 'Bearer token-no-sub' })

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' })
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('service unreachable', () => {
    it('returns 500 on network error (fetch failed)', async () => {
      mockGetClaims.mockResolvedValue({
        data: null,
        error: { message: 'fetch failed', status: 0 }
      })

      req = createMockReq({ authorization: 'Bearer some-token' })

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication service temporarily unavailable' })
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 500 when getClaims throws an exception', async () => {
      mockGetClaims.mockRejectedValue(new Error('ECONNREFUSED'))

      req = createMockReq({ authorization: 'Bearer some-token' })

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication service temporarily unavailable' })
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 500 on ETIMEDOUT error', async () => {
      mockGetClaims.mockResolvedValue({
        data: null,
        error: { message: 'Connection timed out', code: 'ETIMEDOUT', status: 0 }
      })

      req = createMockReq({ authorization: 'Bearer some-token' })

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication service temporarily unavailable' })
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 500 on network error message', async () => {
      mockGetClaims.mockResolvedValue({
        data: null,
        error: { message: 'network error occurred', status: 0 }
      })

      req = createMockReq({ authorization: 'Bearer some-token' })

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication service temporarily unavailable' })
      expect(next).not.toHaveBeenCalled()
    })
  })
})
