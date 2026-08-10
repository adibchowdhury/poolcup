/** Sports-themed default usernames — mashed adjective+noun+digits (e.g. cosmicgunner3569). */

const ADJECTIVES = [
  'swift',
  'cosmic',
  'elite',
  'golden',
  'fierce',
  'rapid',
  'bold',
  'lucky',
  'clutch',
  'prime',
  'silent',
  'iron',
  'neon',
  'wild',
  'crisp',
  'sonic',
  'turbo',
  'stellar',
  'mighty',
  'razor',
] as const

const NOUNS = [
  'striker',
  'gunner',
  'keeper',
  'ace',
  'blazer',
  'rocket',
  'hammer',
  'fox',
  'wolf',
  'eagle',
  'ranger',
  'captain',
  'finisher',
  'playmaker',
  'blocker',
  'dribbler',
  'sniper',
  'midfielder',
  'goalie',
  'runner',
] as const

function randomInt(maxExclusive: number): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0]! % maxExclusive
  }
  return Math.floor(Math.random() * maxExclusive)
}

/** Build one candidate in the backfill style (lowercase a-z + digits only). */
export function buildSportsUsernameCandidate(): string {
  const adj = ADJECTIVES[randomInt(ADJECTIVES.length)]!
  const noun = NOUNS[randomInt(NOUNS.length)]!
  const digits = String(randomInt(9000) + 1000) // 1000–9999
  return `${adj}${noun}${digits}`
}
