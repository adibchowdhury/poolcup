'use client'

/** Full-screen splash cover so login never peeks through during native handoff. */
export function MobileSplashOverlay() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
      aria-hidden="true"
    >
      <img
        src="/splashscreen.png"
        alt=""
        className="h-full w-full object-contain"
        draggable={false}
      />
    </div>
  )
}
