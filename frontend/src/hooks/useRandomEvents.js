import { useState, useEffect, useCallback } from 'react'
import supabase from '../lib/supabase'

/**
 * Fetches all active temporary (event) tag assignments from Supabase.
 * No authentication required — public market data.
 *
 * @returns {{ data: import('../../schemas/typedefs').CityTagAssignment[]|null, loading: boolean, error: string|null, refetch: () => void }}
 */
export function useRandomEvents() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: assignments, error: fetchError } = await supabase
      .from('city_tag_assignments')
      .select('id, city_id, tag_id, expires_at, active, assigned_at, cities(name), city_tags(name, description)')
      .eq('is_permanent', false)
      .eq('active', true)
      .order('assigned_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setData(assignments)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  return { data, loading, error, refetch: fetchEvents }
}
