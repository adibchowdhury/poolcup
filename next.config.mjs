const supabaseHostname = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
})()

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/leaderboard',
        has: [{ type: 'query', key: 'scope', value: 'friends' }],
        destination: '/friends?tab=leaderboard',
        permanent: false,
      },
      {
        source: '/leaderboard',
        destination: '/dashboard',
        permanent: false,
      },
    ]
  },
  images: {
    unoptimized: true,
    ...(supabaseHostname
      ? {
          remotePatterns: [
            {
              protocol: 'https',
              hostname: supabaseHostname,
              pathname: '/storage/v1/object/public/**',
            },
          ],
        }
      : {}),
  },
}

export default nextConfig
