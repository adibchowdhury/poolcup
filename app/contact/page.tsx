'use client'

import { useEffect, useRef, useState } from 'react'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DiscordMarkIcon } from '@/components/discord-mark-icon'
import { PublicPageShell } from '@/components/public-page-shell'
import { cn } from '@/lib/utils'
import {
  DISCORD_BLURPLE,
  DISCORD_BLURPLE_HOVER,
  DISCORD_INVITE_URL,
} from '@/src/lib/discord-invite'

const SUPPORT_EMAIL = 'support@getpoolcup.com'
const COPIED_FEEDBACK_MS = 2000

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

            {/* Discord channel — same card + primary-button rhythm */}
            <div
              className={cn(cardBaseClassName, 'border-[#5865F2]/35')}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#5865F2]/15 text-[#5865F2]">
                <DiscordMarkIcon className="h-6 w-6" size={24} />
              </div>
              <div>
                <h2 className="font-sans text-lg font-bold tracking-tight text-foreground">
                  Join us on Discord
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  For questions, feedback, feature requests, and community
                  discussion.
                </p>
              </div>
              <div className="mt-auto pt-2">
                <a
                  href={DISCORD_INVITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 w-full items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition-colors"
                  style={{ backgroundColor: DISCORD_BLURPLE }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = DISCORD_BLURPLE_HOVER
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = DISCORD_BLURPLE
                  }}
                >
                  Visit our Discord →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicPageShell>
  )
}
