/** Unicode flag emoji by team name (World Cup 2026 common teams). */
const TEAM_FLAG_EMOJI: Record<string, string> = {
  Mexico: '🇲🇽',
  Poland: '🇵🇱',
  Argentina: '🇦🇷',
  'Saudi Arabia': '🇸🇦',
  France: '🇫🇷',
  Australia: '🇦🇺',
  Denmark: '🇩🇰',
  Tunisia: '🇹🇳',
  Spain: '🇪🇸',
  Germany: '🇩🇪',
  Japan: '🇯🇵',
  'Costa Rica': '🇨🇷',
  Belgium: '🇧🇪',
  Canada: '🇨🇦',
  Morocco: '🇲🇦',
  Croatia: '🇭🇷',
  Brazil: '🇧🇷',
  Serbia: '🇷🇸',
  Switzerland: '🇨🇭',
  Cameroon: '🇨🇲',
  Uruguay: '🇺🇾',
  'South Korea': '🇰🇷',
  Korea: '🇰🇷',
  Portugal: '🇵🇹',
  Ghana: '🇬🇭',
  USA: '🇺🇸',
  'United States': '🇺🇸',
  Wales: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  Iran: '🇮🇷',
  Senegal: '🇸🇳',
  Netherlands: '🇳🇱',
  Ecuador: '🇪🇨',
  Qatar: '🇶🇦',
  'South Africa': '🇿🇦',
  'S.Africa': '🇿🇦',
  'Czech Republic': '🇨🇿',
  'Czech Rep': '🇨🇿',
  Scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  Panama: '🇵🇦',
  Colombia: '🇨🇴',
  Peru: '🇵🇪',
  Chile: '🇨🇱',
  Italy: '🇮🇹',
  Ukraine: '🇺🇦',
  Austria: '🇦🇹',
  Sweden: '🇸🇪',
  Norway: '🇳🇴',
  Hungary: '🇭🇺',
  'New Zealand': '🇳🇿',
  China: '🇨🇳',
  India: '🇮🇳',
  Egypt: '🇪🇬',
  Nigeria: '🇳🇬',
  Algeria: '🇩🇿',
  Paraguay: '🇵🇾',
  Bolivia: '🇧🇴',
  Venezuela: '🇻🇪',
  Honduras: '🇭🇳',
  Jamaica: '🇯🇲',
  Slovenia: '🇸🇮',
  Slovakia: '🇸🇰',
  Romania: '🇷🇴',
  Greece: '🇬🇷',
  Turkey: '🇹🇷',
  Russia: '🇷🇺',
  'Republic of Ireland': '🇮🇪',
  Ireland: '🇮🇪',
}

const NAME_ALIASES: Record<string, string> = {
  'korea republic': 'South Korea',
  'republic of korea': 'South Korea',
  'korea': 'South Korea',
  'united states of america': 'USA',
  'u.s.a.': 'USA',
  'us': 'USA',
  'u.s.': 'USA',
  'south africa': 'South Africa',
  'saudi arabia': 'Saudi Arabia',
  'czechia': 'Czech Republic',
  'czech rep': 'Czech Republic',
  's.africa': 'South Africa',
}

/** PNG slugs in public/flags/ (filename without .png). */
export const FLAG_IMAGE_SLUGS = new Set([
  'australia',
  'belgium',
  'bosnia',
  'brazil',
  'canada',
  'cape_verde',
  'curacao',
  'czech_republic',
  'ecuador',
  'germany',
  'haiti',
  'ivory_coast',
  'japan',
  'mexico',
  'morocco',
  'netherlands',
  'paraguay',
  'qatar',
  'scotland',
  'south_africa',
  'south_korea',
  'spain',
  'sweden',
  'tunisia',
  'turkiye',
  'uruguay',
  'usa',
])

