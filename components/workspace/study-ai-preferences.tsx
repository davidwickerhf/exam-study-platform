'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { StudyBillingFields } from './study-billing-fields'
import { studyRequest } from '@/lib/workspace/study-versions'
export type StudyAiPreferences = {
  billingSource: string
  quality: string
  maxJobUsd: number
}
export function useStudyAiPreferences() {
  const [preferences, setPreferences] = useState<StudyAiPreferences | null>(
      null,
    ),
    [error, setError] = useState('')
  useEffect(() => {
    let live = true,
      changed = false
    void studyRequest<StudyAiPreferences>('/api/account/ai/preferences')
      .then((r) => {
        if (live && !changed) {
          setPreferences(r)
          setError('')
        }
      })
      .catch((e) => {
        if (live && !changed) setError(e.message)
      })
    // Update other mounted controls directly; saving once must not fan out
    // duplicate account reads or let an older read replace the saved choice.
    const update = (event: Event) => {
      changed = true
      setPreferences((event as CustomEvent<StudyAiPreferences>).detail)
      setError('')
    }
    window.addEventListener('study-ai-preferences', update)
    return () => {
      live = false
      window.removeEventListener('study-ai-preferences', update)
    }
  }, [])
  async function save(value: StudyAiPreferences) {
    const next = await studyRequest<StudyAiPreferences>(
      '/api/account/ai/preferences',
      value,
    )
    setPreferences(next)
    window.dispatchEvent(
      new CustomEvent('study-ai-preferences', { detail: next }),
    )
    return next
  }
  return { preferences, error, save }
}
export function StudyAiPreferencesForm({ onSaved }: { onSaved?: () => void }) {
  const { preferences, error, save } = useStudyAiPreferences()
  const [source, setSource] = useState('platform'),
    [quality, setQuality] = useState('standard'),
    [cap, setCap] = useState('1'),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  useEffect(() => {
    if (preferences) {
      setSource(preferences.billingSource)
      setQuality(preferences.quality)
      setCap(String(preferences.maxJobUsd))
    }
  }, [preferences])
  async function submit() {
    setBusy(true)
    setMessage('')
    try {
      await save({ billingSource: source, quality, maxJobUsd: Number(cap) })
      setMessage('AI preferences saved.')
      onSaved?.()
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Saved to your account for future practice and assessments. Checking an
        answer uses these preferences directly. Billing never switches
        automatically.
      </p>
      <StudyBillingFields
        source={source}
        setSource={setSource}
        quality={quality}
        setQuality={setQuality}
        cap={cap}
        setCap={setCap}
      />
      <Button disabled={busy || !preferences} onClick={() => void submit()}>
        Save AI preferences
      </Button>
      {(message || error) && (
        <p role="status" className="text-sm">
          {message || error}
        </p>
      )}
    </div>
  )
}
export function StudyAiPreferenceSummary({
  preferences,
}: {
  preferences: StudyAiPreferences | null
}) {
  return (
    <span className="text-xs text-muted-foreground">
      {preferences
        ? `${preferences.quality === 'enhanced' && preferences.billingSource === 'platform' ? 'GPT-5.4' : preferences.billingSource === 'personal' ? 'Your configured model' : 'Standard model'} · ${preferences.billingSource === 'personal' ? 'Your AI key' : 'Platform allowance'}`
        : 'Loading AI preferences…'}
    </span>
  )
}
