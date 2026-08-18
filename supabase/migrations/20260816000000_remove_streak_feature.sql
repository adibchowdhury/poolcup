-- =============================================================================
-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production.
--
-- Removes the prediction-day streak feature:
--   - Claw back achievement XP for streak_days_7 / 30 / 100
--     (13,500 XP from 135 users)
--   - Delete those user_achievements + catalogue rows
--     (Committed / Dedicated / Relentless; condition_metric = streak_days)
--   - Drop award_streak_milestones(uuid, integer)
--     and get_prediction_streak(uuid)
--   - Drop users.last_seen_streak
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. XP clawback
-- ---------------------------------------------------------------------------
DELETE FROM public.xp_transactions
WHERE source_type = 'achievement'
  AND source_id IN ('streak_days_7', 'streak_days_30', 'streak_days_100');
-- 13,500 XP clawed back from 135 users

-- ---------------------------------------------------------------------------
-- 2. Earned badges
-- ---------------------------------------------------------------------------
DELETE FROM public.user_achievements
WHERE achievement_id IN ('streak_days_7', 'streak_days_30', 'streak_days_100');

-- ---------------------------------------------------------------------------
-- 3. Catalogue rows (Committed / Dedicated / Relentless)
-- ---------------------------------------------------------------------------
DELETE FROM public.achievements
WHERE condition_metric = 'streak_days';

-- ---------------------------------------------------------------------------
-- 4. Functions (live signatures)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.award_streak_milestones(uuid, integer);
DROP FUNCTION IF EXISTS public.get_prediction_streak(uuid);

-- ---------------------------------------------------------------------------
-- 5. Column
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  DROP COLUMN IF EXISTS last_seen_streak;