/** Team names that do not match filename slugs after normalization. */
const TEAM_FLAG_IMAGE_ALIASES: Record<string, string> = {
  turkey: 'turkiye',
  turkiye: 'turkiye',
  usa: 'usa',
  us: 'usa',
  'u.s.': 'usa',
  'u.s.a.': 'usa',
  'united states': 'usa',
  'united states of america': 'usa',
  bosnia: 'bosnia',
  'bosnia and herzegovina': 'bosnia',
  'bosnia-herzegovina': 'bosnia',
  curacao: 'curacao',
  curaçao: 'curacao',
  'korea republic': 'south_korea',
  'republic of korea': 'south_korea',
  korea: 'south_korea',
  czechia: 'czech_republic',
  'czech rep': 'czech_republic',
  'cote d ivoire': 'ivory_coast',
  'cote divoire': 'ivory_coast',
}

function normalizeTeamNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function nameToFlagSlug(name: string): string {
  return normalizeTeamNameKey(name).replace(/\s+/g, '_')
}

export function countryNameToFlagFilename(countryName: string): string {
  const key = normalizeTeamNameKey(countryName)

  if (TEAM_FLAG_IMAGE_ALIASES[key]) {
    return TEAM_FLAG_IMAGE_ALIASES[key]!
  }

  const canonical = NAME_ALIASES[key]
  if (canonical) {
    const fromCanonical = nameToFlagSlug(canonical)
    if (FLAG_IMAGE_SLUGS.has(fromCanonical)) {
      return fromCanonical
    }
  }

  const slug = nameToFlagSlug(countryName)
  return slug
}

export function hasFlagImage(countryName: string): boolean {
  return FLAG_IMAGE_SLUGS.has(countryNameToFlagFilename(countryName))
}

export function countryNameToFlagSrc(countryName: string): string {
  return `/flags/${countryNameToFlagFilename(countryName)}.png`
}

function teamInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '??'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

function lookupMappedFlag(teamName: string): string | undefined {
  const trimmed = teamName.trim()
  if (TEAM_FLAG_EMOJI[trimmed]) return TEAM_FLAG_EMOJI[trimmed]

  const aliasKey = trimmed.toLowerCase()
  const canonical = NAME_ALIASES[aliasKey]
  if (canonical && TEAM_FLAG_EMOJI[canonical]) return TEAM_FLAG_EMOJI[canonical]

  const lower = trimmed.toLowerCase()
  for (const [key, flag] of Object.entries(TEAM_FLAG_EMOJI)) {
    if (key.toLowerCase() === lower) return flag
  }

  return undefined
}

/** True if string looks like a country flag emoji (not URL / white flag / empty). */
function isUsableFlagEmoji(flag: string): boolean {
  const value = flag.trim()
  if (!value) return false
  if (/^https?:\/\//i.test(value)) return false
  if (value === '🏳️' || value === '🏳' || value === '🏴') return false
  // Regional indicator pairs (flag emojis)
  if (/[\u{1F1E6}-\u{1F1FF}]{2}/u.test(value)) return true
  // Tag sequences (England, Wales, etc.)
  if (value.includes('\u{E0067}') || value.length >= 2 && [...value].length <= 8) {
    const hasLetter = /[A-Za-z]/.test(value)
    if (!hasLetter && value.length >= 2) return true
    if (value.startsWith('🏴')) return true
  }
  // Single grapheme emoji flags (some environments)
  if (value.length <= 8 && !/^[A-Z]{2,3}$/i.test(value)) return true
  return false
}

export type ResolvedTeamFlag =
  | { kind: 'emoji'; value: string }
  | { kind: 'initials'; value: string }

export function resolveTeamFlag(
  teamName: string,
  dbFlag?: string | null,
): ResolvedTeamFlag {
  if (dbFlag && isUsableFlagEmoji(dbFlag)) {
    return { kind: 'emoji', value: dbFlag.trim() }
  }

  const mapped = lookupMappedFlag(teamName)
  if (mapped) return { kind: 'emoji', value: mapped }

  return { kind: 'initials', value: teamInitials(teamName) }
}

export function resolveTeamFlagDisplay(
  teamName: string,
  dbFlag?: string | null,
): string {
  const resolved = resolveTeamFlag(teamName, dbFlag)
  return resolved.kind === 'emoji' ? resolved.value : resolved.value
}
