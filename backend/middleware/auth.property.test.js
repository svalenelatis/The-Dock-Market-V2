import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import { createAuthMiddleware } from './auth.js'

/**
 * Feature: express-react-migration
 * Property 2: Invalid Authorization header formats are always rejected
 * Validates: Requirements 7.1, 7.3
 */

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

/**
 * Creates a mock client factory for testing getClaims.
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

describe('Property 2: Invalid Authorization header formats are always rejected', () => {
  /**
   * Test 1: Invalid headers are always rejected with 401
   *
   * For any string that does NOT match "Bearer <non-empty-non-whitespace>",
   * the middleware SHALL classify it as invalid and return 401.
   *
   * **Validates: Requirements 7.1, 7.3**
   */
  it('rejects all strings that do not match "Bearer <non-empty-non-whitespace>" pattern', async () => {
    const mockGetClaims = vi.fn()
    const authMiddleware = createAuthMiddleware(createMockClientFactory(mockGetClaims))

    // Generator for invalid authorization headers:
    // 1. Strings without "Bearer " prefix
    // 2. "Bearer " followed by empty string
    // 3. "Bearer " followed by only whitespace
    const invalidHeaderArb = fc.oneof(
      // Arbitrary strings that do NOT start with "Bearer "
      fc.string().filter((s) => !s.startsWith('Bearer ')),
      // "Bearer " with nothing after it
      fc.constant('Bearer '),
      // "Bearer" without a trailing space
      fc.constant('Bearer'),
      // "Bearer " followed by only whitespace characters
      fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1 }).map(
        (ws) => `Bearer ${ws}`
      )
    )

    await fc.assert(
      fc.asyncProperty(invalidHeaderArb, async (header) => {
        const req = createMockReq({ authorization: header })
        const res = createMockRes()
        const next = vi.fn()

        await authMiddleware(req, res, next)

        // Must return 401
        expect(res.status).toHaveBeenCalledWith(401)
        // Must NOT call next
        expect(next).not.toHaveBeenCalled()
        // Must NOT attempt to verify the token
        expect(mockGetClaims).not.toHaveBeenCalled()

        // Reset mocks for next iteration
        mockGetClaims.mockClear()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Test 2: Valid headers always result in successful token extraction and getClaims call
   *
   * For any string matching "Bearer " followed by one or more non-whitespace characters,
   * extraction SHALL succeed and getClaims is called with the token.
   *
   * **Validates: Requirements 7.1, 7.3**
   */
  it('extracts token and calls getClaims for all valid "Bearer <token>" headers', async () => {
    const mockGetClaims = vi.fn().mockResolvedValue({
      data: { claims: { sub: 'test-user-id-123', role: 'authenticated' } },
      error: null
    })
    const authMiddleware = createAuthMiddleware(createMockClientFactory(mockGetClaims))

    // Generator for valid tokens: non-empty strings with at least one non-whitespace char
    const validTokenArb = fc
      .string({ minLength: 1 })
      .filter((s) => s.trim().length > 0)

    await fc.assert(
      fc.asyncProperty(validTokenArb, async (token) => {
        const header = `Bearer ${token}`
        const req = createMockReq({ authorization: header })
        const res = createMockRes()
        const next = vi.fn()

        await authMiddleware(req, res, next)

        // Must call getClaims with the extracted token
        expect(mockGetClaims).toHaveBeenCalledWith(token)
        // Must call next() on successful verification
        expect(next).toHaveBeenCalled()
        // Must attach userId to request
        expect(req.userId).toBe('test-user-id-123')
        // Must attach userClient to request
        expect(req.userClient).toBeDefined()
        // Must NOT return an error status
        expect(res.status).not.toHaveBeenCalled()

        // Reset mocks for next iteration
        mockGetClaims.mockClear()
      }),
      { numRuns: 100 }
    )
  })
})
