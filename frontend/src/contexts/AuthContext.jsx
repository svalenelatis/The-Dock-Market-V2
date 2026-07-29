import { createContext, useContext, useState, useEffect } from 'react'
import supabase from '../lib/supabase'

const AuthContext = createContext(undefined)

/**
 * Provides: { user, session, loading, signIn, signUp, signOut }
 *
 * - Subscribes to onAuthStateChange on mount
 * - Updates user/session on SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED
 * - signIn/signUp/signOut delegate to supabase.auth methods
 * - Does NOT create player records or ships on signup
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get the initial session on mount
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      setLoading(false)
    })

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (
          event === 'SIGNED_IN' ||
          event === 'SIGNED_OUT' ||
          event === 'TOKEN_REFRESHED'
        ) {
          setSession(currentSession)
          setUser(currentSession?.user ?? null)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  /**
   * Signs in with email and password.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ data: object|null, error: object|null }>}
   */
  async function signIn(email, password) {
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)
    if (error) {
      return { data: null, error: { message: error.message } }
    }
    return { data, error: null }
  }

  /**
   * Signs up with email and password.
   * Does NOT create player records or ships — that is handled by a database trigger.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ data: object|null, error: object|null }>}
   */
  async function signUp(email, password) {
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    setLoading(false)
    if (error) {
      return { data: null, error: { message: error.message } }
    }
    return { data, error: null }
  }

  /**
   * Signs out the current user.
   * @returns {Promise<{ error: object|null }>}
   */
  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      return { error: { message: error.message } }
    }
    return { error: null }
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to access auth context. Must be used within an AuthProvider.
 * @returns {{ user: object|null, session: object|null, loading: boolean, signIn: Function, signUp: Function, signOut: Function }}
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
