import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAdminMiddleware } from './admin.js'

/**
 * Creates a mock Supabase client with chained .from().select().eq().single()
 * @param {Function} singleFn - The mock function for .single()
 * @returns {object} Mock supabase client with chain tracking
 */
function createMockSupabase(singleFn) {
  const mockEq = vi.fn(() => ({ single: singleFn }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ select: mockSelect }))

  return {
    from: mockFrom,
    __mockFrom: mockFrom,
    __mockSelect: mockSelect,
    __mockEq: mockEq,
  }
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

describe('adminMiddleware', () => {
  let req, res, next, mockSingle, mockSupabase, adminMiddleware

  beforeEach(() => {
    req = { userId: 'user-123-abc' }
    res = createMockRes()
    next = vi.fn()
    mockSingle = vi.fn()
    mockSupabase = createMockSupabase(mockSingle)
    adminMiddleware = createAdminMiddleware(mockSupabase)
  })

  describe('user not found in admin_users (Requirement 8.4)', () => {
    it('returns 403 when user is not in admin_users table (PGRST116)', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      })

      await adminMiddleware(req, res, next)

      expect(mockSupabase.__mockFrom).toHaveBeenCalledWith('admin_users')
      expect(mockSupabase.__mockSelect).toHaveBeenCalledWith('role')
      expect(mockSupabase.__mockEq).toHaveBeenCalledWith('id', 'user-123-abc')
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin privileges required' })
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('valid admin roles (Requirement 8.2)', () => {
    it('calls next() and attaches adminRole when role is "admin"', async () => {
      mockSingle.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      })

      await adminMiddleware(req, res, next)

      expect(req.adminRole).toBe('admin')
      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('calls next() and attaches adminRole when role is "super_admin"', async () => {
      mockSingle.mockResolvedValue({
        data: { role: 'super_admin' },
        error: null,
      })

      await adminMiddleware(req, res, next)

      expect(req.adminRole).toBe('super_admin')
      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })
  })

  describe('insufficient role (Requirement 8.4)', () => {
    it('returns 403 when user has invalid role (e.g. "viewer")', async () => {
      mockSingle.mockResolvedValue({
        data: { role: 'viewer' },
        error: null,
      })

      await adminMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin privileges required' })
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 403 when data is null (no error)', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: null,
      })

      await adminMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin privileges required' })
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('database errors (Requirement 8.5)', () => {
    it('returns 500 on non-PGRST116 database error', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST500', message: 'Connection refused' },
      })

      await adminMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 500 on unexpected thrown exception', async () => {
      mockSingle.mockRejectedValue(new Error('Unexpected failure'))

      await adminMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
      expect(next).not.toHaveBeenCalled()
    })
  })
})
