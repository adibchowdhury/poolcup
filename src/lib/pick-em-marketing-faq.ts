/** Shared FAQ item shape for pick'em marketing pages (visible UI + FAQPage JSON-LD). */
export type PickEmFaqItem = {
  question: string
  answer: string
}

/** FAQPage JSON-LD built from the same array as the visible FAQ accordion. */
export function buildPickEmFaqJsonLd(items: readonly PickEmFaqItem[]) {
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
