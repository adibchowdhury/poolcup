'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { PoolSettingsSectionPane } from '@/components/pool/pool-settings-hub'
import { PoolSettingsDesktopWorkspaceContext } from '@/components/pool/pool-settings-layout-context'
import type { PoolSettingsTabProps } from '@/components/pool/pool-settings-tab'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import {
  POOL_SETTINGS_SECTIONS,
  subItemsForSection,
  type PoolSettingsControlId,
  type PoolSettingsSectionId,
} from '@/src/lib/pool-settings-nav'
import { scrollToPoolSetting } from '@/src/lib/pool-settings-scroll'

const OBSERVER_IGNORE_MS = 1600

/** Full-width workspace rail — 32px base, 40px at xl (no centered max-width). */
export const POOL_SETTINGS_DESKTOP_WORKSPACE_PAD_CLASS = 'px-8 xl:px-10'

/** External gap between shared pool top bar and category nav — 24px (`mt-6`). */
export const POOL_SETTINGS_DESKTOP_CATEGORY_NAV_TOP_GAP_CLASS = 'mt-6'

/** Resting subsection pill — outlined dark chip. */
export const POOL_SETTINGS_PILL_REST_CLASS =
  'border border-[#292929] bg-[#1c1c1c] text-muted-foreground hover:border-[#353535] hover:bg-[#20221F] hover:text-foreground'

/** Active subsection pill — green-tinted surface + green border + green text. */
export const POOL_SETTINGS_PILL_ACTIVE_CLASS =
  'border-primary/45 bg-primary/10 text-primary'

type PoolSettingsDesktopLayoutProps = {
  tabProps: PoolSettingsTabProps
  section: PoolSettingsSectionId
  onSectionChange: (
    section: PoolSettingsSectionId,
    controlId?: PoolSettingsControlId | null,
  ) => void
  /** Deep-link subsection (`?sub=`); scroll-to within the active category. */
  subControlId?: PoolSettingsControlId | null
  onSubControlChange?: (controlId: PoolSettingsControlId | null) => void
}

