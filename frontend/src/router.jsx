import { createBrowserRouter } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import VerifyEmail from './pages/VerifyEmail'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Market from './pages/Market'
import Inventories from './pages/Inventories'
import Transactions from './pages/Transactions'
import Factories from './pages/Factories'
import Admin from './pages/Admin'

/**
 * Application router using React Router v6 Data Router pattern.
 *
 * Navigation architecture:
 *   - Landing, Auth, and VerifyEmail are standalone (no nav bar).
 *   - All other pages use the Layout wrapper which renders the shared NavBar.
 *   - See .kiro/steering/navigation.md for the full pattern.
 *
 * Validates: Requirements 1.5, 4.1, 4.4, 4.5
 */
const router = createBrowserRouter([
  // Standalone pages (no shared nav)
  {
    path: '/',
    element: <Landing />,
  },
  {
    path: '/auth',
    element: <Auth />,
  },
  {
    path: '/verify-email',
    element: <VerifyEmail />,
  },

  // Onboarding flow (standalone, no nav — requires auth but not completed onboarding)
  {
    path: '/onboarding',
    element: <Onboarding />,
  },

  // Pages with shared NavBar layout
  {
    element: <Layout />,
    children: [
      {
        path: '/dashboard',
        element: (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: '/market',
        element: <Market />,
      },
      {
        path: '/inventories',
        element: (
          <ProtectedRoute>
            <Inventories />
          </ProtectedRoute>
        ),
      },
      {
        path: '/transactions',
        element: (
          <ProtectedRoute>
            <Transactions />
          </ProtectedRoute>
        ),
      },
      {
        path: '/factories',
        element: (
          <ProtectedRoute>
            <Factories />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin',
        element: (
          <AdminRoute>
            <Admin />
          </AdminRoute>
        ),
      },
    ],
  },
])

export default router
