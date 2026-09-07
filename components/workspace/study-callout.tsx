import { StudyProse } from './study-prose'
import { StudyEvidence } from './study-evidence'
import type { StudyRevision } from '@/lib/workspace/study-versions'

export function StudyCallout({ callout, revision }: {
  callout: { kind: 'definition' | 'rule' | 'formula' | 'pitfall' | 'takeaway'; title: string; text: string; sourceIds: string[] }
  revision: StudyRevision
}) {
  // Markdown math blocks require delimiters on separate lines. Models may
  // produce $$equation$$ on one line; keep explicit display math prominent.
  const symbols: Record<string, string> = { cap:'∩', cup:'∪', Omega:'Ω', subseteq:'⊆', emptyset:'∅', times:'×', cdot:'·', neq:'≠', leq:'≤', geq:'≥' }
  const content = callout.text.replace(/\\(cap|cup|Omega|subseteq|emptyset|times|cdot|neq|leq|geq)(?![A-Za-z])/g, (_, command: string) => symbols[command]).replace(/\$\$([\s\S]+?)\$\$/g, (_, math: string) => `\n\n$$\n${math.trim()}\n$$\n\n`)
  const caution = callout.kind === 'pitfall'
  const label = {definition:'Definition',rule:'Core rule',formula:'Formula',pitfall:'Common mistake',takeaway:'Remember'}[callout.kind]
  return <aside aria-label={`${label}: ${callout.title}`} data-study-callout={callout.kind}
    className={`min-w-0 rounded-lg border border-l-[3px] p-5 sm:p-6 ${caution ? 'border-amber-600/25 border-l-amber-600 bg-amber-500/5' : 'border-primary/15 border-l-primary bg-primary/[0.035]'}`}>
    <p className={`mb-2 text-xs font-semibold ${caution ? 'text-amber-700 dark:text-amber-400' : 'text-primary'}`}>{label}</p>
    <h4 className="mb-3 text-base font-semibold leading-snug">{callout.title}</h4>
    <StudyProse>{content}</StudyProse>
    {!!callout.sourceIds.length && <StudyEvidence ids={callout.sourceIds} revision={revision} />}
  </aside>
}
