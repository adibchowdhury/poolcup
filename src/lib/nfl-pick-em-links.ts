/** Deep-link into create wizard with NFL 2026 preselected. */
export const NFL_PICK_EM_CREATE_HREF = '/create?event=nfl-2026'

/**
 * Login round-trip that preserves the event query:
 * encodeURIComponent('/create?event=nfl-2026') → %2Fcreate%3Fevent%3Dnfl-2026
 */
export const NFL_PICK_EM_CREATE_LOGIN_HREF = `/login?next=${encodeURIComponent(NFL_PICK_EM_CREATE_HREF)}`
