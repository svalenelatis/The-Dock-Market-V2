import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || typeof supabaseUrl !== 'string' || supabaseUrl.trim() === '') {
  throw new Error(
    'Missing or empty VITE_SUPABASE_URL environment variable. ' +
    'Please set it in your .env file to initialize the Supabase client.'
  )
}

if (!supabaseAnonKey || typeof supabaseAnonKey !== 'string' || supabaseAnonKey.trim() === '') {
  throw new Error(
    'Missing or empty VITE_SUPABASE_ANON_KEY environment variable. ' +
    'Please set it in your .env file to initialize the Supabase client.'
  )
}

/**
 * Single Supabase browser client instance.
 * Configured with the anon key for public reads and user JWT for player-scoped reads.
 * Session is automatically persisted and tokens are refreshed on expiry.
 */
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default supabase
