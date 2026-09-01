import { CFB_PICK_EM_EVENT_SLUG } from '@/src/lib/college-football-pick-em-season'

/**
 * Phase 3 seam — swap hero CTAs from launching state to these hrefs:
 * logged-out → CFB_PICK_EM_CREATE_LOGIN_HREF, logged-in → CFB_PICK_EM_CREATE_HREF.
 */
export const CFB_PICK_EM_CREATE_HREF = `/create?event=${CFB_PICK_EM_EVENT_SLUG}`

export const CFB_PICK_EM_CREATE_LOGIN_HREF = `/login?next=${encodeURIComponent(CFB_PICK_EM_CREATE_HREF)}`

export const NFL_PICK_EM_PAGE_HREF = '/nfl-pick-em'
