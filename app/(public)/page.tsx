import { CourseRegister } from '@/components/site/course-register'
import { SiteIcon } from '@/components/site/icon'

function ProductPreview() {
  return (
    <div className="product-proof" aria-label="Preview of the Wicker Study course workspace">
      <div className="product-proof-bar"><span><i /><i /><i /></span><strong>study.wicker.life</strong><em>Private workspace</em></div>
      <div className="product-proof-shell">
        <aside><span className="preview-brand">W</span><nav><b /><b /><b /><b /></nav></aside>
        <section>
          <header><span>BCS1540 · Algorithmic Design</span><small>Exam readiness</small></header>
          <div className="preview-heading"><div><small>Ch 03</small><h3>Dynamic Programming</h3></div><strong>42%</strong></div>
          <div className="preview-tabs"><b>Content</b><span>Self-Test</span><span>Exam questions</span></div>
          <div className="preview-study-grid">
            <ol><li className="done">Optimal substructure</li><li className="active">Recurrence design</li><li>Memoization</li><li>Complexity</li></ol>
            <article><h4>Designing the recurrence</h4><p>Define the state before the transition. Each subproblem should capture exactly the information needed by later decisions.</p><div className="preview-equation">OPT(i) = max{'{'} OPT(i − 1), wᵢ + OPT(p(i)) {'}'}</div><div className="preview-rule"><span /><span /><span /></div></article>
            <div className="preview-tools"><small>STUDY TOOLS</small><span>Ask course tutor</span><span>Review flashcards</span><div><b>6</b><span>questions due</span></div></div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <main id="main-content">
      <section className="site-hero">
        <div className="site-hero-copy">
          <h1>Your course material, organised for the exam ahead.</h1>
          <p>Wicker Study brings maintained notes, source PDFs, focused practice, flashcards, mock papers, and a grounded course tutor into one private study record.</p>
          <div className="site-actions"><a className="site-button site-button-primary" href="/v2">Open your workspace <SiteIcon name="arrow" /></a><a className="site-button site-button-secondary" href="/courses">View available courses</a></div>
          <ul className="site-assurances"><li><SiteIcon name="shield" /> Private progress by account</li><li><SiteIcon name="book" /> Editorial course sources</li><li><SiteIcon name="message" /> Source-grounded tutor chat</li></ul>
        </div>
        <ProductPreview />
      </section>

      <section className="site-section course-proof">
        <div className="site-section-heading"><h2>Five courses. One continuous study record.</h2><p>Move from a lecture topic to practice, review, and exam rehearsal without rebuilding context in separate tools.</p></div>
        <CourseRegister compact />
      </section>

      <section className="site-section mechanism-section">
        <div className="mechanism-copy"><h2>Prepared material first. AI only where it earns its place.</h2><p>Course notes, question banks, flashcards, and exam materials are prepared and published as course assets. AI is limited to two deliberate actions: asking the retrieval-grounded tutor and requesting further exercises.</p><a href="/about">How the workspace is structured <SiteIcon name="arrow" /></a></div>
        <div className="mechanism-diagram" aria-label="How course material becomes a personal study workflow">
          <div><span><SiteIcon name="book" /></span><strong>Maintained sources</strong><small>Notes · PDFs · papers</small></div><i />
          <div><span><SiteIcon name="practice" /></span><strong>Focused practice</strong><small>Questions · flashcards · mocks</small></div><i />
          <div><span><SiteIcon name="shield" /></span><strong>Your private record</strong><small>Progress · attempts · usage</small></div>
        </div>
      </section>

      <section className="site-section mobile-proof">
        <div className="mobile-proof-device" aria-hidden="true"><div className="mobile-proof-screen"><small>Today</small><h3>What do you want to study?</h3><b>Continue Algorithmic Design <SiteIcon name="arrow" /></b><p>Review flashcards <span>6 due</span></p><p>Fix mistakes <span>3 open</span></p><p>Practise under time <span>Mock session</span></p></div></div>
        <div><h2>Mobile is for the next useful action.</h2><p>The phone experience does not compress every desktop panel into a long column. It leads with resume, review, mistakes, and timed practice, then opens focused reading and exercise views.</p><ul><li>Resume the exact chapter you left</li><li>Clear a short flashcard queue</li><li>Review open mistakes before an exam</li></ul></div>
      </section>

      <section className="site-close"><h2>Start with the course. Leave with a clearer next step.</h2><p>Your study history remains private and portable, and can be deleted with your account at any time.</p><div className="site-actions"><a className="site-button site-button-primary" href="/v2">Open Wicker Study <SiteIcon name="arrow" /></a><a href="/privacy">Read the privacy notice</a></div></section>
    </main>
  )
}
