import type { SVGProps } from 'react'

type IconName = 'menu' | 'close' | 'arrow' | 'shield' | 'book' | 'message' | 'practice'

export function SiteIcon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {name === 'menu' && <path d="M4 7h16M4 12h16M4 17h16" />}
      {name === 'close' && <path d="m6 6 12 12M18 6 6 18" />}
      {name === 'arrow' && <path d="M5 12h14M14 7l5 5-5 5" />}
      {name === 'shield' && <><path d="M12 3l8 3v6c0 4.5-3.4 7.5-8 9-4.6-1.5-8-4.5-8-9V6l8-3Z" /><path d="m9 12 2 2 4-4" /></>}
      {name === 'book' && <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16ZM20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z" />}
      {name === 'message' && <><path d="M5 18l-2 3v-5.5A8 8 0 1 1 6.5 19H5Z" /><path d="M8 10h8M8 14h5" /></>}
      {name === 'practice' && <><path d="M7 3h10v4H7zM5 5H4a1 1 0 0 0-1 1v14h18V6a1 1 0 0 0-1-1h-1" /><path d="m8 12 2 2 5-5" /></>}
    </svg>
  )
}
