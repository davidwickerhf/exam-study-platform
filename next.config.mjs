/** @type {import('next').NextConfig} */
const nextConfig = {
  // Development-only bridge for verifying the same-origin service split.
  async rewrites() {
    const api = process.env.WICKER_API_ORIGIN
    if (!api) return []
    const target = new URL(api)
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.pathname !== '/') throw new Error('WICKER_API_ORIGIN must be an HTTP origin without credentials or a path.')
    return [{ source: '/api/:path*', destination: `${target.origin}/api/:path*` }, { source: '/skills/:path*', destination: `${target.origin}/skills/:path*` }]
  },
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Revisiting a client workspace page reuses its route payload. Private API
    // data has independent session-scoped caching and mutation invalidation.
    staleTimes: { dynamic: 300, static: 300 },
    // Barrel files: importing one icon from lucide-react pulls its whole index
    // into the module graph. Next rewrites these to per-module imports so a
    // page ships the two icons it names rather than the set.
    // (`experimental.optimizePackageImports`, Next 16.3 — see
    // node_modules/next/dist/server/config-shared.d.ts.)
    optimizePackageImports: ['lucide-react', 'date-fns']
  },
  turbopack: {
    root: process.cwd()
  }
}

export default nextConfig
