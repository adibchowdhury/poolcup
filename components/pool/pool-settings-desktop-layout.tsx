'use client'

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
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
import { PoolSettingsSectionPane } from '@/components/pool/pool-settings-hub'
import {
  PoolSettingsAccordionSubs,
  poolSettingsSubNavKey,
} from '@/components/pool/pool-settings-accordion-subs'
import type { PoolSettingsTabProps } from '@/components/pool/pool-settings-tab'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import {
  controlIdForSearchItem,
  filterPoolSettingsSearch,
  POOL_SETTINGS_SECTIONS,
  sectionTitleForId,
  subItemsForSection,
  type PoolSettingsControlId,
  type PoolSettingsSectionId,
} from '@/src/lib/pool-settings-nav'
import { scrollToPoolSetting } from '@/src/lib/pool-settings-scroll'

const SEARCH_DEBOUNCE_MS = 200
const DEFAULT_SECTION: PoolSettingsSectionId = 'details'
const OBSERVER_IGNORE_MS = 1600

const SECTION_ICONS = {
  details: Info,
  scoring: Trophy,
  members: Users,
  communication: Megaphone,
  commissioner: Shield,
  danger: AlertTriangle,
} as const

const NAV_ITEM_CLASS = cn(
  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-medium transition-colors',
  FOCUS_VISIBLE_RING,
)

function parseSubNavKey(key: string): PoolSettingsControlId | null {
  if (!key.startsWith('sub:')) return null
  return key.slice(4) as PoolSettingsControlId
}

type PoolSettingsDesktopLayoutProps = {
  tabProps: PoolSettingsTabProps
  open: boolean
}

