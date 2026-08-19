'use client'

import { PoolSettingsDesktopLayout } from '@/components/pool/pool-settings-desktop-layout'
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[200]"
        className={cn(
          'z-[201] !flex h-[min(52rem,calc(100dvh-4rem),calc(100svh-4rem))] max-h-[min(calc(100dvh-4rem),calc(100svh-4rem))] w-full min-h-0 max-w-[min(64rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden border-border bg-app-background p-0 sm:max-w-[min(64rem,calc(100%-2rem))]',
          FOCUS_VISIBLE_RING,
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Pool Settings</DialogTitle>
          <DialogDescription>
            Search and manage this pool’s settings.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <PoolSettingsDesktopLayout tabProps={tabProps} open={open} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
