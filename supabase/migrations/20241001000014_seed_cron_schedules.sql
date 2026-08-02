-- Migration: Seed default cron schedule configurations for the in-process scheduler.
-- These schedules are read by backend/lib/scheduler.js on boot.
-- Values are standard cron expressions (minute hour day month weekday).

INSERT INTO configurations (key, value)
VALUES
    ('cron_transactions', '"0 * * * *"'::jsonb),    -- Every hour at :00
    ('cron_factories', '"0 */6 * * *"'::jsonb),     -- Every 6 hours (00:00, 06:00, 12:00, 18:00)
    ('cron_market', '"0 */6 * * *"'::jsonb)         -- Every 6 hours (00:00, 06:00, 12:00, 18:00)
ON CONFLICT (key) DO NOTHING;
