import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PriceModal from './PriceModal'

const defaultPrices = [
  { itemName: 'Iron', price: 25 },
  { itemName: 'Wheat', price: 3.5 },
  { itemName: 'Copper', price: 12.99 },
]

function renderModal(props = {}) {
  const defaults = {
    cityName: 'Port Aldwick',
    prices: defaultPrices,
    onClose: vi.fn(),
  }
  const merged = { ...defaults, ...props }
  const result = render(<PriceModal {...merged} />)
  return { ...result, onClose: merged.onClose }
}

describe('PriceModal', () => {
  // Requirement 4.1 — city name as modal title
  it('renders city name as the modal title', () => {
    renderModal({ cityName: 'Starfall Harbor' })
    const heading = screen.getByRole('heading', { name: 'Starfall Harbor', hidden: true })
    expect(heading).not.toBeNull()
    expect(heading.tagName).toBe('H2')
  })

  // Requirement 4.9 — role="dialog" and aria-labelledby
  it('has role="dialog" attribute', () => {
    renderModal()
    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(dialog).not.toBeNull()
  })

  it('has aria-labelledby pointing to the title element', () => {
    renderModal({ cityName: 'Port Aldwick' })
    const dialog = screen.getByRole('dialog', { hidden: true })
    const labelledById = dialog.getAttribute('aria-labelledby')
    expect(labelledById).toBe('price-modal-title')
    const title = document.getElementById(labelledById)
    expect(title.textContent).toBe('Port Aldwick')
  })

  it('has aria-modal="true"', () => {
    renderModal()
    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  // Requirement 4.6 — close button click
  it('calls onClose when close button is clicked', () => {
    const { onClose } = renderModal()
    const closeButton = screen.getByRole('button', { name: /close/i, hidden: true })
    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // Requirement 4.7 — backdrop click closes modal
  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <PriceModal cityName="TestCity" prices={defaultPrices} onClose={onClose} />
    )
    // The backdrop is the outermost div (parent of the dialog)
    const backdrop = container.firstChild
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when modal content is clicked', () => {
    const onClose = vi.fn()
    render(
      <PriceModal cityName="TestCity" prices={defaultPrices} onClose={onClose} />
    )
    const dialog = screen.getByRole('dialog', { hidden: true })
    fireEvent.click(dialog)
    expect(onClose).not.toHaveBeenCalled()
  })

  // Requirement 4.7 — Escape key closes modal
  it('calls onClose when Escape key is pressed', () => {
    const { onClose } = renderModal()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // Requirement 4.10 — focus moves to close button on mount
  it('focuses the close button on mount', () => {
    renderModal()
    const closeButton = screen.getByRole('button', { name: /close/i, hidden: true })
    expect(document.activeElement).toBe(closeButton)
  })

  // Requirement 4.10 — focus trapping
  it('traps focus: Tab on last focusable element wraps to first', () => {
    renderModal()
    const dialog = screen.getByRole('dialog', { hidden: true })
    const closeButton = screen.getByRole('button', { name: /close/i, hidden: true })

    // The close button is the only focusable element, so Tab should wrap to itself
    closeButton.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false })
    expect(document.activeElement).toBe(closeButton)
  })

  it('traps focus: Shift+Tab on first focusable element wraps to last', () => {
    renderModal()
    const dialog = screen.getByRole('dialog', { hidden: true })
    const closeButton = screen.getByRole('button', { name: /close/i, hidden: true })

    // The close button is both first and last focusable element
    closeButton.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(closeButton)
  })

  // Prices display with correct formatting
  it('displays prices sorted alphabetically with currency formatting', () => {
    renderModal()
    const items = screen.getAllByRole('listitem', { hidden: true })
    // Sorted: Copper, Iron, Wheat
    expect(items[0].textContent).toContain('Copper')
    expect(items[0].textContent).toContain('$12.99')
    expect(items[1].textContent).toContain('Iron')
    expect(items[1].textContent).toContain('$25.00')
    expect(items[2].textContent).toContain('Wheat')
    expect(items[2].textContent).toContain('$3.50')
  })

  // Empty state
  it('shows "No prices available" message when prices array is empty', () => {
    renderModal({ prices: [] })
    expect(screen.getByText('No prices available for this city.')).not.toBeNull()
  })
})
