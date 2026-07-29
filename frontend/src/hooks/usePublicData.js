import { useState, useEffect, useCallback } from 'react'
import supabase from '../lib/supabase'

/**
 * Hook to fetch all cities from Supabase (public, no auth required).
 * @returns {{ data: Array, loading: boolean, error: string|null, refetch: Function }}
 */
export function useCities() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: cities, error: fetchError } = await supabase
        .from('cities')
        .select('*')
        .order('name')

      if (fetchError) throw fetchError
      setData(cities || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

/**
 * Hook to fetch all items from Supabase (public, no auth required).
 * @returns {{ data: Array, loading: boolean, error: string|null, refetch: Function }}
 */
export function useItems() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: items, error: fetchError } = await supabase
        .from('items')
        .select('*')
        .order('name')

      if (fetchError) throw fetchError
      setData(items || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

/**
 * Hook to fetch all city tags from Supabase (public, no auth required).
 * @returns {{ data: Array, loading: boolean, error: string|null, refetch: Function }}
 */
export function useCityTags() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: tags, error: fetchError } = await supabase
        .from('city_tags')
        .select('*')
        .order('name')

      if (fetchError) throw fetchError
      setData(tags || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

/**
 * Hook to fetch all active event (temporary) tag assignments from Supabase (public, no auth required).
 * @returns {{ data: Array, loading: boolean, error: string|null, refetch: Function }}
 */
export function useRandomEvents() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: assignments, error: fetchError } = await supabase
        .from('city_tag_assignments')
        .select('id, city_id, tag_id, expires_at, active, assigned_at, cities(name), city_tags(name, description)')
        .eq('is_permanent', false)
        .eq('active', true)
        .order('assigned_at', { ascending: false })

      if (fetchError) throw fetchError
      setData(assignments || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
