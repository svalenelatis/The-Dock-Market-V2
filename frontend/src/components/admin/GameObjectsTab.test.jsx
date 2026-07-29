import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GameObjectsTab from './GameObjectsTab'

// Mock child components to isolate GameObjectsTab logic
vi.mock('./ItemsManager', () => ({
  default: ({ token }) => <div data-testid="items-manager">ItemsManager:{token}</div>,
}))
vi.mock('./CitiesManager', () => ({
  default: ({ token }) => <div data-testid="cities-manager">CitiesManager:{token}</div>,
}))
vi.mock('./TagsManager', () => ({
  default: ({ token }) => <div data-testid="tags-manager">TagsManager:{token}</div>,
}))

describe('GameObjectsTab', () => {
  it('renders the Game Objects heading', () => {
    render(<GameObjectsTab token="test-token" />)
    expect(screen.getByText('Game Objects')).not.toBeNull()
  })

  it('renders sub-tab buttons for Items, Cities, and Tags', () => {
    render(<GameObjectsTab token="test-token" />)
    expect(screen.getByRole('button', { name: 'Items' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Cities' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Tags' })).not.toBeNull()
  })

  it('defaults to showing the Items section', () => {
    render(<GameObjectsTab token="test-token" />)
    expect(screen.getByTestId('items-manager')).not.toBeNull()
  })

  it('passes token prop to ItemsManager', () => {
    render(<GameObjectsTab token="my-auth-token" />)
    expect(screen.getByTestId('items-manager').textContent).toContain('my-auth-token')
  })

  it('switches to Cities section when Cities sub-tab is clicked', () => {
    render(<GameObjectsTab token="test-token" />)
    fireEvent.click(screen.getByRole('button', { name: 'Cities' }))
    expect(screen.getByTestId('cities-manager')).not.toBeNull()
    expect(screen.queryByTestId('items-manager')).toBeNull()
  })

  it('switches to Tags section when Tags sub-tab is clicked', () => {
    render(<GameObjectsTab token="test-token" />)
    fireEvent.click(screen.getByRole('button', { name: 'Tags' }))
    expect(screen.getByTestId('tags-manager')).not.toBeNull()
    expect(screen.queryByTestId('items-manager')).toBeNull()
  })

  it('highlights active sub-tab with distinct styling', () => {
    render(<GameObjectsTab token="test-token" />)
    const itemsBtn = screen.getByRole('button', { name: 'Items' })
    const citiesBtn = screen.getByRole('button', { name: 'Cities' })

    // Items is active by default
    expect(itemsBtn.className).toContain('bg-blue-100')
    expect(citiesBtn.className).not.toContain('bg-blue-100')

    // Switch to Cities
    fireEvent.click(citiesBtn)
    expect(citiesBtn.className).toContain('bg-blue-100')
    expect(itemsBtn.className).not.toContain('bg-blue-100')
  })
})
