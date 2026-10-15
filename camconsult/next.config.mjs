const CLIENT_PORTAL_URL =
  process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL ?? 'https://cabinet.camconsult.com.tn/login'
const SITE_ORIGIN = new URL(process.env.SITE_URL || 'https://camconsult.com.tn').origin

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.camconsult.com.tn' }],
        destination: `${SITE_ORIGIN}/:path*`,
        permanent: true,
      },
      {
        source: '/espace-client',
        destination: CLIENT_PORTAL_URL,
        permanent: false,
      },
    ]
  },
}

export default nextConfig
