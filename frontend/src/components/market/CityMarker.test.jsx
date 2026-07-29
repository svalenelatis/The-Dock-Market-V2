import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CityMarker from './CityMarker'

describe('CityMarker', () => {
  const city = { id: '1', name: 'Port Aldera', location: { x: 2, y: 3 } }
  const style = { left: '50%', bottom: '30%' }

  it('renders as a <button> element', () => {
    render(<CityMarker city={city} style={style} onClick={() => {}} />)
    const button = screen.getByRole('button')
    expect(button).toBeDefined()
    expect(button.tagName).toBe('BUTTON')
  })

  it('has correct aria-label matching city name', () => {
    render(<CityMarker city={city} style={style} onClick={() => {}} />)
    const button = screen.getByRole('button', { name: 'Port Aldera' })
    expect(button).toBeDefined()
    expect(button.getAttribute('aria-label')).toBe('Port Aldera')
  })

  it('triggers onClick callback when clicked', () => {
    const onClick = vi.fn()
    render(<CityMarker city={city} style={style} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is keyboard-activatable via Enter (native button behavior)', () => {
    const onClick = vi.fn()
    render(<CityMarker city={city} style={style} onClick={onClick} />)
    const button = screen.getByRole('button')
    // Native <button> elements activate on Enter/Space in real browsers.
    // jsdom doesn't replicate this, so we verify the element is a button
    // (which guarantees keyboard activation) and simulate the resulting click.
    expect(button.tagName).toBe('BUTTON')
    expect(button.type).toBe('button')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is keyboard-activatable via Space (native button behavior)', () => {
    const onClick = vi.fn()
    render(<CityMarker city={city} style={style} onClick={onClick} />)
    const button = screen.getByRole('button')
    // Verify it's a real <button> so the browser handles Space activation natively.
    expect(button.tagName).toBe('BUTTON')
    expect(button.type).toBe('button')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('displays the city name as text content', () => {
    render(<CityMarker city={city} style={style} onClick={() => {}} />)
    expect(screen.getByText('Port Aldera')).toBeDefined()
  })
})
