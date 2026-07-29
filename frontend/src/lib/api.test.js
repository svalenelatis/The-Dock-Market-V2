import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Store original fetch
const originalFetch = globalThis.fetch

let apiCall

beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'http://localhost:3001')
  globalThis.fetch = vi.fn()
  const mod = await import('./api.js')
  apiCall = mod.apiCall
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.unstubAllEnvs()
})

describe('lib/api - apiCall', () => {
  describe('request configuration', () => {
    it('sets Content-Type header to application/json', async () => {
      globalThis.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await apiCall('/api/test')

      const [, options] = globalThis.fetch.mock.calls[0]
      expect(options.headers['Content-Type']).toBe('application/json')
    })

    it('sets Authorization header when token is provided', async () => {
      globalThis.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await apiCall('/api/test', { token: 'my-jwt-token' })

      const [, options] = globalThis.fetch.mock.calls[0]
      expect(options.headers['Authorization']).toBe('Bearer my-jwt-token')
    })

    it('does not set Authorization header when no token is provided', async () => {
      globalThis.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await apiCall('/api/test')

      const [, options] = globalThis.fetch.mock.calls[0]
      expect(options.headers['Authorization']).toBeUndefined()
    })

    it('prepends VITE_API_URL to the path', async () => {
      globalThis.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await apiCall('/api/transactions')

      const [url] = globalThis.fetch.mock.calls[0]
      expect(url).toBe('http://localhost:3001/api/transactions')
    })

    it('defaults to GET method', async () => {
      globalThis.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await apiCall('/api/test')

      const [, options] = globalThis.fetch.mock.calls[0]
      expect(options.method).toBe('GET')
    })
  })

  describe('request body handling', () => {
    it('JSON-stringifies the body when provided', async () => {
      globalThis.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const body = { item: 'Iron', quantity: 5, city: 'Port Royal' }
      await apiCall('/api/transactions', { method: 'POST', body })

      const [, options] = globalThis.fetch.mock.calls[0]
      expect(options.body).toBe(JSON.stringify(body))
    })

    it('does not include body for GET requests without body', async () => {
      globalThis.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await apiCall('/api/test')

      const [, options] = globalThis.fetch.mock.calls[0]
      expect(options.body).toBeUndefined()
    })
  })

  describe('successful responses', () => {
    it('returns parsed JSON on success', async () => {
      const responseData = { items: [{ name: 'Iron' }] }
      globalThis.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      })

      const result = await apiCall('/api/items')
      expect(result).toEqual(responseData)
    })
  })

  describe('error handling', () => {
    it('throws "Network error — please try again" on fetch failure', async () => {
      globalThis.fetch.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(apiCall('/api/test')).rejects.toThrow(
        'Network error — please try again'
      )
    })

    it('throws error message from API error response JSON', async () => {
      globalThis.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Insufficient gold' }),
      })

      await expect(apiCall('/api/transactions')).rejects.toThrow('Insufficient gold')
    })

    it('throws generic status message when error response is not JSON', async () => {
      globalThis.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      })

      await expect(apiCall('/api/test')).rejects.toThrow(
        'Request failed with status 500'
      )
    })
  })
})
