import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'

/**
 * Hook to fetch the current player's profile from Supabase.
 * Returns null data when no user is authenticated.
 * @returns {{ data: object|null, loading: boolean, error: string|null, refetch: Function }}
 */
export function usePlayer() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    if (!user) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data: player, error: fetchError } = await supabase
        .from('players')
        .select('*')
        .eq('id', user.id)
        .single()

      if (fetchError) throw fetchError
      setData(player)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

/**
 * Hook to fetch the current player's inventory from Supabase.
 * Returns null data when no user is authenticated.
 * @returns {{ data: Array|null, loading: boolean, error: string|null, refetch: Function }}
 */
export function usePlayerInventory() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    if (!user) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data: inventory, error: fetchError } = await supabase
        .from('player_inventories')
        .select('*, items(name)')
        .eq('player_id', user.id)

      if (fetchError) throw fetchError
      setData(inventory || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

/**
 * Hook to fetch the current player's ships from Supabase.
 * Returns null data when no user is authenticated.
 * @returns {{ data: Array|null, loading: boolean, error: string|null, refetch: Function }}
 */
export function useShips() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    if (!user) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data: ships, error: fetchError } = await supabase
        .from('ships')
        .select('*')
        .eq('player_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setData(ships || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

/**
 * Hook to fetch the current player's transactions from Supabase.
 * Returns null data when no user is authenticated.
 * @returns {{ data: Array|null, loading: boolean, error: string|null, refetch: Function }}
 */
export function useTransactions() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    if (!user) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data: transactions, error: fetchError } = await supabase
        .from('transactions')
        .select('*, ships(name), cities!transactions_target_city_id_fkey(name)')
        .eq('player_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (fetchError) throw fetchError
      setData(transactions || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
