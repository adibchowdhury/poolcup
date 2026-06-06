import { readdir } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'

export async function GET() {
  const dir = path.join(process.cwd(), 'public', 'avatars')
  const files = await readdir(dir)
  const images = files.filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
  return NextResponse.json(images)
}
