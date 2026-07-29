import { Outlet } from 'react-router-dom'
import NavBar from './NavBar'

/**
 * Shared layout wrapper that renders the NavBar and page content.
 * Used as a layout route in the router so all child routes get the nav bar.
 */
export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-100">
      <NavBar />
      <Outlet />
    </div>
  )
}
