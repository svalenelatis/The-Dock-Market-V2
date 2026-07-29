import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'

/**
 * Fetches the current player's ships from Supabase using the user JWT.
 * Re-fetches when the authenticated user changes.
 * Returns null data when no user is authenticated.
 *
 * @returns {{ data: import('../../schemas/typedefs').Ship[]|null, loading: boolean, error: string|null, refetch: () => void }}
 *
 * Validates: Requirements 2.4, 2.5, 2.6, 2.7
 */
export function useShips() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchShips = useCallback(async () => {
    if (!user) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data: ships, error: fetchError } = await supabase
      .from('ships')
      .select('*')
      .eq('player_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setData(ships)
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchShips()
  }, [fetchShips])

  return { data, loading, error, refetch: fetchShips }
}
