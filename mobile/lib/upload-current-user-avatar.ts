import type { SupabaseClient } from '@supabase/supabase-js'
import { compressImageForUpload } from './compress-image-for-upload'

type UploadResult =
  | { publicUrl: string; error: null }
  | { publicUrl: null; error: string }

export async function uploadCurrentUserAvatar(
  supabase: SupabaseClient,
  file: File,
): Promise<UploadResult> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      publicUrl: null,
      error: userError?.message ?? 'You must be signed in to upload a photo',
    }
  }

  let blob: Blob
  try {
    blob = await compressImageForUpload(file)
  } catch (err) {
    return {
      publicUrl: null,
      error:
        err instanceof Error ? err.message : 'Could not process that image',
    }
  }

  const ext = blob.type === 'image/png' ? 'png' : 'jpg'
  const path = `${user.id}/avatar_${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, contentType: blob.type })

  if (uploadError) {
    return { publicUrl: null, error: uploadError.message }
  }

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
  const publicUrl = urlData.publicUrl

  const { error: updateError } = await supabase
    .from('users')
    .update({ custom_avatar_url: publicUrl })
    .eq('id', user.id)

  if (updateError) {
    return { publicUrl: null, error: updateError.message }
  }

  return { publicUrl, error: null }
}

export async function clearCurrentUserCustomAvatar(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('users')
    .update({ custom_avatar_url: null })
    .eq('id', userId)

  return { error: error?.message ?? null }
}
