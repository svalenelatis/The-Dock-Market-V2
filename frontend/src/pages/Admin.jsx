import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import TabNavigation from '../components/admin/TabNavigation'
import PlayerSearchTab from '../components/admin/PlayerSearchTab'
import GameControlTab from '../components/admin/GameControlTab'
import GameObjectsTab from '../components/admin/GameObjectsTab'
import ConfigurationTab from '../components/admin/ConfigurationTab'

const TABS = [
  { id: 'player-search', label: 'Player Search' },
  { id: 'game-control', label: 'Game Control' },
  { id: 'game-objects', label: 'Game Objects' },
  { id: 'configuration', label: 'Configuration' },
]

/**
 * Admin panel with tabbed interface for all administrative operations.
 * Access control is handled by the AdminRoute wrapper in router.jsx.
 *
 * Tabs: Player Search, Game Control, Game Objects, Configuration
 *
 * Validates: Requirements 1.1, 1.2, 1.7
 */
export default function Admin() {
  const [activeTab, setActiveTab] = useState('player-search')
  const { session } = useAuth()
  const token = session?.access_token

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Admin Panel</h1>

      {/* Tab Navigation */}
      <TabNavigation tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content Area */}
      <div className="bg-white rounded-lg shadow p-6">
        {activeTab === 'player-search' && <PlayerSearchTab />}
        {activeTab === 'game-control' && <GameControlTab token={token} />}
        {activeTab === 'game-objects' && <GameObjectsTab token={token} />}
        {activeTab === 'configuration' && <ConfigurationTab token={token} />}
      </div>
    </main>
  )
}
