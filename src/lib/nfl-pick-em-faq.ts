/**
 * Single source for /nfl-pick-em FAQ — visible Accordion + FAQPage JSON-LD.
 * Plain strings only so schema text matches the UI verbatim.
 */
export type NflPickEmFaqItem = {
  question: string
  answer: string
}

/**
 * Locking (verified): matches.locked_at is set to kickoff_at at sync
 * (sync-american-football); isMatchLocked() locks when locked_at <= now —
 * picks lock at kickoff, per game.
 *
 * Mid-season join (verified): join is gated only by pools.accepting_members
 * (commissioner can close). No season-progress block — late joiners pick
 * remaining unlocked games; past kickoffs stay locked.
 */
export const NFL_PICK_EM_FAQ_ITEMS: readonly NflPickEmFaqItem[] = [
  {
    question: 'Is NFL Pick\'em free on PoolCup?',
    answer:
      'Yes. You can create a free Basic pool for the NFL season and invite friends at no cost — members always play free. If you want commissioner extras like a custom logo, colors, or co-commissioners, Custom Pool is a $9.99 one-time upgrade on that pool (not a subscription).',
  },
  {
    question: 'How does scoring work?',
    answer:
      'Each week you pick the winner of every NFL game on the slate — no spreads or point totals. Correct picks earn points, and the leaderboard updates automatically when results post. No spreadsheets required.',
  },
  {
    question: 'How many people can join my pool?',
    answer:
      'Any group size works. PoolCup fits a small office chat or a full league of rivals — there is no member cap on a Basic or Custom pool for pick\'em play.',
  },
  {
    question: 'Can I run a pick\'em pool for my office or league?',
    answer:
      'Yes. Create a pool, share one invite link, and everyone joins in the browser. PoolCup keeps score for you so you are not chasing picks in a spreadsheet or group chat.',
  },
  {
    question: 'When do picks lock?',
    answer:
      'Picks lock at each game\'s kickoff. Once that match\'s kickoff time is reached, its prediction is locked; you can still pick other games that have not kicked off yet.',
  },
  {
    question: 'Can I join mid-season?',
    answer:
      'Yes, as long as the pool is still accepting members. You can make picks on remaining games that have not kicked off; games already locked at kickoff cannot be predicted after the fact.',
  },
] as const

/** FAQPage JSON-LD built from the same array as the visible FAQ. */
export function buildNflPickEmFaqJsonLd(
  items: readonly NflPickEmFaqItem[] = NFL_PICK_EM_FAQ_ITEMS,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}
