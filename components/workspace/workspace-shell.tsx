'use client'

/**
 * The workspace shell, in React.
 *
 * The shared navigation frame for every authenticated route. Built on
 * shadcn's Sidebar for collapse behaviour, the mobile sheet, and the keyboard
 * shortcut.
 */

import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BellIcon,
  BookOpenIcon,
  CalendarIcon,
  ChartNoAxesColumnIcon,
  ChevronRightIcon,
  HouseIcon,
  LayersIcon,
  SparklesIcon,
  TargetIcon,
  UserRoundIcon,
  LogOutIcon,
  SettingsIcon,
  PlugIcon,
  PlusIcon,
  CheckIcon,
  FileTextIcon,
  BookMarkedIcon
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger
} from '@/components/ui/sidebar'
import { WorkspaceTour } from '@/components/workspace/dashboard-tour'
import { WorkspaceSearch } from '@/components/workspace/workspace-search'
import { BrandMark } from '@/components/brand/brand-mark'
import { useIsMobile } from '@/hooks/use-mobile'
import { useClerk, useUser } from '@clerk/nextjs'
import { useWorkspaceSession } from '@/components/workspace/require-auth'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const SECTIONS = [
  {
    label: 'Study',
    items: [
      { href: '/app', label: 'Home', icon: HouseIcon },
      { href: '/app/courses', label: 'Courses', icon: BookOpenIcon },
      { href: '/app/practice', label: 'Practice', icon: TargetIcon },
      { href: '/app/updates', label: 'Updates', icon: BellIcon },
      { href: '/app/tutor', label: 'Tutor', icon: SparklesIcon }
    ]
  },
  {
    label: 'Plan',
    items: [
      { href: '/app/planning', label: 'Planning', icon: ChartNoAxesColumnIcon },
      { href: '/app/calendar', label: 'Calendar', icon: CalendarIcon }
    ]
  },
  {
    label: 'Manage',
    items: [
      { href: '/app/documents', label: 'Documents', icon: FileTextIcon },
      { href: '/app/docs', label: 'Docs', icon: BookMarkedIcon },
      { href: '/app/settings', label: 'Settings', icon: SettingsIcon },
      { href: '/app/admin', label: 'Admin', icon: LayersIcon, adminOnly: true }
    ]
  }
] as const

const MOBILE_ITEMS = [
  { href: '/app', label: 'Home', icon: HouseIcon },
  { href: '/app/courses', label: 'Courses', icon: BookOpenIcon },
  { href: '/app/practice', label: 'Practice', icon: TargetIcon },
  { href: '/app/planning', label: 'Planning', icon: ChartNoAxesColumnIcon },
  { href: '/app/account', label: 'Account', icon: UserRoundIcon }
] as const

type ProgrammeIndex = { activeProgrammeId: string; programmes: { id: string; programme: string; academicYear: string }[] }
type AccountIdentity = { name: string; email: string | null }

