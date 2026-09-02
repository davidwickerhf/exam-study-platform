'use client'

/**
 * The workspace shell, in React.
 *
 * This is the piece every other route waits on: the legacy shell is rendered
 * by public/app.js, so a migrated route could not previously appear inside the
 * product's own navigation. Built on shadcn's Sidebar, which already carries
 * the collapse behaviour, the mobile sheet, and the keyboard shortcut that the
 * vanilla version hand-rolled.
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
  SidebarProvider
} from '@/components/ui/sidebar'

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
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<Link href="/v2" />}>
                <div className="bg-primary text-primary-foreground font-heading flex aspect-square size-8 items-center justify-center rounded-sm text-lg font-semibold">
                  W
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Wicker Study</span>
                  <span className="text-muted-foreground text-xs">Academic workspace</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {SECTIONS.map((section) => (
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
              <SidebarMenuButton size="lg" render={<Link href="/v2/account" />}>
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

      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
