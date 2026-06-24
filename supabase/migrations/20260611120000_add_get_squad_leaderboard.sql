CREATE OR REPLACE FUNCTION public.get_squad_leaderboard()
RETURNS TABLE (
  rank integer,
  pool_id uuid,
  name text,
  avatar text,
  scoring_style text,
  member_count integer,
  total_points integer,
  avg_points numeric,
  is_mine boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH squad_stats AS (
    SELECT
      p.id AS pool_id,
      p.name,
      p.avatar,
      p.scoring_style::text AS scoring_style,
      COUNT(pm.id)::integer AS member_count,
      COALESCE(SUM(lc.total_points), 0)::integer AS total_points
    FROM pools p
    INNER JOIN pool_members pm ON pm.pool_id = p.id
    LEFT JOIN leaderboard_cache lc
      ON lc.pool_id = p.id AND lc.member_id = pm.id
    GROUP BY p.id, p.name, p.avatar, p.scoring_style
    HAVING COUNT(pm.id) >= 3
      AND COALESCE(SUM(lc.total_points), 0) > 0
  ),
  ranked AS (
    SELECT
      ROW_NUMBER() OVER (
        ORDER BY
          ROUND((total_points::numeric / member_count::numeric), 1) DESC,
          total_points DESC,
          name ASC
      )::integer AS rank,
      pool_id,
      name,
      avatar,
      scoring_style,
      member_count,
      total_points,
      ROUND((total_points::numeric / member_count::numeric), 1) AS avg_points
    FROM squad_stats
  )
  SELECT
    r.rank,
    r.pool_id,
    r.name,
    r.avatar,
    r.scoring_style,
    r.member_count,
    r.total_points,
    r.avg_points,
    EXISTS (
      SELECT 1
      FROM pool_members me
      WHERE me.pool_id = r.pool_id
        AND me.user_id = auth.uid()
    ) AS is_mine
  FROM ranked r
  ORDER BY r.rank;
$$;

REVOKE ALL ON FUNCTION public.get_squad_leaderboard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_squad_leaderboard() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_squad_leaderboard() TO authenticated;
