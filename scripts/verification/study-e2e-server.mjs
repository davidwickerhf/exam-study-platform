// Real local API + Next, with a disposable account and no provider credentials.
import { spawn } from 'node:child_process'
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
const child = spawn(process.execPath, ['server.mjs'], { env, stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal))
child.on('exit', (code) => process.exit(code || 0))
