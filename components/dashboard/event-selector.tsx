'use client'

import { Fragment, useState } from 'react'
import { LayoutGrid, Swords, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type EventSelectorItem = {
  id: string
  label: string
  iconPng?: string | null
}

const FALLBACK_ICONS: Record<string, LucideIcon> = {
  all: LayoutGrid,
}

type EventSelectorProps = {
  events: EventSelectorItem[]
  selectedId: string
  onSelect: (id: string) => void
}

function EventIcon({
  event,
  selected,
}: {
  event: EventSelectorItem
  selected: boolean
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const FallbackIcon = FALLBACK_ICONS[event.id] ?? Swords

  if (!event.iconPng || imgFailed) {
    return (
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center',
          selected ? 'text-foreground' : 'text-muted-foreground',
        )}
        aria-hidden
      >
        <FallbackIcon className="h-[18px] w-[18px]" />
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/sports/${event.iconPng}`}
      alt=""
      width={32}
      height={32}
      className={cn(
        'h-8 w-8 shrink-0 object-contain',
        !selected && 'opacity-55',
      )}
      onError={() => setImgFailed(true)}
    />
  )
}

export function EventSelector({
  events,
  selectedId,
  onSelect,
}: EventSelectorProps) {
  return (
    <div
      className="-mx-1 overflow-x-auto px-1 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Select sporting event"
    >
      <div className="inline-flex items-center whitespace-nowrap">
        {events.map((event, index) => {
          const selected = event.id === selectedId

          return (
            <Fragment key={event.id}>
              {index > 0 ? (
                <div
                  className="mx-0.5 h-8 w-px shrink-0 bg-foreground/20"
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onSelect(event.id)}
                className={cn(
                  'inline-flex min-h-[50px] shrink-0 items-center px-2 py-2.5 transition-colors',
                  'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border',
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  <EventIcon event={event} selected={selected} />
                  <span
                    className={cn(
                      'whitespace-nowrap text-sm',
                      selected
                        ? 'font-semibold text-foreground'
                        : 'font-normal text-muted-foreground',
                    )}
                  >
                    {event.label}
                  </span>
                </span>
              </button>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
