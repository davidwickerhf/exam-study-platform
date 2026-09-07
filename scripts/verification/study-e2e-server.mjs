// Real local API + Next, with a disposable account and no provider credentials.
const env = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: '4188',
  WICKER_LOCAL_USER: 'study-e2e-fixture',
  WICKER_LOCAL_USER_EMAIL: 'study-e2e@example.test',
  WICKER_LOCAL_ACCOUNTS: '',
  DATABASE_URL: '',
  CLERK_SECRET_KEY: '',
  CLERK_PUBLISHABLE_KEY: '',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
  OPENAI_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  LLM_PROVIDER: 'openai',
  AI_CONNECTION_ENCRYPTION_KEY: Buffer.alloc(32, 11).toString('base64'),
  VERCEL: '',
  VERCEL_ENV: '',
  WICKER_API_ORIGIN: ''
}
// The browser suite drives dozens of separate browser contexts through one
// disposable account. Do not let aggregate fixture traffic throttle later
// tests; the limiter itself is covered by rate-limit.test.mjs. This runs only
// in this test launcher, never in the production server.
Object.assign(process.env, env)
const { resetRateLimits } = await import('../../lib/rate-limit.mjs')
setInterval(resetRateLimits, 5000).unref()
await import('../../server.mjs')
