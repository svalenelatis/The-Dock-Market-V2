import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import InlineValidationError from './InlineValidationError'

describe('InlineValidationError', () => {
  it('renders nothing when error is null', () => {
    const { container } = render(<InlineValidationError error={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when error is undefined', () => {
    const { container } = render(<InlineValidationError error={undefined} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when error is an empty string', () => {
    const { container } = render(<InlineValidationError error="" />)
    expect(container.innerHTML).toBe('')
  })

  it('renders error message when error is provided', () => {
    render(<InlineValidationError error="Gold must be between 0 and 999,999,999" />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('Gold must be between 0 and 999,999,999')
  })

  it('applies default Tailwind classes', () => {
    render(<InlineValidationError error="Invalid value" />)
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('mt-1')
    expect(alert.className).toContain('text-sm')
    expect(alert.className).toContain('text-red-600')
  })

  it('appends additional className when provided', () => {
    render(<InlineValidationError error="Invalid value" className="mb-2" />)
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('mb-2')
    expect(alert.className).toContain('text-red-600')
  })

  it('has role="alert" for accessibility', () => {
    render(<InlineValidationError error="Required field" />)
    expect(screen.getByRole('alert')).toBeTruthy()
  })
})
