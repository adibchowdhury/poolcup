'use client'

export type PoolSettingsPatch = {
  name?: string
  description?: string | null
  acceptingMembers?: boolean
  themeColor?: string | null
  scoreExactPoints?: number | null
  scoreWinnerPoints?: number | null
  scoreDrawPoints?: number | null
  confirmRecalculate?: boolean
}

export type PoolSettingsPatchResult = {
  success: boolean
  actions?: string[]
  unchanged?: boolean
  error?: string
  needsConfirmation?: boolean
  warning?: string
  scoringVersion?: number | null
  matchesRescored?: number | null
  recalculated?: boolean
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
  const data = (await res.json().catch(() => null)) as
    | (PoolSettingsPatchResult & { message?: string })
    | null

  if (res.status === 409 && data?.needsConfirmation) {
    return {
      success: false,
      needsConfirmation: true,
      error:
        data.message ||
        data.error ||
        'Confirmation required to recalculate scoring',
    }
  }

  if (!res.ok) {
    return {
      success: false,
      error:
        (data && typeof data.error === 'string' ? data.error : null) ||
        'Could not save settings',
    }
  }
  return { success: true, ...data }
}
