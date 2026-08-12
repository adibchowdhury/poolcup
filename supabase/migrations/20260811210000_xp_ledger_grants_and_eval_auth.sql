-- =============================================================================
-- XP ledger GRANT surface. Not yet applied to production (do not assume live
-- REVOKEs). Apply when ready; do NOT mix with scoring deploys.
--
-- award_xp / award_prediction_xp / evaluate_user_achievements must be
-- service_role only (SECURITY DEFINER). Website evaluate route is self-only.
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.award_xp(uuid, integer, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp(uuid, integer, text, text, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.award_prediction_xp(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_prediction_xp(uuid)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.get_user_xp_total(uuid)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.level_from_xp(integer)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.xp_for_level(integer)
  TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.evaluate_user_achievements(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_user_achievements(uuid)
  TO service_role;
