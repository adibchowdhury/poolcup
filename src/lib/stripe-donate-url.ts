/** Stripe Payment Link (donate.stripe.com) — not a server-created Checkout Session. */
export const STRIPE_DONATE_BASE_URL =
  'https://donate.stripe.com/aFa9ASayG42Q9P5g1K4ZG00'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidDonorUserId(userId: string): boolean {
  return UUID_RE.test(userId)
}

/** Append client_reference_id for logged-in donors (Payment Link URL parameter). */
export function buildStripeDonateUrl(userId?: string | null): string {
  if (!userId || !isValidDonorUserId(userId)) {
    return STRIPE_DONATE_BASE_URL
  }

  const url = new URL(STRIPE_DONATE_BASE_URL)
  url.searchParams.set('client_reference_id', userId)
  return url.toString()
}
