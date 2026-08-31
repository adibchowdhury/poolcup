import type { LucideIcon } from 'lucide-react'
import {
  Download,
  Megaphone,
  Palette,
  Shield,
  Target,
  UserCog,
  UserX,
  Vote,
} from 'lucide-react'

/**
 * Custom Pool features sourced from `LockedFeatureSection` gates in
 * `pool-settings-tab.tsx` — do not add items that are not actually gated.
 */
export type CustomPoolUnlockFeature = {
  id: string
  icon: LucideIcon
  name: string
  description: string
}

export const CUSTOM_POOL_UNLOCK_FEATURES: CustomPoolUnlockFeature[] = [
  {
    id: 'branding',
    icon: Palette,
    name: 'Pool branding',
    description: 'Custom logo and accent colors for your pool.',
  },
  {
    id: 'scoring',
    icon: Target,
    name: 'Custom scoring',
    description: 'Set points for exact scores, winners, and draws.',
  },
  {
    id: 'announcements',
    icon: Megaphone,
    name: 'Announcements',
    description: 'Post updates and pin a banner for members.',
  },
  {
    id: 'polls',
    icon: Vote,
    name: 'Polls',
    description: 'Create polls with live results for your squad.',
  },
  {
    id: 'exports',
    icon: Download,
    name: 'Exports',
    description: 'Download standings and prediction data.',
  },
  {
    id: 'co_commissioners',
    icon: UserCog,
    name: 'Co-commissioners',
    description: 'Add trusted co-admins to help run the pool.',
  },
  {
    id: 'missing_predictions',
    icon: UserX,
    name: 'Missing predictions',
    description: 'See who still needs to pick before kickoff.',
  },
  {
    id: 'moderation_log',
    icon: Shield,
    name: 'Moderation log',
    description: 'Review moderation actions taken in the pool.',
  },
]
