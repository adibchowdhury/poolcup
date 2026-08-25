import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Calendar,
  CircleHelp,
  Compass,
  FileText,
  Home,
  Mail,
  MessageCircle,
  Plus,
  Settings,
  Trophy,
  User,
  Users,
} from 'lucide-react'
import { resolveHubDesktopNavValue } from '@/src/lib/mobile-bottom-nav-routes'

export type HubContentHeader = {
  title: string
  icon: LucideIcon
}

/** Display titles + nav icons for hub desktop content top bar (lg+). */
const HUB_NAV_CONTENT_HEADERS: Record<string, HubContentHeader> = {
  dashboard: { title: 'Dashboard', icon: Home },
  games: { title: 'Upcoming Matches', icon: Calendar },
  friends: { title: 'Friends', icon: Users },
  discover: { title: 'Discover', icon: Compass },
  profile: { title: 'Profile', icon: User },
  inbox: { title: 'Chat', icon: MessageCircle },
  'how-it-works': { title: 'Help', icon: CircleHelp },
}

const DEFAULT_HEADER: HubContentHeader = {
  title: 'PoolCup',
  icon: Home,
}

/**
 * Derives the content-area page title + icon from pathname + tab
 * (same inputs as sidebar nav).
 */
export function resolveHubContentHeader(
  pathname: string,
  tabParam: string | null,
): HubContentHeader {
  if (pathname.startsWith('/friends/find')) {
    return { title: 'Find Friends', icon: Users }
  }

  const nav = resolveHubDesktopNavValue(pathname, tabParam)
  if (nav && HUB_NAV_CONTENT_HEADERS[nav]) {
    return HUB_NAV_CONTENT_HEADERS[nav]
  }
  if (pathname === '/settings/notifications') {
    return { title: 'Notifications', icon: Bell }
  }
  if (pathname === '/contact') {
    return { title: 'Contact', icon: Mail }
  }
  if (pathname === '/terms') {
    return { title: 'Terms', icon: FileText }
  }
  if (pathname === '/privacy') {
    return { title: 'Privacy', icon: FileText }
  }
  if (pathname === '/create') {
    return { title: 'Create Pool', icon: Plus }
  }
  if (pathname.startsWith('/match/')) {
    return { title: 'Match', icon: Calendar }
  }
  if (pathname.startsWith('/pool/')) {
    if (pathname.includes('/settings')) {
      return { title: 'Pool Settings', icon: Settings }
    }
    return { title: 'Pool', icon: Trophy }
  }
  if (pathname.startsWith('/chat/')) {
    return { title: 'Chat', icon: MessageCircle }
  }

  return DEFAULT_HEADER
}

/** @deprecated Prefer resolveHubContentHeader for icon + title. */
export function resolveHubContentTitle(
  pathname: string,
  tabParam: string | null,
): string {
  return resolveHubContentHeader(pathname, tabParam).title
}
