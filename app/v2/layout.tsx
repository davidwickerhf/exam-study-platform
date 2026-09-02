import type { ReactNode } from 'react'
import { AppProviders } from '@/components/app-providers'
import { TooltipProvider } from '@/components/ui/tooltip'
import { RequireAuth } from '@/components/v2/require-auth'
import { WorkspaceShell } from '@/components/v2/workspace-shell'

/**
 * The migrated surfaces own the board ground themselves. The legacy shell
 * sets it on <body> for everything it still renders; these routes cannot rely
 * on that, and will not need to once public/app.js is gone.
 */
export default function V2Layout({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || null
  const authEnabled = Boolean(publishableKey && process.env.CLERK_SECRET_KEY)
  return (
    <div data-v2 className="bg-background text-foreground min-h-dvh">
      <AppProviders publishableKey={publishableKey}>
        <RequireAuth authEnabled={authEnabled}>
          <TooltipProvider>
            <WorkspaceShell>{children}</WorkspaceShell>
          </TooltipProvider>
        </RequireAuth>
      </AppProviders>
    </div>
  )
}
