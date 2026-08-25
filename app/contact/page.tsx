'use client'

import { useEffect, useRef, useState } from 'react'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PublicPageShell } from '@/components/public-page-shell'
import { cn } from '@/lib/utils'

const REDDIT_COMMUNITY_URL = 'https://www.reddit.com/r/PoolCupCommunity/'
const SUPPORT_EMAIL = 'support@getpoolcup.com'
const COPIED_FEEDBACK_MS = 2000

/** Official-style Reddit mark (Simple Icons path), sized for card icon use. */
function RedditMarkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.028l2.907.617a1.214 1.214 0 0 1 1.108-.701zM9.607 12c-.534 0-.969.434-.969.969 0 .535.435.969.969.969.535 0 .969-.434.969-.969 0-.535-.434-.969-.969-.969zm4.786 0c-.535 0-.969.434-.969.969 0 .535.434.969.969.969.534 0 .969-.434.969-.969 0-.535-.435-.969-.969-.969zm-4.786 2.378a.715.715 0 0 0 0 1.428c.957 0 1.843.34 2.536.907a.715.715 0 0 0 .995 0c.693-.567 1.579-.907 2.536-.907a.715.715 0 0 0 0-1.428c-1.254 0-2.397.465-3.286 1.21-.889-.745-2.032-1.21-3.286-1.21z" />
    </svg>
  )
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to execCommand path (permissions / insecure context).
    }
  }

  try {
    const input = document.createElement('textarea')
    input.value = text
    input.setAttribute('readonly', '')
    input.style.position = 'fixed'
    input.style.top = '0'
    input.style.left = '0'
    input.style.width = '1px'
    input.style.height = '1px'
    input.style.padding = '0'
    input.style.border = 'none'
    input.style.outline = 'none'
    input.style.boxShadow = 'none'
    input.style.background = 'transparent'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.focus()
    input.select()
    input.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(input)
    return ok
  } catch {
    return false
  }
}

const cardBaseClassName = cn(
  'flex flex-col gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm',
  'sm:p-8',
)

export default function ContactPage() {
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  async function handleCopyEmail() {
    const ok = await copyTextToClipboard(SUPPORT_EMAIL)
    if (!ok) return

    setCopied(true)
    if (copiedTimerRef.current !== null) {
      window.clearTimeout(copiedTimerRef.current)
    }
    copiedTimerRef.current = window.setTimeout(() => {
      setCopied(false)
      copiedTimerRef.current = null
    }, COPIED_FEEDBACK_MS)
  }

  return (
    <PublicPageShell>
      <div className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <h1 className="font-display text-4xl tracking-wide text-foreground md:text-6xl">
              Get in <span className="text-primary">Touch</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              PoolCup is easy to reach — pick the channel that fits your question.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:mt-16 sm:grid-cols-2 sm:gap-6">
            {/* Email channel — copy primary; address shown as plain text */}
            <div className={cn(cardBaseClassName, 'border-border')}>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Mail className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="font-sans text-lg font-bold tracking-tight text-foreground">
                  Email us
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  For account, billing, bug reports, or private issues.
                </p>
                <p className="mt-3 font-sans text-sm font-medium text-foreground break-all">
                  {SUPPORT_EMAIL}
                </p>
              </div>
              <div className="mt-auto pt-2">
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => {
                    void handleCopyEmail()
                  }}
                  aria-live="polite"
                >
                  {copied ? 'Copied ✓' : 'Copy email address'}
                </Button>
              </div>
            </div>

            {/* Reddit channel — same card + primary-button rhythm */}
            <div
              className={cn(cardBaseClassName, 'border-[#FF4500]/35')}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FF4500]/15 text-[#FF4500]">
                <RedditMarkIcon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-sans text-lg font-bold tracking-tight text-foreground">
                  Join us on Reddit
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  For questions, feedback, feature requests, and community
                  discussion.
                </p>
              </div>
              <div className="mt-auto pt-2">
                <Button
                  asChild
                  className="w-full border-[#FF4500] bg-[#FF4500] text-white hover:border-[#E03E00] hover:bg-[#E03E00]"
                >
                  <a
                    href={REDDIT_COMMUNITY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Visit our Reddit →
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicPageShell>
  )
}
