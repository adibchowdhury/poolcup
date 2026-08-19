-- =============================================================================
-- Already applied to production via MCP. Documentation/rebuild parity only.
-- Do NOT run against production.
--
-- App-side removal: the global /leaderboard page and global-rank surfaces
-- (profile hero, dashboard chip, client RPCs) were deleted. Friends XP
-- leaderboard, pool leaderboards, and get_user_best_rank are unaffected.
--
-- Drops orphaned global-rank RPCs:
--   - get_user_global_rank(uuid)
--   - get_global_xp_leaderboard_page(integer, integer)
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_user_global_rank(uuid);
DROP FUNCTION IF EXISTS public.get_global_xp_leaderboard_page(integer, integer);
