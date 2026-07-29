import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiCall } from '../lib/api'

/**
 * Checks if the current player has completed onboarding.
 * Used by ProtectedRoute to redirect new players to the onboarding flow.
 *
 * @returns {{ onboardingComplete: boolean|null, playerExists: boolean|null, loading: boolean, error: string|null, refetch: () => void }}
 */
export function useOnboardingStatus() {
  const { session } = useAuth()
  const [onboardingComplete, setOnboardingComplete] = useState(null)
  const [playerExists, setPlayerExists] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchStatus = useCallback(async () => {
    if (!session?.access_token) {
      setOnboardingComplete(null)
      setPlayerExists(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await apiCall('/api/onboarding/status', {
        token: session.access_token,
      })
      setOnboardingComplete(data.onboarding_complete)
      setPlayerExists(data.player_exists)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  return { onboardingComplete, playerExists, loading, error, refetch: fetchStatus }
}
