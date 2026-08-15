/**
 * Retry wrapper for transient Supabase/pooler connection failures.
 * Used by live-sync startup DB reads (sporting_events, match window).
 */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Detect pooler / Envoy / network blips (e.g. connect error 111). */
export function isTransientDbError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('upstream connect error') ||
    m.includes('disconnect/reset before headers') ||
    m.includes('delayed connect error') ||
    m.includes('connect error: 111') ||
    m.includes('econnrefused') ||
    m.includes('econnreset') ||
    m.includes('etimedout') ||
    m.includes('socket hang up') ||
    m.includes('fetch failed') ||
    m.includes('network request failed') ||
    m.includes('connection refused') ||
    m.includes('temporarily unavailable') ||
    /\b502\b/.test(m) ||
    /\b503\b/.test(m) ||
    /\b504\b/.test(m)
  )
}

export type TransientDbRetryOptions = {
  /** Total attempts including the first. Default 4. */
  attempts?: number
  /** Initial backoff in ms; doubles each retry. Default 500 → 1s → 2s. */
  baseDelayMs?: number
}

/**
 * Run `fn` with exponential backoff on transient DB/pooler errors.
 * Non-transient errors throw immediately. Exhausted retries rethrow last error.
 */
export async function withTransientDbRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options?: TransientDbRetryOptions,
): Promise<T> {
  const attempts = options?.attempts ?? 4
  const baseDelayMs = options?.baseDelayMs ?? 500
  let lastError: unknown

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const msg = err instanceof Error ? err.message : String(err)
      const canRetry = isTransientDbError(msg) && i < attempts - 1
      if (!canRetry) throw err

      const delay = baseDelayMs * 2 ** i
      console.warn(
        `${label}: transient DB error (attempt ${i + 1}/${attempts}), retrying in ${delay}ms:`,
        msg,
      )
      await sleep(delay)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? 'transient DB retry exhausted'))
}
