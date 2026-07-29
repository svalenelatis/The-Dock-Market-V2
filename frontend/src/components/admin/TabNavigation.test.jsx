import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TabNavigation from './TabNavigation'

const TABS = [
  { id: 'player-search', label: 'Player Search' },
  { id: 'game-control', label: 'Game Control' },
  { id: 'game-objects', label: 'Game Objects' },
  { id: 'configuration', label: 'Configuration' },
]

describe('TabNavigation', () => {
  it('renders a button for each tab', () => {
    render(<TabNavigation tabs={TABS} activeTab="player-search" onTabChange={() => {}} />)

    TABS.forEach((tab) => {
      expect(screen.getByRole('button', { name: tab.label })).not.toBeNull()
    })
  })

  it('highlights the active tab with distinct styling', () => {
    render(<TabNavigation tabs={TABS} activeTab="game-control" onTabChange={() => {}} />)

    const activeButton = screen.getByRole('button', { name: 'Game Control' })
    expect(activeButton.className).toContain('bg-blue-600')
    expect(activeButton.className).toContain('text-white')

    const inactiveButton = screen.getByRole('button', { name: 'Player Search' })
    expect(inactiveButton.className).toContain('bg-white')
    expect(inactiveButton.className).toContain('text-gray-600')
  })

  it('calls onTabChange with the tab id when clicked', () => {
    const onTabChange = vi.fn()
    render(<TabNavigation tabs={TABS} activeTab="player-search" onTabChange={onTabChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Configuration' }))

    expect(onTabChange).toHaveBeenCalledWith('configuration')
  })

  it('renders with an empty tabs array without error', () => {
    render(<TabNavigation tabs={[]} activeTab="" onTabChange={() => {}} />)

    expect(screen.queryByRole('button')).toBeNull()
  })
})
