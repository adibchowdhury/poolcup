'use client'

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type MutableRefObject } from 'react'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import {
  subItemsForSection,
  type PoolSettingsControlId,
  type PoolSettingsSectionId,
} from '@/src/lib/pool-settings-nav'

const RAIL_MARKER_INSET = 2

export const POOL_SETTINGS_ACCORDION_CLASS =
  'grid transition-[grid-template-rows] duration-[220ms] ease-out motion-reduce:transition-none'

const SUB_ITEM_CLASS = cn(
  'flex w-full items-center rounded-md py-1 pl-3.5 pr-2 text-left text-xs font-medium transition-colors',
  FOCUS_VISIBLE_RING,
)

const RAIL_MARKER_CLASS = cn(
  'pointer-events-none absolute left-[-1px] w-[3px] rounded-full bg-primary',
  'transition-[top,height,opacity] duration-[220ms] ease-out motion-reduce:transition-none',
)

export function poolSettingsSubNavKey(controlId: string) {
  return `sub:${controlId}`
}

type PoolSettingsAccordionSubsProps = {
  sectionId: PoolSettingsSectionId
  sectionTitle: string
  expanded: boolean
  activeSubItem: PoolSettingsControlId | null
  destructive: boolean
  onJump: (controlId: PoolSettingsControlId) => void
  tabStopKey?: string
  itemRefs?: MutableRefObject<Map<string, HTMLButtonElement>>
  onKeyDown?: (event: KeyboardEvent<HTMLElement>, key: string) => void
}

export function PoolSettingsAccordionSubs({
  sectionId,
  sectionTitle,
  expanded,
  activeSubItem,
  destructive,
  onJump,
  tabStopKey,
  itemRefs,
  onKeyDown,
}: PoolSettingsAccordionSubsProps) {
  const subs = subItemsForSection(sectionId)
  const railRef = useRef<HTMLDivElement>(null)
  const [marker, setMarker] = useState({ top: 0, height: 0, visible: false })

  useLayoutEffect(() => {
    const rail = railRef.current
    if (!rail || !expanded || !activeSubItem) {
      setMarker((current) =>
        current.visible ? { ...current, visible: false } : current,
      )
      return
    }

    const update = () => {
      const active = rail.querySelector<HTMLElement>(
        `[data-sub-id="${activeSubItem}"]`,
      )
      if (!active) {
        setMarker((current) =>
          current.visible ? { ...current, visible: false } : current,
        )
        return
      }
      setMarker({
        top: active.offsetTop + RAIL_MARKER_INSET,
        height: Math.max(active.offsetHeight - RAIL_MARKER_INSET * 2, 8),
        visible: true,
      })
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [activeSubItem, expanded])

  return (
    <div
      className={POOL_SETTINGS_ACCORDION_CLASS}
      style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
    >
      <div
        className="min-h-0 overflow-hidden"
        inert={expanded ? undefined : true}
        aria-hidden={!expanded}
      >
        <div ref={railRef} className="relative ml-[1.125rem] mt-0.5 mb-0.5">
          <div
            className="pointer-events-none absolute bottom-1 left-0 top-1 w-px bg-border"
            aria-hidden
          />
          <div
            className={cn(
              RAIL_MARKER_CLASS,
              marker.visible ? 'opacity-100' : 'opacity-0',
            )}
            style={{ top: marker.top, height: marker.height }}
            aria-hidden
          />
          <ul
            role="group"
            aria-label={`${sectionTitle} settings`}
            className="space-y-0.5"
          >
            {subs.map((sub) => {
              const subSelected = expanded && sub.id === activeSubItem
              const key = poolSettingsSubNavKey(sub.id)
              return (
                <li key={sub.id} role="none">
                  <button
                    type="button"
                    id={`settings-sub-${sub.id}`}
                    ref={(node) => {
                      if (!itemRefs) return
                      if (node) itemRefs.current.set(key, node)
                      else itemRefs.current.delete(key)
                    }}
                    role="treeitem"
                    aria-selected={subSelected}
                    aria-level={2}
                    data-settings-nav-item={key}
                    data-sub-id={sub.id}
                    tabIndex={
                      expanded && (tabStopKey ? tabStopKey === key : true)
                        ? 0
                        : -1
                    }
                    className={cn(
                      SUB_ITEM_CLASS,
                      subSelected
                        ? destructive
                          ? 'bg-destructive/15 text-destructive'
                          : 'bg-primary/10 text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                    onClick={() => onJump(sub.id)}
                    onKeyDown={
                      onKeyDown
                        ? (event) => onKeyDown(event, key)
                        : undefined
                    }
                  >
                    <span className="min-w-0 flex-1 truncate">{sub.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
