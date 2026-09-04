import type { Metadata } from 'next'
import { CourseRegister } from '@/components/site/course-register'
import { SiteIcon } from '@/components/site/icon'

export const metadata: Metadata = {
  title: 'Courses',
  description: 'Explore the maintained Wicker Study course catalogue and the study tools available inside every course.'
}

const capabilities = [
  ['Chapter workspace', 'Maintained notes, topic outlines, and reading progress'],
  ['Source library', 'PDF access, extracted text, page search, and citations'],
  ['Practice', 'Self-tests, exam-style questions, grading, and mastery'],
  ['Review queues', 'Spaced-repetition flashcards and a personal mistake bank'],
  ['Exam rehearsal', 'Prepared papers and timed mock sessions'],
  ['Grounded tutor', 'Course-scoped retrieval with source and page citations']
] as const

export default function CoursesPage() {
  return (
    <main id="main-content" className="site-reading-page courses-public-page">
      <header className="reading-hero">
        <h1>A maintained course is more than a folder of files.</h1>
        <p>Each Wicker Study course connects its source material to chapter reading, practice, review, mock exams, and your own progress.</p>
      </header>

      <section className="course-catalogue-intro"><h2>Current catalogue</h2><p>Five Maastricht University BCS courses are available now. Course material is maintained centrally; progress and history remain private to each account.</p></section>
      <CourseRegister />

      <section className="course-capability-table">
        <header><h2>Inside every maintained course</h2><p>Reading, practice, review, and exams all stay attached to the same course.</p></header>
        {capabilities.map(([label, value]) => <div key={label}><strong>{label}</strong><span>{value}</span><b>Included</b></div>)}
      </section>

      <section className="course-request-proof">
        <div><h2>Missing a course?</h2><p>Request it and attach relevant material privately. Nothing is shared until the team has checked the sources and the finished course.</p></div>
        <ol><li><span>01</span><p><strong>Collect and verify</strong><small>Sources stay private by default.</small></p></li><li><span>02</span><p><strong>Organise the course</strong><small>Chapters and sources stay linked.</small></p></li><li><span>03</span><p><strong>Review and publish</strong><small>Nothing becomes shared material automatically.</small></p></li></ol>
      </section>

      <section className="reading-cta"><div><h2>Study from the course, not around it.</h2><p>Open your workspace to start with a maintained course or add your academic plan.</p></div><a className="site-button site-button-primary" href="/app">Open workspace <SiteIcon name="arrow" /></a></section>
    </main>
  )
}
