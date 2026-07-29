/**
 * Reusable tab navigation component for the Admin panel.
 *
 * Props:
 * - tabs: array of { id: string, label: string }
 * - activeTab: string (the currently active tab id)
 * - onTabChange: function(tabId) called when a tab is clicked
 *
 * Validates: Requirements 1.1, 1.2
 */
export default function TabNavigation({ tabs, activeTab, onTabChange }) {
  return (
    <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 rounded-t-md text-sm font-medium transition ${
            activeTab === tab.id
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-800'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
