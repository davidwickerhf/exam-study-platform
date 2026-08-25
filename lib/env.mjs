import dotenv from 'dotenv'

// Local Clerk tooling writes `.env.local`; traditional deployments and the
// setup guide may use `.env`. Existing process variables always win.
dotenv.config({ path: ['.env.local', '.env'], override: false, quiet: true })
