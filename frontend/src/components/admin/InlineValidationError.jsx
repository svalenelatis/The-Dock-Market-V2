/**
 * Reusable inline validation error display component.
 * Renders adjacent to form fields that fail validation.
 *
 * Validates: Requirements 3.8, 5.5, 6.7, 9.5, 10.6, 13.5
 *
 * @param {{ error: string | null | undefined, className?: string }} props
 */
export default function InlineValidationError({ error, className = '' }) {
  if (!error) return null

  return (
    <p
      className={`mt-1 text-sm text-red-600 ${className}`.trim()}
      role="alert"
    >
      {error}
    </p>
  )
}
