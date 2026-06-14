CREATE OR REPLACE FUNCTION public.get_pool_member_avatars(p_pool_id uuid)
RETURNS TABLE (member_id uuid, user_id uuid, display_name text, avatar text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pm.id, pm.user_id, pm.display_name, u.avatar
  FROM pool_members pm
  LEFT JOIN users u ON u.id = pm.user_id
  WHERE pm.pool_id = p_pool_id
    AND EXISTS (
      SELECT 1 FROM pool_members me
      WHERE me.pool_id = p_pool_id AND me.user_id = auth.uid()
    );
$$;
REVOKE ALL ON FUNCTION public.get_pool_member_avatars(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_pool_member_avatars(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_pool_member_avatars(uuid) TO authenticated;
