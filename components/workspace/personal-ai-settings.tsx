'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription
} from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StudyAiPreferencesForm } from './study-ai-preferences'
import { Skeleton } from '@/components/ui/skeleton'
import { studyRequest, type StudyBudget } from '@/lib/workspace/study-versions'
export function PersonalAiSettings() {
  const [budget, setBudget] = useState<StudyBudget | null>(null),
    [model, setModel] = useState('gpt-5-mini'),
    [key, setKey] = useState(''),
    [limit, setLimit] = useState('5'),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  async function load() {
    const b = await studyRequest<StudyBudget>('/api/account/ai')
    setBudget(b)
    setModel(b.personal.model)
    setLimit(String(b.personal.monthlyLimitUsd))
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message))
  }, [])
  async function save(remove = false) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await studyRequest(
        '/api/account/ai',
        remove
          ? undefined
          : { model, apiKey: key, monthlyLimitUsd: Number(limit), consent },
        remove ? 'DELETE' : 'POST'
      )
      setKey('')
      setConsent(false)
      await load()
      setNotice(
        remove
          ? 'Your AI key was removed. Jobs using it will pause before their next request.'
          : 'Settings saved. Choose “My own AI key” when generating or resuming a version.'
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <section className="space-y-5 border-b pb-6"><h2 className="text-xl font-semibold">AI defaults</h2><StudyAiPreferencesForm/></section>
      <header>
        <h2 className="text-xl font-semibold">Your AI key</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          Generate beyond the included study allowance using your own OpenAI or
          Anthropic account. Choose which account pays each time you start or
          resume generation.
        </p>
      </header>
      {budget ? (
        <>
          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold">
              {budget.unlimited ? 'Unlimited AI usage' : 'Included study allowance'}
            </h3>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">
                  Chapters today
                </dt>
                <dd className="mt-1">
                  {budget.platform.chaptersToday}{!budget.unlimited && ` / ${budget.limits.chaptersDay}`}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">
                  Chapters this month
                </dt>
                <dd className="mt-1">
                  {budget.platform.chaptersMonth}{!budget.unlimited && ` / ${budget.limits.chaptersMonth}`}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">
                  Platform allowance used this month
                </dt>
                <dd className="mt-1">
                  ${budget.platform.spentMonthUsd.toFixed(2)}{!budget.unlimited && ` / $${budget.limits.userMonthUsd.toFixed(2)}`}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">
                  Your key usage this month
                </dt>
                <dd className="mt-1">
                  ${budget.personal.spentMonthUsd.toFixed(2)}{!budget.unlimited && ` / $${budget.personal.monthlyLimitUsd.toFixed(2)}`}
                </dd>
              </div>
            </dl>
            <p className="text-muted-foreground mt-4 text-xs">
              {budget.unlimited ? 'No spending, chapter, token or request quota applies. Actual costs are still recorded; execution and duplicate-job safeguards remain active.' : <>Reading, saved questions and unchanged chapter reuse do not
              trigger new AI calls. Mapping, writing, checks and retries count
              toward token and spending limits. The shared platform budget also
              applies.</>}
            </p>
          </div>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="personal-ai-model">
                Provider and model
              </FieldLabel>
              <Select value={model} onValueChange={(v) => v && setModel(v)}>
                <SelectTrigger id="personal-ai-model">
                  <SelectValue>
                    {budget.personal.models[model]?.provider === 'openai'
                      ? 'OpenAI'
                      : 'Anthropic'}{' '}
                    · {budget.personal.models[model]?.label || model}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(budget.personal.models).map(([id, m]) => (
                      <SelectItem key={id} value={id}>
                        {m.provider === 'openai' ? 'OpenAI' : 'Anthropic'} ·{' '}
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="personal-ai-key">
                {budget.personal.connected
                  ? 'Replace API key (optional)'
                  : 'API key'}
              </FieldLabel>
              <Input
                id="personal-ai-key"
                type="password"
                value={key}
                autoComplete="new-password"
                spellCheck={false}
                onChange={(e) => setKey(e.target.value)}
                placeholder={
                  budget.personal.connected
                    ? 'A key is securely stored'
                    : 'Paste your provider API key'
                }
              />
              <FieldDescription>
                Stored encrypted on the server. The saved key is never returned
                to the browser or included in your data export. A ChatGPT or
                Claude subscription is separate from API billing.
              </FieldDescription>
            </Field>
            {!budget.unlimited && <Field>
              <FieldLabel htmlFor="personal-ai-monthly-limit">
                Monthly Wicker spending limit (USD)
              </FieldLabel>
              <Input
                id="personal-ai-monthly-limit"
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
              <FieldDescription>
                This limit covers requests made through Wicker with your key,
                using the configured rate card. Other apps and provider charges
                are outside it.
              </FieldDescription>
            </Field>}
            <Field orientation="horizontal">
              <Checkbox
                id="personal-ai-consent"
                checked={consent}
                onCheckedChange={(v) => setConsent(Boolean(v))}
              />
              <FieldLabel htmlFor="personal-ai-consent">
                When I select my key, Wicker may send my selected study sources
                to this provider and bill the requests to my API account.
              </FieldLabel>
            </Field>
          </FieldGroup>
          {!budget.personal.storageConfigured && (
            <Alert>
              <AlertDescription>
                Secure key storage needs server configuration before you can
                connect an AI key.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={
                busy ||
                !consent ||
                !budget.personal.storageConfigured ||
                (!key && !budget.personal.connected)
              }
              onClick={() => void save()}
            >
              Save AI settings
            </Button>
            {budget.personal.connected && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void save(true)}
              >
                Remove key
              </Button>
            )}
          </div>
        </>
      ) : (
        !error && <Skeleton className="h-64 w-full" />
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <p role="status" className="text-muted-foreground text-sm">
          {notice}
        </p>
      )}
    </section>
  )
}
