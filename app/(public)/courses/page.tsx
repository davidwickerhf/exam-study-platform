import type { Metadata } from 'next'
import { CourseRegister } from '@/components/site/course-register'
import { SiteIcon } from '@/components/site/icon'

export const metadata: Metadata = { title: 'Courses' }

const capabilities = [
  ['Maintained chapter notes', 'Included'],
  ['Source PDF access and search', 'Included'],
  ['Self-tests and exam-style practice', 'Included'],
  ['Flashcards and mistake review', 'Included'],
  ['Timed mock sessions', 'Included'],
  ['Retrieval-grounded tutor chat', 'Usage limited'],
  ['Further exercise requests', 'Usage limited']
] as const

export default function CoursesPage() {
  return (
    <main id="main-content" className="site-reading-page courses-public-page">
      <header className="reading-hero"><h1>The current course catalogue.</h1><p>Every listed course includes maintained chapter material and a structured path into reading, practice, review, and exam preparation.</p></header>
      <CourseRegister />
      <section className="course-capability-table"><h2>Available in every course</h2>{capabilities.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</section>
      <section className="reading-cta"><h2>Open the full workspace.</h2><a className="site-button site-button-primary" href="/v2">Continue to sign in <SiteIcon name="arrow" /></a></section>
    </main>
  )
}
