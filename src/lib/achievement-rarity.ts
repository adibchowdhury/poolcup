/** Canonical rarity labels for UI (title-case). */
export type AchievementRarityLabel = 'Common' | 'Rare' | 'Epic' | 'Legendary'

export const ACHIEVEMENT_RARITY_ORDER = [
  'common',
  'rare',
  'epic',
  'legendary',
] as const

export type AchievementRaritySlug = (typeof ACHIEVEMENT_RARITY_ORDER)[number]

export function normalizeAchievementRarity(
  value: string | null | undefined,
): AchievementRaritySlug {
  const raw = (value ?? '').trim().toLowerCase()
  if (raw === 'rare') return 'rare'
  if (raw === 'epic') return 'epic'
  if (raw === 'legendary') return 'legendary'
  return 'common'
}

export function achievementRarityLabel(
  value: string | null | undefined,
): AchievementRarityLabel {
  const slug = normalizeAchievementRarity(value)
  if (slug === 'rare') return 'Rare'
  if (slug === 'epic') return 'Epic'
  if (slug === 'legendary') return 'Legendary'
  return 'Common'
}

/** @deprecated Prefer achievementRarityLabel from DB column. */
export function getAchievementRarityFromXp(
  xpValue: number,
): AchievementRarityLabel {
  if (xpValue <= 50) return 'Common'
  if (xpValue <= 250) return 'Rare'
  if (xpValue <= 600) return 'Epic'
  return 'Legendary'
}

export const ACHIEVEMENT_RARITY_STYLES: Record<
  AchievementRarityLabel,
  { border: string; text: string; bar: string; glow: string; chip: string }
> = {
  Common: {
    border: 'border-slate-400/25',
    text: 'text-slate-300',
    bar: 'bg-slate-400',
    glow: 'shadow-[0_0_18px_rgba(148,163,184,0.08)]',
    chip: 'border-slate-400/30 bg-slate-400/10 text-slate-300',
  },
  Rare: {
    border: 'border-sky-400/35',
    text: 'text-sky-300',
    bar: 'bg-sky-400',
    glow: 'shadow-[0_0_20px_rgba(56,189,248,0.12)]',
    chip: 'border-sky-400/35 bg-sky-400/10 text-sky-300',
  },
  Epic: {
    border: 'border-purple-400/35',
    text: 'text-purple-300',
    bar: 'bg-purple-400',
    glow: 'shadow-[0_0_20px_rgba(192,132,252,0.13)]',
    chip: 'border-purple-400/35 bg-purple-400/10 text-purple-300',
  },
  Legendary: {
    border: 'border-amber-400/40',
    text: 'text-amber-300',
    bar: 'bg-amber-400',
    glow: 'shadow-[0_0_24px_rgba(251,191,36,0.16)]',
    chip: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  },
}
