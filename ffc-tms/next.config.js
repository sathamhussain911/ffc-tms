/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  buildExcludes: [/middleware-manifest\.json$/],
})

const nextConfig = {
  reactStrictMode: true,
  // NOTE: output:'export' is REMOVED — server components need SSR (cookies, redirect, auth)
  // Cloudflare Pages deploys Next.js SSR via @cloudflare/next-on-pages
  // Build command in Cloudflare: npx @cloudflare/next-on-pages
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
    unoptimized: true,
  },
}

module.exports = withPWA(nextConfig)
