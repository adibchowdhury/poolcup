import { isPresetAvatarFilename } from '@/src/lib/avatars'
import { supabase } from '@/src/lib/supabase'

const UPLOADED_AVATAR_BUCKET = 'avatars'

export async function deleteUploadedAvatarFromStorage(
  userId: string,
  avatar: string | null | undefined,
): Promise<void> {
  if (!avatar || isPresetAvatarFilename(avatar)) return

  const path = avatar.includes('/') ? avatar : `${userId}/${avatar}`
  const { error } = await supabase.storage.from(UPLOADED_AVATAR_BUCKET).remove([path])

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('not found') || message.includes('object not found')) {
      return
    }
    throw new Error(error.message)
  }
}

export async function deleteCurrentUserAccount(): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc('delete_current_user')

  if (error) {
    return { error: new Error(error.message) }
  }

  return { error: null }
}
