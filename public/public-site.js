const courses = [
  { code: 'BCS1540', short: 'AD', name: 'Algorithmic Design', chapters: 10, topics: 'Greedy methods · dynamic programming · complexity' },
  { code: 'BCS1520', short: 'Stats', name: 'Statistics', chapters: 13, topics: 'Probability · inference · data workflows' },
  { code: 'BCS2410', short: 'EP', name: 'Embedded Programming', chapters: 7, topics: 'C memory · ARM · FPGA and edge AI' },
  { code: 'BCS2420', short: 'CS', name: 'Computer Security', chapters: 7, topics: 'Cryptography · authentication · system defence' },
  { code: 'BCS2540', short: 'NM', name: 'Numerical Methods', chapters: 7, topics: 'Equations · interpolation · numerical integration' }
]

const icons = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  arrow: '<path d="M5 12h14M14 7l5 5-5 5"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 7.5-8 9-4.6-1.5-8-4.5-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16ZM20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z"/>',
  message: '<path d="M5 18l-2 3v-5.5A8 8 0 1 1 6.5 19H5Z"/><path d="M8 10h8M8 14h5"/>',
  practice: '<path d="M7 3h10v4H7zM5 5H4a1 1 0 0 0-1 1v14h18V6a1 1 0 0 0-1-1h-1M8 12l2 2 5-5"/>'
}

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`
}

function header(active = '') {
  const links = [['/', 'Product'], ['/about', 'About'], ['/courses', 'Courses'], ['/docs', 'Docs']]
  return `<header class="site-header">
    <a class="site-brand" href="/" aria-label="Wicker Study home"><span>W</span><strong>Wicker Study</strong></a>
    <button class="site-menu-button" type="button" data-site-menu aria-expanded="false" aria-label="Open navigation">${icon('menu')}</button>
    <nav class="site-nav" aria-label="Primary navigation">
      ${links.map(([href, label]) => `<a href="${href}" ${active === href ? 'aria-current="page"' : ''}>${label}</a>`).join('')}
      <a class="site-nav-signin" href="/sign-in">Sign in</a>
      <a class="site-button site-button-primary" href="/app">Open workspace ${icon('arrow')}</a>
    </nav>
  </header>`
}

function footer() {
  return `<footer class="site-footer">
    <div class="site-footer-main">
      <a class="site-brand" href="/"><span>W</span><strong>Wicker Study</strong></a>
      <p>A private academic workspace built around maintained university course material.</p>
    </div>
    <nav aria-label="Legal and product links">
      <a href="/about">About</a><a href="/courses">Courses</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/sign-in">Sign in</a>
    </nav>
    <p class="site-footer-note">© 2026 Wicker Study. Essential authentication storage only; no advertising trackers.</p>
  </footer>`
}

function productPreview() {
  return `<div class="product-proof" aria-label="Preview of the Wicker Study course workspace">
    <div class="product-proof-bar"><span><i></i><i></i><i></i></span><strong>study.wicker.life</strong><em>Private workspace</em></div>
    <div class="product-proof-shell">
      <aside>
        <span class="preview-brand">W</span>
        <nav><b></b><b></b><b></b><b></b></nav>
      </aside>
      <section>
        <header><span>BCS1540 · Algorithmic Design</span><small>Exam readiness</small></header>
        <div class="preview-heading"><div><small>Ch 03</small><h3>Dynamic Programming</h3></div><strong>42%</strong></div>
        <div class="preview-tabs"><b>Content</b><span>Self-Test</span><span>Exam questions</span></div>
        <div class="preview-study-grid">
          <ol><li class="done">Optimal substructure</li><li class="active">Recurrence design</li><li>Memoization</li><li>Complexity</li></ol>
          <article><h4>Designing the recurrence</h4><p>Define the state before the transition. Each subproblem should capture exactly the information needed by later decisions.</p><div class="preview-equation">OPT(i) = max{ OPT(i − 1), wᵢ + OPT(p(i)) }</div><div class="preview-rule"><span></span><span></span><span></span></div></article>
          <div class="preview-tools"><small>STUDY TOOLS</small><span>Ask course tutor</span><span>Review flashcards</span><div><b>6</b><span>questions due</span></div></div>
        </div>
      </section>
    </div>
  </div>`
}

function courseRegister(compact = false) {
  return `<div class="public-course-register ${compact ? 'is-compact' : ''}">
    ${courses.map((course, index) => `<article>
      <span class="course-register-index">${String(index + 1).padStart(2, '0')}</span>
      <div><strong>${course.code} <em>${course.short}</em></strong><h3>${course.name}</h3></div>
      <p>${course.topics}</p>
      <span class="course-register-count">${course.chapters} chapters</span>
    </article>`).join('')}
  </div>`
}

function landingPage() {
  return `${header('/')}
    <main id="main-content">
      <section class="site-hero">
        <div class="site-hero-copy">
          <h1>Your course material, organised for the exam ahead.</h1>
          <p>Wicker Study brings maintained notes, source PDFs, focused practice, flashcards, mock papers, and a grounded course tutor into one private study record.</p>
          <div class="site-actions"><a class="site-button site-button-primary" href="/app">Open your workspace ${icon('arrow')}</a><a class="site-button site-button-secondary" href="/courses">View available courses</a></div>
          <ul class="site-assurances"><li>${icon('shield')} Private progress by account</li><li>${icon('book')} Editorial course sources</li><li>${icon('message')} Source-grounded tutor chat</li></ul>
        </div>
        ${productPreview()}
      </section>

      <section class="site-section course-proof">
        <div class="site-section-heading"><h2>Five courses. One continuous study record.</h2><p>Move from a lecture topic to practice, review, and exam rehearsal without rebuilding context in separate tools.</p></div>
        ${courseRegister(true)}
      </section>

      <section class="site-section mechanism-section">
        <div class="mechanism-copy"><h2>Prepared material first. AI only where it earns its place.</h2><p>Course notes, question banks, flashcards, and exam materials are prepared and published as course assets. AI is limited to two deliberate actions: asking the retrieval-grounded tutor and requesting further exercises.</p><a href="/about">How the workspace is structured ${icon('arrow')}</a></div>
        <div class="mechanism-diagram" aria-label="How course material becomes a personal study workflow">
          <div><span>${icon('book')}</span><strong>Maintained sources</strong><small>Notes · PDFs · papers</small></div><i></i>
          <div><span>${icon('practice')}</span><strong>Focused practice</strong><small>Questions · flashcards · mocks</small></div><i></i>
          <div><span>${icon('shield')}</span><strong>Your private record</strong><small>Progress · attempts · usage</small></div>
        </div>
      </section>

      <section class="site-section mobile-proof">
        <div class="mobile-proof-device" aria-hidden="true"><div class="mobile-proof-screen"><small>Today</small><h3>What do you want to study?</h3><b>Continue Algorithmic Design ${icon('arrow')}</b><p>Review flashcards <span>6 due</span></p><p>Fix mistakes <span>3 open</span></p><p>Practise under time <span>Mock session</span></p></div></div>
        <div><h2>Mobile is for the next useful action.</h2><p>The phone experience does not compress every desktop panel into a long column. It leads with resume, review, mistakes, and timed practice, then opens focused reading and exercise views.</p><ul><li>Resume the exact chapter you left</li><li>Clear a short flashcard queue</li><li>Review open mistakes before an exam</li></ul></div>
      </section>

      <section class="site-close"><h2>Start with the course. Leave with a clearer next step.</h2><p>Your study history remains private and portable, and can be deleted with your account at any time.</p><div class="site-actions"><a class="site-button site-button-primary" href="/app">Open Wicker Study ${icon('arrow')}</a><a href="/privacy">Read the privacy notice</a></div></section>
    </main>${footer()}`
}

function aboutPage() {
  return `${header('/about')}<main id="main-content" class="site-reading-page">
    <header class="reading-hero"><h1>A study workspace built around course truth.</h1><p>Wicker Study separates maintained academic material from the personal record created while studying it.</p></header>
    <section class="about-principles">
      <article><h2>The course layer</h2><p>Notes, source PDFs, question banks, flashcards, tutorials, and mock papers are maintained centrally. Students use prepared material instead of repeatedly asking a model to recreate it.</p></article>
      <article><h2>The personal layer</h2><p>Mastery, attempts, annotations, spaced-repetition history, mistake reviews, chat history, and AI allowances belong to the signed-in student and are stored separately.</p></article>
      <article><h2>The assistance layer</h2><p>The tutor retrieves relevant passages from the selected course and keeps answers tied to that corpus. Additional exercises are generated only when the student explicitly asks for them.</p></article>
    </section>
    <section class="reading-section"><h2>Designed for two different study contexts</h2><div class="comparison-table"><div><strong>Desktop</strong><p>Long reading, source comparison, structured practice, mock exams, and side-by-side study tools.</p></div><div><strong>Mobile</strong><p>Resume, short reviews, mistake correction, timed practice, and focused single-task flows.</p></div></div></section>
    <section class="reading-section"><h2>What the product does not do</h2><ul><li>It does not replace lectures, official module guidance, or professional academic advice.</li><li>It does not let students regenerate shared course material from the app.</li><li>It does not use AI to make decisions with legal or similarly significant effects.</li><li>It does not sell personal study data or use advertising trackers.</li></ul></section>
    <section class="reading-cta"><h2>See the maintained curriculum.</h2><a class="site-button site-button-primary" href="/courses">View courses ${icon('arrow')}</a></section>
  </main>${footer()}`
}

function coursesPage() {
  return `${header('/courses')}<main id="main-content" class="site-reading-page courses-public-page">
    <header class="reading-hero"><h1>The current course catalogue.</h1><p>Every listed course includes maintained chapter material and a structured path into reading, practice, review, and exam preparation.</p></header>
    ${courseRegister()}
    <section class="course-capability-table"><h2>Available in every course</h2><div><span>Maintained chapter notes</span><b>Included</b></div><div><span>Source PDF access and search</span><b>Included</b></div><div><span>Self-tests and exam-style practice</span><b>Included</b></div><div><span>Flashcards and mistake review</span><b>Included</b></div><div><span>Timed mock sessions</span><b>Included</b></div><div><span>Retrieval-grounded tutor chat</span><b>Usage limited</b></div><div><span>Further exercise requests</span><b>Usage limited</b></div></section>
    <section class="reading-cta"><h2>Open the full workspace.</h2><a class="site-button site-button-primary" href="/app">Continue to sign in ${icon('arrow')}</a></section>
  </main>${footer()}`
}

function privacyPage() {
  return `${header('/privacy')}<main id="main-content" class="legal-page">
    <header class="legal-hero"><div><h1>Privacy notice</h1><p>How Wicker Study handles personal data, and how to exercise your rights.</p></div><dl><div><dt>Effective</dt><dd>27 August 2026</dd></div><div><dt>Contact</dt><dd><a href="mailto:privacy@wicker.life">privacy@wicker.life</a></dd></div></dl></header>
    <div class="legal-layout"><nav aria-label="Privacy notice sections"><a href="#controller">Controller</a><a href="#data">Data we process</a><a href="#purposes">Purposes and legal bases</a><a href="#providers">Service providers</a><a href="#retention">Retention</a><a href="#rights">Your rights</a><a href="#cookies">Cookies</a><a href="#contact">Contact</a></nav><article>
      <section id="controller"><h2>1. Controller</h2><p>Wicker Study is the controller for personal study data processed through this service. Privacy enquiries and data-rights requests can be sent to <a href="mailto:privacy@wicker.life">privacy@wicker.life</a>.</p></section>
      <section id="data"><h2>2. Data we process</h2><ul><li><strong>Account data:</strong> account identifier, email address, authentication status, and account creation information supplied through Clerk.</li><li><strong>Study data:</strong> course ordering, progress, mastery, notes, attempts, answers, flashcards, mistake history, review schedules, academic-plan details, and mock-session records.</li><li><strong>AI activity:</strong> tutor messages, exercise instructions, academic documents or descriptions submitted for plan extraction, retrieved course passages, request counts, and input/output token totals. Account email addresses are not intentionally included in model prompts.</li><li><strong>Technical data:</strong> essential session data and security or service logs created by hosting and authentication providers.</li></ul><p>Shared course sources are editorial content and are stored separately from personal study records.</p></section>
      <section id="purposes"><h2>3. Purposes and legal bases</h2><div class="legal-table"><div><strong>Provide the workspace</strong><span>Account access, synchronisation, progress, practice, and requested AI features.</span><em>Performance of the service contract</em></div><div><strong>Keep the service secure</strong><span>Authentication, abuse prevention, rate limiting, troubleshooting, and operational integrity.</span><em>Legitimate interests and legal obligations where applicable</em></div><div><strong>Respond to rights requests</strong><span>Access, correction, export, restriction, objection, and deletion requests.</span><em>Legal obligation</em></div></div></section>
      <section id="providers"><h2>4. Service providers and transfers</h2><p>Wicker Study uses Clerk for authentication, Neon for managed database storage, Vercel for hosting, and the configured AI provider for tutor, extra-exercise, or academic-plan extraction requests. These providers process only the data needed for their role. Some processing may occur outside the EEA under the transfer safeguards offered in the relevant provider terms and data-processing agreements.</p><p>Personal data is not sold and is not used for third-party advertising.</p></section>
      <section id="retention"><h2>5. Retention and deletion</h2><p>Primary account and study data is retained while the account remains active. Curriculum, transcript, and screenshot originals submitted for plan extraction are used to create a review draft and are not retained by Wicker Study; only academic fields the user confirms are saved. Users can export their personal data and permanently delete their account from Settings. Deletion removes the active personal record and authentication identity; limited copies may remain temporarily in provider backups or security logs until their normal protected retention cycle ends, or longer where law requires it.</p></section>
      <section id="rights"><h2>6. Your rights</h2><p>Depending on the circumstances, the GDPR provides rights to be informed, access data, correct inaccurate data, request erasure or restriction, object to certain processing, receive portable data, and avoid decisions based solely on automated processing that have legal or similarly significant effects.</p><p>Settings provides direct data export and account deletion. Other requests can be sent to <a href="mailto:privacy@wicker.life">privacy@wicker.life</a>. We may need to verify identity and aim to respond without undue delay and ordinarily within one month. You may also complain to the data protection authority in your country.</p></section>
      <section id="automation"><h2>7. AI and automated processing</h2><p>AI features support study and do not make legal or similarly significant decisions about users. Routine answer checking is performed locally against prepared reference material. Tutor chat is retrieval-grounded, but its output can still be incomplete or incorrect and should be checked against course sources. Academic-plan extraction creates an editable draft only; users review and confirm the fields before they enter the personal record.</p></section>
      <section id="cookies"><h2>8. Cookies and local storage</h2><p>The service uses essential authentication storage and local browser storage needed to maintain sessions, interface preferences, and study continuity. Wicker Study does not currently use advertising cookies or third-party analytics trackers. If non-essential tracking is introduced, this notice and the consent experience will be updated first.</p></section>
      <section id="security"><h2>9. Security</h2><p>Personal data is separated by authenticated user identifier. Transport encryption, access controls, managed infrastructure, and server-side policy enforcement are used to reduce risk. No internet service can guarantee absolute security.</p></section>
      <section id="contact"><h2>10. Contact and changes</h2><p>Questions or rights requests: <a href="mailto:privacy@wicker.life">privacy@wicker.life</a>. Material changes to this notice will be dated on this page.</p></section>
    </article></div>
  </main>${footer()}`
}

function docsPage() {
  const origin = window.location.origin
  const code = (text) => `<pre><code>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code></pre>`
  return `${header('/docs')}<main id="main-content" class="legal-page docs-page">
    <header class="legal-hero"><div><h1>Docs</h1><p>How to study with Wicker Study, keep your plan current with documents, and connect agents or maintain content.</p></div><dl><div><dt>API</dt><dd><a href="/api/agent/manifest">/api/agent/manifest</a></dd></div><div><dt>Skill</dt><dd><a href="/skills/wicker-study/SKILL.md">SKILL.md</a></dd></div></dl></header>
    <div class="legal-layout"><nav aria-label="Docs sections"><a href="#start">Getting started</a><a href="#study">Studying</a><a href="#documents">Documents &amp; calendars</a><a href="#keys">API keys</a><a href="#skill">Claude skill</a><a href="#mcp">MCP server</a><a href="#api">HTTP API</a><a href="#admin">Administrators</a></nav><article>
      <section id="start"><h2>1. Getting started</h2><p>Sign in at <a href="/sign-in">/sign-in</a>. The workspace opens on <strong>Home</strong>: your next exam, study queues, activity, and courses. Set up your academic plan under <strong>Planning</strong> — pick a known programme or upload a curriculum, transcript, or screenshots and review the extracted draft before anything is saved.</p><ul><li><strong>Courses</strong> — maintained material per course: chapters, mastery items, mock exams, tutorials.</li><li><strong>Practice</strong> — questions, flashcards, mistakes, and timed mocks in one place.</li><li><strong>Calendar</strong> — month, week, day, and agenda views over your exams, deadlines, institution dates, and timetable feeds; search and filter by type or course.</li><li><strong>Planning</strong> — programme, courses and attempts, calendar ledger, documents, progress, and the scenario planner.</li><li><strong>Account</strong> — profile, AI allowance, API keys, data export and reset.</li></ul></section>
      <section id="study"><h2>2. Studying</h2><p>Open a chapter to read it with the outline and the source-grounded tutor. Every published question can be answered and graded; answers below 7/10 go to the mistake bank, and every graded question joins the spaced-repetition deck. Mastery on each course item is yours to set. Activity (answers, reviews, mocks, resolved mistakes, chapters read) feeds the streak and weekly totals on Home.</p><p>AI is used only for the tutor, extra exercises you request, and document reading; allowances are shown under <strong>Account → AI usage</strong>.</p></section>
      <section id="documents"><h2>3. Documents and calendars</h2><p><strong>Planning → Documents</strong> accepts a transcript, exam schedule, timetable, academic calendar, curriculum, or an <code>.ics</code> file at any time. The reader proposes a change set — results and grades, exam dates, new courses, course details, dates and events, programme details — and only the lines you tick are applied. Reading the same document again proposes nothing that is already in your plan.</p><p><strong>Calendar links</strong> (<code>https://…</code> or <code>webcal://…</code> feeds) can be previewed or saved to your plan; saved links show their last sync and can be re-synced or removed. Institution-wide dates maintained for your programme appear read-only in <strong>Calendar</strong> with an “Add to my plan” action.</p><p>Files are read for the update only; originals are not stored. Document reads count against the intake allowance; calendar feeds do not use AI.</p></section>
      <section id="keys"><h2>4. API keys</h2><p>Create keys under <strong>Account → API access</strong>. A key acts as you, limited to its scopes: <code>read</code> (every GET), <code>write</code> (study mutations and plan changes), <code>admin</code> (editorial content; administrators only). Keys are shown once and stored hashed; they cannot manage other keys, reset data, or delete the account.</p>${code(`curl -H "Authorization: Bearer wsk_…" ${origin}/api/courses`)}</section>
      <section id="skill"><h2>5. Claude skill</h2><p>The skill teaches Claude Code how to read course material, study on your behalf, keep your plan current, and (with an admin key) maintain content. Install it once for your user, or into a project:</p>${code(`# for every project (Claude Code user skills)
mkdir -p ~/.claude/skills/wicker-study
curl -fsSL ${origin}/skills/wicker-study/SKILL.md -o ~/.claude/skills/wicker-study/SKILL.md

# or inside one repository
mkdir -p .claude/skills/wicker-study
curl -fsSL ${origin}/skills/wicker-study/SKILL.md -o .claude/skills/wicker-study/SKILL.md`)}<p>Then export your key (<code>WICKER_STUDY_API_KEY=wsk_…</code>) and ask Claude to, for example, “summarise chapter 2 of Computer Security”, “update my plan from this transcript”, or “add these questions to BCS1520 chapter 3”. The skill reads <a href="/api/agent/manifest">/api/agent/manifest</a> when unsure.</p></section>
      <section id="mcp"><h2>6. MCP server</h2><p>The repository ships an MCP server (<code>mcp/server.mjs</code>) that wraps the same API as tools for Claude Desktop, Claude Code, Cursor, and others.</p>${code(`{
  "mcpServers": {
    "wicker-study": {
      "command": "node",
      "args": ["/path/to/exam-study-platform/mcp/server.mjs"],
      "env": { "WICKER_STUDY_URL": "${origin}", "WICKER_STUDY_API_KEY": "wsk_…" }
    }
  }
}`)}<p>Tools cover reading (courses, chapters, search, questions, flashcards, mistakes, mocks, plan, activity), studying (answers, reviews, mastery, plan changes, documents, calendars), and the <code>admin_*</code> family.</p></section>
      <section id="api"><h2>7. HTTP API</h2><p>One JSON API serves the web app, agents, and administrators. Send <code>Content-Type: application/json</code>; errors return <code>{ "error": "…" }</code> with 401 (key), 403 (scope), 404, 409 (stale revision), or 501 (editorial write without a hosted database). The complete, versioned list of endpoints with body shapes is at <a href="/api/agent/manifest">/api/agent/manifest</a>.</p><div class="legal-table"><div><strong>Read</strong><span>/api/courses, /api/courses/{id}, /api/chapter/{course}/{chapter}, /api/retrieve, /api/questions/{course}/{chapter}, /api/flashcards/{course}, /api/sr/due, /api/mistakes, /api/mocks, /api/academics, /api/activity</span></div><div><strong>Write</strong><span>/api/grade, /api/items/{id}, /api/sr/review, /api/flashcards/…, /api/mistakes/{id}/resolve, /api/academics, /api/academics/documents/analyze + /apply, /api/academics/calendars</span></div><div><strong>Admin</strong><span>/api/admin/status, /api/admin/courses/{id} (+ chapters, materials, items, papers, questions, flashcards), /api/admin/programmes/{id} (+ calendar)</span></div></div></section>
      <section id="admin"><h2>8. Administrators</h2><p>Administrators are the user ids listed in the <code>ADMIN_USER_IDS</code> environment variable. They can mint admin keys and use <strong>Account → Admin</strong> in the workspace to upload course materials (PDF text is extracted and indexed) and institution-wide academic calendars per known programme. Everything else — courses, chapters, mastery items, papers, question banks, editorial flashcards, the programme catalogue — is available through the admin API and MCP tools and takes effect immediately on the active release.</p></section>
    </article></div>
  </main>${footer()}`
}

function termsPage() {
  return `${header('/terms')}<main id="main-content" class="legal-page">
    <header class="legal-hero"><div><h1>Terms of service</h1><p>The rules for accessing and using Wicker Study.</p></div><dl><div><dt>Effective</dt><dd>27 August 2026</dd></div><div><dt>Contact</dt><dd><a href="mailto:support@wicker.life">support@wicker.life</a></dd></div></dl></header>
    <div class="legal-layout"><nav aria-label="Terms sections"><a href="#service">Service</a><a href="#accounts">Accounts</a><a href="#academic">Academic use</a><a href="#content">Content</a><a href="#ai">AI features</a><a href="#acceptable">Acceptable use</a><a href="#availability">Availability</a><a href="#ending">Ending use</a></nav><article>
      <section id="service"><h2>1. The service</h2><p>Wicker Study provides a private workspace for accessing maintained course material, recording study progress, practising questions, reviewing flashcards and mistakes, running mock sessions, and using limited source-grounded AI assistance.</p></section>
      <section id="accounts"><h2>2. Accounts and access</h2><p>You are responsible for the security of your sign-in method and for activity under your account. Provide accurate account information and notify us promptly if you believe access has been compromised. The service is intended for university-level learners able to enter into these terms.</p></section>
      <section id="academic"><h2>3. Academic use</h2><p>The service supports study but does not replace lectures, official module documents, instructors, or examination rules. You remain responsible for checking material and complying with your institution’s academic-integrity requirements. No grade or examination outcome is guaranteed.</p></section>
      <section id="content"><h2>4. Course and personal content</h2><p>Course materials and the platform interface remain protected by their applicable intellectual-property rights. You may use them for personal study within the service and may not redistribute, scrape, resell, or republish them without permission. You retain rights in personal notes and answers you create.</p></section>
      <section id="ai"><h2>5. AI-assisted features</h2><p>AI is limited to retrieval-grounded tutor chat and further exercises requested by the user. Responses can be incomplete or incorrect and should be verified against cited course material. Usage limits protect service capacity and may be adjusted. Attempts to bypass limits or use AI endpoints outside their intended study purpose are prohibited.</p></section>
      <section id="acceptable"><h2>6. Acceptable use</h2><p>Do not interfere with the service, attempt unauthorised access, upload malicious material, abuse other users, automate excessive requests, circumvent security or usage controls, or use the service in a way that violates law or third-party rights.</p></section>
      <section id="availability"><h2>7. Availability and changes</h2><p>We aim to keep the service dependable, but access may be interrupted for maintenance, security, provider outages, or changes to course availability. Features and course content may change as the maintained curriculum evolves.</p></section>
      <section id="warranty"><h2>8. Responsibility</h2><p>The service is provided on an as-available basis. To the maximum extent permitted by applicable law, Wicker Study is not responsible for indirect loss, lost academic opportunity, or decisions made solely from generated output. Nothing in these terms excludes rights or liability that cannot legally be excluded.</p></section>
      <section id="ending"><h2>9. Ending use</h2><p>You may stop using the service at any time and can export your personal data or permanently delete your account from Settings. Access may be suspended where reasonably necessary to protect the service, other users, or legal compliance.</p></section>
      <section id="contact"><h2>10. Contact and changes</h2><p>Questions about these terms can be sent to <a href="mailto:support@wicker.life">support@wicker.life</a>. Material revisions will be dated on this page. Continued use after revised terms take effect indicates acceptance where permitted by law.</p></section>
    </article></div>
  </main>${footer()}`
}

export function mountPublicSite(pathname = '/') {
  const target = document.getElementById('public-site')
  document.getElementById('auth-gate').hidden = true
  document.getElementById('app').innerHTML = ''
  target.hidden = false
  document.documentElement.classList.add('public-mode')
  document.body.classList.add('public-mode')
  document.querySelector('.skip-link')?.setAttribute('href', '#main-content')
  const renderers = { '/': landingPage, '/about': aboutPage, '/courses': coursesPage, '/docs': docsPage, '/privacy': privacyPage, '/terms': termsPage }
  const renderer = renderers[pathname] || landingPage
  target.innerHTML = renderer()
  const labels = { '/': 'Academic exam preparation', '/about': 'About', '/courses': 'Courses', '/docs': 'Docs', '/privacy': 'Privacy notice', '/terms': 'Terms of service' }
  document.title = `${labels[pathname] || labels['/']} · Wicker Study`
  if (new URLSearchParams(window.location.search).get('account-deleted') === '1') {
    target.insertAdjacentHTML('afterbegin', '<div class="site-notice" role="status"><strong>Account deleted.</strong><span>Your Wicker Study account and active personal study record were removed.</span><button type="button" aria-label="Dismiss notification">×</button></div>')
    target.querySelector('.site-notice button')?.addEventListener('click', (event) => event.currentTarget.closest('.site-notice')?.remove())
    window.history.replaceState(null, '', window.location.pathname)
  }
  const menu = target.querySelector('[data-site-menu]')
  menu?.addEventListener('click', () => {
    const open = target.classList.toggle('site-menu-open')
    menu.setAttribute('aria-expanded', String(open))
    menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation')
    menu.innerHTML = icon(open ? 'close' : 'menu')
  })
}

export function mountAuthSite() {
  const publicSite = document.getElementById('public-site')
  const gate = document.getElementById('auth-gate')
  publicSite.hidden = true
  document.getElementById('app').innerHTML = ''
  document.documentElement.classList.remove('public-mode')
  document.body.classList.remove('public-mode')
  document.querySelector('.skip-link')?.setAttribute('href', '#auth-gate')
  gate.hidden = false
  gate.innerHTML = `<div class="auth-page">
    <a class="auth-back" href="/">← Back to Wicker Study</a>
    <section class="auth-form-column" aria-labelledby="auth-title">
      <a class="site-brand" href="/"><span>W</span><strong>Wicker Study</strong></a>
      <div class="auth-form-copy"><h1 id="auth-title">Return to your study record.</h1><p>Open your notes, attempts, mastery history, and review schedule.</p></div>
      <div id="clerk-sign-in"></div>
      <p class="auth-legal">By continuing, you agree to the <a href="/terms">Terms</a> and acknowledge the <a href="/privacy">Privacy notice</a>.</p>
    </section>
    <aside class="auth-product-column" aria-label="Product overview">
      <div class="auth-product-copy"><h2>One place for the full course-to-exam loop.</h2><p>Maintained sources, focused practice, and a private record that resumes on any device.</p></div>
      <div class="auth-course-sheet"><header><span>Today’s study plan</span><strong>3 actions</strong></header><div><b>Continue</b><span>BCS1540 · Dynamic Programming</span><em>22 min</em></div><div><b>Review</b><span>Statistics flashcards</span><em>6 due</em></div><div><b>Correct</b><span>Computer Security mistakes</span><em>3 open</em></div></div>
      <p class="auth-privacy-note">${icon('shield')} Course content is shared. Your notes and progress are private to your account.</p>
    </aside>
  </div>`
  document.title = 'Sign in · Wicker Study'
}
