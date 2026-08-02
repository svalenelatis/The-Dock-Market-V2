const cron = require('node-cron')
const supabase = require('./supabase')
const { createChildLogger } = require('./logger')

const log = createChildLogger('scheduler')

// Lazy-load processing functions to avoid circular dependency issues at boot
let _runners = null
function getRunners() {
  if (!_runners) {
    const {
      runMarketUpdate,
      runTransactionProcessing,
      runFactoryProcessing,
    } = require('../routes/admin/daily-update')
    _runners = {
      transactions: runTransactionProcessing,
      factories: runFactoryProcessing,
      market: runMarketUpdate,
    }
  }
  return _runners
}

/** Active scheduled jobs: jobName -> cron task */
const jobs = new Map()

/**
 * Load cron schedules from the `configurations` table and start timers.
 * Expects rows with keys like `cron_transactions`, `cron_factories`, `cron_market`
 * and values as standard cron expressions (e.g. "0 * * * *").
 */
async function loadSchedules() {
  try {
    const { data, error } = await supabase
      .from('configurations')
      .select('key, value')
      .like('key', 'cron_%')

    if (error) {
      log.error({ err: error }, 'Failed to load cron schedules from database')
      return
    }

    if (!data || data.length === 0) {
      log.info('No cron schedules found in configurations table')
      return
    }

    // Stop any existing jobs before reloading
    stopAll()

    const runners = getRunners()

    for (const row of data) {
      const jobName = row.key.replace('cron_', '') // e.g. "transactions"
      // value is JSONB — Supabase client auto-deserializes JSON strings,
      // but handle edge cases (extra quotes, objects, etc.)
      let schedule = row.value
      if (typeof schedule !== 'string') {
        schedule = String(schedule)
      }
      // Strip any wrapping quotes that might sneak in from JSONB storage
      schedule = schedule.replace(/^["']|["']$/g, '').trim()

      log.info({ jobName, rawValue: row.value, parsedSchedule: schedule }, `Loading cron config for "${jobName}"`)

      const runner = runners[jobName]

      if (!runner) {
        log.warn({ jobName, schedule }, `No runner found for cron job "${jobName}", skipping`)
        continue
      }

      if (!cron.validate(schedule)) {
        log.warn({ jobName, schedule }, `Invalid cron expression for "${jobName}", skipping`)
        continue
      }

      const task = cron.schedule(schedule, async () => {
        const startTime = Date.now()
        log.info({ job: jobName }, `Cron firing: ${jobName}`)
        try {
          const result = await runner()
          const elapsed = Date.now() - startTime
          log.info({ job: jobName, elapsed_ms: elapsed, result }, `Cron complete: ${jobName}`)
        } catch (err) {
          const elapsed = Date.now() - startTime
          log.error({ job: jobName, elapsed_ms: elapsed, err }, `Cron failed: ${jobName}`)
        }
      })

      jobs.set(jobName, task)
      log.info({ job: jobName, schedule }, `Cron scheduled: ${jobName}`)
    }

    log.info({ jobCount: jobs.size }, 'Scheduler loaded successfully')
  } catch (err) {
    log.error({ err }, 'Unexpected error loading cron schedules')
  }
}

/**
 * Reload schedules — stops all current jobs and re-reads from database.
 * Call this after an admin updates cron_* configuration values.
 */
async function reloadSchedules() {
  log.info('Reloading cron schedules...')
  await loadSchedules()
}

/**
 * Stop all active cron jobs.
 */
function stopAll() {
  for (const [name, task] of jobs) {
    task.stop()
    log.info({ job: name }, `Cron stopped: ${name}`)
  }
  jobs.clear()
}

/**
 * Get current status of all scheduled jobs.
 * @returns {Array<{name: string, running: boolean}>}
 */
function getStatus() {
  const status = []
  for (const [name] of jobs) {
    status.push({ name, scheduled: true })
  }
  return status
}

module.exports = { loadSchedules, reloadSchedules, stopAll, getStatus }
