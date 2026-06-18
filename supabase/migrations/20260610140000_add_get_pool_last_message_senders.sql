CREATE OR REPLACE FUNCTION public.get_pool_last_message_senders(p_pool_ids uuid[])
RETURNS TABLE (pool_id uuid, user_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT ON (pm.pool_id)
    pm.pool_id,
    pm.user_id
  FROM public.pool_messages pm
  WHERE pm.pool_id = ANY (p_pool_ids)
  ORDER BY pm.pool_id, pm.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_pool_last_message_senders(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_pool_last_message_senders(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_pool_last_message_senders(uuid[]) TO authenticated;