/** The account block at the foot of the sidebar, independent of who signed in. */
function AccountMenu({ identity, programmeIndex, onSignOut }: { identity: AccountIdentity; programmeIndex: ProgrammeIndex | null; onSignOut: () => void | Promise<void> }) {
  const [signingOut, setSigningOut] = useState(false)
  const { name, email } = identity
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const secondary = programmeIndex?.programmes.find((programme) => programme.id === programmeIndex.activeProgrammeId)?.programme || email || 'Signed in'
  const signOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await onSignOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton size="lg" tooltip="Account menu" className="h-auto min-h-16 rounded-none px-4 py-3 group-data-[collapsible=icon]:min-h-0 group-data-[collapsible=icon]:rounded-md" />}>
        <Avatar className="size-9 shrink-0 rounded-full border border-sidebar-border"><AvatarFallback className="bg-foreground text-card rounded-full text-xs font-semibold">{initials}</AvatarFallback></Avatar>
        <div className="flex min-w-0 flex-col gap-0.5 leading-none">
          <span className="truncate text-sm font-semibold" title={email ? `${name} · ${email}` : name}>{name}</span>
          <span className="text-muted-foreground truncate text-xs" title={secondary}>{secondary}</span>
        </div>
        <ChevronRightIcon className="ml-auto shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel><span className="block truncate">{name}</span><span className="block truncate font-normal">{email}</span></DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {programmeIndex && <>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Study workspace</DropdownMenuLabel>
            {programmeIndex.programmes.map((programme) => <DropdownMenuItem key={programme.id} onClick={async () => { if (programme.id === programmeIndex.activeProgrammeId) return; await fetch('/api/academics/active', { method: 'PUT', headers: { 'Content-Type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ id: programme.id }) }); window.location.reload() }}>{programme.id === programmeIndex.activeProgrammeId ? <CheckIcon /> : <span className="size-4" />}{programme.programme || 'Untitled programme'}{programme.academicYear && <span className="text-muted-foreground ml-auto text-xs">{programme.academicYear}</span>}</DropdownMenuItem>)}
            <DropdownMenuItem render={<Link href="/app/setup?checklist=1&step=programme&new=1" />}><PlusIcon />Add another programme</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
        </>}
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/app/account" />}><UserRoundIcon />Profile settings</DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/app/settings" />}><SettingsIcon />Settings</DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/app/settings?tab=connections" />}><PlugIcon />Connections</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" disabled={signingOut} closeOnClick={false} onClick={() => void signOut()}><LogOutIcon />{signingOut ? 'Signing out…' : 'Sign out'}</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Clerk's hooks throw outside a ClerkProvider, so they live behind this. */
function ClerkAccountMenu({ programmeIndex }: { programmeIndex: ProgrammeIndex | null }) {
  const clerk = useClerk()
  const { user } = useUser()
  return (
    <AccountMenu
      identity={{ name: user?.fullName || user?.firstName || 'Student', email: user?.primaryEmailAddress?.emailAddress || null }}
      programmeIndex={programmeIndex}
      onSignOut={() => clerk.signOut({ redirectUrl: '/sign-in' })}
    />
  )
}

/** Local development: the session, not Clerk, names the account. */
function LocalAccountMenu({ programmeIndex, email }: { programmeIndex: ProgrammeIndex | null; email: string | null }) {
  return (
    <AccountMenu
      identity={{ name: 'Student', email }}
      programmeIndex={programmeIndex}
      onSignOut={async () => {
        await fetch('/api/auth/local-session', { method: 'DELETE' }).catch(() => undefined)
        window.location.assign('/sign-in')
      }}
    />
  )
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  // The gate already read /api/auth/session; asking again would double every
  // workspace load, and Clerk is simply absent in the local modes.
  const { clerkEnabled, session } = useWorkspaceSession()
  const [sidebarWidth, setSidebarWidth] = useState(248)
  const [programmeIndex, setProgrammeIndex] = useState<ProgrammeIndex | null>(null)
  const isAdmin = Boolean(session?.admin)

  useEffect(() => {
    const stored = Number(window.localStorage.getItem('wicker-sidebar-width'))
    if (Number.isFinite(stored)) setSidebarWidth(Math.min(320, Math.max(224, stored)))
    fetch('/api/academics', { headers: { accept: 'application/json' } }).then((response) => response.ok ? response.json() : null).then((data) => setProgrammeIndex(data?.index ?? null)).catch(() => undefined)
  }, [])

  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startWidth = sidebarWidth
    const move = (pointer: PointerEvent) => setSidebarWidth(Math.min(320, Math.max(224, startWidth + pointer.clientX - startX)))
    const finish = (pointer: PointerEvent) => {
      const width = Math.min(320, Math.max(224, startWidth + pointer.clientX - startX))
      setSidebarWidth(width)
      window.localStorage.setItem('wicker-sidebar-width', String(width))
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
  }

  // Setup is a focused first-run journey, not another workspace destination.
  // Keep authentication and session wiring above it, but remove every piece of
  // product navigation until the student enters (or explicitly skips) setup.
  if (pathname === '/app/setup') return <div className="min-h-dvh bg-background">{children}</div>

  return (
    <SidebarProvider style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}>
      <Sidebar collapsible="icon" className="bg-sidebar">
        <SidebarHeader className="gap-0 p-0">
          <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <Link href="/app" className="flex min-w-0 flex-1 items-center gap-3 group-data-[collapsible=icon]:hidden" aria-label="Wicker Study home">
              <BrandMark className="size-9 shrink-0 rounded-lg" />
              <span className="min-w-0 leading-none group-data-[collapsible=icon]:hidden">
                <strong className="block truncate text-[15px] font-semibold tracking-tight">Wicker Study</strong>
                <span className="text-muted-foreground mt-1 block text-[10px] font-semibold tracking-[0.1em] uppercase">Study desk</span>
              </span>
            </Link>
            <SidebarTrigger className="text-muted-foreground shrink-0 group-data-[collapsible=icon]:mx-auto" />
          </div>
          <div className="border-b border-sidebar-border px-3 py-3 group-data-[collapsible=icon]:hidden"><WorkspaceSearch shortcut={!isMobile} /></div>
        </SidebarHeader>

        <SidebarContent className="py-2">
          {SECTIONS.map((section) => (
            <SidebarGroup key={section.label} className="px-3 py-2.5">
              <SidebarGroupLabel className="font-data h-7 px-2 text-[10px] font-semibold tracking-[0.1em] uppercase">{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {section.items.filter((item) => !('adminOnly' in item) || !item.adminOnly || isAdmin).map((item) => {
                    const active = item.href === '/app' ? pathname === item.href : pathname.startsWith(item.href)
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          data-tour={`nav-${item.href.split('/').at(-1)}`}
                          isActive={active}
                          tooltip={item.label}
                          render={<Link href={item.href} />}
                          // Three separable states: the live destination carries
                          // the signal rule and a filled row, hover only tints,
                          // and the keyboard ring sits above both.
                          className={`relative h-9 gap-3 px-2.5 before:absolute before:inset-y-0 before:left-0 before:w-[3px] focus-visible:ring-2 focus-visible:ring-offset-0 [&_svg]:size-[17px] ${active ? 'before:bg-primary bg-sidebar-accent font-semibold text-sidebar-accent-foreground' : 'before:bg-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground'}`}
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-0 group-data-[collapsible=icon]:p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              {clerkEnabled
                ? <ClerkAccountMenu programmeIndex={programmeIndex} />
                : <LocalAccountMenu programmeIndex={programmeIndex} email={session?.email ?? null} />}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail aria-label="Resize sidebar" title="Drag to resize sidebar" onClick={(event) => event.preventDefault()} onPointerDown={beginResize} className="cursor-col-resize after:bg-sidebar-border/70" />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-background">
        <div className="border-border bg-background sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 md:hidden">
          <SidebarTrigger data-tour="menu" className="-ml-1" />
          <BrandMark className="size-7 rounded" />
          <div className="ml-auto min-w-0 flex-1 max-w-60"><WorkspaceSearch shortcut={isMobile} /></div>
        </div>
        <div className="min-h-svh pb-20 md:pb-0">{children}</div>
        <nav className="border-border bg-background fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t md:hidden" aria-label="Primary navigation">
          {MOBILE_ITEMS.map((item) => {
            const active = item.href === '/app' ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={`nav-${item.href.split('/').at(-1)}`}
                aria-current={active ? 'page' : undefined}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                <span className={`h-0.5 w-6 ${active ? 'bg-primary' : 'bg-transparent'}`} />
                <item.icon className="size-[18px]" />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </SidebarInset>
      <WorkspaceTour />
    </SidebarProvider>
  )
}