export function PoolSettingsDesktopLayout({
  tabProps,
  section,
  onSectionChange,
  subControlId = null,
  onSubControlChange,
}: PoolSettingsDesktopLayoutProps) {
  const [activeSubItem, setActiveSubItem] = useState<PoolSettingsControlId | null>(
    subControlId,
  )
  const pendingScrollRef = useRef<string | null>(null)
  const ignoreObserverUntilRef = useRef(0)
  const paneRef = useRef<HTMLDivElement>(null)

  const sectionMeta = POOL_SETTINGS_SECTIONS.find((row) => row.id === section)
  const subsectionPills = useMemo(() => subItemsForSection(section), [section])

  useEffect(() => {
    setActiveSubItem(subControlId)
    if (subControlId) {
      pendingScrollRef.current = subControlId
      ignoreObserverUntilRef.current = Date.now() + OBSERVER_IGNORE_MS
    }
  }, [section, subControlId])

  function markSubItem(controlId: PoolSettingsControlId) {
    setActiveSubItem(controlId)
    ignoreObserverUntilRef.current = Date.now() + OBSERVER_IGNORE_MS
    onSubControlChange?.(controlId)
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
      onSectionChange(nextSection, controlId)
      return
    }
    scrollToPoolSetting(controlId)
  }

  function selectSection(
    next: PoolSettingsSectionId,
    controlId?: PoolSettingsControlId | null,
  ) {
    if (controlId) {
      markSubItem(controlId)
      queueScrollToControl(controlId)
    } else {
      setActiveSubItem(null)
      onSubControlChange?.(null)
    }
    if (next !== section) {
      onSectionChange(next, controlId)
    } else if (controlId) {
      scrollToPoolSetting(controlId)
    } else {
      paneRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  useEffect(() => {
    const controlId = pendingScrollRef.current
    if (!controlId) return
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
  }, [section])

  useEffect(() => {
    const pane = paneRef.current
    if (!pane) return
    const controls = pane.querySelectorAll('[data-pool-setting]')
    if (controls.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < ignoreObserverUntilRef.current) return
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const next = visible[0]?.target.getAttribute('data-pool-setting')
        if (next) {
          const id = next as PoolSettingsControlId
          setActiveSubItem(id)
          onSubControlChange?.(id)
        }
      },
      { root: pane, rootMargin: '-8% 0px -62% 0px', threshold: [0.1, 0.25] },
    )
    controls.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [section, tabProps.poolId, onSubControlChange])

  return (
    <PoolSettingsDesktopWorkspaceContext.Provider value={true}>
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#141414]">
        <nav
          className={cn(
            'shrink-0 border-b border-white/[0.06] bg-[#1a1a1a]',
            POOL_SETTINGS_DESKTOP_CATEGORY_NAV_TOP_GAP_CLASS,
            POOL_SETTINGS_DESKTOP_WORKSPACE_PAD_CLASS,
          )}
          aria-label="Settings categories"
        >
          <div className="-mb-px flex w-full gap-5 overflow-x-auto scrollbar-none xl:gap-6">
            {POOL_SETTINGS_SECTIONS.map((row) => {
              const selected = row.id === section
              const isDanger = row.destructive
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => selectSection(row.id)}
                  aria-current={selected ? 'page' : undefined}
                  className={cn(
                    'relative shrink-0 px-1 py-4 text-sm font-medium transition-colors min-h-[52px]',
                    FOCUS_VISIBLE_RING,
                    isDanger
                      ? cn(
                          'text-destructive',
                          selected
                            ? 'text-destructive'
                            : 'text-destructive/70 hover:text-destructive',
                        )
                      : cn(
                          selected
                            ? 'text-primary'
                            : 'text-muted-foreground hover:text-foreground',
                        ),
                  )}
                >
                  {row.title}
                  <span
                    className={cn(
                      'absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-opacity',
                      selected
                        ? isDanger
                          ? 'bg-destructive opacity-100'
                          : 'bg-primary opacity-100'
                        : 'opacity-0',
                    )}
                    aria-hidden
                  />
                </button>
              )
            })}
          </div>
        </nav>

        {subsectionPills.length > 0 ? (
          <div
            className={cn(
              'shrink-0 border-b border-white/[0.06] bg-[#171717]',
              POOL_SETTINGS_DESKTOP_WORKSPACE_PAD_CLASS,
              'py-4',
            )}
            aria-label={`${sectionMeta?.title ?? section} sections`}
          >
            <div className="flex w-full flex-wrap gap-2.5">
              {subsectionPills.map((pill) => {
                const selected = activeSubItem === pill.id
                const isDangerSection = sectionMeta?.destructive === true
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => jumpToControl(pill.id, section)}
                    aria-current={selected ? 'true' : undefined}
                    className={cn(
                      'inline-flex min-h-[38px] items-center rounded-full px-5 text-sm font-medium transition-colors',
                      FOCUS_VISIBLE_RING,
                      isDangerSection
                        ? cn(
                            'border',
                            selected
                              ? 'border-destructive/45 bg-destructive/10 text-destructive'
                              : 'border-[#292929] bg-[#1c1c1c] text-destructive/70 hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive',
                          )
                        : cn(
                            'border',
                            selected
                              ? POOL_SETTINGS_PILL_ACTIVE_CLASS
                              : POOL_SETTINGS_PILL_REST_CLASS,
                          ),
                    )}
                  >
                    {pill.name}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <div
          ref={paneRef}
          className={cn(
            'min-h-0 min-w-0 flex-1 overflow-y-auto bg-[#171717]',
            POOL_SETTINGS_DESKTOP_WORKSPACE_PAD_CLASS,
            'pb-10 pt-8',
          )}
        >
          <PoolSettingsSectionPane
            sectionId={section}
            tabProps={tabProps}
            hideSectionHeading
          />
        </div>
      </div>
    </PoolSettingsDesktopWorkspaceContext.Provider>
  )
}
