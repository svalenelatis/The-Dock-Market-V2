import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @supabase/supabase-js before any dynamic imports
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}))

describe('lib/supabase', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('throws when VITE_SUPABASE_URL is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')

    await expect(() => import('./supabase.js')).rejects.toThrow(
      'Missing or empty VITE_SUPABASE_URL environment variable'
    )

    vi.unstubAllEnvs()
  })

  it('throws when VITE_SUPABASE_ANON_KEY is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    await expect(() => import('./supabase.js')).rejects.toThrow(
      'Missing or empty VITE_SUPABASE_ANON_KEY environment variable'
    )

    vi.unstubAllEnvs()
  })

  it('creates client successfully when both env vars are set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')

    const mod = await import('./supabase.js')
    expect(mod.default).toBeDefined()

    vi.unstubAllEnvs()
  })
})
