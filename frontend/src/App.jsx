import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import router from './router'

/**
 * Root application component.
 * Wraps the entire app in AuthProvider so all routes have access to auth state.
 * Uses RouterProvider with the data router for React Router v6 pattern.
 * Validates: Requirements 4.4
 */
export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
