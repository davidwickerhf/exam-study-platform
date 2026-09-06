import { FeedbackProvider } from '@/components/feedback/feedback'
import type { ReactNode } from 'react'
import { AppProviders } from '@/components/app-providers'
import { TooltipProvider } from '@/components/ui/tooltip'
import { RequireAuth } from '@/components/workspace/require-auth'
import { WorkspaceShell } from '@/components/workspace/workspace-shell'

/** The authenticated workspace owns its board ground and navigation frame. */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || null
  const authEnabled = Boolean(publishableKey && process.env.CLERK_SECRET_KEY)
  const localLoginEnabled = !authEnabled && process.env.NODE_ENV !== 'production' && Boolean(process.env.WICKER_LOCAL_ACCOUNTS)
  return (
    <div data-workspace className="bg-background text-foreground min-h-dvh">
      <AppProviders publishableKey={publishableKey}>
        <RequireAuth authEnabled={authEnabled} localLoginEnabled={localLoginEnabled}>
          <TooltipProvider>
            <FeedbackProvider><WorkspaceShell>{children}</WorkspaceShell></FeedbackProvider>
          </TooltipProvider>
        </RequireAuth>
      </AppProviders>
    </div>
  )
}
