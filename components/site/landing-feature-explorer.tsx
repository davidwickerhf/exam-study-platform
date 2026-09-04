'use client'

import { useState } from 'react'
import { SiteIcon } from './icon'

const features = [
  {
    id: 'courses',
    label: 'Course material',
    title: 'Read the complete course in one place.',
    copy: 'Chapters, source PDFs, search, annotations, and progress stay connected instead of becoming separate piles.'
  },
  {
    id: 'practice',
    label: 'Practice',
    title: 'Practise what needs another pass.',
    copy: 'Questions, due flashcards, open mistakes, and timed mocks share the same record of what needs another pass.'
  },
  {
    id: 'planning',
    label: 'Planning',
    title: 'Keep the degree plan beside the daily work.',
    copy: 'Programme requirements, attempts, credits, electives, exam dates, and scenarios live in one academic ledger.'
  },
  {
    id: 'calendar',
    label: 'Calendar & Canvas',
    title: 'See every deadline on one timeline.',
    copy: 'Exams, timetable feeds, personal events, assignments, announcements, and submission state remain distinguishable by source.'
  },
  {
    id: 'tutor',
    label: 'Tutor',
    title: 'Ask the course. Check the source.',
    copy: 'The tutor searches the selected course before answering and keeps source and page citations beside the response.'
  },
  {
    id: 'continuity',
    label: 'Study record',
    title: 'Pick up where you stopped.',
    copy: 'Reading, answers, reviews, mocks, corrections, and tutor conversations create one private history across devices.'
  }
] as const

function CourseVisual() {
  return <div className="feature-ui feature-ui-course"><div className="feature-app-head"><div><span>BCS2420</span><strong>Computer Security</strong></div><b>4 ECTS · exam in 12d</b></div><nav className="feature-app-tabs"><b>Overview</b><span>Chapters</span><span>Practice</span><span>Materials</span></nav><div className="feature-course-body"><aside><span>7 chapters</span><b>Course contents</b><ol><li>Security principles</li><li>Cryptography</li><li>Authentication</li><li className="is-active">Malware &amp; system security</li><li>Web &amp; network defence</li></ol></aside><article><header><span>Chapter 04</span><b>64% read</b></header><h4>Malware and system security</h4><p>This chapter covers how malicious code enters, persists, hides, spreads, and gets removed.</p><blockquote><b>How to study this chapter</b><span>Define the concept, state the mechanism, name the attack or failure mode, and give the defence or trade-off.</span></blockquote><footer><span>Lecture 05 · Tutorial 5 · Lab 3</span><b>Sources</b></footer></article></div></div>
}

function PracticeVisual() {
  return <div className="feature-ui feature-ui-practice"><div className="feature-app-head"><div><span>Practice</span><strong>Choose what to work on</strong></div><b>17 waiting</b></div><nav className="feature-app-tabs"><b>Questions</b><span>Flashcards <i>14</i></span><span>Mistakes <i>3</i></span><span>Mocks</span></nav><div className="practice-filters"><span>BCS2420</span><span>Chapter 04</span><span>Multiple choice</span></div><div className="practice-columns"><section><span>BCS2420 · CHAPTER 04 · QUESTION 06 / 20</span><h4>Which security property detects that a message was modified?</h4><div><b>A</b><p>Confidentiality</p></div><div className="is-correct"><b>B</b><p>Integrity</p><em>Correct</em></div></section><aside><div><b>14</b><span>flashcards due</span></div><div><b>3</b><span>open mistakes</span></div><div><b>2</b><span>mock attempts</span></div></aside></div></div>
}

function PlanningVisual() {
  return <div className="feature-ui feature-ui-planning"><div className="feature-app-head"><div><span>Private to your account · Maastricht University</span><strong>BSc Computer Science</strong></div><b>78 / 180 ECTS</b></div><nav className="feature-app-tabs"><b>Overview</b><span>Courses</span><span>Progress</span><span>Documents</span><span>Planner</span></nav><div className="planning-progress"><i><b /></i><span>43% complete</span></div><div className="planning-register"><p><span>Core programme</span><b>60 / 120 ECTS</b><em>8 passed</em></p><p><span>Electives</span><b>18 / 30 ECTS</b><em>3 planned</em></p><p><span>Academic work</span><b>0 / 30 ECTS</b><em>Not started</em></p></div><footer><span>Scenario</span><b>Graduate by July 2027</b><SiteIcon name="arrow" /></footer></div>
}

