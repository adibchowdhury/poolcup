'use client'

import { DotLottieReact } from '@lottiefiles/dotlottie-react'

type CreatePoolPlanFireLottieProps = {
  animate?: boolean
}

export function CreatePoolPlanFireLottie({
  animate = true,
}: CreatePoolPlanFireLottieProps) {
  return (
    <DotLottieReact
      src="/fireflame.lottie"
      autoplay={animate}
      loop={animate}
      width={130}
      height={130}
      className="create-pool-plan-card__fire-streak__media"
    />
  )
}
