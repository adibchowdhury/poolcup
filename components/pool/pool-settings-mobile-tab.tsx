'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ChevronRight,
  Info,
  Megaphone,
  Search,
  Shield,
  Trophy,
  Users,
} from 'lucide-react'
import {
  PoolSettingsAccordionSubs,
  POOL_SETTINGS_ACCORDION_CLASS,
} from '@/components/pool/pool-settings-accordion-subs'
import {
  PoolSettingsCommissionerSection,
  PoolSettingsCommunicationSection,
  PoolSettingsDangerSection,
  PoolSettingsDetailsSection,
  PoolSettingsMembersSection,
  PoolSettingsScoringSection,
  type PoolSettingsTabProps,
} from '@/components/pool/pool-settings-tab'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import {
  controlIdForSearchItem,
  filterPoolSettingsSearch,
  isPoolSettingsSectionId,
  POOL_SETTINGS_SECTIONS,
  sectionTitleForId,
  type PoolSettingsControlId,
  type PoolSettingsSectionId,
} from '@/src/lib/pool-settings-nav'
import { scrollToPoolSetting } from '@/src/lib/pool-settings-scroll'

const SEARCH_DEBOUNCE_MS = 200
const OBSERVER_IGNORE_MS = 1600

const SECTION_ICONS = {
  details: Info,
  scoring: Trophy,
  members: Users,
  communication: Megaphone,
  commissioner: Shield,
  danger: AlertTriangle,
} as const

const SECTION_SCREENS = {
  details: PoolSettingsDetailsSection,
  scoring: PoolSettingsScoringSection,
  members: PoolSettingsMembersSection,
  communication: PoolSettingsCommunicationSection,
  commissioner: PoolSettingsCommissionerSection,
  danger: PoolSettingsDangerSection,
} as const

type PoolSettingsMobileTabProps = {
  tabProps: PoolSettingsTabProps
  initialSection?: string | null
}

