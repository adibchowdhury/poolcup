'use client'

import dynamic from 'next/dynamic'

function CreatePoolPlanFirePlaceholder() {
  return (
    <span
      className="create-pool-plan-card__fire-streak__media create-pool-plan-card__fire-streak__media--placeholder"
      aria-hidden
    />
  )
}

const CreatePoolPlanFireLottie = dynamic(
  () =>
    import('./create-pool-plan-fire-lottie').then(
      (mod) => mod.CreatePoolPlanFireLottie,
    ),
  {
    ssr: false,
    loading: () => <CreatePoolPlanFirePlaceholder />,
  },
)

type CreatePoolPlanFireAccentProps = {
  prefersReducedMotion: boolean
}

export function CreatePoolPlanFireAccent({
  prefersReducedMotion,
}: CreatePoolPlanFireAccentProps) {
  return (
    <span className="create-pool-plan-card__fire-streak" aria-hidden>
      <CreatePoolPlanFireLottie animate={!prefersReducedMotion} />
    </span>
  )
}
