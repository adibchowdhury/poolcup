import {
  buildPickEmFaqJsonLd,
  type PickEmFaqItem,
} from '@/src/lib/pick-em-marketing-faq'

/**
 * Single source for /college-football-pick-em FAQ — visible Accordion + FAQPage JSON-LD.
 * Winner-pick model; honest about CFB launch timing vs live NFL pools.
 */
export const CFB_PICK_EM_FAQ_ITEMS: readonly PickEmFaqItem[] = [
  {
    question: 'Is college football pick\'em free on PoolCup?',
    answer:
      'Yes. You will be able to create a free Basic college football pick\'em pool for the season and invite friends at no cost — members always play free. Custom Pool is a $9.99 one-time upgrade if you want commissioner extras like a custom logo, colors, or co-commissioners (not a subscription).',
  },
  {
    question: 'When can I create a college football pool?',
    answer:
      'College football pick\'em pools on PoolCup are launching in the next few days ahead of the 2026 season. NFL Pick\'em is live now — you can create a free NFL pick\'em pool today while we finish the CFB launch.',
  },
  {
    question: 'How does scoring work?',
    answer:
      'Each week you make weekly picks on the winner of every game on the Saturday slate — no spreads or point totals. Correct picks earn points, and the leaderboard updates automatically when results post.',
  },
  {
    question: 'When do picks lock?',
    answer:
      'Picks lock at each game\'s kickoff. Once that matchup\'s kickoff time is reached, its prediction is locked; you can still pick other games that have not kicked off yet.',
  },
  {
    question: 'Can I join a pick\'em pool mid-season?',
    answer:
      'Yes, as long as the pool is still accepting members. You can make picks on remaining games that have not kicked off; games already locked at kickoff cannot be predicted after the fact.',
  },
  {
    question: 'Can I run a college football pick em league for my office?',
    answer:
      'Yes. Create a pick\'em pool, share one invite link, and everyone joins in the browser. PoolCup keeps score for you so you are not chasing picks in a spreadsheet or group chat.',
  },
] as const

export function buildCfbPickEmFaqJsonLd(
  items: readonly PickEmFaqItem[] = CFB_PICK_EM_FAQ_ITEMS,
) {
  return buildPickEmFaqJsonLd(items)
}