export function PoolSettingsMobileTab({
  tabProps,
  initialSection = null,
}: PoolSettingsMobileTabProps) {
  const searchId = useId()
  const resultsId = useId()
  const [section, setSection] = useState<PoolSettingsSectionId | null>(() =>
    isPoolSettingsSectionId(initialSection) ? initialSection : null,
  )
  const [activeSubItem, setActiveSubItem] =
    useState<PoolSettingsControlId | null>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [opened, setOpened] = useState<Set<PoolSettingsSectionId>>(
    () =>
      new Set(
        isPoolSettingsSectionId(initialSection) ? [initialSection] : [],
      ),
  )
  const pendingScrollRef = useRef<string | null>(null)
  const ignoreObserverUntilRef = useRef(0)

  function openSection(next: PoolSettingsSectionId) {
    setSection(next)
    setOpened((prev) => {
      if (prev.has(next)) return prev
      const copy = new Set(prev)
      copy.add(next)
      return copy
    })
  }

  useEffect(() => {
    if (!isPoolSettingsSectionId(initialSection)) return
    openSection(initialSection)
  }, [initialSection])

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

  function markSubItem(controlId: PoolSettingsControlId) {
    setActiveSubItem(controlId)
    ignoreObserverUntilRef.current = Date.now() + OBSERVER_IGNORE_MS
  }

  function jumpToControl(
    controlId: PoolSettingsControlId,
    nextSection: PoolSettingsSectionId,
  ) {
    markSubItem(controlId)
    if (nextSection !== section) {
      pendingScrollRef.current = controlId
      openSection(nextSection)
      return
    }
    scrollToPoolSetting(controlId)
  }

  function selectSearchItem(sectionId: PoolSettingsSectionId, controlId: PoolSettingsControlId | null) {
    openSection(sectionId)
    if (controlId) {
      markSubItem(controlId)
      pendingScrollRef.current = controlId
    } else {
      setActiveSubItem(null)
    }
    setQuery('')
    setDebouncedQuery('')
  }

  useEffect(() => {
    const controlId = pendingScrollRef.current
    if (!controlId || searchActive) return
    let cancelled = false
    let attempts = 0
    const tryScroll = () => {
      if (cancelled) return
      if (scrollToPoolSetting(controlId) || attempts >= 12) {
        pendingScrollRef.current = null
        return
      }
      attempts += 1
      window.setTimeout(tryScroll, 40)
    }
    const frame = window.requestAnimationFrame(tryScroll)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [section, searchActive])

  useEffect(() => {
    if (!section || searchActive) return
    const controls = document.querySelectorAll('[data-pool-setting]')
    if (controls.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < ignoreObserverUntilRef.current) return
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const next = visible[0]?.target.getAttribute('data-pool-setting')
        if (next) setActiveSubItem(next as PoolSettingsControlId)
      },
      { root: null, rootMargin: '-20% 0px -55% 0px', threshold: [0.1, 0.25] },
    )
    controls.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [section, searchActive, tabProps.poolId])

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
              const destructive =
                POOL_SETTINGS_SECTIONS.find((row) => row.id === item.sectionId)
                  ?.destructive === true
              return (
                <li
                  key={item.id}
                  className={cn(index > 0 && 'border-t border-border/70')}
                >
                  <button
                    type="button"
                    className={cn(
                      'relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40',
                      FOCUS_VISIBLE_RING,
                      'focus-visible:z-10',
                      destructive && 'hover:bg-destructive/10',
                    )}
                    onClick={() =>
                      selectSearchItem(
                        item.sectionId,
                        controlIdForSearchItem(item),
                      )
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {sectionTitleForId(item.sectionId)}
                      </p>
                    </div>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border bg-card/50">
            {POOL_SETTINGS_SECTIONS.map((row, index) => {
              const Icon = SECTION_ICONS[row.id]
              const expanded = row.id === section
              const SectionScreen = SECTION_SCREENS[row.id]
              return (
                <li
                  key={row.id}
                  className={cn(
                    index > 0 && 'border-t border-border/70',
                    row.destructive && 'bg-destructive/[0.06]',
                  )}
                >
                  <button
                    type="button"
                    aria-expanded={expanded}
                    className={cn(
                      'relative flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40',
                      FOCUS_VISIBLE_RING,
                      'focus-visible:z-10',
                      row.destructive && 'hover:bg-destructive/10',
                    )}
                    onClick={() => {
                      if (expanded) {
                        setSection(null)
                        setActiveSubItem(null)
                        return
                      }
                      setActiveSubItem(null)
                      openSection(row.id)
                    }}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        row.destructive
                          ? 'text-destructive'
                          : 'text-muted-foreground',
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'font-display text-base tracking-wide',
                          row.destructive
                            ? 'text-destructive'
                            : 'text-foreground',
                        )}
                      >
                        {row.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {row.subtitle}
                      </p>
                    </div>
                    <ChevronRight
                      className={cn(
                        'h-4 w-4 shrink-0 transition-transform duration-[220ms] ease-out motion-reduce:transition-none',
                        expanded && 'rotate-90',
                        row.destructive
                          ? 'text-destructive/80'
                          : 'text-muted-foreground',
                      )}
                      aria-hidden
                    />
                  </button>
                  <PoolSettingsAccordionSubs
                    sectionId={row.id}
                    sectionTitle={row.title}
                    expanded={expanded}
                    activeSubItem={activeSubItem}
                    destructive={row.destructive}
                    onJump={(controlId) => jumpToControl(controlId, row.id)}
                  />
                  <div
                    className={POOL_SETTINGS_ACCORDION_CLASS}
                    style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
                  >
                    <div
                      className="min-h-0 overflow-hidden"
                      inert={expanded ? undefined : true}
                      aria-hidden={!expanded}
                    >
                      {opened.has(row.id) ? (
                        <div className="px-4 pb-4 pt-1">
                          <SectionScreen {...tabProps} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
