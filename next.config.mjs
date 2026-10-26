/** @type {import('next').NextConfig} */
const nextConfig = {
  // Same-origin service split. Vercel routes these paths to the `api` service
  // in vercel.json; elsewhere (Coolify, local) Next proxies them to the API
  // container at WICKER_API_SERVICE_URL (e.g. http://api:8080). Rewrites are
  // compiled at build time, so the variable must be set when building.
  async rewrites() {
    if (process.env.VERCEL) return []
    const api = process.env.WICKER_API_SERVICE_URL || process.env.WICKER_API_ORIGIN
    if (!api) return []
    const target = new URL(api)
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.pathname !== '/') throw new Error('WICKER_API_SERVICE_URL must be an HTTP origin without credentials or a path.')
    const origin = target.origin
    // beforeFiles: these paths always belong to the API, as on Vercel.
    return {
      beforeFiles: [
        { source: '/.well-known/oauth-authorization-server', destination: `${origin}/.well-known/oauth-authorization-server` },
        { source: '/.well-known/oauth-protected-resource/api/mcp', destination: `${origin}/.well-known/oauth-protected-resource/api/mcp` },
        { source: '/.well-known/oauth-protected-resource', destination: `${origin}/.well-known/oauth-protected-resource` },
        { source: '/api/:path*', destination: `${origin}/api/:path*` },
        { source: '/skills/:path*', destination: `${origin}/skills/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Proxied API calls include long tutor streams and document conversions.
    proxyTimeout: Number(process.env.WICKER_API_PROXY_TIMEOUT_MS || 900_000),
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
