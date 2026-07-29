import { useEffect, useRef, useCallback } from 'react'
import { formatCurrency, sortPriceEntries } from '../../lib/formatters'

/**
 * Modal dialog showing a city's price sheet.
 * Implements focus trapping, Escape key close, and backdrop click close.
 *
 * @param {{ cityName: string, prices: Array<{itemName: string, price: number}>, onClose: () => void }} props
 */
export default function PriceModal({ cityName, prices, onClose }) {
  const modalRef = useRef(null)
  const closeButtonRef = useRef(null)
  const titleId = 'price-modal-title'

  // Sort prices alphabetically by item name
  const sortedPrices = sortPriceEntries(prices)

  // Focus close button on mount
  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Focus trap: Tab cycles within modal
  const handleKeyDown = useCallback((e) => {
    if (e.key !== 'Tab') return

    const modal = modalRef.current
    if (!modal) return

    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (e.shiftKey) {
      // Shift+Tab: if on first element, wrap to last
      if (document.activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
      }
    } else {
      // Tab: if on last element, wrap to first
      if (document.activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
      }
    }
  }, [])

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      aria-hidden="true"
    >
      {/* Modal panel */}
      <div
        ref={modalRef}
        role="dialog"
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative mx-4 w-full max-w-2xl rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-gray-900">
            {cityName}
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Price list — two-column grid to show all items without scrolling */}
        <div className="px-6 py-4">
          {sortedPrices.length === 0 ? (
            <p className="text-gray-500">No prices available for this city.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
              {sortedPrices.map((entry) => (
                <li
                  key={entry.itemName}
                  className="flex items-center justify-between py-1"
                >
                  <span className="text-sm text-gray-800">{entry.itemName}</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(entry.price)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
