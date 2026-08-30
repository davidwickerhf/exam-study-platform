import type { ReactNode } from 'react'
import { contacts, type ContactKind } from '@/lib/site-content'

export function ContactLink({ kind, children }: { kind: ContactKind; children?: ReactNode }) {
  const address = contacts[kind]
  return <a href={`mailto:${address}`}>{children || address}</a>
}
