import type { Metadata } from 'next'
import { ContactLink } from '@/components/site/contact-link'
import { SiteIcon } from '@/components/site/icon'
import { operatorName } from '@/lib/site-content'

export const metadata: Metadata = { title: 'About' }

export default function AboutPage() {
  return (
    <main id="main-content" className="site-reading-page">
      <header className="reading-hero"><h1>A study workspace built around course truth.</h1><p>Wicker Study separates maintained academic material from the personal record created while studying it.</p></header>
      <section className="about-principles">
        <article><h2>The course layer</h2><p>Notes, source PDFs, question banks, flashcards, tutorials, and mock papers are maintained centrally. Students use prepared material instead of repeatedly asking a model to recreate it.</p></article>
        <article><h2>The personal layer</h2><p>Mastery, attempts, annotations, spaced-repetition history, mistake reviews, chat history, and AI allowances belong to the signed-in student and are stored separately.</p></article>
        <article><h2>The assistance layer</h2><p>The tutor retrieves relevant passages from the selected course and keeps answers tied to that corpus. Additional exercises are generated only when the student explicitly asks for them.</p></article>
      </section>
      <section className="reading-section"><h2>Designed for two different study contexts</h2><div className="comparison-table"><div><strong>Desktop</strong><p>Long reading, source comparison, structured practice, mock exams, and side-by-side study tools.</p></div><div><strong>Mobile</strong><p>Resume, short reviews, mistake correction, timed practice, and focused single-task flows.</p></div></div></section>
      <section className="reading-section"><h2>What the product does not do</h2><ul><li>It does not replace lectures, official module guidance, or professional academic advice.</li><li>It does not let students regenerate shared course material from the app.</li><li>It does not use AI to make decisions with legal or similarly significant effects.</li><li>It does not sell personal study data or use advertising trackers.</li></ul></section>
      <section className="reading-section"><h2>Contact Wicker Study</h2><p>Wicker Study is independently operated by {operatorName}. Use the address that best matches your request so it reaches the right queue.</p><div className="legal-table"><div><strong>General enquiries</strong><span><ContactLink kind="info" /></span></div><div><strong>Account and product support</strong><span><ContactLink kind="support" /></span></div><div><strong>Privacy and data rights</strong><span><ContactLink kind="privacy" /></span></div><div><strong>Security reports</strong><span><ContactLink kind="security" /></span></div><div><strong>Legal notices</strong><span><ContactLink kind="legal" /></span></div></div></section>
      <section className="reading-cta"><h2>See the maintained curriculum.</h2><a className="site-button site-button-primary" href="/courses">View courses <SiteIcon name="arrow" /></a></section>
    </main>
  )
}
