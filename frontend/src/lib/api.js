/**
 * Frontend API helper for communicating with the Express backend.
 * Prepends VITE_API_URL, sets Authorization header with Bearer token,
 * sets Content-Type to application/json, and handles error responses.
 */

const API_URL = import.meta.env.VITE_API_URL

/**
 * Makes an authenticated API call to the Express backend.
 *
 * @param {string} path - Relative path (e.g., '/api/transactions')
 * @param {object} [options] - Request options
 * @param {string} [options.method] - HTTP method (defaults to 'GET')
 * @param {object} [options.body] - Request body (will be JSON.stringified)
 * @param {string} [options.token] - Bearer token for Authorization header
 * @returns {Promise<object>} Parsed JSON response
 * @throws {Error} With message from API error response or generic network error
 */
export async function apiCall(path, options = {}) {
  const { method = 'GET', body, token } = options

  const headers = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const fetchOptions = {
    method,
    headers,
  }

  if (body) {
    fetchOptions.body = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(`${API_URL}${path}`, fetchOptions)
  } catch (err) {
    throw new Error('Network error — please try again')
  }

  if (!response.ok) {
    let errorMessage
    try {
      const errorData = await response.json()
      errorMessage = errorData.error || `Request failed with status ${response.status}`
    } catch {
      errorMessage = `Request failed with status ${response.status}`
    }
    throw new Error(errorMessage)
  }

  return response.json()
}
