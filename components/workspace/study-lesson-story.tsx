'use client'
import { useEffect, useRef, useState } from 'react'
import { StudyProse } from './study-prose'
import { StudyEvidence } from './study-evidence'
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
    const visible = new Map<number, number>()
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const index = Number((entry.target as HTMLElement).dataset.storySection)
        if (entry.isIntersecting) visible.set(index, entry.boundingClientRect.top)
        else visible.delete(index)
      }
      const candidate = [...visible].sort((a, b) => a[1] - b[1])[0]
      if (candidate) setActive(candidate[0])
    }, { rootMargin: '-10% 0px -50% 0px', threshold: 0 })
    elements.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [chapter.id])
  const priorVisual = chapter.sections.reduce((last, section, i) => i <= active && section.visual ? i : last, -1)
  const visualIndex = priorVisual >= 0 ? priorVisual : chapter.sections.findIndex(s => s.visual)
  const visualSection = chapter.sections[visualIndex]
  return <div ref={root} className={hasVisual ? 'grid min-w-0 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:gap-10' : ''}>
    <div className="min-w-0">
      {chapter.sections.map((section, index) => <section key={`${chapter.id}-${index}`} data-story-section={index} className="mb-12 scroll-mt-8 last:mb-0">
        <p className="mb-3 text-xs font-medium tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')} / {String(chapter.sections.length).padStart(2, '0')}</p>
        <h3 className="mb-4 text-xl font-semibold leading-snug tracking-tight">{section.title}</h3>
        <div className="max-w-prose text-pretty"><StudyProse>{section.text}</StudyProse></div>
        {section.takeaway && <p className="mt-5 border-l-2 border-primary pl-4 text-sm font-medium leading-relaxed">{section.takeaway}</p>}
        {section.detail && <details className="mt-5 border-y py-3"><summary className="cursor-pointer text-sm font-medium">Go deeper: {section.title}</summary><div className="mt-4 max-w-prose"><StudyProse>{section.detail}</StudyProse></div></details>}
        <StudyEvidence ids={section.sourceIds} revision={revision} />
        {section.visual && <div className="mt-6 xl:hidden"><StudyVisual visual={section.visual} /><StudyEvidence ids={section.visual.sourceIds} revision={revision} /></div>}
      </section>)}
    </div>
    {visualSection?.visual && <aside aria-label="Visual explanation" className="sticky top-6 hidden min-w-0 xl:block" data-active-story-section={visualIndex}>
      <p className="mb-3 text-xs text-muted-foreground">{visualSection.title}</p>
      <StudyVisual key={`${chapter.id}-${visualIndex}`} visual={visualSection.visual} />
      <StudyEvidence ids={visualSection.visual.sourceIds} revision={revision} />
    </aside>}
  </div>
}
