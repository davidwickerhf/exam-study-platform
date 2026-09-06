/** @type {import('next').NextConfig} */
const nextConfig = {
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
