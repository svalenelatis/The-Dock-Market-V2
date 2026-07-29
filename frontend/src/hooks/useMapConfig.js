import { useState, useEffect, useCallback } from 'react'
import supabase from '../lib/supabase'

const DEFAULT_CONFIG = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }

/**
 * Fetches the single map_config row from Supabase.
 * Maps snake_case columns to camelCase and falls back to default bounds
 * if no row exists.
 *
 * @returns {{ data: { xMin: number, xMax: number, yMin: number, yMax: number }|null, loading: boolean, error: string|null, refetch: () => void }}
 *
 * Validates: Requirements 7.1, 7.2
 */
export function useMapConfig() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMapConfig = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: rows, error: fetchError } = await supabase
      .from('map_config')
      .select('*')
      .limit(1)

    if (fetchError) {
      setError(fetchError.message)
    } else if (!rows || rows.length === 0) {
      setData(DEFAULT_CONFIG)
    } else {
      const row = rows[0]
      setData({
        xMin: row.x_min,
        xMax: row.x_max,
        yMin: row.y_min,
        yMax: row.y_max,
      })
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchMapConfig()
  }, [fetchMapConfig])

  return { data, loading, error, refetch: fetchMapConfig }
}