function CalendarVisual() {
  return <div className="feature-ui feature-ui-calendar"><div className="feature-app-head"><div><span>Calendar</span><strong>September 2024</strong></div><b>+ Add event</b></div><div className="calendar-toolbar"><span className="is-active">Month</span><span>Week</span><span>Day</span><span>Agenda</span><b>All courses</b></div><div className="calendar-week"><span>MON 02</span><span>TUE 03</span><span className="is-today">WED 04</span><span>THU 05</span><span>FRI 06</span></div><div className="calendar-grid"><i /><i /><i><b>09:00</b><span>Numerical Methods</span></i><i /><i><b>16:00</b><span>Statistics problem set due</span></i><i><b>10:00</b><span>Security lecture</span></i><i /><i /><i><b>13:30</b><span>Canvas tutorial</span></i></div><footer><span><i className="source-mark-canvas" /> Canvas</span><span><i className="source-mark-timetable" /> Timetable</span><span><i className="source-mark-personal" /> Personal</span></footer></div>
}

function TutorVisual() {
  return <div className="feature-ui feature-ui-tutor"><div className="feature-app-head"><div><span>Tutor</span><strong>Trojan vs worm</strong></div><b>New · History</b></div><div className="feature-tutor-body"><aside><span>Course</span><b>BCS2420</b><p>Computer Security</p><small>Answers cite this course</small></aside><article><div className="tutor-question">What is the defining difference between a Trojan and a worm?</div><div className="tutor-answer"><span>Answer</span><p>A Trojan relies on deception and the user running it. A worm propagates on its own by exploiting network-reachable vulnerabilities.</p><div><b>Lecture 05 · p. 32</b><b>Sample paper · Part C, Q1</b></div></div><footer><span>Ask a follow-up…</span><i><SiteIcon name="arrow" /></i></footer></article></div></div>
}

function ContinuityVisual() {
  return <div className="feature-ui feature-ui-continuity"><div className="feature-app-head"><div><span>Account</span><strong>Your study record</strong></div><b>6 day streak</b></div><nav className="feature-app-tabs"><b>Profile</b><span>AI usage</span><span>API access</span><span>Data &amp; privacy</span></nav><div className="continuity-grid">{Array.from({ length: 35 }, (_, index) => <i key={index} data-level={index < 23 ? (index * 7) % 5 : 0} />)}</div><div className="continuity-feed"><p><time>Today · 09:58</time><b>Chapter resumed</b><span>Malware and system security · 18 min</span></p><p><time>Yesterday · 18:42</time><b>Mistake corrected</b><span>Numerical integration · attempt 2</span></p><p><time>02 Sep · 14:10</time><b>Mock completed</b><span>Statistics · 72%</span></p></div></div>
}

function FeatureVisual({ id }: { id: (typeof features)[number]['id'] }) {
  if (id === 'courses') return <CourseVisual />
  if (id === 'practice') return <PracticeVisual />
  if (id === 'planning') return <PlanningVisual />
  if (id === 'calendar') return <CalendarVisual />
  if (id === 'tutor') return <TutorVisual />
  return <ContinuityVisual />
}

export function LandingFeatureExplorer() {
  const [active, setActive] = useState<(typeof features)[number]['id']>('courses')
  const selected = features.find((feature) => feature.id === active) ?? features[0]

  const moveTab = (currentIndex: number, direction: -1 | 1) => {
    const nextIndex = (currentIndex + direction + features.length) % features.length
    const next = features[nextIndex]
    setActive(next.id)
    document.getElementById(`feature-tab-${next.id}`)?.focus()
  }

  return (
    <section className="landing-feature-explorer" aria-labelledby="feature-explorer-title">
      <header>
        <div><h2 id="feature-explorer-title">From first read<br />to final review.</h2></div>
        <p>Read a chapter, practise it, plan the exam, check deadlines, ask for help, and pick up exactly where you left off.</p>
      </header>
      <div className="feature-tabs" role="tablist" aria-label="Workspace features">
        {features.map((feature, index) => <button key={feature.id} type="button" role="tab" tabIndex={active === feature.id ? 0 : -1} aria-selected={active === feature.id} aria-controls={`feature-${feature.id}`} id={`feature-tab-${feature.id}`} onClick={() => setActive(feature.id)} onKeyDown={(event) => { if (event.key === 'ArrowLeft') { event.preventDefault(); moveTab(index, -1) } if (event.key === 'ArrowRight') { event.preventDefault(); moveTab(index, 1) } }}>{feature.label}</button>)}
      </div>
      <p className="feature-sample-note"><SiteIcon name="shield" /> Example account shown. Your dates, sources, and activity appear after you connect them.</p>
      <div className="feature-stage">
        <div className="feature-stage-copy"><h3>{selected.title}</h3><p>{selected.copy}</p></div>
        <div className="feature-stage-visuals">
          {features.map((feature) => <div key={feature.id} id={`feature-${feature.id}`} role="tabpanel" aria-labelledby={`feature-tab-${feature.id}`} aria-hidden={active !== feature.id} className={active === feature.id ? 'is-active' : undefined}><FeatureVisual id={feature.id} /></div>)}
        </div>
      </div>
    </section>
  )
}
