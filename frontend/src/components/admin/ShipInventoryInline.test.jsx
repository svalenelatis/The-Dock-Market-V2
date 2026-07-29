import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ShipInventoryInline from './ShipInventoryInline'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('ShipInventoryInline', () => {
  const ship = {
    id: 'ship-1',
    name: 'The Black Pearl',
    speed: 5,
    cargo_capacity: 100,
    status: 'READY',
  }

  const token = 'test-token-123'
  const onToggle = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    })
  })

  it('renders the ship header with name, speed, cargo, and status', () => {
    render(
      <ShipInventoryInline
        ship={ship}
        isExpanded={false}
        onToggle={onToggle}
        token={token}
      />
    )

    expect(screen.getByText('The Black Pearl')).toBeTruthy()
    expect(screen.getByText(/Speed: 5/)).toBeTruthy()
    expect(screen.getByText(/Cargo: 100/)).toBeTruthy()
    expect(screen.getByText(/Status: READY/)).toBeTruthy()
  })

  it('calls onToggle when the ship header is clicked', () => {
    render(
      <ShipInventoryInline
        ship={ship}
        isExpanded={false}
        onToggle={onToggle}
        token={token}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /The Black Pearl/ }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('does not show inventory panel when not expanded', () => {
    render(
      <ShipInventoryInline
        ship={ship}
        isExpanded={false}
        onToggle={onToggle}
        token={token}
      />
    )

    expect(screen.queryByText('Cargo:')).toBeNull()
  })

  it('fetches and displays inventory when expanded', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { item_name: 'Iron', quantity: 20 },
        { item_name: 'Gold', quantity: 5 },
      ],
    })

    render(
      <ShipInventoryInline
        ship={ship}
        isExpanded={true}
        onToggle={onToggle}
        token={token}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Iron')).toBeTruthy()
      expect(screen.getByText('Gold')).toBeTruthy()
    })

    // Check quantity display
    expect(screen.getByText('20')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('displays remaining capacity correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { item_name: 'Iron', quantity: 30 },
        { item_name: 'Wood', quantity: 20 },
      ],
    })

    render(
      <ShipInventoryInline
        ship={ship}
        isExpanded={true}
        onToggle={onToggle}
        token={token}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/50 \/ 100 used/)).toBeTruthy()
      expect(screen.getByText(/\(50 remaining\)/)).toBeTruthy()
    })
  })

  it('shows empty message when inventory is empty', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    render(
      <ShipInventoryInline
        ship={ship}
        isExpanded={true}
        onToggle={onToggle}
        token={token}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("No items in this ship's inventory.")).toBeTruthy()
    })
  })

  it('validates add form requires item name', async () => {
    render(
      <ShipInventoryInline
        ship={ship}
        isExpanded={true}
        onToggle={onToggle}
        token={token}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(screen.getByText('Item name is required')).toBeTruthy()
    })
  })

  it('validates add form rejects invalid quantity', async () => {
    render(
      <ShipInventoryInline
        ship={ship}
        isExpanded={true}
        onToggle={onToggle}
        token={token}
      />
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. Iron')).toBeTruthy()
    })

    const itemInput = screen.getByPlaceholderText('e.g. Iron')
    const qtyInput = screen.getByPlaceholderText('1')

    fireEvent.change(itemInput, { target: { value: 'Iron' } })
    fireEvent.change(qtyInput, { target: { value: '0' } })

    const addButton = screen.getByRole('button', { name: 'Add' })
    fireEvent.submit(addButton.closest('form'))

    await waitFor(() => {
      expect(screen.getByText('Quantity must be an integer between 1 and 99,999')).toBeTruthy()
    })
  })

  it('shows delete confirmation dialog when delete button is clicked', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ item_name: 'Iron', quantity: 10 }],
    })

    render(
      <ShipInventoryInline
        ship={ship}
        isExpanded={true}
        onToggle={onToggle}
        token={token}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Iron')).toBeTruthy()
    })

    fireEvent.click(screen.getByTitle('Delete item'))

    expect(screen.getByText('Delete Inventory Entry')).toBeTruthy()
    expect(
      screen.getByText(/Are you sure you want to remove "Iron" from The Black Pearl's inventory\?/)
    ).toBeTruthy()
  })

  it('enters edit mode when quantity is clicked', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ item_name: 'Iron', quantity: 10 }],
    })

    render(
      <ShipInventoryInline
        ship={ship}
        isExpanded={true}
        onToggle={onToggle}
        token={token}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('10')).toBeTruthy()
    })

    fireEvent.click(screen.getByTitle('Click to edit quantity'))

    // Should show save and cancel buttons
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })
})
