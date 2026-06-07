import { createHash, timingSafeEqual } from 'node:crypto'

function hash(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

/** Constant-time string comparison (hashes to fixed length first). */
export function secureCompare(a: string, b: string): boolean {
  return timingSafeEqual(hash(a), hash(b))
}
