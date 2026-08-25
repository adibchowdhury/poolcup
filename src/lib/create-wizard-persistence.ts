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
  themeColor: string | null
  hasPendingEmblem: boolean
}

export const CREATE_WIZARD_STORAGE_KEY = 'poolcup_create_wizard_v2'
/** Legacy key — cleared on load/save so stale 4-step drafts cannot hydrate. */
const CREATE_WIZARD_STORAGE_KEY_V1 = 'poolcup_create_wizard_v1'
export const CREATE_WIZARD_EMBLEM_KEY_PREFIX = 'poolcup_create_emblem_'
/** Emblem staged before checkout; survives cancel (not keyed by draft id). */
export const CREATE_WIZARD_EMBLEM_PENDING_KEY = 'poolcup_create_emblem_pending'

export type CreateWizardPersistedState = {
  step: number
  selectedSport: string | null
  selectedEventId: string | null
  poolName: string
  poolDescription: string
  scoringStyle: 'classic' | 'winner'
  isPublic: boolean
  selectedPlan: 'basic' | 'custom'
  themeColor: string | null
  hasPendingEmblem: boolean
}

function clearLegacyWizardKeys(): void {
  try {
    sessionStorage.removeItem(CREATE_WIZARD_STORAGE_KEY_V1)
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

async function fileToDataUrl(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return `data:${file.type || 'image/jpeg'};base64,${btoa(binary)}`
}

/** Persist emblem for post-checkout upload (draft-keyed + pending for cancel). */
export async function persistStagedEmblem(
  draftId: string,
  file: File,
): Promise<boolean> {
  try {
    const dataUrl = await fileToDataUrl(file)
    sessionStorage.setItem(
      `${CREATE_WIZARD_EMBLEM_KEY_PREFIX}${draftId}`,
      dataUrl,
    )
    sessionStorage.setItem(CREATE_WIZARD_EMBLEM_PENDING_KEY, dataUrl)
    return true
  } catch {
    return false
  }
}

/** Stage emblem before draft id exists (cancel restore / pre-checkout). */
export async function persistPendingEmblem(file: File): Promise<boolean> {
  try {
    const dataUrl = await fileToDataUrl(file)
    sessionStorage.setItem(CREATE_WIZARD_EMBLEM_PENDING_KEY, dataUrl)
    return true
  } catch {
    return false
  }
}

export function loadStagedEmblemDataUrl(draftId: string): string | null {
  try {
    return (
      sessionStorage.getItem(`${CREATE_WIZARD_EMBLEM_KEY_PREFIX}${draftId}`) ??
      sessionStorage.getItem(CREATE_WIZARD_EMBLEM_PENDING_KEY)
    )
  } catch {
    return null
  }
}

export function loadPendingEmblemDataUrl(): string | null {
  try {
    return sessionStorage.getItem(CREATE_WIZARD_EMBLEM_PENDING_KEY)
  } catch {
    return null
  }
}

export function clearStagedEmblem(draftId?: string): void {
  try {
    if (draftId) {
      sessionStorage.removeItem(`${CREATE_WIZARD_EMBLEM_KEY_PREFIX}${draftId}`)
    }
    sessionStorage.removeItem(CREATE_WIZARD_EMBLEM_PENDING_KEY)
  } catch {
    // ignore
  }
}

export function dataUrlToFile(dataUrl: string, filename: string): File | null {
  try {
    const [header, data] = dataUrl.split(',')
    if (!header || !data) return null
    const match = /data:(.*?);base64/.exec(header)
    const mime = match?.[1] || 'image/jpeg'
    const binary = atob(data)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new File([bytes], filename, { type: mime })
  } catch {
    return null
  }
}
