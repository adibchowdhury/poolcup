import type { SupabaseClient } from '@supabase/supabase-js'
import { compressImageForUpload } from '@/src/lib/compress-image-for-upload'

type UploadResult =
  | { publicUrl: string; error: null }
  | { publicUrl: null; error: string }

/**
 * Compress + upload a pool emblem to the avatars bucket (user-scoped path).
 * Does NOT write pools.emblem_url — callers must persist via admin PATCH /settings.
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
  return { publicUrl: urlData.publicUrl, error: null }
}
