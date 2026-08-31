'use client'

import { useCallback, useEffect, useState } from 'react'
import { PoolSettingsDesktopLayout } from '@/components/pool/pool-settings-desktop-layout'
import type { PoolSettingsTabProps } from '@/components/pool/pool-settings-tab'
import {
  isPoolSettingsSectionId,
  normalizePoolSettingsControlId,
  poolSettingsPath,
  readPoolSettingsClientRoute,
  shallowPoolSettingsUrl,
  type PoolSettingsControlId,
  type PoolSettingsSectionId,
} from '@/src/lib/pool-settings-nav'

function normalizeSection(section: string | null | undefined): PoolSettingsSectionId {
  if (section && isPoolSettingsSectionId(section)) return section
  const fromPath = readPoolSettingsClientRoute().section
  if (fromPath) return fromPath
  return 'details'
}

type PoolSettingsDesktopShellProps = {
  inviteCode: string
  tabProps: PoolSettingsTabProps
  /** Server-provided section on hard load (settings route). */
  sectionParam?: string | null
  /** Server-provided `?sub=` on hard load. */
  subParam?: string | null
}

/**
 * Desktop settings workspace — client section/sub state + shallow URL sync.
 * Embedded in pool-home-view (tab) or standalone settings route.
 */
export function PoolSettingsDesktopShell({
  inviteCode,
  tabProps,
  sectionParam = null,
  subParam = null,
}: PoolSettingsDesktopShellProps) {
  const [activeSection, setActiveSection] = useState<PoolSettingsSectionId>(
    () => normalizeSection(sectionParam),
  )
  const [activeSub, setActiveSub] = useState<PoolSettingsControlId | null>(
    () =>
      normalizePoolSettingsControlId(subParam) ??
      readPoolSettingsClientRoute().sub,
  )

  useEffect(() => {
    if (!sectionParam) return
    setActiveSection(normalizeSection(sectionParam))
    setActiveSub(readPoolSettingsClientRoute().sub)
  }, [sectionParam])

  useEffect(() => {
    const onPopState = () => {
      const route = readPoolSettingsClientRoute()
      if (route.section) setActiveSection(route.section)
      setActiveSub(route.sub)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigateSection = useCallback(
    (
      nextSection: PoolSettingsSectionId,
      controlId?: PoolSettingsControlId | null,
    ) => {
      setActiveSection(nextSection)
      setActiveSub(controlId ?? null)
      shallowPoolSettingsUrl(
        poolSettingsPath(inviteCode, nextSection, controlId ?? null),
        'push',
      )
    },
    [inviteCode],
  )

  const syncSubInUrl = useCallback(
    (controlId: PoolSettingsControlId | null) => {
      const route = readPoolSettingsClientRoute()
      if (route.sub === controlId) return
      setActiveSub(controlId)
      shallowPoolSettingsUrl(
        poolSettingsPath(inviteCode, activeSection, controlId ?? null),
        'replace',
      )
    },
    [inviteCode, activeSection],
  )

  return (
    <PoolSettingsDesktopLayout
      section={activeSection}
      subControlId={activeSub}
      onSectionChange={navigateSection}
      onSubControlChange={syncSubInUrl}
      tabProps={tabProps}
    />
  )
}
