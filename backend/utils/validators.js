/**
 * Pure validation functions for transaction requests.
 * No side effects, no database access — just input checking.
 */

/** Valid transaction actions */
const VALID_ACTIONS = ['buy', 'sell', 'transfer']

/**
 * Validates a transaction request body for required fields and correct types.
 *
 * @param {object} body - The request body to validate
 * @param {string} [body.action] - Transaction action (buy, sell, or transfer)
 * @param {string} [body.shipId] - UUID of the ship
 * @param {string} [body.targetCityId] - UUID of the target city
 * @param {string} [body.playerId] - UUID of the player
 * @param {string} [body.itemName] - Item name (required for buy/sell)
 * @param {number} [body.quantity] - Quantity (required for buy/sell, integer >= 1)
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateTransactionRequest(body) {
  const errors = []

  if (!body || typeof body !== 'object') {
    return { isValid: false, errors: ['Request body must be an object'] }
  }

  // Check required fields
  if (!body.action) {
    errors.push('action is required')
  }
  if (!body.shipId) {
    errors.push('shipId is required')
  }
  if (!body.targetCityId) {
    errors.push('targetCityId is required')
  }
  if (!body.playerId) {
    errors.push('playerId is required')
  }

  // Validate action enum
  if (body.action && !VALID_ACTIONS.includes(body.action)) {
    errors.push(`action must be one of: ${VALID_ACTIONS.join(', ')}`)
  }

  // Validate buy/sell-specific fields
  if (body.action === 'buy' || body.action === 'sell') {
    if (!body.itemName || (typeof body.itemName === 'string' && body.itemName.trim() === '')) {
      errors.push('itemName is required for buy/sell actions')
    }

    if (body.quantity === undefined || body.quantity === null) {
      errors.push('quantity is required for buy/sell actions')
    } else if (!Number.isInteger(body.quantity) || body.quantity < 1) {
      errors.push('quantity must be an integer greater than or equal to 1')
    }
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Validates an array of transaction actions for correct structure.
 *
 * @param {Array} actions - Array of action objects to validate
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateTransactionActions(actions) {
  const errors = []

  if (!Array.isArray(actions)) {
    return { isValid: false, errors: ['actions must be an array'] }
  }

  if (actions.length === 0) {
    errors.push('actions array must not be empty')
  }

  const validActionTypes = ['buy', 'sell', 'return', 'changeGold', 'add', 'subtract']

  actions.forEach((action, index) => {
    if (!action || typeof action !== 'object') {
      errors.push(`actions[${index}] must be an object`)
      return
    }

    if (!action.type || !validActionTypes.includes(action.type)) {
      errors.push(`actions[${index}].type must be one of: ${validActionTypes.join(', ')}`)
    }

    // Validate fields for actions that require itemName and quantity
    if (action.type === 'buy' || action.type === 'sell' || action.type === 'add' || action.type === 'subtract') {
      if (!action.itemName || (typeof action.itemName === 'string' && action.itemName.trim() === '')) {
        errors.push(`actions[${index}].itemName is required for ${action.type} actions`)
      }
      if (action.quantity === undefined || action.quantity === null) {
        errors.push(`actions[${index}].quantity is required for ${action.type} actions`)
      } else if (!Number.isInteger(action.quantity) || action.quantity < 1) {
        errors.push(`actions[${index}].quantity must be an integer greater than or equal to 1`)
      }
    }

    // Validate changeGold action
    if (action.type === 'changeGold') {
      if (action.amount === undefined || action.amount === null || typeof action.amount !== 'number') {
        errors.push(`actions[${index}].amount is required for changeGold actions`)
      }
    }
  })

  return { isValid: errors.length === 0, errors }
}

module.exports = {
  validateTransactionRequest,
  validateTransactionActions,
  normalizeJsonb,
  validateFactoryData,
}

/**
 * Normalizes a value that should be a JSON object but may have been stored
 * as a stringified JSON string. Handles double-encoding from Supabase inserts
 * where a string was passed for a JSONB column.
 *
 * @param {*} value - The value to normalize (could be object, string, or null)
 * @returns {object|null} Parsed object, or null if unparseable
 *
 * Examples:
 *   normalizeJsonb({ item: "Grain" })  → { item: "Grain" }
 *   normalizeJsonb('{"item":"Grain"}') → { item: "Grain" }
 *   normalizeJsonb('{}')               → {}
 *   normalizeJsonb(null)               → null
 *   normalizeJsonb('not json')         → null
 */
function normalizeJsonb(value) {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'object') {
    return value
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed
      }
      return null
    } catch {
      return null
    }
  }
  return null
}

/**
 * Validates factory input_requirements and output_production data before
 * writing to the database. Ensures they are proper objects (not strings).
 *
 * @param {object} factoryData - The factory data to validate
 * @param {*} factoryData.input_requirements - Must be an object (or empty object)
 * @param {*} factoryData.output_production - Must be { item: string, quantity: number }
 * @returns {{ isValid: boolean, errors: string[], normalized: { input_requirements: object, output_production: object }|null }}
 */
function validateFactoryData(factoryData) {
  const errors = []

  if (!factoryData || typeof factoryData !== 'object') {
    return { isValid: false, errors: ['Factory data must be an object'], normalized: null }
  }

  // Validate and normalize input_requirements
  let inputReqs = factoryData.input_requirements
  if (inputReqs === undefined || inputReqs === null) {
    inputReqs = {}
  }
  if (typeof inputReqs === 'string') {
    try {
      inputReqs = JSON.parse(inputReqs)
    } catch {
      errors.push('input_requirements must be a valid JSON object, not a string')
    }
  }
  if (typeof inputReqs !== 'object' || Array.isArray(inputReqs)) {
    errors.push('input_requirements must be a plain object')
  }

  // Validate and normalize output_production
  let outputProd = factoryData.output_production
  if (typeof outputProd === 'string') {
    try {
      outputProd = JSON.parse(outputProd)
    } catch {
      errors.push('output_production must be a valid JSON object, not a string')
    }
  }
  if (!outputProd || typeof outputProd !== 'object') {
    errors.push('output_production must be an object with { item, quantity }')
  } else {
    if (!outputProd.item || typeof outputProd.item !== 'string' || outputProd.item.trim() === '') {
      errors.push('output_production.item must be a non-empty string')
    }
    if (typeof outputProd.quantity !== 'number' || !Number.isInteger(outputProd.quantity) || outputProd.quantity < 1) {
      errors.push('output_production.quantity must be a positive integer')
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors, normalized: null }
  }

  return {
    isValid: true,
    errors: [],
    normalized: {
      input_requirements: inputReqs,
      output_production: outputProd,
    },
  }
}
