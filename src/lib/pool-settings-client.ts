'use client'

export type PoolSettingsPatch = {
  name?: string
  description?: string | null
  acceptingMembers?: boolean
  themeColor?: string | null
  scoreExactPoints?: number | null
  scoreWinnerPoints?: number | null
  scoreDrawPoints?: number | null
}

export type PoolSettingsPatchResult = {
  success: boolean
  actions?: string[]
  unchanged?: boolean
  error?: string
  pool?: {
    name: string
    description: string | null
    acceptingMembers: boolean
    themeColor: string | null
    scoreExactPoints: number | null
    scoreWinnerPoints: number | null
    scoreDrawPoints: number | null
  }
}

export async function patchPoolSettings(
  poolId: string,
  body: PoolSettingsPatch,
): Promise<PoolSettingsPatchResult> {
  const res = await fetch(
    `/api/pools/${encodeURIComponent(poolId)}/settings`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  const data = (await res.json().catch(() => null)) as PoolSettingsPatchResult | null
  if (!res.ok) {
    return {
      success: false,
      error:
        (data && 'error' in data && typeof (data as { error?: string }).error === 'string'
          ? (data as { error: string }).error
          : null) || 'Could not save settings',
    }
  }
  return { success: true, ...data }
}
