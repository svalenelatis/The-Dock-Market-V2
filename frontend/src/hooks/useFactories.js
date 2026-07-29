import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'

/**
 * Fetches the current player's factories from Supabase using the user JWT.
 * Re-fetches when the authenticated user changes.
 * Returns null data when no user is authenticated.
 *
 * @returns {{ data: Array|null, loading: boolean, error: string|null, refetch: () => void }}
 */
export function useFactories() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchFactories = useCallback(async () => {
    if (!user) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data: factories, error: fetchError } = await supabase
      .from('factories')
      .select('*')
      .eq('player_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setData(factories)
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchFactories()
  }, [fetchFactories])

  return { data, loading, error, refetch: fetchFactories }
}
