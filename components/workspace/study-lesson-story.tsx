'use client'
import './study-lesson-story.css'
import { useEffect, useRef, useState } from 'react'
import { StudyProse, StudyInline } from './study-prose'
import { StudyEvidence } from './study-evidence'
import { StudyCallout } from './study-callout'
import { StudyGuidedAttempt } from './study-learning-support'
import { StudyVisual } from './study-visual'
import type { StudyChapter, StudyRevision } from '@/lib/workspace/study-versions'

export function StudyLessonStory({ chapter, revision }: { chapter: StudyChapter; revision: StudyRevision }) {
  const root = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const hasVisual = chapter.sections.some(s => s.visual)
  useEffect(() => {
    setActive(0)
    const elements = root.current?.querySelectorAll<HTMLElement>('[data-story-section]')
    if (!elements || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(() => {
      const bandTop = window.innerHeight * .15, bandBottom = window.innerHeight * .65
      let best = 0, candidate = 0
      elements.forEach(element => {
        const rect = element.getBoundingClientRect()
        const overlap = Math.max(0, Math.min(rect.bottom, bandBottom) - Math.max(rect.top, bandTop))
        if (overlap > best) { best = overlap; candidate = Number(element.dataset.storySection) }
      })
      if (best > 0) setActive(candidate)
    }, { rootMargin: '-15% 0px -35% 0px', threshold: [0, .1, .25, .5, .75, 1] })
    elements.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [chapter.id])
  const priorVisual = chapter.sections.reduce((last, section, i) => i <= active && section.visual ? i : last, -1)
  const visualIndex = priorVisual >= 0 ? priorVisual : chapter.sections.findIndex(s => s.visual)
  const visualSection = chapter.sections[visualIndex]
  return <div className="study-story"><div ref={root} className={hasVisual ? 'study-story-layout' : ''}>
    <div className="min-w-0">
      {chapter.sections.map((section, index) => <section key={`${chapter.id}-${index}`} id={section.id ? `lesson-${chapter.id}-${section.id}` : undefined} data-story-section={index} className="mb-12 scroll-mt-8 last:mb-0">
        <p className="mb-3 text-xs font-medium tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')} / {String(chapter.sections.length).padStart(2, '0')}</p>
        <h3 className="mb-4 text-xl font-semibold leading-snug tracking-tight">{section.title}</h3>
        {!!section.callouts?.length && <div className="mb-5 space-y-4">{section.callouts.map((callout,i) => <StudyCallout key={i} callout={callout} revision={revision} />)}</div>}
        <div className="max-w-prose text-pretty"><StudyProse>{section.text}</StudyProse></div>
        {section.takeaway && (!section.callouts?.length ? <div className="mt-5"><StudyCallout callout={{kind:'takeaway',title:'Key idea',text:section.takeaway,sourceIds:[]}} revision={revision} /></div> : <p className="mt-5 text-sm font-medium leading-relaxed"><StudyInline>{section.takeaway}</StudyInline></p>)}
        {section.detail && <details className="mt-5 border-y py-3"><summary className="cursor-pointer text-sm font-medium">Go deeper: {section.title}</summary><div className="mt-4 max-w-prose"><StudyProse>{section.detail}</StudyProse></div></details>}
        {chapter.formatVersion === 3 && chapter.questions.filter(q => q.practiceStage === 'guided' && chapter.objectiveCoverage?.some(path => path.workedExampleSectionIds.at(-1) === section.id && path.guidedQuestionKeys.includes(q.key || ''))).map(q => <StudyGuidedAttempt key={q.id} question={q} />)}
        <StudyEvidence ids={section.sourceIds} revision={revision} />
        {section.visual && <div className="study-story-inline-visual mt-6"><StudyVisual visual={section.visual} /><StudyEvidence ids={section.visual.sourceIds} revision={revision} /></div>}
      </section>)}
    </div>
    {visualSection?.visual && <aside aria-label="Visual explanation" className="study-story-side-visual sticky top-6 min-w-0" data-active-story-section={visualIndex}>
      <p className="mb-3 text-xs text-muted-foreground">{visualSection.title}</p>
      <StudyVisual key={`${chapter.id}-${visualIndex}`} visual={visualSection.visual} />
      <StudyEvidence ids={visualSection.visual.sourceIds} revision={revision} />
    </aside>}
  </div></div>
}
