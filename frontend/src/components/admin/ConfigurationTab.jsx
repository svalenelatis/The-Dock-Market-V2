import { useState, useEffect, useCallback } from 'react'
import { apiCall } from '../../lib/api'
import InlineValidationError from './InlineValidationError'

/**
 * Configuration tab for viewing, editing, and adding global game configuration entries.
 *
 * - Lists all configuration entries with key and current value
 * - Renders appropriate input type: numeric for numbers, toggle for booleans, text for strings
 * - Save & Apply button per entry
 * - Success confirmation message on save
 * - Validation error display adjacent to affected field
 * - Add new configuration form (key: alphanumeric + underscores, value)
 * - Duplicate key error handling
 * - Preserve unsaved changes on network error
 *
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8
 *
 * @param {{ token: string }} props
 */
export default function ConfigurationTab({ token }) {
  const [configs, setConfigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  // Track edited values per key (preserves unsaved changes)
  const [editedValues, setEditedValues] = useState({})
  // Track saving state per key
  const [savingKeys, setSavingKeys] = useState({})
  // Track success message per key
  const [successKeys, setSuccessKeys] = useState({})
  // Track validation errors per key
  const [errorKeys, setErrorKeys] = useState({})

  // New configuration form state
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newKeyError, setNewKeyError] = useState(null)
  const [newValueError, setNewValueError] = useState(null)
  const [addingNew, setAddingNew] = useState(false)
  const [addSuccess, setAddSuccess] = useState(false)

  const fetchConfigurations = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const data = await apiCall('/api/admin/configurations', { token })
      setConfigs(data)
    } catch (err) {
      setFetchError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchConfigurations()
  }, [fetchConfigurations])

  /**
   * Determines the input type based on the stored value type.
   * - typeof value === 'number' → 'number'
   * - typeof value === 'boolean' → 'boolean'
   * - Array.isArray(value) → 'array'
   * - typeof value === 'object' && value !== null → 'object'
   * - otherwise → 'string'
   */
  function getInputType(value) {
    if (typeof value === 'number') return 'number'
    if (typeof value === 'boolean') return 'boolean'
    if (Array.isArray(value)) return 'array'
    if (value !== null && typeof value === 'object') return 'object'
    return 'string'
  }

  /**
   * Gets the current display value for a config entry.
   * Uses edited value if it exists, otherwise uses the stored value.
   */
  function getDisplayValue(key, storedValue) {
    if (key in editedValues) return editedValues[key]
    return storedValue
  }

  /**
   * Handles changing a configuration value in local state.
   */
  function handleValueChange(key, newVal) {
    setEditedValues((prev) => ({ ...prev, [key]: newVal }))
    // Clear success and error when editing
    setSuccessKeys((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setErrorKeys((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  /**
   * Updates a nested field within an object-type configuration value.
   * path is an array of keys, e.g., ['first_ship', 'speed']
   */
  function handleNestedChange(configKey, storedValue, path, newFieldValue) {
    const currentObj = getDisplayValue(configKey, storedValue)
    // Deep clone
    const updated = JSON.parse(JSON.stringify(currentObj))
    // Walk the path and set the value
    let target = updated
    for (let i = 0; i < path.length - 1; i++) {
      target = target[path[i]]
    }
    target[path[path.length - 1]] = newFieldValue
    handleValueChange(configKey, updated)
  }

  /**
   * Saves an individual configuration entry.
   */
  async function handleSave(key, storedValue) {
    const currentValue = getDisplayValue(key, storedValue)
    const inputType = getInputType(storedValue)

    // Convert the value to the correct type for submission
    let submitValue = currentValue
    if (inputType === 'number') {
      submitValue = Number(currentValue)
      if (isNaN(submitValue)) {
        setErrorKeys((prev) => ({ ...prev, [key]: 'Value must be a valid number' }))
        return
      }
    } else if (inputType === 'boolean') {
      submitValue = Boolean(currentValue)
    } else if (inputType === 'object' || inputType === 'array') {
      // Objects and arrays are already in the correct shape from nested editing
      submitValue = currentValue
    }

    setSavingKeys((prev) => ({ ...prev, [key]: true }))
    setErrorKeys((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setSuccessKeys((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })

    try {
      await apiCall(`/api/admin/configurations/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: { value: submitValue },
        token,
      })
      // On success: update local configs, clear edited value, show success
      setConfigs((prev) =>
        prev.map((c) => (c.key === key ? { ...c, value: submitValue } : c))
      )
      setEditedValues((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      setSuccessKeys((prev) => ({ ...prev, [key]: true }))
    } catch (err) {
      // Preserve unsaved changes on error (don't clear editedValues)
      setErrorKeys((prev) => ({ ...prev, [key]: err.message }))
    } finally {
      setSavingKeys((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  /**
   * Validates and submits a new configuration entry.
   */
  async function handleAddNew(e) {
    e.preventDefault()
    setNewKeyError(null)
    setNewValueError(null)
    setAddSuccess(false)

    // Validate key: alphanumeric + underscores, 1-100 chars
    const keyPattern = /^[a-zA-Z0-9_]{1,100}$/
    if (!newKey) {
      setNewKeyError('Key is required')
      return
    }
    if (!keyPattern.test(newKey)) {
      setNewKeyError('Key must be 1–100 characters, alphanumeric and underscores only')
      return
    }

    // Validate value is not empty
    if (newValue === '') {
      setNewValueError('Value is required')
      return
    }

    // Try to parse value as JSON for type flexibility (number, boolean, string)
    let parsedValue = newValue
    if (newValue === 'true') parsedValue = true
    else if (newValue === 'false') parsedValue = false
    else if (!isNaN(Number(newValue)) && newValue.trim() !== '') parsedValue = Number(newValue)

    setAddingNew(true)

    try {
      const created = await apiCall('/api/admin/configurations', {
        method: 'POST',
        body: { key: newKey, value: parsedValue },
        token,
      })
      // Add to local list
      setConfigs((prev) => [...prev, created])
      setNewKey('')
      setNewValue('')
      setAddSuccess(true)
    } catch (err) {
      // Check for duplicate key (409)
      if (err.message.toLowerCase().includes('already exists') || err.message.toLowerCase().includes('duplicate')) {
        setNewKeyError('A configuration with this key already exists')
      } else {
        // Network or other error — preserve form values
        setNewValueError(err.message)
      }
    } finally {
      setAddingNew(false)
    }
  }

  /**
   * Renders the appropriate input for a configuration value based on its type.
   * For objects, recursively renders sub-fields as labeled inputs.
   */
  function renderInput(config) {
    const { key, value: storedValue } = config
    const currentValue = getDisplayValue(key, storedValue)
    const isSaving = savingKeys[key]

    return renderField(currentValue, key, [], isSaving)
  }

  /**
   * Recursively renders a field based on its type.
   * @param {*} value - The current value to render
   * @param {string} configKey - The top-level config key (for state management)
   * @param {string[]} path - Path of nested keys from the root value
   * @param {boolean} isSaving - Whether the config is currently saving
   */
  function renderField(value, configKey, path, isSaving) {
    const fieldType = getInputType(value)
    const fullPath = path.join('.')
    const label = path.length > 0 ? path[path.length - 1].replace(/_/g, ' ') : ''

    if (fieldType === 'boolean') {
      return (
        <label className="relative inline-flex items-center cursor-pointer" key={fullPath}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => {
              if (path.length === 0) {
                handleValueChange(configKey, e.target.checked)
              } else {
                handleNestedChange(configKey, configs.find(c => c.key === configKey)?.value, path, e.target.checked)
              }
            }}
            disabled={isSaving}
            className="sr-only peer"
            aria-label={fullPath || configKey}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600">
            {Boolean(value) ? 'Enabled' : 'Disabled'}
          </span>
        </label>
      )
    }

    if (fieldType === 'number') {
      return (
        <input
          key={fullPath}
          type="number"
          step="any"
          value={value}
          onChange={(e) => {
            const numVal = e.target.value === '' ? '' : Number(e.target.value)
            if (path.length === 0) {
              handleValueChange(configKey, e.target.value)
            } else {
              handleNestedChange(configKey, configs.find(c => c.key === configKey)?.value, path, numVal === '' ? 0 : numVal)
            }
          }}
          disabled={isSaving}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
          aria-label={fullPath || configKey}
        />
      )
    }

    if (fieldType === 'array') {
      return (
        <div key={fullPath} className="space-y-1">
          <input
            type="text"
            value={Array.isArray(value) ? value.join(', ') : ''}
            onChange={(e) => {
              const arrVal = e.target.value.split(',').map(s => s.trim()).filter(s => s !== '')
              if (path.length === 0) {
                handleValueChange(configKey, arrVal)
              } else {
                handleNestedChange(configKey, configs.find(c => c.key === configKey)?.value, path, arrVal)
              }
            }}
            disabled={isSaving}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
            aria-label={fullPath || configKey}
            placeholder="Comma-separated values"
          />
          <p className="text-xs text-gray-400">Comma-separated list</p>
        </div>
      )
    }

    if (fieldType === 'object') {
      return (
        <div key={fullPath} className="space-y-3 pl-4 border-l-2 border-gray-200">
          {Object.entries(value).map(([subKey, subValue]) => (
            <div key={`${fullPath}.${subKey}`}>
              <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">
                {subKey.replace(/_/g, ' ')}
              </label>
              {renderField(subValue, configKey, [...path, subKey], isSaving)}
            </div>
          ))}
        </div>
      )
    }

    // Default: text input
    return (
      <input
        key={fullPath}
        type="text"
        value={value ?? ''}
        onChange={(e) => {
          if (path.length === 0) {
            handleValueChange(configKey, e.target.value)
          } else {
            handleNestedChange(configKey, configs.find(c => c.key === configKey)?.value, path, e.target.value)
          }
        }}
        disabled={isSaving}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        aria-label={fullPath || configKey}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-gray-500 text-sm">Loading configurations...</p>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="py-4">
        <p className="text-red-600 text-sm" role="alert">
          Failed to load configurations: {fetchError}
        </p>
        <button
          onClick={fetchConfigurations}
          className="mt-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Configuration</h2>
        <p className="text-sm text-gray-500 mb-6">
          View and edit global game configuration values.
        </p>
      </div>

      {/* Configuration Entries List */}
      <div className="space-y-4">
        {configs.length === 0 && (
          <p className="text-gray-500 text-sm">No configuration entries found.</p>
        )}

        {configs.map((config) => (
          <div
            key={config.key}
            className="border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {config.key}
                </label>
                {renderInput(config)}
                <InlineValidationError error={errorKeys[config.key]} />
                {successKeys[config.key] && (
                  <p className="mt-1 text-sm text-green-600" role="status">
                    Saved
                  </p>
                )}
              </div>
              <button
                onClick={() => handleSave(config.key, config.value)}
                disabled={savingKeys[config.key]}
                className="mt-6 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition whitespace-nowrap"
              >
                {savingKeys[config.key] ? 'Saving...' : 'Save & Apply'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Configuration */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-md font-semibold text-gray-700 mb-4">
          Add New Configuration
        </h3>
        <form onSubmit={handleAddNew} className="space-y-4 max-w-lg">
          <div>
            <label
              htmlFor="new-config-key"
              className="block text-sm font-medium text-gray-600 mb-1"
            >
              Key
            </label>
            <input
              id="new-config-key"
              type="text"
              value={newKey}
              onChange={(e) => {
                setNewKey(e.target.value)
                setNewKeyError(null)
                setAddSuccess(false)
              }}
              placeholder="e.g. max_trade_distance"
              disabled={addingNew}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
            />
            <InlineValidationError error={newKeyError} />
            <p className="mt-1 text-xs text-gray-400">
              Alphanumeric characters and underscores only, 1–100 characters.
            </p>
          </div>

          <div>
            <label
              htmlFor="new-config-value"
              className="block text-sm font-medium text-gray-600 mb-1"
            >
              Value
            </label>
            <input
              id="new-config-value"
              type="text"
              value={newValue}
              onChange={(e) => {
                setNewValue(e.target.value)
                setNewValueError(null)
                setAddSuccess(false)
              }}
              placeholder='e.g. 1.5, true, "some string"'
              disabled={addingNew}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
            />
            <InlineValidationError error={newValueError} />
            <p className="mt-1 text-xs text-gray-400">
              Numbers and booleans (true/false) are auto-detected. Everything else is stored as a string.
            </p>
          </div>

          {addSuccess && (
            <p className="text-sm text-green-600" role="status">
              Configuration added successfully.
            </p>
          )}

          <button
            type="submit"
            disabled={addingNew}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {addingNew ? 'Adding...' : 'Add Configuration'}
          </button>
        </form>
      </div>
    </div>
  )
}
