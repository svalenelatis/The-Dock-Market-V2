import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'

// Mock the useAuth hook
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

// Mock the useOnboardingStatus hook
vi.mock('../hooks/useOnboardingStatus', () => ({
  useOnboardingStatus: vi.fn(),
}))

import { useAuth } from '../contexts/AuthContext'
import { useOnboardingStatus } from '../hooks/useOnboardingStatus'

function renderWithRouter(ui, { route = '/' } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>)
}

describe('ProtectedRoute', () => {
  it('shows loading indicator while auth is loading', () => {
    useAuth.mockReturnValue({ session: null, loading: true })
    useOnboardingStatus.mockReturnValue({ onboardingComplete: false, playerExists: false, loading: true })

    const { container } = renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    )

    // Should show spinner, not content
    expect(screen.queryByText('Protected Content')).toBeNull()
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })

  it('redirects to /auth when no session exists', () => {
    useAuth.mockReturnValue({ session: null, loading: false })
    useOnboardingStatus.mockReturnValue({ onboardingComplete: false, playerExists: false, loading: false })

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    )

    // Should not render children
    expect(screen.queryByText('Protected Content')).toBeNull()
  })

  it('renders children when session exists', () => {
    useAuth.mockReturnValue({
      session: { access_token: 'abc', user: { id: '123' } },
      loading: false,
    })
    useOnboardingStatus.mockReturnValue({ onboardingComplete: true, playerExists: true, loading: false })

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    )

    expect(screen.getByText('Protected Content')).not.toBeNull()
  })
})
