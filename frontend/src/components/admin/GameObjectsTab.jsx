import { useState } from 'react'
import ItemsManager from './ItemsManager'
import CitiesManager from './CitiesManager'
import TagsManager from './TagsManager'

const SUB_TABS = [
  { id: 'items', label: 'Items' },
  { id: 'cities', label: 'Cities' },
  { id: 'tags', label: 'Tags' },
]

/**
 * Game Objects tab container with sub-navigation for Items, Cities, and Tags.
 * Renders the selected section's manager component below the sub-nav.
 *
 * Validates: Requirements 9.1, 10.1, 11.1
 *
 * @param {{ token: string }} props
 */
export default function GameObjectsTab({ token }) {
  const [activeSubTab, setActiveSubTab] = useState('items')

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-700 mb-4">Game Objects</h2>

      {/* Sub-tab navigation */}
      <div className="flex gap-2 mb-6">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              activeSubTab === tab.id
                ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      {activeSubTab === 'items' && <ItemsManager token={token} />}
      {activeSubTab === 'cities' && <CitiesManager token={token} />}
      {activeSubTab === 'tags' && <TagsManager token={token} />}
    </div>
  )
}
