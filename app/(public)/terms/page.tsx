import type { Metadata } from 'next'
import { ContactLink } from '@/components/site/contact-link'
import { operatorName } from '@/lib/site-content'

export const metadata: Metadata = { title: 'Terms of service' }

export default function TermsPage() {
  return (
    <main id="main-content" className="legal-page">
      <header className="legal-hero"><div><h1>Terms of service</h1><p>The rules for accessing and using Wicker Study.</p></div><dl><div><dt>Effective</dt><dd>30 August 2026</dd></div><div><dt>Operator</dt><dd>{operatorName}</dd></div><div><dt>Contact</dt><dd><ContactLink kind="legal" /></dd></div></dl></header>
      <div className="legal-layout">
        <nav aria-label="Terms sections"><a href="#service">Service</a><a href="#accounts">Accounts</a><a href="#academic">Academic use</a><a href="#content">Content</a><a href="#ai">AI features</a><a href="#acceptable">Acceptable use</a><a href="#availability">Availability</a><a href="#ending">Ending use</a><a href="#contact">Contact</a></nav>
        <article>
          <section id="service"><h2>1. The service and operator</h2><p>These terms are between you and {operatorName}, an individual operating the service under the name Wicker Study. Wicker Study provides a private workspace for accessing maintained course material, recording study progress, practising questions, reviewing flashcards and mistakes, running mock sessions, and using limited source-grounded AI assistance.</p></section>
          <section id="accounts"><h2>2. Accounts and access</h2><p>You are responsible for the security of your sign-in method and for activity under your account. Provide accurate account information and notify us promptly if you believe access has been compromised. The service is intended for university-level learners able to enter into these terms.</p></section>
          <section id="academic"><h2>3. Academic use</h2><p>The service supports study but does not replace lectures, official module documents, instructors, or examination rules. You remain responsible for checking material and complying with your institution’s academic-integrity requirements. No grade or examination outcome is guaranteed.</p></section>
          <section id="content"><h2>4. Course and personal content</h2><p>Course materials and the platform interface remain protected by their applicable intellectual-property rights. You may use them for personal study within the service and may not redistribute, scrape, resell, or republish them without permission. You retain rights in personal notes and answers you create.</p></section>
          <section id="ai"><h2>5. AI-assisted features</h2><p>AI is limited to retrieval-grounded tutor chat and further exercises requested by the user. Responses can be incomplete or incorrect and should be verified against cited course material. Usage limits protect service capacity and may be adjusted. Attempts to bypass limits or use AI endpoints outside their intended study purpose are prohibited.</p></section>
          <section id="acceptable"><h2>6. Acceptable use</h2><p>Do not interfere with the service, attempt unauthorised access, upload malicious material, abuse other users, automate excessive requests, circumvent security or usage controls, or use the service in a way that violates law or third-party rights.</p></section>
          <section id="availability"><h2>7. Availability and changes</h2><p>We aim to keep the service dependable, but access may be interrupted for maintenance, security, provider outages, or changes to course availability. Features and course content may change as the maintained curriculum evolves.</p></section>
          <section id="warranty"><h2>8. Responsibility</h2><p>The service is provided on an as-available basis. To the maximum extent permitted by applicable law, Wicker Study is not responsible for indirect loss, lost academic opportunity, or decisions made solely from generated output. Nothing in these terms excludes rights or liability that cannot legally be excluded.</p></section>
          <section id="ending"><h2>9. Ending use</h2><p>You may stop using the service at any time and can export your personal data or permanently delete your account from Settings. Access may be suspended where reasonably necessary to protect the service, other users, or legal compliance.</p></section>
          <section id="contact"><h2>10. Contact and changes</h2><p>Questions about these terms and formal notices can be sent to <ContactLink kind="legal" />. Account and product help can be sent to <ContactLink kind="support" />. Material revisions will be dated on this page. Continued use after revised terms take effect indicates acceptance where permitted by law.</p></section>
        </article>
      </div>
    </main>
  )
}
