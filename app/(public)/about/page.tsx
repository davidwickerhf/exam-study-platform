import type { Metadata } from 'next'
import { ContactLink } from '@/components/site/contact-link'
import { SiteIcon } from '@/components/site/icon'
import { operatorName } from '@/lib/site-content'

export const metadata: Metadata = {
  title: 'Approach',
  description: 'How Wicker Study separates maintained academic sources from each student’s private learning record.'
}

const layers = [
  ['Course material', 'Kept up to date', 'Notes, source PDFs, question banks, flashcards, tutorials, and mock papers are maintained and versioned centrally. Everyone studies from the same current course.'],
  ['Your activity', 'Private to your account', 'Your programme, attempts, exam dates, mastery, answers, annotations, review history, mistakes, activity, and chats travel with you between devices.'],
  ['Tutor', 'Answers with sources', 'The tutor searches the selected course before answering and keeps its source and page citations beside the response. New exercises are created only when you ask for them.']
] as const

export default function AboutPage() {
  return (
    <main id="main-content" className="site-reading-page about-public-page">
      <header className="reading-hero">
        <h1>Your course material and your activity belong in different places.</h1>
        <p>Wicker Study keeps course content current while the record of how you plan, practise, and progress remains yours.</p>
      </header>

      <section className="about-layer-register" aria-label="What Wicker Study maintains and what belongs to you">
        {layers.map(([label, title, description]) => (
          <article key={label}><span>{label}</span><h2>{title}</h2><p>{description}</p></article>
        ))}
      </section>

      <section className="about-operating-model">
        <div><h2>Designed around studying, not around AI.</h2><p>Your courses, planning, and practice come first. AI is used only to answer from course sources, create extra exercises when asked, and turn academic documents into changes you can review.</p></div>
        <dl>
          <div><dt>Source first</dt><dd>Every course begins with maintained material and attached citations.</dd></div>
          <div><dt>Human review</dt><dd>Uploaded documents propose changes; nothing silently rewrites your plan.</dd></div>
          <div><dt>Reversible control</dt><dd>Export, reset, revoke connections, or erase personal data from your account.</dd></div>
        </dl>
      </section>

      <section className="reading-section about-contexts">
        <h2>One record, two study contexts.</h2>
        <div className="comparison-table"><div><strong>At a desk</strong><p>Orient the course, compare sources, read chapters, work through structured practice, inspect the plan, and rehearse under exam conditions.</p></div><div><strong>On a phone</strong><p>Resume the exact chapter, clear a short flashcard queue, correct open mistakes, check deadlines, or start a focused timed session.</p></div></div>
      </section>

      <section className="about-not-section">
        <h2>Clear limits matter.</h2>
        <ul><li>Wicker Study does not replace lectures, official module guidance, or professional academic advice.</li><li>It does not ask a model to recreate maintained shared course material on demand.</li><li>It does not use AI to make legal or similarly significant decisions.</li><li>It does not sell personal study data or use advertising trackers.</li></ul>
      </section>

      <section className="about-contact">
        <div><h2>Built and operated independently.</h2><p>Wicker Study is operated by {operatorName}. Send your request to the queue that matches it best.</p></div>
        <div className="contact-register"><p><span>General</span><ContactLink kind="info" /></p><p><span>Product support</span><ContactLink kind="support" /></p><p><span>Privacy</span><ContactLink kind="privacy" /></p><p><span>Security</span><ContactLink kind="security" /></p><p><span>Legal</span><ContactLink kind="legal" /></p></div>
      </section>

      <section className="reading-cta"><h2>See the maintained curriculum.</h2><a className="site-button site-button-primary" href="/courses">View courses <SiteIcon name="arrow" /></a></section>
    </main>
  )
}
