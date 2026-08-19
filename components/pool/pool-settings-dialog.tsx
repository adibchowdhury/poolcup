'use client'

import { useEffect, useState } from 'react'
import {
  PoolSettingsHub,
} from '@/components/pool/pool-settings-hub'
import type { PoolSettingsTabProps } from '@/components/pool/pool-settings-tab'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'

type PoolSettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tabProps: PoolSettingsTabProps
}

export function PoolSettingsDialog({
  open,
  onOpenChange,
  tabProps,
}: PoolSettingsDialogProps) {
  const [section, setSection] = useState<string | null>(null)

  useEffect(() => {
    if (!open) setSection(null)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[min(90vh,52rem)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden border-border bg-app-background p-0 sm:max-w-2xl',
          FOCUS_VISIBLE_RING,
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Pool Settings</DialogTitle>
          <DialogDescription>
            Search and manage this pool’s settings.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-12">
          <PoolSettingsHub
            {...tabProps}
            section={section}
            onSelectSection={setSection}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
