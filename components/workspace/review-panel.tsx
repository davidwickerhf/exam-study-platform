'use client'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export function ReviewPanel({trigger,triggerLabel,disabled,title,description,children,bodyClassName}: {trigger:ReactNode;triggerLabel?:string;disabled?:boolean;title:string;description:string;children:ReactNode;bodyClassName?:string}) {
  return <Sheet>
    <SheetTrigger render={<Button type="button" variant={triggerLabel ? "ghost" : "outline"} size={triggerLabel ? "icon-sm" : "sm"} aria-label={triggerLabel} title={triggerLabel} disabled={disabled}/>}>{trigger}</SheetTrigger>
    <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
      <SheetHeader className="shrink-0 border-b p-5 pr-12"><SheetTitle className="break-words">{title}</SheetTitle><SheetDescription>{description}</SheetDescription></SheetHeader>
      <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain p-5',bodyClassName)}>{children}</div>
      <SheetFooter className="shrink-0 border-t p-4"><SheetClose render={<Button type="button"/>}>Done reviewing</SheetClose></SheetFooter>
    </SheetContent>
  </Sheet>
}
