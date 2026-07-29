import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'

/**
 * Route guard component that protects admin-only content.
 *
 * - Shows a loading indicator while admin status is being checked
 * - Redirects to /dashboard if the user does not have admin privileges
 * - Redirects to /auth if the user is not authenticated
 * - Displays an error message if admin verification fails due to network/server error
 * - Renders children when the user has an 'admin' or 'super_admin' role
 *
 * Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export default function AdminRoute({ children }) {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [verificationError, setVerificationError] = useState(null)

  useEffect(() => {
    async function checkAdminStatus() {
      if (!user) {
        setIsAdmin(false)
        setChecking(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('role')
          .eq('id', user.id)
          .single()

        if (error) {
          // Distinguish between "not found" (user is not an admin) and network/server errors
          if (error.code === 'PGRST116') {
            // PGRST116 = "JSON object requested, multiple (or no) rows returned"
            // This means no admin_users row exists for this user — not an admin
            setIsAdmin(false)
          } else {
            // Network or server error — deny access with error message
            setVerificationError('Admin verification could not be completed. Please try again later.')
            setIsAdmin(false)
          }
        } else if (!data) {
          setIsAdmin(false)
        } else {
          setIsAdmin(data.role === 'admin' || data.role === 'super_admin')
        }
      } catch (err) {
        // Network failure (e.g., offline, timeout)
        setVerificationError('Admin verification could not be completed. Please check your connection and try again.')
        setIsAdmin(false)
      }

      setChecking(false)
    }

    if (!authLoading) {
      checkAdminStatus()
    }
  }, [user, authLoading])

  if (authLoading || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  if (verificationError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg max-w-md text-center">
          <p className="font-medium mb-2">Access Denied</p>
          <p className="text-sm">{verificationError}</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
