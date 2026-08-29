'use client'

/**
 * Login right-panel testimonial — frozen near the panel bottom.
 * Quote body + marks: Caveat (handwritten). Attribution stays muted Inter.
 * Opening mark is inline with the first line; closing mark stays end-inline.
 */
const QUOTE =
  'Every game feels more exciting with predictions, bragging rights, and a leaderboard on the line. Nothing beats calling the score perfectly.'

export function LoginPanelTestimonial() {
  // Fixed podium↔quote gap (~32px / mt-8) — preserved while the pair centers as one block.
  // Attribution gap: mt-3 (~12px).
  // Caveat ~1.38× Inter: 13px → 18px keeps visual presence of the prior UI face.
  return (
    <figure className="relative z-10 mx-auto mt-8 w-full max-w-[88%] shrink-0 px-5 pb-0 pt-0">
      <blockquote className="font-quote text-[18px] font-normal leading-[1.45] text-[#F4F7FA]">
        <span
          className="mr-0.5 inline font-quote text-[26px] font-semibold leading-none text-[#F2C94C]/45"
          aria-hidden
        >
          “
        </span>
        {QUOTE}
        <span
          className="ml-0.5 inline font-quote text-[26px] font-semibold leading-none text-[#F2C94C]/45"
          aria-hidden
        >
          ”
        </span>
      </blockquote>

      <figcaption className="mt-3 text-xs leading-tight text-[#91A39D]">
        — PoolCup player
      </figcaption>
    </figure>
  )
}
