import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MapConfigForm from './MapConfigForm'

// Mock the supabase client
vi.mock('../../lib/supabase', () => ({
  default: {
    from: vi.fn(() => ({
      upsert: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [{}], error: null })),
      })),
    })),
  },
}))

describe('MapConfigForm', () => {
  const defaultConfig = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }
  let onSave

  beforeEach(() => {
    onSave = vi.fn().mockResolvedValue(undefined)
  })

  it('displays current config values in editable inputs', () => {
    render(<MapConfigForm currentConfig={defaultConfig} onSave={onSave} />)

    expect(screen.getByLabelText('xMin').value).toBe('-5')
    expect(screen.getByLabelText('xMax').value).toBe('5')
    expect(screen.getByLabelText('yMin').value).toBe('-5')
    expect(screen.getByLabelText('yMax').value).toBe('5')
  })

  it('shows error when xMin >= xMax', async () => {
    render(<MapConfigForm currentConfig={{ xMin: 10, xMax: 5, yMin: -5, yMax: 5 }} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: /save bounds/i }))

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toBe('xMin must be less than xMax')
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows error when yMin >= yMax', async () => {
    render(<MapConfigForm currentConfig={{ xMin: -5, xMax: 5, yMin: 10, yMax: 5 }} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: /save bounds/i }))

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toBe('yMin must be less than yMax')
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows error when xMin equals xMax', async () => {
    render(<MapConfigForm currentConfig={{ xMin: 5, xMax: 5, yMin: -5, yMax: 5 }} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: /save bounds/i }))

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toBe('xMin must be less than xMax')
    })
  })

  it('form remains editable after validation error', async () => {
    render(<MapConfigForm currentConfig={{ xMin: 10, xMax: 5, yMin: -5, yMax: 5 }} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: /save bounds/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).not.toBeNull()
    })

    // Inputs should still be editable
    const xMinInput = screen.getByLabelText('xMin')
    expect(xMinInput.disabled).toBe(false)
    fireEvent.change(xMinInput, { target: { value: '-5' } })
    expect(xMinInput.value).toBe('-5')
  })

  it('calls onSave with valid config on successful submit', async () => {
    render(<MapConfigForm currentConfig={defaultConfig} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: /save bounds/i }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 })
    })
  })

  it('shows success message after save', async () => {
    render(<MapConfigForm currentConfig={defaultConfig} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: /save bounds/i }))

    await waitFor(() => {
      const status = screen.getByRole('status')
      expect(status.textContent).toBe('Map configuration saved successfully.')
    })
  })

  it('shows saving state while submitting', async () => {
    // Make onSave hang so we can check loading state
    onSave = vi.fn(() => new Promise(() => {}))
    render(<MapConfigForm currentConfig={defaultConfig} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: /save bounds/i }))

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /saving/i })
      expect(button.disabled).toBe(true)
    })
  })

  it('accepts finite floating-point ranges', async () => {
    const config = { xMin: -100.5, xMax: 100.5, yMin: -200.75, yMax: 200.75 }
    render(<MapConfigForm currentConfig={config} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: /save bounds/i }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(config)
    })
  })
})
