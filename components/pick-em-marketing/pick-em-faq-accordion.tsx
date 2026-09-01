'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import type { PickEmFaqItem } from '@/src/lib/pick-em-marketing-faq'

/**
 * Shared pricing-page Accordion pattern for pick'em marketing FAQs.
 * forceMount keeps answers in the HTML for crawlers even when closed.
 */
export function PickEmFaqAccordion({
  items,
  valuePrefix,
}: {
  items: readonly PickEmFaqItem[]
  valuePrefix: string
}) {
  return (
    <Accordion type="single" collapsible className="mt-10 w-full">
      {items.map((item, index) => (
        <AccordionItem
          key={item.question}
          value={`${valuePrefix}-${index}`}
          className="border-[rgba(255,255,255,0.08)]"
        >
          <AccordionTrigger className="text-left text-base text-[#f0f4f8] hover:text-[#00e676] hover:no-underline">
            {item.question}
          </AccordionTrigger>
          <AccordionContent forceMount className="text-[#728d9c]">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
