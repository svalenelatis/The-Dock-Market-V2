import { useState, useEffect, useCallback } from 'react'
import supabase from '../lib/supabase'

/**
 * Fetches all cities from Supabase using the anon key (public data).
 * No authentication required.
 *
 * @returns {{ data: import('../../schemas/typedefs').City[]|null, loading: boolean, error: string|null, refetch: () => void }}
 *
 * Validates: Requirements 2.3, 2.5, 2.6
 */
export function useCities() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCities = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: cities, error: fetchError } = await supabase
      .from('cities')
      .select('*')
      .order('name')

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setData(cities)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCities()
  }, [fetchCities])

  return { data, loading, error, refetch: fetchCities }
}
