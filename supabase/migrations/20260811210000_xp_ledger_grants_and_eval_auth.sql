-- =============================================================================
-- XP ledger GRANT surface. Not yet applied to production (do not assume live
-- REVOKEs). Apply when ready; do NOT mix with scoring deploys.
--
-- award_xp / award_prediction_xp must be service_role only (SECURITY DEFINER).
-- evaluate_user_achievements is invoked from /api/xp/evaluate as the signed-in
-- user only (app-layer auth.uid() = self).
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
