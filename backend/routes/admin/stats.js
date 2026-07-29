const { Router } = require('express')
const adminAuth = require('../../middleware/admin')
const supabase = require('../../lib/supabase')

const router = Router()

router.use(adminAuth)

/**
 * GET /
 * Returns parallel count queries for players, cities, items, transactions, ships.
 */
router.get('/', async (req, res) => {
  try {
    req.log.info({ module: 'admin', operation: 'getStats' }, 'Fetching admin stats')

    const [playersResult, citiesResult, itemsResult, transactionsResult, shipsResult] =
      await Promise.all([
        supabase.from('players').select('*', { count: 'exact', head: true }),
        supabase.from('cities').select('*', { count: 'exact', head: true }),
        supabase.from('items').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('*', { count: 'exact', head: true }),
        supabase.from('ships').select('*', { count: 'exact', head: true }),
      ])

    // Check if any query returned an error
    const results = [playersResult, citiesResult, itemsResult, transactionsResult, shipsResult]
    const failed = results.find((r) => r.error)

    if (failed) {
      req.log.error({ module: 'admin', operation: 'getStats', code: failed.error.code || 'UNKNOWN' }, 'Database error fetching stats')
      return res.status(500).json({ error: 'Failed to fetch stats' })
    }

    req.log.info({ module: 'admin', operation: 'getStats', result: { players: playersResult.count, cities: citiesResult.count, items: itemsResult.count } }, 'Stats fetched successfully')
    return res.json({
      players: playersResult.count,
      cities: citiesResult.count,
      items: itemsResult.count,
      transactions: transactionsResult.count,
      ships: shipsResult.count,
    })
  } catch (err) {
    req.log.error({ module: 'admin', operation: 'getStats', err }, 'Unexpected error')
    return res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

module.exports = router
