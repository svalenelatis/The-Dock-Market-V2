/**
 * Admin validation and sanitization utilities.
 * All functions are pure — no side effects or external dependencies.
 */

/**
 * Strips dangerous patterns from a string while preserving safe characters.
 * Idempotent: sanitizeString(sanitizeString(x)) === sanitizeString(x)
 *
 * @param {string} input - The string to sanitize
 * @returns {string} The sanitized string
 */
function sanitizeString(input) {
  if (typeof input !== 'string') return ''
  let result = input
  let prev
  do {
    prev = result
    // Remove < and > characters
    result = result.replace(/[<>]/g, '')
    // Remove javascript: (case-insensitive)
    result = result.replace(/javascript:/gi, '')
    // Remove on[a-z]+= event handler patterns (case-insensitive)
    result = result.replace(/on[a-z]+=/gi, '')
  } while (result !== prev)
  return result
}

/**
 * Validates an item payload.
 * Returns { isValid: true, errors: [] } iff:
 * - name is a non-empty string of 1–100 characters
 * - base_price is a number between 0 and 1,000,000 inclusive
 * - components (if present) is an array of at most 10 non-empty strings
 * - tags (if present) is an array of at most 10 non-empty strings
 *
 * @param {object} item - The item payload to validate
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateItem(item) {
  const errors = []

  if (!item || typeof item !== 'object') {
    return { isValid: false, errors: ['Item must be an object'] }
  }

  // Validate name
  if (typeof item.name !== 'string' || item.name.length < 1 || item.name.length > 100) {
    errors.push('Name must be a string between 1 and 100 characters')
  }

  // Validate base_price
  if (typeof item.base_price !== 'number' || isNaN(item.base_price) || item.base_price < 0 || item.base_price > 1000000) {
    errors.push('Base price must be a number between 0 and 1,000,000')
  }

  // Validate components (optional)
  if (item.components !== undefined) {
    if (!Array.isArray(item.components)) {
      errors.push('Components must be an array')
    } else if (item.components.length > 10) {
      errors.push('Components must have at most 10 entries')
    } else if (item.components.some(c => typeof c !== 'string' || c.length === 0)) {
      errors.push('Each component must be a non-empty string')
    }
  }

  // Validate tags (optional)
  if (item.tags !== undefined) {
    if (!Array.isArray(item.tags)) {
      errors.push('Tags must be an array')
    } else if (item.tags.length > 10) {
      errors.push('Tags must have at most 10 entries')
    } else if (item.tags.some(t => typeof t !== 'string' || t.length === 0)) {
      errors.push('Each tag must be a non-empty string')
    }
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Validates a city payload.
 * Returns { isValid: true, errors: [] } iff:
 * - name is a non-empty string of 1–100 characters
 * - volatility is a number between 0 and 1 inclusive
 * - location is an object with numeric x and y each between -1000 and 1000
 * - tags (if present) is an array of at most 20 non-empty strings
 *
 * @param {object} city - The city payload to validate
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateCity(city) {
  const errors = []

  if (!city || typeof city !== 'object') {
    return { isValid: false, errors: ['City must be an object'] }
  }

  // Validate name
  if (typeof city.name !== 'string' || city.name.length < 1 || city.name.length > 100) {
    errors.push('Name must be a string between 1 and 100 characters')
  }

  // Validate volatility
  if (typeof city.volatility !== 'number' || isNaN(city.volatility) || city.volatility < 0 || city.volatility > 1) {
    errors.push('Volatility must be a number between 0 and 1')
  }

  // Validate location
  if (!city.location || typeof city.location !== 'object') {
    errors.push('Location must be an object with x and y coordinates')
  } else {
    if (typeof city.location.x !== 'number' || isNaN(city.location.x) || city.location.x < -1000 || city.location.x > 1000) {
      errors.push('Location x must be a number between -1000 and 1000')
    }
    if (typeof city.location.y !== 'number' || isNaN(city.location.y) || city.location.y < -1000 || city.location.y > 1000) {
      errors.push('Location y must be a number between -1000 and 1000')
    }
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Validates a city tag payload.
 * Returns { isValid: true, errors: [] } iff:
 * - name is a non-empty string of at most 100 characters
 * - description is a non-empty string of at most 500 characters
 * - can_be_permanent is a boolean
 * - can_be_event is a boolean
 * - effects is an object with goods and tags sub-objects where all values are numbers between -10 and 10
 *
 * @param {object} cityTag - The city tag payload to validate
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateCityTag(cityTag) {
  const errors = []

  if (!cityTag || typeof cityTag !== 'object') {
    return { isValid: false, errors: ['City tag must be an object'] }
  }

  // Validate name
  if (typeof cityTag.name !== 'string' || cityTag.name.length < 1 || cityTag.name.length > 100) {
    errors.push('Name must be a string between 1 and 100 characters')
  }

  // Validate description
  if (typeof cityTag.description !== 'string' || cityTag.description.length < 1 || cityTag.description.length > 500) {
    errors.push('Description must be a string between 1 and 500 characters')
  }

  // Validate can_be_permanent (optional, defaults handled by DB)
  if (cityTag.can_be_permanent !== undefined && typeof cityTag.can_be_permanent !== 'boolean') {
    errors.push('can_be_permanent must be a boolean')
  }

  // Validate can_be_event (optional, defaults handled by DB)
  if (cityTag.can_be_event !== undefined && typeof cityTag.can_be_event !== 'boolean') {
    errors.push('can_be_event must be a boolean')
  }

  // Validate effects
  if (!cityTag.effects || typeof cityTag.effects !== 'object') {
    errors.push('Effects must be an object with goods and tags sub-objects')
  } else {
    // Validate effects.goods
    if (!cityTag.effects.goods || typeof cityTag.effects.goods !== 'object' || Array.isArray(cityTag.effects.goods)) {
      errors.push('Effects goods must be an object')
    } else {
      const goodsValues = Object.values(cityTag.effects.goods)
      if (goodsValues.some(v => typeof v !== 'number' || isNaN(v) || v < -10 || v > 10)) {
        errors.push('All effects goods values must be numbers between -10 and 10')
      }
    }

    // Validate effects.tags
    if (!cityTag.effects.tags || typeof cityTag.effects.tags !== 'object' || Array.isArray(cityTag.effects.tags)) {
      errors.push('Effects tags must be an object')
    } else {
      const tagsValues = Object.values(cityTag.effects.tags)
      if (tagsValues.some(v => typeof v !== 'number' || isNaN(v) || v < -10 || v > 10)) {
        errors.push('All effects tags values must be numbers between -10 and 10')
      }
    }
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Validates a player update payload.
 * Returns { isValid: true, errors: [] } iff:
 * - gold (if present) is an integer between 0 and 999,999,999 inclusive
 * - home_port_id (if present) is a valid UUID format
 *
 * @param {object} body - The player update payload
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validatePlayerUpdate(body) {
  const errors = []

  if (!body || typeof body !== 'object') {
    return { isValid: false, errors: ['Body must be an object'] }
  }

  // Validate gold
  if (body.gold !== undefined) {
    if (typeof body.gold !== 'number' || !Number.isInteger(body.gold) || body.gold < 0 || body.gold > 999999999) {
      errors.push('Gold must be an integer between 0 and 999,999,999')
    }
  }

  // Validate home_port_id
  if (body.home_port_id !== undefined) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (typeof body.home_port_id !== 'string' || !uuidRegex.test(body.home_port_id)) {
      errors.push('home_port_id must be a valid UUID format')
    }
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Validates a ship payload.
 * Returns { isValid: true, errors: [] } iff:
 * - name is a string of 1–50 characters
 * - speed is a number between 1 and 100 inclusive
 * - cargo_capacity is a number between 1 and 1000 inclusive
 *
 * @param {object} body - The ship payload
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateShip(body) {
  const errors = []

  if (!body || typeof body !== 'object') {
    return { isValid: false, errors: ['Body must be an object'] }
  }

  // Validate name
  if (typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 50) {
    errors.push('Name must be a string between 1 and 50 characters')
  }

  // Validate speed
  if (typeof body.speed !== 'number' || isNaN(body.speed) || body.speed < 1 || body.speed > 100) {
    errors.push('Speed must be a number between 1 and 100')
  }

  // Validate cargo_capacity
  if (typeof body.cargo_capacity !== 'number' || isNaN(body.cargo_capacity) || body.cargo_capacity < 1 || body.cargo_capacity > 1000) {
    errors.push('Cargo capacity must be a number between 1 and 1000')
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Validates an inventory entry payload.
 * Returns { isValid: true, errors: [] } iff:
 * - item_name is a non-empty string
 * - quantity is an integer between 1 and 99,999 inclusive
 *
 * @param {object} body - The inventory entry payload
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateInventoryEntry(body) {
  const errors = []

  if (!body || typeof body !== 'object') {
    return { isValid: false, errors: ['Body must be an object'] }
  }

  // Validate item_name
  if (typeof body.item_name !== 'string' || body.item_name.length < 1) {
    errors.push('item_name must be a non-empty string')
  }

  // Validate quantity
  if (typeof body.quantity !== 'number' || !Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 99999) {
    errors.push('Quantity must be an integer between 1 and 99,999')
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Validates a factory payload.
 * Returns { isValid: true, errors: [] } iff:
 * - type is a string of 1–100 characters
 * - input_requirements is an array of at most 10 objects, each with item (non-empty string) and quantity (integer 1–10,000)
 * - output_production is an object with item (non-empty string) and quantity (integer 1–10,000)
 *
 * @param {object} body - The factory payload
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateFactory(body) {
  const errors = []

  if (!body || typeof body !== 'object') {
    return { isValid: false, errors: ['Body must be an object'] }
  }

  // Validate type
  if (typeof body.type !== 'string' || body.type.length < 1 || body.type.length > 100) {
    errors.push('Type must be a string between 1 and 100 characters')
  }

  // Validate input_requirements
  if (!Array.isArray(body.input_requirements)) {
    errors.push('input_requirements must be an array')
  } else if (body.input_requirements.length > 10) {
    errors.push('input_requirements must have at most 10 entries')
  } else {
    for (let i = 0; i < body.input_requirements.length; i++) {
      const req = body.input_requirements[i]
      if (!req || typeof req !== 'object') {
        errors.push(`input_requirements[${i}] must be an object`)
        continue
      }
      if (typeof req.item !== 'string' || req.item.length < 1) {
        errors.push(`input_requirements[${i}].item must be a non-empty string`)
      }
      if (typeof req.quantity !== 'number' || !Number.isInteger(req.quantity) || req.quantity < 1 || req.quantity > 10000) {
        errors.push(`input_requirements[${i}].quantity must be an integer between 1 and 10,000`)
      }
    }
  }

  // Validate output_production
  if (!body.output_production || typeof body.output_production !== 'object' || Array.isArray(body.output_production)) {
    errors.push('output_production must be an object')
  } else {
    if (typeof body.output_production.item !== 'string' || body.output_production.item.length < 1) {
      errors.push('output_production.item must be a non-empty string')
    }
    if (typeof body.output_production.quantity !== 'number' || !Number.isInteger(body.output_production.quantity) || body.output_production.quantity < 1 || body.output_production.quantity > 10000) {
      errors.push('output_production.quantity must be an integer between 1 and 10,000')
    }
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Validates a configuration value based on the key's specific rules.
 * Returns { isValid: true, errors: [] } iff:
 * - For ship_speed_scalar: value is a number between 0.1 and 10
 * - For random_tag_chance: value is a number between 0 and 1
 * - For unknown keys: value is not null/undefined
 *
 * @param {string} key - The configuration key
 * @param {*} value - The configuration value
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateConfiguration(key, value) {
  const errors = []

  if (key === 'ship_speed_scalar') {
    if (typeof value !== 'number' || isNaN(value) || value < 0.1 || value > 10) {
      errors.push('ship_speed_scalar must be a number between 0.1 and 10')
    }
  } else if (key === 'random_tag_chance') {
    if (typeof value !== 'number' || isNaN(value) || value < 0 || value > 1) {
      errors.push('random_tag_chance must be a number between 0 and 1')
    }
  } else if (key === 'starting_player_state') {
    if (!value || typeof value !== 'object') {
      errors.push('starting_player_state must be an object')
    } else {
      // Validate starting_gold
      if (typeof value.starting_gold !== 'number' || !Number.isInteger(value.starting_gold) || value.starting_gold < 0 || value.starting_gold > 999999999) {
        errors.push('starting_gold must be an integer between 0 and 999,999,999')
      }
      // Validate first_ship
      if (!value.first_ship || typeof value.first_ship !== 'object') {
        errors.push('first_ship must be an object with speed and cargo_capacity')
      } else {
        if (typeof value.first_ship.speed !== 'number' || !Number.isInteger(value.first_ship.speed) || value.first_ship.speed < 1 || value.first_ship.speed > 100) {
          errors.push('first_ship.speed must be an integer between 1 and 100')
        }
        if (typeof value.first_ship.cargo_capacity !== 'number' || !Number.isInteger(value.first_ship.cargo_capacity) || value.first_ship.cargo_capacity < 1 || value.first_ship.cargo_capacity > 1000) {
          errors.push('first_ship.cargo_capacity must be an integer between 1 and 1000')
        }
      }
      // Validate first_factory
      if (!value.first_factory || typeof value.first_factory !== 'object') {
        errors.push('first_factory must be an object')
      } else {
        if (!Array.isArray(value.first_factory.possible_outputs) || value.first_factory.possible_outputs.length === 0) {
          errors.push('first_factory.possible_outputs must be a non-empty array of item names')
        } else if (value.first_factory.possible_outputs.some(o => typeof o !== 'string' || o.length === 0)) {
          errors.push('Each entry in first_factory.possible_outputs must be a non-empty string')
        }
        if (!Array.isArray(value.first_factory.possible_inputs)) {
          errors.push('first_factory.possible_inputs must be an array (can be empty)')
        } else if (value.first_factory.possible_inputs.some(i => typeof i !== 'string' || i.length === 0)) {
          errors.push('Each entry in first_factory.possible_inputs must be a non-empty string')
        }
        if (typeof value.first_factory.output_quantity !== 'number' || !Number.isInteger(value.first_factory.output_quantity) || value.first_factory.output_quantity < 1 || value.first_factory.output_quantity > 10000) {
          errors.push('first_factory.output_quantity must be an integer between 1 and 10,000')
        }
      }
    }
  } else {
    if (value === null || value === undefined) {
      errors.push('Value must not be null or undefined')
    }
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Validates a configuration key format.
 * Returns { isValid: true, errors: [] } iff:
 * - key is 1–100 characters, alphanumeric + underscores only
 *
 * @param {string} key - The configuration key to validate
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateConfigKey(key) {
  const errors = []

  const configKeyRegex = /^[a-zA-Z0-9_]{1,100}$/
  if (typeof key !== 'string' || !configKeyRegex.test(key)) {
    errors.push('Key must be 1–100 characters, alphanumeric and underscores only')
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Validates an admin tag payload.
 * Returns { isValid: true, errors: [] } iff:
 * - effects is an object with goods and tags sub-objects where all values are numbers between -10 and 10
 * - expiry (if provided and not 'permanent') is a date string at least 1 full day in the future
 *
 * @param {object} body - The admin tag payload
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateAdminTag(body) {
  const errors = []

  if (!body || typeof body !== 'object') {
    return { isValid: false, errors: ['Body must be an object'] }
  }

  // Validate effects
  if (!body.effects || typeof body.effects !== 'object') {
    errors.push('Effects must be an object with goods and tags sub-objects')
  } else {
    // Validate effects.goods
    if (!body.effects.goods || typeof body.effects.goods !== 'object' || Array.isArray(body.effects.goods)) {
      errors.push('Effects goods must be an object')
    } else {
      const goodsValues = Object.values(body.effects.goods)
      if (goodsValues.some(v => typeof v !== 'number' || isNaN(v) || v < -10 || v > 10)) {
        errors.push('All effects goods values must be numbers between -10 and 10')
      }
    }

    // Validate effects.tags
    if (!body.effects.tags || typeof body.effects.tags !== 'object' || Array.isArray(body.effects.tags)) {
      errors.push('Effects tags must be an object')
    } else {
      const tagsValues = Object.values(body.effects.tags)
      if (tagsValues.some(v => typeof v !== 'number' || isNaN(v) || v < -10 || v > 10)) {
        errors.push('All effects tags values must be numbers between -10 and 10')
      }
    }
  }

  // Validate expiry (if provided and not permanent)
  if (body.expiry !== undefined && body.expiry !== null && body.expiry !== 'permanent') {
    const expiryDate = new Date(body.expiry)
    if (isNaN(expiryDate.getTime())) {
      errors.push('Expiry must be a valid date string')
    } else {
      const now = new Date()
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      if (expiryDate < oneDayFromNow) {
        errors.push('Expiry date must be at least 1 day in the future')
      }
    }
  }

  return { isValid: errors.length === 0, errors }
}

module.exports = {
  sanitizeString,
  validateItem,
  validateCity,
  validateCityTag,
  validatePlayerUpdate,
  validateShip,
  validateInventoryEntry,
  validateFactory,
  validateConfiguration,
  validateConfigKey,
  validateAdminTag,
}
