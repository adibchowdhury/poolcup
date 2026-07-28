const MAX_DIMENSION = 512
const JPEG_QUALITY = 0.85

export async function compressImageForUpload(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
  )
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Could not prepare image for upload')
  }

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const usePng = file.type === 'image/png'
  const mimeType = usePng ? 'image/png' : 'image/jpeg'

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result)
          return
        }
        reject(new Error('Could not compress image'))
      },
      mimeType,
      usePng ? undefined : JPEG_QUALITY,
    )
  })

  return blob
}
