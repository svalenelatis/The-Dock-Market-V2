-- Migration: Seed starting_player_state configuration
-- Controls onboarding defaults: starting gold, first ship stats, first factory options.
-- The onboarding route reads this at runtime so admins can tune it without code changes.

INSERT INTO configurations (key, value)
VALUES ('starting_player_state', '{
  "starting_gold": 100,
  "first_ship": {
    "speed": 1,
    "cargo_capacity": 15
  },
  "first_factory": {
    "possible_outputs": ["Grain", "Water", "Textiles", "Iron Ore", "Stone", "Wood"],
    "possible_inputs": [],
    "output_quantity": 2
  }
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
