"use client"
import { ReviewPanel } from './review-panel'

export type DocumentCheckResult = {
  status: 'confirmed' | 'attention' | 'awaiting-document'
  message: string
  recordCredits: number | null
  transcriptCredits: number | null
  recordLabel?: string | null
  transcriptLabel?: string | null
  counts: Record<string, number>
  issues: string[]
  checks: { status: string; course: string; name: string; academicYear: string; transcript: ResultRow | null; record: ResultRow[] }[]
}
type ResultRow = { grade: number | null; status: string; creditsEarned: number; creditsTotal: number; examDate?: string | null }
const labels: Record<string, string> = { confirmed: 'Agrees', conflict: 'Disagrees', ambiguous: 'Sitting unclear', 'record-only': 'Academic Work only', 'transcript-only': 'Transcript only' }
function result(row: ResultRow) {
  return `${row.grade == null ? row.status === 'no-show' ? 'No grade' : row.status : `Grade ${row.grade}`} · ${row.creditsEarned}/${row.creditsTotal} ECTS${row.examDate ? ` · ${row.examDate}` : ''}`
}

export function DocumentCheck({ value, compact = false }: { value: DocumentCheckResult; compact?: boolean }) {
  return <section aria-label="Document comparison" className={compact ? "border-t pt-4" : "mt-6 border-t pt-5"}>
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-sm font-semibold">Transcript × Academic Work</h3>
      <span className="text-muted-foreground text-xs">{value.status === 'confirmed' ? 'Results corroborated' : value.status === 'awaiting-document' ? 'Waiting for both readings' : 'Review needed'}</span>
    </div>
    <p className="text-muted-foreground mt-2 max-w-[72ch] text-sm leading-relaxed">{value.message}</p>
    <dl className="my-4 grid grid-cols-2 gap-6">
      {[["Transcript", value.transcriptCredits, value.transcriptLabel], ["Academic Work", value.recordCredits, value.recordLabel]].map(([label, credits, file]) => <div key={String(label)}>
        <dt className="text-muted-foreground text-xs">{label}</dt>
        <dd className="font-data mt-1 text-2xl tabular-nums">{credits == null ? 'Not read' : `${credits} ECTS`}</dd>
        {file && <dd className="text-muted-foreground mt-1 break-words text-xs">{file}</dd>}
      </div>)}
    </dl>
    {value.issues.length > 0 && <ul className="text-muted-foreground mb-4 list-disc space-y-1 pl-4 text-sm">{value.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
    {value.checks.length > 0 && <ReviewPanel trigger={`Compare ${value.checks.length} results`} title="Compare document results" description={`${value.counts.confirmed || 0} of ${value.checks.length} results agree. Differences appear first.`}>
      <ul aria-label="Compared results" className="mt-3 border-t">
        {[...value.checks].sort((a, b) => Number(a.status === 'confirmed') - Number(b.status === 'confirmed')).map((check, index) => <li key={`${check.course}-${check.academicYear}-${index}`} className="border-b py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><strong className="text-sm font-medium">{check.name || check.course}</strong><span className="text-muted-foreground text-xs">{labels[check.status] || check.status}</span></div>
          <p className="text-muted-foreground mt-0.5 text-xs">{check.course !== check.name ? `${check.course} · ` : ''}{check.academicYear}</p>
          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2"><p><span className="text-muted-foreground block">Transcript</span>{check.transcript ? result(check.transcript) : 'No matching result'}</p><p><span className="text-muted-foreground block">Academic Work</span>{check.record.length ? check.record.map(result).join('; ') : 'No matching result'}</p></div>
        </li>)}
      </ul>
    </ReviewPanel>}
  </section>
}
