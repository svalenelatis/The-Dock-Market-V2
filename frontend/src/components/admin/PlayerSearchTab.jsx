import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiCall } from '../../lib/api'
import PlayerDetailPanel from './PlayerDetailPanel'

/**
 * Player search tab for the admin panel.
 * Provides text search (2+ chars), dropdown results (max 10),
 * toggle for including archived players, and loads full player details on select.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.7
 */
export default function PlayerSearchTab() {
  const { session } = useAuth()
  const [query, setQuery] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [hasSearched, setHasSearched] = useState(false)

  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [loadingPlayer, setLoadingPlayer] = useState(false)
  const [playerError, setPlayerError] = useState(null)

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const debounceRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search when query changes (300ms delay)
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (query.length < 2) {
      setResults([])
      setHasSearched(false)
      setDropdownOpen(false)
      return
    }

    debounceRef.current = setTimeout(() => {
      performSearch()
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, includeArchived])

  async function performSearch() {
    setSearching(true)
    setSearchError(null)
    setHasSearched(true)

    try {
      const params = new URLSearchParams({
        q: query,
        includeArchived: String(includeArchived),
      })
      const data = await apiCall(
        `/api/admin/players/search?${params.toString()}`,
        { token: session?.access_token }
      )
      setResults(Array.isArray(data) ? data : [])
      setDropdownOpen(true)
    } catch (err) {
      setSearchError(err.message || 'Failed to search players')
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  async function handleSelectPlayer(player) {
    setDropdownOpen(false)
    setLoadingPlayer(true)
    setPlayerError(null)
    setSelectedPlayer(null)

    try {
      const data = await apiCall(
        `/api/admin/players/${player.id}`,
        { token: session?.access_token }
      )
      setSelectedPlayer(data)
    } catch (err) {
      setPlayerError(err.message || 'Failed to load player details')
    } finally {
      setLoadingPlayer(false)
    }
  }

  function handlePlayerUpdated(updatedPlayer) {
    setSelectedPlayer(updatedPlayer)
  }

  function handlePlayerDeleted() {
    setSelectedPlayer(null)
    setQuery('')
    setResults([])
    setHasSearched(false)
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-700 mb-4">Player Search</h2>

      {/* Search input and archive toggle */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1" ref={dropdownRef}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label="Search players by email"
          />

          {/* Loading indicator */}
          {searching && (
            <div className="absolute right-3 top-2.5">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
            </div>
          )}

          {/* Dropdown results */}
          {dropdownOpen && query.length >= 2 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-y-auto">
              {results.length === 0 && hasSearched && !searching && (
                <p className="px-4 py-3 text-sm text-gray-500">No players found</p>
              )}
              {results.map((player) => (
                <button
                  key={player.id}
                  onClick={() => handleSelectPlayer(player)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition border-b border-gray-100 last:border-b-0"
                >
                  <span className="font-medium text-gray-800">{player.email}</span>
                  {player.archived && (
                    <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                      Archived
                    </span>
                  )}
                  <span className="block text-xs text-gray-400">
                    Gold: {player.gold?.toLocaleString() ?? 'N/A'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Archive toggle */}
        <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap cursor-pointer">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Show archived players
        </label>
      </div>

      {/* Search error */}
      {searchError && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {searchError}
        </p>
      )}

      {/* Player loading state */}
      {loadingPlayer && (
        <div className="flex items-center gap-2 py-8 justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
          <span className="text-sm text-gray-500">Loading player details...</span>
        </div>
      )}

      {/* Player load error */}
      {playerError && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {playerError}
        </p>
      )}

      {/* Player detail panel */}
      {selectedPlayer && !loadingPlayer && (
        <PlayerDetailPanel
          player={selectedPlayer}
          onPlayerUpdated={handlePlayerUpdated}
          onPlayerDeleted={handlePlayerDeleted}
        />
      )}
    </div>
  )
}
