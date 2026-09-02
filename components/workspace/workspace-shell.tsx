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
  UserRoundIcon
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
import { WorkspaceSearch } from '@/components/workspace/workspace-search'
import { BrandMark } from '@/components/brand/brand-mark'
import { useUser } from '@clerk/nextjs'

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
    items: [{ href: '/app/admin', label: 'Admin', icon: LayersIcon }]
  }
] as const

const MOBILE_ITEMS = [
  { href: '/app', label: 'Home', icon: HouseIcon },
  { href: '/app/courses', label: 'Courses', icon: BookOpenIcon },
  { href: '/app/practice', label: 'Practice', icon: TargetIcon },
  { href: '/app/planning', label: 'Planning', icon: ChartNoAxesColumnIcon },
  { href: '/app/account', label: 'Account', icon: UserRoundIcon }
] as const

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { user: clerkUser } = useUser()
  const [sidebarWidth, setSidebarWidth] = useState(236)
  const [isAdmin, setIsAdmin] = useState(false)
  const name = clerkUser?.fullName || clerkUser?.firstName || 'Student'
  const email = clerkUser?.primaryEmailAddress?.emailAddress || null
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  useEffect(() => {
    const stored = Number(window.localStorage.getItem('wicker-sidebar-width'))
    if (Number.isFinite(stored)) setSidebarWidth(Math.min(320, Math.max(208, stored)))
    fetch('/api/auth/session').then((response) => response.ok ? response.json() : null).then((session) => setIsAdmin(Boolean(session?.admin))).catch(() => undefined)
  }, [])

  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startWidth = sidebarWidth
    const move = (pointer: PointerEvent) => setSidebarWidth(Math.min(320, Math.max(208, startWidth + pointer.clientX - startX)))
    const finish = (pointer: PointerEvent) => {
      const width = Math.min(320, Math.max(208, startWidth + pointer.clientX - startX))
      setSidebarWidth(width)
      window.localStorage.setItem('wicker-sidebar-width', String(width))
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
  }

  return (
    <SidebarProvider style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-1">
          <SidebarMenu className="min-w-0 flex-1">
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<Link href="/app" />}>
                <BrandMark className="size-8 shrink-0" />
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Wicker Study</span>
                  <span className="text-muted-foreground text-xs">Academic workspace</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarTrigger className="shrink-0 group-data-[collapsible=icon]:hidden" />
          </div>
        </SidebarHeader>

        <SidebarContent>
          <div className="px-2"><WorkspaceSearch /></div>
          {SECTIONS.filter((section) => section.label !== 'Manage' || isAdmin).map((section) => (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={pathname === item.href}
                        tooltip={item.label}
                        render={<Link href={item.href} />}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        {/* The account block the vanilla shell kept at the foot of the rail. */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<Link href="/app/account" />}>
                <Avatar className="size-8 rounded-sm">
                  <AvatarFallback className="rounded-sm">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col gap-0.5 leading-none">
                  <span className="truncate font-medium">{name}</span>
                  <span className="text-muted-foreground truncate text-xs">{email ?? 'Signed in'}</span>
                </div>
                <ChevronRightIcon className="ml-auto" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail aria-label="Resize sidebar" title="Drag to resize sidebar" onClick={(event) => event.preventDefault()} onPointerDown={beginResize} className="cursor-col-resize after:bg-sidebar-border/70" />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-background">
        <div className="border-border bg-background sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 md:hidden">
          <SidebarTrigger className="-ml-1" />
          <BrandMark className="size-7 rounded" />
          <span className="hidden text-sm font-semibold tracking-tight min-[390px]:inline">Wicker Study</span>
          <div className="ml-auto w-[min(15rem,58vw)]"><WorkspaceSearch /></div>
        </div>
        <div className="min-h-svh pb-20 md:pb-0">{children}</div>
        <nav className="border-border bg-background fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t md:hidden" aria-label="Primary navigation">
          {MOBILE_ITEMS.map((item) => {
            const active = item.href === '/app' ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
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
    </SidebarProvider>
  )
}
