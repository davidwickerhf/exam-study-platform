'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldGroup
} from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { studyRequest, type StudyBudget } from '@/lib/workspace/study-versions'
export function StudyBillingFields({
  source,
  setSource,
  cap,
  setCap
}: {
  source: string
  setSource: (value: string) => void
  cap: string
  setCap: (value: string) => void
}) {
  const [budget, setBudget] = useState<StudyBudget | null>(null),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    studyRequest<StudyBudget>('/api/account/ai')
      .then((r) => active && setBudget(r))
      .catch((e) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [])
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="study-billing-source">AI billing</FieldLabel>
        <Select value={source} onValueChange={(v) => v && setSource(v)}>
          <SelectTrigger id="study-billing-source">
            <SelectValue>
              {source === 'personal'
                ? 'My own AI key'
                : 'Included platform allowance'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="platform">
                Included platform allowance
              </SelectItem>
              <SelectItem
                value="personal"
                disabled={!budget?.personal.connected}
              >
                My own AI key
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldDescription>
          {budget?.unlimited ? 'No AI usage quota applies to this account or environment. Usage and cost are still recorded.' : source === 'personal'
            ? `Uses your ${budget?.personal.model || 'connected model'} key. $${budget?.personal.spentMonthUsd.toFixed(2) || '0.00'} of $${budget?.personal.monthlyLimitUsd || 0} monthly limit used.`
            : budget
              ? `${Math.max(0, budget.limits.chaptersDay - budget.platform.chaptersToday)} included chapters left today · ${Math.max(0, budget.limits.chaptersMonth - budget.platform.chaptersMonth)} this month. Token and spending limits also apply.`
              : 'Loading allowance…'}{' '}
          <Link
            className="text-primary underline"
            href="/app/settings?tab=ai-key"
          >
            Manage your AI key
          </Link>
        </FieldDescription>
      </Field>
      {!budget?.unlimited && <Field>
        <FieldLabel htmlFor="study-spending-cap">
          Spending cap for this generation (USD)
        </FieldLabel>
        <Input
          id="study-spending-cap"
          type="number"
          min="0.05"
          max="10"
          step="0.05"
          value={cap}
          onChange={(e) => setCap(e.target.value)}
        />
        <FieldDescription>
          Generation pauses before the next call would exceed this cap. Paid
          work stays saved. Billing never switches automatically.
        </FieldDescription>
      </Field>}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </FieldGroup>
  )
}
