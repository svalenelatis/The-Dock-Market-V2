import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'

/**
 * Fetches the current player's transaction history from Supabase using the user JWT.
 * Returns the most recent 50 transactions ordered by creation date descending.
 * Re-fetches when the authenticated user changes.
 * Returns null data when no user is authenticated.
 *
 * @param {{ limit?: number }} [options] - Optional configuration
 * @returns {{ data: import('../../schemas/typedefs').Transaction[]|null, loading: boolean, error: string|null, refetch: () => void }}
 *
 * Validates: Requirements 2.4, 2.5, 2.6, 2.7
 */
export function useTransactions(options = {}) {
  const { limit = 50 } = options
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchTransactions = useCallback(async () => {
    if (!user) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('player_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setData(transactions)
    }

    setLoading(false)
  }, [user, limit])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  return { data, loading, error, refetch: fetchTransactions }
}
