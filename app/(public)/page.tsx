import type { Metadata } from 'next'
import { BrandMark } from '@/components/brand/brand-mark'
import { CourseRegister } from '@/components/site/course-register'
import { LandingFeatureExplorer } from '@/components/site/landing-feature-explorer'
import { LandingHeroSequence } from '@/components/site/landing-hero-sequence'
import { SiteIcon } from '@/components/site/icon'

const sampleActivity = [
  2, 1, 0, 3, 2, 4, 1,
  0, 2, 3, 1, 4, 2, 3,
  0, 1, 3, 4, 2, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0
] as const

export const metadata: Metadata = {
  title: 'A private study system for the exam ahead',
  description: 'Bring course sources, planning, practice, Canvas updates, and a source-grounded tutor into one private academic workspace.'
}

function ControlRoom() {
  return (
    <div className="control-room" aria-label="Wicker Study home screen">
      <div className="control-room-shell">
        <aside className="control-room-sidebar" aria-hidden="true">
          <div className="preview-wordmark"><BrandMark /><span>Wicker Study</span></div>
          <div className="preview-search"><span>Search material</span><kbd>⌘ K</kbd></div>
          <small>STUDY</small>
          <nav><span className="is-active">Home</span><span>Courses</span><span>Practice</span><span>Updates</span><span data-assembly-target="tutor">Tutor</span></nav>
          <small>PLAN</small>
          <nav><span>Planning</span><span>Calendar</span></nav>
          <div className="preview-account"><i>DW</i><span><b>David</b><small>BSc Computer Science</small></span></div>
        </aside>

        <div className="control-room-main">
          <header className="control-room-pagehead">
            <div><h2>Wednesday, 4 September 2024</h2><p>Period 1 · 2024/25 · week 3 of 7</p></div>
            <PeriodWidget target />
          </header>

          <div className="control-room-grid">
            <section className="control-room-route">
              <header><strong>Your study route</strong><span>Full calendar</span></header>
              <dl className="preview-metrics"><div><dt>Credits</dt><dd>78/180</dd></div><div><dt>Courses passed</dt><dd>8/15</dd></div><div><dt>Streak</dt><dd>6d</dd></div><div><dt>This week</dt><dd>7 sessions</dd></div></dl>
              <div className="preview-itinerary">
                <article className="control-room-now">
                  <i aria-hidden="true" />
                  <span>NOW</span>
                  <div><p>09:40 · BCS2420</p><h3>Continue malware and system security</h3><small>Your current chapter · 18 min remaining</small><span className="preview-action">Resume chapter <SiteIcon name="arrow" /></span></div>
                </article>
                <article className="preview-stop"><i aria-hidden="true" /><time>NEXT · 06 SEP</time><div><b>Statistics problem set</b><small>BCS1520 · Canvas assignment</small></div><span>2d</span></article>
                <article className="preview-stop"><i aria-hidden="true" /><time>LATER · 11 SEP</time><div><b>Numerical Methods quiz</b><small>BCS2540 · Academic plan</small></div><span>7d</span></article>
              </div>
            </section>

            <aside className="control-room-aside">
              <PriorityWidget target />
              <StudyQueueWidget target />
              <ActivityWidget target />
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}

function PeriodWidget({ target = false }: { target?: boolean }) {
  return <div className="period-widget" data-assembly-target={target ? 'exam' : undefined}><p><span>PERIOD 1 · 7 WEEKS</span><b>Next exam · BCS2420 · 16 Sep · 12d</b></p><ol aria-hidden="true"><li className="is-past">W1</li><li className="is-past">W2</li><li className="is-current">W3</li><li>W4</li><li>W5</li><li>W6</li><li>W7</li></ol></div>
}

function PriorityWidget({ target = false }: { target?: boolean }) {
  return <section className="control-room-priorities" data-assembly-target={target ? 'priority' : undefined}>
    <header><strong>Priorities</strong><span>3 active</span></header>
    <div><i className="priority-mark priority-mark-due" /><p><b>Statistics problem set</b><small>BCS1520 · Canvas · due 6 Sep</small><em>Submission open</em></p><span>2d</span></div>
    <div><i className="priority-mark" /><p><b>Numerical Methods quiz</b><small>BCS2540 · Course guide · 11 Sep</small><em>Assessment confirmed</em></p><span>7d</span></div>
    <div><i className="priority-mark" /><p><b>Computer Security exam</b><small>BCS2420 · Academic plan · 16 Sep</small><em>Exam date recorded</em></p><span>12d</span></div>
    <footer>Canvas · timetable · verified course rules</footer>
  </section>
}

function StudyQueueWidget({ target = false }: { target?: boolean }) {
  return <section className="control-room-queue" data-assembly-target={target ? 'queue' : undefined}>
    <header><strong>Study queue</strong><span>Open practice</span></header>
    <div><i className="queue-mark">Q</i><p><b>Questions</b><small>5 active courses</small></p><strong>Ready</strong></div>
    <div><i className="queue-mark">F</i><p><b>Flashcards</b><small>Due for review</small></p><strong>14</strong></div>
    <div><i className="queue-mark">M</i><p><b>Mistakes</b><small>Open to correct</small></p><strong>3</strong></div>
  </section>
}

function ActivityWidget({ target = false }: { target?: boolean }) {
  return <section className="control-room-activity" data-assembly-target={target ? 'activity' : undefined}>
    <header><strong>Period 1 activity</strong><span>16 active days</span></header>
    <div className="activity-week-labels" aria-hidden="true">{Array.from({ length: 7 }, (_, index) => <span key={index} className={index === 2 ? 'is-current' : undefined}>W{index + 1}</span>)}</div>
    <div className="activity-body" aria-hidden="true"><div className="activity-days"><span>M</span><span /><span>W</span><span /><span>F</span><span /><span /></div><div className="activity-bars">{sampleActivity.map((level, index) => <i key={index} data-level={level} />)}</div></div>
    <footer><span>Today is outlined</span><span>Less <i /><i data-level="1" /><i data-level="2" /><i data-level="3" /><i data-level="4" /> More</span></footer>
  </section>
}

const systemSteps = [
  ['Add your courses and dates', 'Bring in course notes, PDFs, Canvas updates, your timetable, and academic documents.'],
  ['See what comes next', 'Deadlines, exam dates, and progress shape a short list of what needs attention now and what can wait.'],
  ['Study and keep your progress', 'Reading, answers, reviews, mocks, mistakes, and tutor conversations stay ready for the next session.']
] as const

export default function HomePage() {
  return (
    <main id="main-content" className="landing-page">
      <LandingHeroSequence>
        <div className="landing-hero-top">
          <div className="hero-live-field" aria-hidden="true">
            <span className="field-line field-line-a" /><span className="field-line field-line-b" /><span className="field-line field-line-c" />
            <i className="field-signal field-signal-a" /><i className="field-signal field-signal-b" /><i className="field-signal field-signal-c" />
            <b className="field-data field-data-a">W3</b><b className="field-data field-data-b">14 due</b><b className="field-data field-data-c">12d</b>
          </div>
          <div className="hero-artifact hero-artifact-priority" data-assembly-source="priority" aria-hidden="true"><PriorityWidget /></div>
          <div className="hero-artifact hero-artifact-exam" data-assembly-source="exam" aria-hidden="true"><PeriodWidget /></div>
          <div className="landing-hero-message" data-assembly-copy>
            <h1>Your entire degree. <em>One clear next move.</em></h1>
            <div className="landing-hero-copy">
              <p className="landing-lede">Wicker Study turns course material, your academic plan, Canvas activity, and practice history into one calm route through the exam season.</p>
              <div className="site-actions"><a className="site-button site-button-primary" href="/app">Open your workspace <SiteIcon name="arrow" /></a><a className="site-text-link" href="#workspace">See the workspace <SiteIcon className="site-icon-down" name="arrow" /></a></div>
            </div>
          </div>
          <div className="hero-artifact hero-artifact-activity" data-assembly-source="activity" aria-hidden="true"><ActivityWidget /></div>
          <div className="hero-artifact hero-artifact-queue" data-assembly-source="queue" aria-hidden="true"><StudyQueueWidget /></div>
        </div>
        <div className="landing-product-stage" data-assembly-frame aria-hidden="true" inert>
          <span className="product-stage-label">Your home screen</span>
          <ol aria-label="Ways to use Wicker Study"><li>Plan</li><li>Follow</li><li>Study</li><li>Review</li></ol>
          <ControlRoom />
          <p><SiteIcon name="shield" /> Example account shown. Your home screen uses only the sources and activity connected to your account.</p>
        </div>
        <div className="assembly-scroll-cue" aria-hidden="true"><span>Scroll to assemble</span><i /></div>
      </LandingHeroSequence>

      <div className="landing-proof-strip" aria-label="Platform facts">
        <div><strong>5</strong><span>maintained courses</span></div>
        <div><strong>44</strong><span>maintained chapters</span></div>
        <div><strong>4</strong><span>practice modes</span></div>
        <div><strong>Page-level</strong><span>citations in tutor answers</span></div>
      </div>

      <section className="landing-system" id="how-it-works">
        <header className="landing-section-heading">
          <h2>Not another place to collect material. A way to move through it.</h2>
          <p>Your courses, deadlines, practice, and progress stay together, so the next useful thing is always close at hand.</p>
        </header>
        <div className="system-route">
          {systemSteps.map(([title, description], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <div id="workspace"><LandingFeatureExplorer /></div>

      <section className="landing-capabilities">
        <div className="capabilities-copy">
          <h2>Your study record, wherever you need it.</h2>
          <p>Keep course material current, bring in deadlines from Canvas and your calendar, connect your own tools, and decide exactly what stays.</p>
          <a className="site-text-link" href="/about">See how Wicker Study works <SiteIcon name="arrow" /></a>
        </div>
        <div className="capability-register">
          <article><span>COURSES</span><div><h3>Maintained course material</h3><p>Versioned notes, published sources, question banks, flashcards, tutorials, and mock papers.</p></div><b>Kept current</b></article>
          <article><span>UPDATES</span><div><h3>Canvas &amp; calendar</h3><p>Assignments, announcements, submissions, timetables, institution dates, and personal events.</p></div><b>In sync</b></article>
          <article><span>CONNECT</span><div><h3>API &amp; agent access</h3><p>Scoped personal keys, MCP setup, and a local companion for workflows that need your approval.</p></div><b>On your terms</b></article>
          <article><span>ACCOUNT</span><div><h3>Data &amp; AI controls</h3><p>Usage meters, export, study reset, source permissions, key revocation, and account deletion.</p></div><b>Under your control</b></article>
        </div>
      </section>

      <section className="landing-courses">
        <header className="landing-section-heading">
          <h2>Maintained course material, ready to work from.</h2>
          <p>The current catalogue covers five Maastricht University BCS courses, each organised into a navigable body of notes, sources, and practice.</p>
        </header>
        <CourseRegister compact />
        <a className="site-text-link course-register-link" href="/courses">Explore the course catalogue <SiteIcon name="arrow" /></a>
      </section>

      <section className="landing-boundary">
        <div className="boundary-statement">
          <SiteIcon name="shield" />
          <h2>Course material is shared. Your learning stays yours.</h2>
        </div>
        <div className="boundary-columns">
          <article><h3>Maintained for the course</h3><p>Notes, published sources, question banks, flashcards, tutorials, and mock papers are kept up to date centrally.</p><span>Available to the course</span></article>
          <article><h3>Owned by you</h3><p>Your plan, progress, answers, annotations, mistakes, reviews, chats, and activity remain attached to your account.</p><span>Visible only to you</span></article>
        </div>
      </section>

      <section className="landing-close">
        <div><h2>Open the workspace. See the route ahead.</h2><p>Start with your course plan or enter an honestly empty workspace and add sources when you are ready.</p></div>
        <div className="site-actions"><a className="site-button site-button-primary" href="/app">Open Wicker Study <SiteIcon name="arrow" /></a><a className="site-text-link" href="/privacy">Read the privacy notice</a></div>
      </section>
    </main>
  )
}
