'use client'

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import {
  filterPoolSettingsSearch,
  POOL_SETTINGS_SECTIONS,
  poolSettingsPath,
  sectionTitleForId,
} from '@/src/lib/pool-settings-nav'

const SEARCH_DEBOUNCE_MS = 200

const ROW_CLASS = cn(
  'relative flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40',
  FOCUS_VISIBLE_RING,
  'focus-visible:z-10',
)

function SettingsNavRow({
  href,
  onSelect,
  className,
  children,
}: {
  href: string
  onSelect?: () => void
  className: string
  children: ReactNode
}) {
  if (onSelect) {
    return (
      <button type="button" onClick={onSelect} className={className}>
        {children}
      </button>
    )
  }
  return (
    <Link href={href} prefetch={false} className={className}>
      {children}
    </Link>
  )
}

/**
 * Static hub (search + six rows). Needs only inviteCode — no pool/member fetch.
 */
export function PoolSettingsHubList({
  inviteCode,
  onSelectSection,
}: {
  inviteCode: string
  onSelectSection?: (id: string) => void
}) {
  const searchId = useId()
  const resultsId = useId()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery('')
      return
    }
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  const searchActive = debouncedQuery.trim().length > 0
  const matches = useMemo(
    () => (searchActive ? filterPoolSettingsSearch(debouncedQuery) : []),
    [debouncedQuery, searchActive],
  )

  function sectionHref(id: string) {
    return poolSettingsPath(inviteCode, id)
  }

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search settings…"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search pool settings"
          aria-controls={resultsId}
          className={cn(
            'h-11 rounded-xl border-border bg-card/90 pl-10 pr-3 shadow-none',
            FOCUS_VISIBLE_RING,
          )}
        />
      </div>

      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Pool Settings
      </p>

      <div id={resultsId} aria-live="polite">
        {searchActive && matches.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
            No settings match
          </p>
        ) : searchActive ? (
          <ul className="overflow-hidden rounded-2xl border border-border bg-card/50">
            {matches.map((item, index) => {
              const sectionTitle = sectionTitleForId(item.sectionId)
              return (
                <li
                  key={item.id}
                  className={cn(index > 0 && 'border-t border-border/70')}
                >
                  <SettingsNavRow
                    href={sectionHref(item.sectionId)}
                    onSelect={
                      onSelectSection
                        ? () => onSelectSection(item.sectionId)
                        : undefined
                    }
                    className={cn(
                      'relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40',
                      FOCUS_VISIBLE_RING,
                      'focus-visible:z-10',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {sectionTitle}
                      </p>
                    </div>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </SettingsNavRow>
                </li>
              )
            })}
          </ul>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border bg-card/50">
            {POOL_SETTINGS_SECTIONS.map((section, index) => (
              <li
                key={section.id}
                className={cn(
                  index > 0 && 'border-t border-border/70',
                  section.destructive && 'bg-destructive/[0.06]',
                )}
              >
                <SettingsNavRow
                  href={sectionHref(section.id)}
                  onSelect={
                    onSelectSection
                      ? () => onSelectSection(section.id)
                      : undefined
                  }
                  className={cn(
                    ROW_CLASS,
                    section.destructive && 'hover:bg-destructive/10',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'font-display text-base tracking-wide',
                        section.destructive
                          ? 'text-destructive'
                          : 'text-foreground',
                      )}
                    >
                      {section.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {section.subtitle}
                    </p>
                  </div>
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 shrink-0',
                      section.destructive
                        ? 'text-destructive/80'
                        : 'text-muted-foreground',
                    )}
                    aria-hidden
                  />
                </SettingsNavRow>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
