require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { logger } = require('./lib/logger')
const { logStartup, logMissingEnvVars, setupGracefulShutdown } = require('./lib/lifecycle')
const requestLogger = require('./middleware/requestLogger')
const errorHandler = require('./middleware/errorHandler')

// --- Environment Variable Validation ---
const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FRONTEND_URL',
]

const missingVars = REQUIRED_ENV_VARS.filter((varName) => !process.env[varName])

if (missingVars.length > 0) {
  logMissingEnvVars(missingVars)
}

// --- Port Validation ---
const DEFAULT_PORT = 3001
const portEnv = process.env.PORT

let port = DEFAULT_PORT

if (portEnv !== undefined) {
  const parsed = Number(portEnv)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    logger.fatal(
      { port: portEnv },
      `Invalid PORT configuration "${portEnv}". PORT must be a numeric value between 1 and 65535.`
    )
    process.exit(1)
  }
  port = parsed
}

// --- Express App Setup ---
const app = express()

// CORS configuration — only allow requests from FRONTEND_URL origin
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    optionsSuccessStatus: 204,
  })
)

// JSON body parsing with 1 MB limit
app.use(express.json({ limit: '1mb' }))

// Handle malformed JSON bodies
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' })
  }
  next(err)
})

// --- Request Logging Middleware ---
app.use(requestLogger)

// --- Route Mounting ---
// Transaction routes
const transactionsRouter = require('./routes/transactions')
app.use('/api/transactions', transactionsRouter)

// Inventory transfer routes
const inventoryRouter = require('./routes/inventory')
app.use('/api/inventory', inventoryRouter)

// Onboarding routes
const onboardingRouter = require('./routes/onboarding')
app.use('/api/onboarding', onboardingRouter)

// Admin routes
const adminRouter = express.Router()
const adminItemsRouter = require('./routes/admin/items')
const adminCitiesRouter = require('./routes/admin/cities')
const adminCityTagsRouter = require('./routes/admin/city-tags')
const adminUsersRouter = require('./routes/admin/users')
const adminRandomEventsRouter = require('./routes/admin/random-events')
const adminStatsRouter = require('./routes/admin/stats')
const adminDailyUpdateRouter = require('./routes/admin/daily-update')
const adminConfigurationsRouter = require('./routes/admin/configurations')
const adminFactoriesRouter = require('./routes/admin/factories')
const adminPlayersRouter = require('./routes/admin/players')
const adminShipsRouter = require('./routes/admin/ships')
const adminInventoryRouter = require('./routes/admin/inventory')
const adminPriceOverridesRouter = require('./routes/admin/price-overrides')
adminRouter.use('/items', adminItemsRouter)
adminRouter.use('/cities', adminCitiesRouter)
adminRouter.use('/city-tags', adminCityTagsRouter)
adminRouter.use('/users', adminUsersRouter)
adminRouter.use('/random-events', adminRandomEventsRouter)
adminRouter.use('/stats', adminStatsRouter)
adminRouter.use('/daily-update', adminDailyUpdateRouter)
adminRouter.use('/configurations', adminConfigurationsRouter)
adminRouter.use('/factories', adminFactoriesRouter)
adminRouter.use('/players', adminPlayersRouter)
adminRouter.use('/ships', adminShipsRouter)
adminRouter.use('/inventory', adminInventoryRouter)
adminRouter.use('/price-overrides', adminPriceOverridesRouter)
app.use('/api/admin', adminRouter)

// --- Centralized Error Handler (must be after all routes) ---
app.use(errorHandler)

// --- Server Start ---
// Only start listening if this file is run directly (not imported for testing)
if (require.main === module) {
  app.listen(port, () => {
    logStartup(port)

    // Start the in-process cron scheduler
    const { loadSchedules } = require('./lib/scheduler')
    loadSchedules()
  })
  setupGracefulShutdown(logger)
}

// Export app for testing
module.exports = { app }
