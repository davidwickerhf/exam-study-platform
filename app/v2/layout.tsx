import type { ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { WorkspaceShell } from '@/components/v2/workspace-shell'

/**
 * The migrated surfaces own the board ground themselves. The legacy shell
 * sets it on <body> for everything it still renders; these routes cannot rely
 * on that, and will not need to once public/app.js is gone.
 */
export default function V2Layout({ children }: { children: ReactNode }) {
  return (
    <div data-v2 className="bg-background text-foreground min-h-dvh">
      <TooltipProvider>
        <WorkspaceShell>{children}</WorkspaceShell>
      </TooltipProvider>
    </div>
  )
}
