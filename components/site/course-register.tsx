import { courses } from '@/lib/site-content'

export function CourseRegister({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`public-course-register ${compact ? 'is-compact' : ''}`}>
      {courses.map((course, index) => (
        <article key={course.code}>
          <span className="course-register-index">{String(index + 1).padStart(2, '0')}</span>
          <div><strong>{course.code} <em>{course.short}</em></strong><h3>{course.name}</h3></div>
          <p>{course.topics}</p>
          <span className="course-register-count">{course.chapters} chapters</span>
        </article>
      ))}
    </div>
  )
}
