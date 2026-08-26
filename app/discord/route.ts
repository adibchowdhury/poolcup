import { NextResponse } from 'next/server'
import { DISCORD_INVITE_URL } from '@/src/lib/discord-invite'

/** Vanity redirect — use /discord in emails/socials; invite URL can change without rotting links. */
export function GET() {
  return NextResponse.redirect(DISCORD_INVITE_URL, 302)
}
