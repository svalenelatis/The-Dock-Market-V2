import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'

/**
 * Shared navigation bar displayed on all pages (except auth/landing).
 *
 * Layout:
 *   LEFT  — Public links (always visible): Market
 *   RIGHT — Authenticated links (only when signed in): Dashboard, Ships, Transactions, Sign Out
 *           Admin link visible only to users with admin/super_admin role
 *
 * See .kiro/steering/navigation.md for the full navigation architecture decision.
 *
 * Validates: Requirements 1.3
 */
export default function NavBar() {
  const { session, user, signOut } = useAuth()
  const location = useLocation()
  const [isAdmin, setIsAdmin] = useState(false)

  // Check admin status for showing admin link
  useEffect(() => {
    if (!user || !session) {
      setIsAdmin(false)
      return
    }

    supabase
      .from('admin_users')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setIsAdmin(data.role === 'admin' || data.role === 'super_admin')
        } else {
          setIsAdmin(false)
        }
      })
  }, [user, session])

  function isActive(path) {
    return location.pathname === path
  }

  const linkBase = 'text-sm font-medium transition'
  const activeClass = 'text-blue-700 underline underline-offset-4'
  const inactiveClass = 'text-blue-600 hover:underline'

  return (
    <header className="bg-white shadow">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Left side — Public navigation */}
        <nav className="flex items-center gap-4">
          <Link to="/" className="text-lg font-bold text-gray-800 mr-4">
            Dock Market
          </Link>
          <Link
            to="/market"
            className={`${linkBase} ${isActive('/market') ? activeClass : inactiveClass}`}
          >
            Market
          </Link>
        </nav>

        {/* Right side — Authenticated navigation */}
        <nav className="flex items-center gap-4">
          {session ? (
            <>
              <Link
                to="/dashboard"
                className={`${linkBase} ${isActive('/dashboard') ? activeClass : inactiveClass}`}
              >
                Dashboard
              </Link>
              <Link
                to="/inventories"
                className={`${linkBase} ${isActive('/inventories') ? activeClass : inactiveClass}`}
              >
                Inventories
              </Link>
              <Link
                to="/transactions"
                className={`${linkBase} ${isActive('/transactions') ? activeClass : inactiveClass}`}
              >
                Transactions
              </Link>
              <Link
                to="/factories"
                className={`${linkBase} ${isActive('/factories') ? activeClass : inactiveClass}`}
              >
                Factories
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className={`${linkBase} ${isActive('/admin') ? activeClass : inactiveClass}`}
                >
                  Admin
                </Link>
              )}
              <button
                onClick={signOut}
                className="text-sm text-gray-500 hover:text-gray-700 ml-2"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className={`${linkBase} ${isActive('/auth') ? activeClass : inactiveClass}`}
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
