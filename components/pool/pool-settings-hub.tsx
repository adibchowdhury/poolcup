'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  PoolSettingsCommissionerSection,
  PoolSettingsCommunicationSection,
  PoolSettingsDangerSection,
  PoolSettingsDetailsSection,
  PoolSettingsMembersSection,
  PoolSettingsScoringSection,
  type PoolSettingsTabProps,
} from '@/components/pool/pool-settings-tab'
import { PoolSettingsHubList } from '@/components/pool/pool-settings-hub-list'
import { cn } from '@/lib/utils'
import { FOCUS_VISIBLE_RING } from '@/src/lib/focus-visible'
import {
  isPoolSettingsSectionId,
  POOL_SETTINGS_SECTIONS,
  type PoolSettingsSectionId,
} from '@/src/lib/pool-settings-nav'

const SECTION_SCREENS = {
  details: PoolSettingsDetailsSection,
  scoring: PoolSettingsScoringSection,
  members: PoolSettingsMembersSection,
  communication: PoolSettingsCommunicationSection,
  commissioner: PoolSettingsCommissionerSection,
  danger: PoolSettingsDangerSection,
} as const

function SettingsBackControl({
  href,
  onClick,
  label,
}: {
  href?: string
  onClick?: () => void
  label: string
}) {
  const className = cn(
    'inline-flex w-fit items-center gap-1.5 rounded-lg py-1 text-sm text-muted-foreground transition-colors hover:text-foreground',
    FOCUS_VISIBLE_RING,
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </button>
    )
  }
  if (!href) return null
  return (
    <Link href={href} prefetch className={className}>
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Link>
  )
}

export function PoolSettingsSectionPane({
  sectionId,
  tabProps,
  onBackToHub,
  hideSectionHeading = false,
}: {
  sectionId: PoolSettingsSectionId
  tabProps: PoolSettingsTabProps
  onBackToHub?: () => void
  /** Desktop horizontal nav shows category title — omit duplicate heading. */
  hideSectionHeading?: boolean
}) {
  const section = POOL_SETTINGS_SECTIONS.find((row) => row.id === sectionId)
  if (!section) return null
  const SectionScreen = SECTION_SCREENS[sectionId]

  return (
    <div className="w-full min-w-0 space-y-4">
      {onBackToHub ? (
        <SettingsBackControl onClick={onBackToHub} label="Settings menu" />
      ) : null}
      {!hideSectionHeading ? (
        <div>
          <h2
            className={cn(
              'font-display text-2xl tracking-wide',
              section.destructive ? 'text-destructive' : 'text-foreground',
            )}
          >
            {section.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{section.subtitle}</p>
        </div>
      ) : null}
      <SectionScreen {...tabProps} />
    </div>
  )
}

/**
 * Mobile settings hub + per-section screens. Desktop uses
 * PoolSettingsDesktopLayout on `/pool/{invite}/settings/{section}`.
 */
export function PoolSettingsHub({
  section = null,
  onSelectSection,
  ...tabProps
}: PoolSettingsTabProps & {
  section?: string | null
  /** When set, section rows swap content in-place (desktop modal) instead of routing. */
  onSelectSection?: (section: string | null) => void
}) {
  const inviteCode = tabProps.inviteCode ?? ''
  const onBackToHub = onSelectSection
    ? () => onSelectSection(null)
    : undefined

  if (isPoolSettingsSectionId(section)) {
    return (
      <PoolSettingsSectionPane
        sectionId={section}
        onBackToHub={onBackToHub}
        tabProps={tabProps}
      />
    )
  }

  return (
    <PoolSettingsHubList
      inviteCode={inviteCode}
      onSelectSection={
        onSelectSection ? (id) => onSelectSection(id) : undefined
      }
    />
  )
}
