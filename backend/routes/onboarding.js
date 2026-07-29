const { Router } = require('express')
const authMiddleware = require('../middleware/auth')
const supabase = require('../lib/supabase')

const router = Router()

// All onboarding routes require authentication
router.use(authMiddleware)

/**
 * POST /api/onboarding/complete
 *
 * Completes the new player onboarding flow by creating their starter ship
 * and factory, then marking onboarding as complete.
 *
 * Body:
 *   - ship_name (string): The name the player chose for their first ship
 *
 * Creates:
 *   - 1 ship: named by player, cargo 15, speed 1, docked at home port
 *   - 1 Grain Factory: produces 2 grain per day, no input requirements
 *   - Marks player as onboarding_complete = true
 *
 * Returns 200 with the created ship and factory data.
 * Returns 400 if already onboarded or invalid input.
 */
router.post('/complete', async (req, res) => {
  try {
    req.log.info({ operation: 'completeOnboarding' }, 'Onboarding completion started')

    const { ship_name } = req.body

    // --- Input validation ---
    if (!ship_name || typeof ship_name !== 'string' || ship_name.trim().length === 0) {
      req.log.warn({ field: 'ship_name', reason: 'Must be a non-empty string' }, 'Validation failed')
      return res.status(400).json({ error: 'ship_name is required and must be a non-empty string' })
    }

    const trimmedName = ship_name.trim()

    if (trimmedName.length > 50) {
      req.log.warn({ field: 'ship_name', reason: 'Must be 50 characters or fewer' }, 'Validation failed')
      return res.status(400).json({ error: 'ship_name must be 50 characters or fewer' })
    }

    // --- Verify player exists and hasn't already onboarded ---
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, onboarding_complete, home_port_id')
      .eq('id', req.userId)
      .single()

    if (playerError || !player) {
      req.log.error({ operation: 'completeOnboarding', code: playerError?.code }, 'Player not found')
      return res.status(404).json({ error: 'Player record not found' })
    }

    if (player.onboarding_complete) {
      req.log.warn({ operation: 'completeOnboarding', reason: 'Already completed' }, 'Onboarding already done')
      return res.status(400).json({ error: 'Onboarding already completed' })
    }

    // --- Load starting player state configuration ---
    const { data: configRow, error: configError } = await supabase
      .from('configurations')
      .select('value')
      .eq('key', 'starting_player_state')
      .single()

    // Fallback defaults if config is missing or unreadable
    const defaults = {
      starting_gold: 100,
      first_ship: { speed: 1, cargo_capacity: 15 },
      first_factory: {
        possible_outputs: ['Grain'],
        possible_inputs: [],
        output_quantity: 2,
      },
    }

    const config = (configError || !configRow) ? defaults : configRow.value
    const shipConfig = config.first_ship || defaults.first_ship
    const factoryConfig = config.first_factory || defaults.first_factory
    const startingGold = config.starting_gold ?? defaults.starting_gold

    // --- Randomize factory output from possible_outputs ---
    const possibleOutputs = factoryConfig.possible_outputs && factoryConfig.possible_outputs.length > 0
      ? factoryConfig.possible_outputs
      : ['Grain']
    const chosenOutput = possibleOutputs[Math.floor(Math.random() * possibleOutputs.length)]
    const outputQuantity = factoryConfig.output_quantity || 2

    // Build input_requirements from possible_inputs (randomize 0-2 inputs)
    const possibleInputs = factoryConfig.possible_inputs || []
    let inputRequirements = {}
    if (possibleInputs.length > 0) {
      // Pick 1-2 random inputs (never the same as output)
      const availableInputs = possibleInputs.filter(i => i !== chosenOutput)
      const inputCount = Math.min(availableInputs.length, Math.floor(Math.random() * 2) + 1)
      const shuffled = availableInputs.sort(() => Math.random() - 0.5)
      const chosenInputs = shuffled.slice(0, inputCount)
      inputRequirements = chosenInputs.reduce((acc, item) => {
        acc[item] = Math.floor(Math.random() * 3) + 1 // 1-3 quantity per input
        return acc
      }, {})
    }

    // --- Create starter ship ---
    const { data: ship, error: shipError } = await supabase
      .from('ships')
      .insert({
        player_id: req.userId,
        name: trimmedName,
        speed: shipConfig.speed || 1,
        cargo_capacity: shipConfig.cargo_capacity || 15,
        status: 'READY',
        current_city_id: player.home_port_id,
      })
      .select()
      .single()

    if (shipError) {
      req.log.error({ operation: 'completeOnboarding', code: shipError.code }, 'Failed to create ship')
      return res.status(500).json({ error: 'Failed to create starter ship' })
    }

    // --- Create randomized factory ---
    const { data: factory, error: factoryError } = await supabase
      .from('factories')
      .insert({
        player_id: req.userId,
        factory_type: chosenOutput,
        input_requirements: inputRequirements,
        output_production: { item: chosenOutput, quantity: outputQuantity },
        active: true,
      })
      .select()
      .single()

    if (factoryError) {
      req.log.error({ operation: 'completeOnboarding', code: factoryError.code }, 'Failed to create factory')
      return res.status(500).json({ error: 'Failed to create starter factory' })
    }

    // --- Set starting gold and mark onboarding as complete ---
    const { error: updateError } = await supabase
      .from('players')
      .update({ gold: startingGold, onboarding_complete: true })
      .eq('id', req.userId)

    if (updateError) {
      req.log.error({ operation: 'completeOnboarding', code: updateError.code }, 'Failed to mark onboarding complete')
      return res.status(500).json({ error: 'Failed to complete onboarding' })
    }

    req.log.info({ operation: 'completeOnboarding', shipId: ship.id, factoryId: factory.id, factoryType: chosenOutput, gold: startingGold }, 'Onboarding completed successfully')

    return res.status(200).json({
      message: 'Welcome aboard, Captain!',
      ship,
      factory,
    })
  } catch (err) {
    req.log.error({ operation: 'completeOnboarding', err }, 'Unhandled error in onboarding')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/onboarding/status
 *
 * Returns the onboarding status for the authenticated player.
 * Used by the frontend to decide whether to redirect to onboarding.
 */
router.get('/status', async (req, res) => {
  try {
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, onboarding_complete')
      .eq('id', req.userId)
      .single()

    if (playerError || !player) {
      // Player record might not exist yet if trigger hasn't fired
      return res.status(200).json({ onboarding_complete: null, player_exists: false })
    }

    return res.status(200).json({
      onboarding_complete: player.onboarding_complete,
      player_exists: true,
    })
  } catch (err) {
    req.log.error({ operation: 'getOnboardingStatus', err }, 'Unhandled error in onboarding status')
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
