'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import type { NflPickEmFaqItem } from '@/src/lib/nfl-pick-em-faq'

/**
 * Pricing-page Accordion pattern for /nfl-pick-em FAQ.
 * forceMount keeps answers in the HTML for crawlers even when closed.
 */
export function NflPickEmFaqAccordion({
  items,
}: {
  items: readonly NflPickEmFaqItem[]
}) {
  return (
    <Accordion type="single" collapsible className="mt-10 w-full">
      {items.map((item, index) => (
        <AccordionItem
          key={item.question}
          value={`nfl-faq-${index}`}
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
