// Game constants and configuration values
// NOTE: Market simulation tuning parameters (KP, KI, LAG_FACTOR, etc.)
// are NOT included here — those belong to the Daily_Handler Edge Function.

/** Starting gold for new players */
const STARTING_GOLD = 100

/** Maximum JSON body size for Express (1 MB) */
const MAX_BODY_SIZE = '1mb'

/** Default port when PORT env var is not set */
const DEFAULT_PORT = 3001

/** Default ship speed for new players */
const STARTING_SHIP_SPEED = 1

/** Default ship cargo capacity for new players */
const STARTING_SHIP_CAPACITY = 15

/** Maximum number of actions in a single transaction */
const MAX_TRANSACTION_ACTIONS = 10

/** Ship statuses */
const SHIP_STATUS = Object.freeze({
  READY: 'READY',
  TRAVELING: 'TRAVELING',
})

/** Transaction types */
const TRANSACTION_TYPE = Object.freeze({
  BUY: 'BUY',
  SELL: 'SELL',
  TRANSFER: 'TRANSFER',
})

/** Transaction statuses */
const TRANSACTION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  EXECUTING: 'EXECUTING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
})

/** Transaction action types */
const ACTION_TYPE = Object.freeze({
  BUY: 'buy',
  SELL: 'sell',
  RETURN: 'return',
  CHANGE_GOLD: 'changeGold',
  ADD: 'add',
  SUBTRACT: 'subtract',
})

/** Admin roles */
const ADMIN_ROLE = Object.freeze({
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
})

/** Audit action types */
const AUDIT_ACTION = Object.freeze({
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
})

module.exports = {
  STARTING_GOLD,
  MAX_BODY_SIZE,
  DEFAULT_PORT,
  STARTING_SHIP_SPEED,
  STARTING_SHIP_CAPACITY,
  MAX_TRANSACTION_ACTIONS,
  SHIP_STATUS,
  TRANSACTION_TYPE,
  TRANSACTION_STATUS,
  ACTION_TYPE,
  ADMIN_ROLE,
  AUDIT_ACTION,
}