export function PoolSettingsDesktopLayout({
  tabProps,
  open,
}: PoolSettingsDesktopLayoutProps) {
  const searchId = useId()
  const listId = useId()
  const [section, setSection] = useState<PoolSettingsSectionId>(DEFAULT_SECTION)
  const [activeSubItem, setActiveSubItem] =
    useState<PoolSettingsControlId | null>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [highlightedSearchId, setHighlightedSearchId] = useState<string | null>(
    null,
  )
  const itemRefs = useRef(new Map<string, HTMLButtonElement>())
  const pendingFocusRef = useRef<string | null>(null)
  const pendingScrollRef = useRef<string | null>(null)
  const ignoreObserverUntilRef = useRef(0)
  const paneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      setSection(DEFAULT_SECTION)
      setActiveSubItem(null)
      setQuery('')
      setDebouncedQuery('')
      setHighlightedSearchId(null)
      pendingScrollRef.current = null
    }
  }, [open])

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
  const expandedSubs = useMemo(() => subItemsForSection(section), [section])
  const navKeys = useMemo(() => {
    const keys: string[] = []
    for (const row of POOL_SETTINGS_SECTIONS) {
      keys.push(row.id)
      if (row.id === section) {
        for (const sub of subItemsForSection(row.id)) {
          keys.push(poolSettingsSubNavKey(sub.id))
        }
      }
    }
    return keys
  }, [section])

  function focusItem(key: string) {
    itemRefs.current.get(key)?.focus()
  }

  function markSubItem(controlId: PoolSettingsControlId) {
    setActiveSubItem(controlId)
    ignoreObserverUntilRef.current = Date.now() + OBSERVER_IGNORE_MS
  }

  function queueScrollToControl(controlId: string) {
    pendingScrollRef.current = controlId
  }

  function jumpToControl(
    controlId: PoolSettingsControlId,
    nextSection: PoolSettingsSectionId,
  ) {
    markSubItem(controlId)
    if (nextSection !== section) {
      queueScrollToControl(controlId)
      setSection(nextSection)
      return
    }
    scrollToPoolSetting(controlId)
  }

  useEffect(() => {
    if (!searchActive) {
      setHighlightedSearchId(null)
      return
    }
    setHighlightedSearchId((current) => {
      if (current && matches.some((item) => item.id === current)) return current
      return matches[0]?.id ?? null
    })
  }, [searchActive, matches])

  function selectSection(
    next: PoolSettingsSectionId,
    options?: { clearSearch?: boolean; controlId?: PoolSettingsControlId | null },
  ) {
    const controlId = options?.controlId ?? null
    setSection(next)
    if (controlId) {
      markSubItem(controlId)
      queueScrollToControl(controlId)
    } else {
      setActiveSubItem(null)
    }
    if (options?.clearSearch && searchActive) {
      pendingFocusRef.current = controlId ? poolSettingsSubNavKey(controlId) : next
      setQuery('')
      setDebouncedQuery('')
    }
  }

  useEffect(() => {
    if (searchActive || !pendingFocusRef.current) return
    focusItem(pendingFocusRef.current)
    pendingFocusRef.current = null
  }, [searchActive])

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
    const pane = paneRef.current
    if (!pane || searchActive) return
    const controls = pane.querySelectorAll('[data-pool-setting]')
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
      { root: pane, rootMargin: '-8% 0px -62% 0px', threshold: [0.1, 0.25] },
    )
    controls.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [section, searchActive, tabProps.poolId])

  function handleSearchKeyDown(
    event: KeyboardEvent<HTMLElement>,
    keys: string[],
    currentKey: string,
  ) {
    const index = keys.indexOf(currentKey)
    if (index < 0 || keys.length === 0) return

    const activate = (key: string) => {
      const match = matches.find((row) => row.id === key)
      if (!match) return
      setHighlightedSearchId(match.id)
      setSection(match.sectionId)
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      const nextKey = keys[Math.min(index + 1, keys.length - 1)]
      activate(nextKey)
      focusItem(nextKey)
      return
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const nextKey = keys[Math.max(index - 1, 0)]
      activate(nextKey)
      focusItem(nextKey)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      activate(keys[0])
      focusItem(keys[0])
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      const last = keys[keys.length - 1]
      activate(last)
      focusItem(last)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const match = matches.find((row) => row.id === currentKey)
      if (match) {
        selectSection(match.sectionId, {
          clearSearch: true,
          controlId: controlIdForSearchItem(match),
        })
      }
    }
  }

  function handleTreeKeyDown(
    event: KeyboardEvent<HTMLElement>,
    currentKey: string,
  ) {
    const keys = navKeys
    const index = keys.indexOf(currentKey)
    if (index < 0 || keys.length === 0) return

    const activateKey = (key: string) => {
      const subId = parseSubNavKey(key)
      if (subId) {
        markSubItem(subId)
        return
      }
      setActiveSubItem(null)
      setSection(key as PoolSettingsSectionId)
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const nextKey = keys[Math.min(index + 1, keys.length - 1)]
      activateKey(nextKey)
      focusItem(nextKey)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const nextKey = keys[Math.max(index - 1, 0)]
      activateKey(nextKey)
      focusItem(nextKey)
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      const subId = parseSubNavKey(currentKey)
      if (subId) return
      const firstSub = poolSettingsSubNavKey(expandedSubs[0]?.id ?? '')
      if (currentKey === section && expandedSubs[0]) {
        markSubItem(expandedSubs[0].id)
        focusItem(firstSub)
      } else {
        setSection(currentKey as PoolSettingsSectionId)
      }
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      const subId = parseSubNavKey(currentKey)
      if (subId) {
        setActiveSubItem(null)
        focusItem(section)
      }
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      activateKey(keys[0])
      focusItem(keys[0])
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      const last = keys[keys.length - 1]
      activateKey(last)
      focusItem(last)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const subId = parseSubNavKey(currentKey)
      if (subId) {
        jumpToControl(subId, section)
        return
      }
      setActiveSubItem(null)
      setSection(currentKey as PoolSettingsSectionId)
      paneRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const sectionTabStop = activeSubItem ? poolSettingsSubNavKey(activeSubItem) : section
  const searchKeys = matches.map((item) => item.id)

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      <aside className="flex h-full min-h-0 w-[240px] shrink-0 flex-col border-r border-border bg-muted/20">
        <div className="px-3 pb-2 pt-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowDown') return
                const first = searchActive ? searchKeys[0] : navKeys[0]
                if (!first) return
                event.preventDefault()
                if (searchActive) {
                  const match = matches.find((row) => row.id === first)
                  if (match) {
                    setHighlightedSearchId(match.id)
                    setSection(match.sectionId)
                  }
                }
                focusItem(first)
              }}
              placeholder="Search settings…"
              autoComplete="off"
              spellCheck={false}
              aria-label="Search pool settings"
              aria-controls={listId}
              className={cn(
                'h-9 rounded-lg border-border bg-card/90 pl-8 pr-2 text-sm shadow-none',
                FOCUS_VISIBLE_RING,
              )}
            />
          </div>
          <p className="mt-3 px-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Pool Settings
          </p>
        </div>

        <div
          id={listId}
          role={searchActive ? 'listbox' : 'tree'}
          aria-label="Settings sections"
          aria-activedescendant={
            searchActive
              ? highlightedSearchId
                ? `settings-search-${highlightedSearchId}`
                : undefined
              : activeSubItem
                ? `settings-sub-${activeSubItem}`
                : `settings-nav-${section}`
          }
          className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
        >
          {searchActive && matches.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No settings match
            </p>
          ) : searchActive ? (
            <ul className="space-y-0.5">
              {matches.map((item) => {
                const selected = item.id === highlightedSearchId
                const destructive =
                  POOL_SETTINGS_SECTIONS.find((row) => row.id === item.sectionId)
                    ?.destructive === true
                return (
                  <li key={item.id} role="none">
                    <button
                      type="button"
                      id={`settings-search-${item.id}`}
                      ref={(node) => {
                        if (node) itemRefs.current.set(item.id, node)
                        else itemRefs.current.delete(item.id)
                      }}
                      role="option"
                      aria-selected={selected}
                      data-settings-nav-item={item.id}
                      tabIndex={selected ? 0 : -1}
                      className={cn(
                        NAV_ITEM_CLASS,
                        'flex-col items-start gap-0.5',
                        selected
                          ? destructive
                            ? 'bg-destructive/15 text-destructive'
                            : 'bg-primary/15 text-foreground'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                      )}
                      onClick={() =>
                        selectSection(item.sectionId, {
                          clearSearch: true,
                          controlId: controlIdForSearchItem(item),
                        })
                      }
                      onKeyDown={(event) =>
                        handleSearchKeyDown(event, searchKeys, item.id)
                      }
                    >
                      <span className="w-full truncate">{item.name}</span>
                      <span className="w-full truncate text-[10px] font-normal text-muted-foreground">
                        {sectionTitleForId(item.sectionId)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <ul className="space-y-0.5">
              {POOL_SETTINGS_SECTIONS.map((row) => {
                const Icon = SECTION_ICONS[row.id]
                const selected = row.id === section
                return (
                  <li key={row.id} role="none">
                    <button
                      type="button"
                      id={`settings-nav-${row.id}`}
                      ref={(node) => {
                        if (node) itemRefs.current.set(row.id, node)
                        else itemRefs.current.delete(row.id)
                      }}
                      role="treeitem"
                      aria-expanded={selected}
                      aria-selected={selected}
                      aria-level={1}
                      data-settings-nav-item={row.id}
                      tabIndex={sectionTabStop === row.id ? 0 : -1}
                      className={cn(
                        NAV_ITEM_CLASS,
                        row.destructive && !selected && 'text-destructive/80',
                        selected &&
                          !row.destructive &&
                          'bg-primary/15 text-foreground',
                        selected &&
                          row.destructive &&
                          'bg-destructive/15 text-destructive',
                        !selected &&
                          !row.destructive &&
                          'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                        !selected &&
                          row.destructive &&
                          'hover:bg-destructive/10 hover:text-destructive',
                      )}
                      onClick={() => {
                        setActiveSubItem(null)
                        setSection(row.id)
                        paneRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      onKeyDown={(event) => handleTreeKeyDown(event, row.id)}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{row.title}</span>
                      <ChevronRight
                        className={cn(
                          'h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-[220ms] ease-out motion-reduce:transition-none',
                          selected && 'rotate-90',
                        )}
                        aria-hidden
                      />
                    </button>
                    <PoolSettingsAccordionSubs
                      sectionId={row.id}
                      sectionTitle={row.title}
                      expanded={selected}
                      activeSubItem={activeSubItem}
                      destructive={row.destructive}
                      tabStopKey={sectionTabStop}
                      itemRefs={itemRefs}
                      onJump={(controlId) => jumpToControl(controlId, row.id)}
                      onKeyDown={handleTreeKeyDown}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      <div
        ref={paneRef}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 pb-6 pt-12"
      >
        <PoolSettingsSectionPane sectionId={section} tabProps={tabProps} />
      </div>
    </div>
  )
}
