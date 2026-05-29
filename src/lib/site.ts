/** Production site URL used for metadata, canonical links, and auth redirects. */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
  'https://www.getpoolcup.com'
