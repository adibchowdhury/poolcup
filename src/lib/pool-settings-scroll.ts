import { poolSettingsControlElementId } from '@/src/lib/pool-settings-nav'

export function scrollToPoolSetting(controlId: string): boolean {
  const element = document.getElementById(
    poolSettingsControlElementId(controlId),
  )
  if (!element) return false
  element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return true
}
