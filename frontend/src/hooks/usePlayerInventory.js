import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'

/**
 * Fetches the current player's inventory from Supabase using the user JWT.
 * Includes joined item names. Re-fetches when the authenticated user changes.
 * Returns null data when no user is authenticated.
 *
 * @returns {{ data: Array|null, loading: boolean, error: string|null, refetch: () => void }}
 *
 * Validates: Requirements 2.4, 2.5, 2.6, 2.7
 */
export function usePlayerInventory() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchInventory = useCallback(async () => {
    if (!user) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data: inventory, error: fetchError } = await supabase
      .from('player_inventories')
      .select('*, items(name)')
      .eq('player_id', user.id)

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setData(inventory)
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  return { data, loading, error, refetch: fetchInventory }
}
