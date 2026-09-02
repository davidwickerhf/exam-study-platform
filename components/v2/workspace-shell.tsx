'use client'

/**
 * The workspace shell, in React.
 *
 * The shared navigation frame for every authenticated route. Built on
 * shadcn's Sidebar for collapse behaviour, the mobile sheet, and the keyboard
 * shortcut.
 */

import type { ReactNode } from 'react'
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
  TargetIcon
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
  SidebarTrigger
} from '@/components/ui/sidebar'
import { WorkspaceSearch } from '@/components/v2/workspace-search'
import { BrandMark } from '@/components/brand/brand-mark'

const SECTIONS = [
  {
    label: 'Study',
    items: [
      { href: '/v2', label: 'Home', icon: HouseIcon },
      { href: '/v2/courses', label: 'Courses', icon: BookOpenIcon },
      { href: '/v2/practice', label: 'Practice', icon: TargetIcon },
      { href: '/v2/updates', label: 'Updates', icon: BellIcon },
      { href: '/v2/tutor', label: 'Tutor', icon: SparklesIcon }
    ]
  },
  {
    label: 'Plan',
    items: [
      { href: '/v2/planning', label: 'Planning', icon: ChartNoAxesColumnIcon },
      { href: '/v2/calendar', label: 'Calendar', icon: CalendarIcon }
    ]
  },
  {
    label: 'Manage',
    items: [{ href: '/v2/admin', label: 'Admin', icon: LayersIcon }]
  }
] as const

export function WorkspaceShell({ children, user }: { children: ReactNode; user?: { name: string; email: string } }) {
  const pathname = usePathname()
  const initials = (user?.name ?? 'Student')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <SidebarProvider style={{ '--sidebar-width': '15rem' } as React.CSSProperties}>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-sidebar-border border-b px-3 py-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="h-12 px-1 hover:bg-transparent active:bg-transparent" render={<Link href="/v2" />}>
                <BrandMark className="size-9 shrink-0 rounded-md shadow-[0_8px_24px_rgb(49_84_232/0.24)]" />
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="text-sidebar-accent-foreground font-semibold tracking-tight">Wicker Study</span>
                  <span className="text-sidebar-foreground/70 text-xs">Academic workspace</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="px-2 py-4">
          <div className="px-1 pb-3"><WorkspaceSearch /></div>
          {SECTIONS.map((section) => (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel className="text-sidebar-foreground/55 px-2 text-[11px] font-semibold tracking-[0.12em] uppercase">{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={pathname === item.href}
                        tooltip={item.label}
                        className="h-9 rounded-md px-2.5 font-medium transition-colors data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:shadow-[inset_2px_0_0_var(--sidebar-primary)]"
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
        <SidebarFooter className="border-sidebar-border border-t p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="h-12 rounded-md" render={<Link href="/v2/account" />}>
                <Avatar className="size-8 rounded-sm">
                  <AvatarFallback className="rounded-sm">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col gap-0.5 leading-none">
                  <span className="truncate font-medium">{user?.name ?? 'Student'}</span>
                  <span className="text-muted-foreground truncate text-xs">{user?.email ?? 'Not signed in'}</span>
                </div>
                <ChevronRightIcon className="ml-auto" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-background">
        <div className="border-border/80 bg-background/95 sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 backdrop-blur md:hidden">
          <SidebarTrigger className="-ml-1" />
          <BrandMark className="size-7 rounded" />
          <span className="text-sm font-semibold tracking-tight">Wicker Study</span>
          <div className="ml-auto w-40"><WorkspaceSearch /></div>
        </div>
        <div className="min-h-svh">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
