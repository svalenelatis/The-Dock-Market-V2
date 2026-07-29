import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useOnboardingStatus } from '../hooks/useOnboardingStatus'

/**
 * Route guard component that protects child content from unauthenticated access
 * and redirects new players to the onboarding flow.
 *
 * - Shows a loading indicator while auth/onboarding state is being determined
 * - Redirects to /auth if no active session exists
 * - Redirects to /onboarding if player hasn't completed onboarding
 * - Renders children when a valid session is present and onboarding is done
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export default function ProtectedRoute({ children }) {
  const { session, loading: authLoading } = useAuth()
  const { onboardingComplete, playerExists, loading: onboardingLoading } = useOnboardingStatus()

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/auth" replace />
  }

  if (onboardingLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  // If player exists but hasn't completed onboarding, send them there
  if (playerExists && onboardingComplete === false) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
