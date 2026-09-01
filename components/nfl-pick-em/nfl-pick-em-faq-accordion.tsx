'use client'

import { PickEmFaqAccordion } from '@/components/pick-em-marketing/pick-em-faq-accordion'
import type { NflPickEmFaqItem } from '@/src/lib/nfl-pick-em-faq'

/** NFL wrapper — shared accordion with NFL value prefix. */
export function NflPickEmFaqAccordion({
  items,
}: {
  items: readonly NflPickEmFaqItem[]
}) {
  return <PickEmFaqAccordion items={items} valuePrefix="nfl-faq" />
}
