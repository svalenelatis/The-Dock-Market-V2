const { createClient } = require('@supabase/supabase-js')

/**
 * Service Role Client (global singleton).
 * Used for privileged operations that bypass RLS: admin writes, system tasks,
 * and any query that shouldn't be scoped to a single user.
 *
 * NEVER expose this client to the frontend or pass it to user-facing code paths.
 */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

/**
 * Creates a Supabase client scoped to a specific user's JWT.
 * Used in auth middleware to verify tokens via getClaims() and can also be
 * used in route handlers for user-scoped RLS queries.
 *
 * @param {string} jwt - The user's access token from the Authorization header
 * @returns {import('@supabase/supabase-js').SupabaseClient} A client scoped to this user
 */
function createUserClient(jwt) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: { Authorization: `Bearer ${jwt}` }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

module.exports = supabase
module.exports.createUserClient = createUserClient
