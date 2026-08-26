/**
 * Client-safe draft payload type (no server-only imports).
 * Keep in sync with ValidatedPoolCreationDraft in pool-creation-draft.ts.
 */
export type PoolCreationDraftPayload = {
  name: string
  description: string | null
  scoringStyle: 'classic' | 'winner'
  eventId: string
  eventName: string
  isPublic: boolean
}

export const CREATE_WIZARD_STORAGE_KEY = 'poolcup_create_wizard_v2'
/** Legacy key — cleared on load/save so stale 4-step drafts cannot hydrate. */
const CREATE_WIZARD_STORAGE_KEY_V1 = 'poolcup_create_wizard_v1'
/** Legacy emblem staging keys — cleared so stale staged logos cannot resurrect. */
const CREATE_WIZARD_EMBLEM_KEY_PREFIX = 'poolcup_create_emblem_'
const CREATE_WIZARD_EMBLEM_PENDING_KEY = 'poolcup_create_emblem_pending'

export type CreateWizardPersistedState = {
  step: number
  selectedSport: string | null
  selectedEventId: string | null
  poolName: string
  poolDescription: string
  scoringStyle: 'classic' | 'winner'
  isPublic: boolean
  selectedPlan: 'basic' | 'custom' | null
}

function clearLegacyWizardKeys(): void {
  try {
    sessionStorage.removeItem(CREATE_WIZARD_STORAGE_KEY_V1)
    sessionStorage.removeItem(CREATE_WIZARD_EMBLEM_PENDING_KEY)
    // Best-effort: wipe any draft-keyed emblem leftovers from older creates.
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(CREATE_WIZARD_EMBLEM_KEY_PREFIX)) {
        sessionStorage.removeItem(key)
      }
    }
  } catch {
    // ignore
  }
}

export function saveCreateWizardState(state: CreateWizardPersistedState): void {
  try {
    clearLegacyWizardKeys()
    sessionStorage.setItem(CREATE_WIZARD_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore quota / private mode
  }
}

export function loadCreateWizardState(): CreateWizardPersistedState | null {
  try {
    clearLegacyWizardKeys()
    const raw = sessionStorage.getItem(CREATE_WIZARD_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CreateWizardPersistedState
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function clearCreateWizardState(): void {
  try {
    clearLegacyWizardKeys()
    sessionStorage.removeItem(CREATE_WIZARD_STORAGE_KEY)
  } catch {
    // ignore
  }
}
