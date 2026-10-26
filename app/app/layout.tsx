import { FeedbackProvider } from '@/components/feedback/feedback'
import type { ReactNode } from 'react'
import { hostedAuthEnabled } from '@/lib/hosted-auth.mjs'
import { TooltipProvider } from '@/components/ui/tooltip'
import { RequireAuth } from '@/components/workspace/require-auth'
import { WorkspaceShell } from '@/components/workspace/workspace-shell'

/** The authenticated workspace owns its board ground and navigation frame. */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const authEnabled = hostedAuthEnabled()
  const localLoginEnabled = !authEnabled && process.env.NODE_ENV !== 'production' && Boolean(process.env.WICKER_LOCAL_ACCOUNTS)
  return (
    <div data-workspace className="bg-background text-foreground min-h-dvh">
      <RequireAuth authEnabled={authEnabled} localLoginEnabled={localLoginEnabled}>
        <TooltipProvider>
          <FeedbackProvider><WorkspaceShell>{children}</WorkspaceShell></FeedbackProvider>
        </TooltipProvider>
      </RequireAuth>
    </div>
  )
}
