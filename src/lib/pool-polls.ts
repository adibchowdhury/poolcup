export const POLL_QUESTION_MAX = 280
export const POLL_OPTION_MAX = 120
export const POLL_OPTIONS_MIN = 2
export const POLL_OPTIONS_MAX = 10

export type PollOption = {
  optionId: string
  label: string
  sortOrder: number
  votes: number
}

export type PoolPoll = {
  pollId: string
  question: string
  closesAt: string | null
  isClosed: boolean
  createdAt: string
  totalVotes: number
  myOptionId: string | null
  options: PollOption[]
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return 0
}

function parseOptions(raw: unknown): PollOption[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const optionId =
        asString(row.option_id) ?? asString(row.optionId) ?? null
      const label = asString(row.label)
      if (!optionId || !label) return null
      return {
        optionId,
        label,
        sortOrder: asNumber(row.sort_order ?? row.sortOrder),
        votes: asNumber(row.votes),
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a!.sortOrder ?? 0) - (b!.sortOrder ?? 0)) as PollOption[]
}

export function parsePoolPoll(raw: unknown): PoolPoll | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const pollId = asString(row.poll_id) ?? asString(row.pollId) ?? asString(row.id)
  const question = asString(row.question)
  const createdAt =
    asString(row.created_at) ?? asString(row.createdAt) ?? null
  if (!pollId || !question || !createdAt) return null
  return {
    pollId,
    question,
    closesAt: asString(row.closes_at) ?? asString(row.closesAt),
    isClosed: Boolean(row.is_closed ?? row.isClosed),
    createdAt,
    totalVotes: asNumber(row.total_votes ?? row.totalVotes),
    myOptionId:
      asString(row.my_option_id) ?? asString(row.myOptionId) ?? null,
    options: parseOptions(row.options),
  }
}

export function formatPollCloseLabel(
  closesAt: string | null,
  isClosed: boolean,
): string | null {
  if (!closesAt) return null
  const at = Date.parse(closesAt)
  if (!Number.isFinite(at)) return null
  if (isClosed || at <= Date.now()) {
    return `Closed ${new Date(at).toLocaleString()}`
  }
  const ms = at - Date.now()
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `Closes in ${Math.max(mins, 1)}m`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `Closes in ${hours}h`
  const days = Math.round(hours / 24)
  return `Closes in ${days}d`
}

export function validatePollComposer(input: {
  question: string
  options: string[]
}): { ok: true; question: string; options: string[] } | { ok: false; error: string } {
  const question = input.question.trim()
  if (!question) return { ok: false, error: 'Enter a question' }
  if (question.length > POLL_QUESTION_MAX) {
    return {
      ok: false,
      error: `Keep the question under ${POLL_QUESTION_MAX} characters`,
    }
  }
  const options = input.options
    .map((o) => o.trim())
    .filter((o) => o.length > 0)
  if (options.length < POLL_OPTIONS_MIN) {
    return { ok: false, error: `Add at least ${POLL_OPTIONS_MIN} options` }
  }
  if (options.length > POLL_OPTIONS_MAX) {
    return { ok: false, error: `At most ${POLL_OPTIONS_MAX} options` }
  }
  for (const opt of options) {
    if (opt.length > POLL_OPTION_MAX) {
      return {
        ok: false,
        error: `Keep options under ${POLL_OPTION_MAX} characters`,
      }
    }
  }
  return { ok: true, question, options }
}

export async function fetchPoolPollsApi(poolId: string): Promise<{
  polls: PoolPoll[]
  error?: string
}> {
  try {
    const res = await fetch(
      `/api/pools/${encodeURIComponent(poolId)}/polls`,
    )
    const data = (await res.json()) as {
      polls?: PoolPoll[]
      error?: string
    }
    if (!res.ok) {
      return { polls: [], error: data.error || 'Could not load polls' }
    }
    return { polls: Array.isArray(data.polls) ? data.polls : [] }
  } catch {
    return { polls: [], error: 'Could not load polls' }
  }
}

export async function createPollApi(
  poolId: string,
  body: { question: string; options: string[]; closesAt?: string | null },
): Promise<{ ok: true; pollId: string } | { ok: false; error: string }> {
  const res = await fetch(
    `/api/pools/${encodeURIComponent(poolId)}/polls`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  const data = (await res.json().catch(() => null)) as {
    pollId?: string
    error?: string
  } | null
  if (!res.ok || !data?.pollId) {
    return { ok: false, error: data?.error || 'Could not create poll' }
  }
  return { ok: true, pollId: data.pollId }
}

export async function castPollVoteApi(
  poolId: string,
  pollId: string,
  optionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(
    `/api/pools/${encodeURIComponent(poolId)}/polls/${encodeURIComponent(pollId)}/vote`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId }),
    },
  )
  const data = (await res.json().catch(() => null)) as {
    error?: string
  } | null
  if (!res.ok) {
    return { ok: false, error: data?.error || 'Could not cast vote' }
  }
  return { ok: true }
}

export async function deletePollApi(
  poolId: string,
  pollId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(
    `/api/pools/${encodeURIComponent(poolId)}/polls/${encodeURIComponent(pollId)}`,
    { method: 'DELETE' },
  )
  const data = (await res.json().catch(() => null)) as {
    error?: string
  } | null
  if (!res.ok) {
    return { ok: false, error: data?.error || 'Could not delete poll' }
  }
  return { ok: true }
}
