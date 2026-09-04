export type AccessPolicy = {
  domains: string[]
  emails: string[]
}

export const ACCESS_EMAIL_DOMAINS: readonly string[]
export const ACCESS_ADMIN_EMAILS: readonly string[]
export function accessPolicy(): AccessPolicy
export function emailAllowed(email: unknown, policy?: AccessPolicy): boolean
export function isAccessAdministratorEmail(email: unknown): boolean
export function verifiedPrimaryEmail(user: {
  primaryEmailAddressId?: string | null
  emailAddresses?: Array<{
    id: string
    emailAddress: string
    verification?: { status?: string | null } | null
  }> | null
} | null | undefined): string | null
