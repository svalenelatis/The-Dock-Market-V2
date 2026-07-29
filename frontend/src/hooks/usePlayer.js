import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'

/**
 * Fetches the current player's data from Supabase using the user JWT.
 * Re-fetches when the authenticated user changes.
 * Returns null data when no user is authenticated.
 *
 * @returns {{ data: import('../../schemas/typedefs').Player|null, loading: boolean, error: string|null, refetch: () => void }}
 *
 * Validates: Requirements 2.4, 2.5, 2.6, 2.7
 */
export function usePlayer() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPlayer = useCallback(async () => {
    if (!user) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select('*')
      .eq('id', user.id)
      .single()

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setData(player)
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchPlayer()
  }, [fetchPlayer])

  return { data, loading, error, refetch: fetchPlayer }
}
