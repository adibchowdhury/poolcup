import type { SupabaseClient } from '@supabase/supabase-js'
import { compressImageForUpload } from '@/src/lib/compress-image-for-upload'

type UploadResult =
  | { publicUrl: string; error: null }
  | { publicUrl: null; error: string }

/**
 * Upload a squad emblem to the avatars bucket (user-scoped path), then
 * persist the public URL on pools.emblem_url. Creator-only via RLS on update.
 */
export async function uploadPoolEmblem(
  supabase: SupabaseClient,
  poolId: string,
  file: File,
): Promise<UploadResult> {
  if (!poolId) {
    return { publicUrl: null, error: 'Missing pool' }
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      publicUrl: null,
      error: userError?.message ?? 'You must be signed in to upload an emblem',
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
  const path = `${user.id}/pool_${poolId}/emblem_${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, contentType: blob.type })

  if (uploadError) {
    return { publicUrl: null, error: uploadError.message }
  }

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
  const publicUrl = urlData.publicUrl

  const { error: updateError } = await supabase
    .from('pools')
    .update({ emblem_url: publicUrl })
    .eq('id', poolId)

  if (updateError) {
    return { publicUrl: null, error: updateError.message }
  }

  return { publicUrl, error: null }
}

export async function clearPoolEmblem(
  supabase: SupabaseClient,
  poolId: string,
): Promise<{ error: string | null }> {
  if (!poolId) return { error: 'Missing pool' }

  const { error } = await supabase
    .from('pools')
    .update({ emblem_url: null })
    .eq('id', poolId)

  return { error: error?.message ?? null }
}
