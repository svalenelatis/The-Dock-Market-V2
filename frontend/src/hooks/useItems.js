import { useState, useEffect, useCallback } from 'react'
import supabase from '../lib/supabase'

/**
 * Fetches all items from Supabase using the anon key (public data).
 * No authentication required.
 *
 * @returns {{ data: import('../../schemas/typedefs').Item[]|null, loading: boolean, error: string|null, refetch: () => void }}
 *
 * Validates: Requirements 2.3, 2.5, 2.6
 */
export function useItems() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: items, error: fetchError } = await supabase
      .from('items')
      .select('*')
      .order('name')

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setData(items)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  return { data, loading, error, refetch: fetchItems }
}
