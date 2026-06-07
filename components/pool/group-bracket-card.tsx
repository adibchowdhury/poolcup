'use client'

import { useEffect, useState } from 'react'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  countryNameToFlagSrc,
  hasFlagImage,
  resolveTeamFlagDisplay,
} from '@/src/lib/team-flags'

function TeamFlagImage({ countryName }: { countryName: string }) {
  const flagSrc = countryNameToFlagSrc(countryName)
  const [imageFailed, setImageFailed] = useState(false)
  const showFlagImage = hasFlagImage(countryName)

  useEffect(() => {
    setImageFailed(false)
  }, [flagSrc, showFlagImage])

  if (!showFlagImage || imageFailed) {
    return (
      <span className="text-lg leading-none" aria-hidden>
        {resolveTeamFlagDisplay(countryName, null)}
      </span>
    )
  }

  return (
    <img
      src={flagSrc}
      alt=""
      className="h-5 w-auto shrink-0"
      onError={() => setImageFailed(true)}
    />
  )
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold',
        rank <= 2 && 'bg-primary/20 text-primary',
        rank === 3 && 'bg-secondary/20 text-secondary',
        rank === 4 && 'bg-destructive/15 text-destructive',
      )}
    >
      {rank}
    </span>
  )
}

function AdvancementBadge({ rank }: { rank: number }) {
  if (rank <= 2) {
    return (
      <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
        Advances
      </span>
    )
  }

  if (rank === 3) {
    return (
      <span className="shrink-0 rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary">
        Maybe
      </span>
    )
  }

  return (
    <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
      Eliminated
    </span>
  )
}

interface GroupBracketCardProps {
  groupLetter: string
  teamOrder: string[]
  readOnly: boolean
  onReorder: (nextOrder: string[]) => void
}

export function GroupBracketCard({
  groupLetter,
  teamOrder,
  readOnly,
  onReorder,
}: GroupBracketCardProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function handleDragStart(index: number) {
    if (readOnly) return
    setDraggingIndex(index)
  }

  function handleDragOver(event: React.DragEvent, index: number) {
    if (readOnly) return
    event.preventDefault()
    setDragOverIndex(index)
  }

  function handleDrop(event: React.DragEvent, index: number) {
    if (readOnly) return
    event.preventDefault()

    if (draggingIndex === null || draggingIndex === index) {
      setDraggingIndex(null)
      setDragOverIndex(null)
      return
    }

    const next = [...teamOrder]
    const [moved] = next.splice(draggingIndex, 1)
    next.splice(index, 0, moved!)
    onReorder(next)
    setDraggingIndex(null)
    setDragOverIndex(null)
  }

  function handleDragEnd() {
    setDraggingIndex(null)
    setDragOverIndex(null)
  }

  return (
    <article className="rounded-xl border border-border/90 bg-card/90 p-4 shadow-sm backdrop-blur-sm">
      <h3 className="mb-3 font-display text-lg tracking-wide text-foreground uppercase">
        Group {groupLetter}
      </h3>

      {teamOrder.length === 0 ? (
        <p className="text-sm text-muted-foreground">No teams loaded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {teamOrder.map((team, index) => {
            const rank = index + 1
            return (
              <li
                key={team}
                draggable={!readOnly}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(event) => handleDragOver(event, index)}
                onDrop={(event) => handleDrop(event, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'flex items-center gap-2 rounded-lg border-2 px-2 py-2 transition-all duration-200 sm:gap-3 sm:px-3',
                  rank <= 2 && 'border-primary/40 bg-primary/10',
                  rank === 3 && 'border-secondary/40 bg-secondary/10',
                  rank === 4 && 'border-border/60 bg-muted/30',
                  draggingIndex === index && 'opacity-50',
                  dragOverIndex === index &&
                    draggingIndex !== index &&
                    'border-primary/60 ring-1 ring-primary/30',
                  readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
                )}
              >
                {!readOnly && (
                  <GripVertical
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                )}
                <RankBadge rank={rank} />
                <TeamFlagImage countryName={team} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                  {team}
                </span>
                <AdvancementBadge rank={rank} />
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}
