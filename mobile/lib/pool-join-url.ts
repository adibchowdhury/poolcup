/** Full website join link for sharing (static app has no /join route). */
export function getPoolJoinUrl(inviteCode: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'https://www.getpoolcup.com'
  return `${base}/join/${inviteCode}`
}
