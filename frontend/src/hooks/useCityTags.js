import { useState, useEffect, useCallback } from 'react'
import supabase from '../lib/supabase'

/**
 * Fetches all city tags from Supabase using the anon key (public data).
 * No authentication required.
 *
 * @returns {{ data: import('../../schemas/typedefs').CityTag[]|null, loading: boolean, error: string|null, refetch: () => void }}
 *
 * Validates: Requirements 2.3, 2.5, 2.6
 */
export function useCityTags() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCityTags = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: cityTags, error: fetchError } = await supabase
      .from('city_tags')
      .select('*')
      .order('name')

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setData(cityTags)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCityTags()
  }, [fetchCityTags])

  return { data, loading, error, refetch: fetchCityTags }
}
