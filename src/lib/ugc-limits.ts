/**
 * Server + client UGC max lengths. Prefer enforcing in API routes / helpers;
 * DB CHECK constraints are listed in the Batch 2 notes for MCP.
 */

export const DISPLAY_NAME_MAX_LENGTH = 40
export const CHAT_MESSAGE_MAX_LENGTH = 500

export {
  POOL_NAME_MAX_LENGTH,
  POOL_DESCRIPTION_MAX_LENGTH,
} from '@/src/lib/pool-name'

export { ANNOUNCEMENT_MAX_LENGTH } from '@/src/lib/pool-announcements'

export {
  POLL_QUESTION_MAX,
  POLL_OPTION_MAX,
} from '@/src/lib/pool-polls'

export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Display name is required'
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    return `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer`
  }
  return null
}

export function validateChatMessage(content: string): string | null {
  const trimmed = content.trim()
  if (!trimmed) return 'Message is required'
  if (trimmed.length > CHAT_MESSAGE_MAX_LENGTH) {
    return `Keep messages under ${CHAT_MESSAGE_MAX_LENGTH} characters`
  }
  return null
}
