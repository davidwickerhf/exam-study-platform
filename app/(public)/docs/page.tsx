import type { Metadata } from 'next'
import { ContactLink } from '@/components/site/contact-link'

export const metadata: Metadata = { title: 'Docs' }

const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://study.wicker.life'

function Code({ children }: { children: string }) {
  return <pre><code>{children}</code></pre>
}

export default function DocsPage() {
  return (
    <main id="main-content" className="legal-page docs-page">
      <header className="legal-hero"><div><h1>Docs</h1><p>How to study with Wicker Study, keep your plan current with documents, and connect agents or maintain content.</p></div><dl><div><dt>API</dt><dd><a href="/api/agent/manifest">/api/agent/manifest</a></dd></div><div><dt>Skill</dt><dd><a href="/skills/wicker-study/SKILL.md">SKILL.md</a></dd></div></dl></header>
      <div className="legal-layout">
        <nav aria-label="Docs sections"><a href="#start">Getting started</a><a href="#study">Studying</a><a href="#documents">Documents &amp; calendars</a><a href="#keys">API keys</a><a href="#skill">Claude skill</a><a href="#mcp">MCP server</a><a href="#api">HTTP API</a><a href="#security">Security</a><a href="#admin">Administrators</a></nav>
        <article>
          <section id="start"><h2>1. Getting started</h2><p>Sign in at <a href="/sign-in">/sign-in</a>. The workspace opens on <strong>Home</strong>: your next exam, study queues, activity, and courses. Set up your academic plan under <strong>Planning</strong> — pick a known programme or upload a curriculum, transcript, or screenshots and review the extracted draft before anything is saved.</p><ul><li><strong>Courses</strong> — maintained material per course: chapters, mastery items, mock exams, tutorials.</li><li><strong>Practice</strong> — questions, flashcards, mistakes, and timed mocks in one place.</li><li><strong>Calendar</strong> — month, week, day, and agenda views over your exams, deadlines, institution dates, and timetable feeds; search and filter by type or course.</li><li><strong>Planning</strong> — programme, courses and attempts, documents, progress, and the scenario planner.</li><li><strong>Account</strong> — profile, AI allowance, API keys, data export and reset.</li></ul></section>
          <section id="study"><h2>2. Studying</h2><p>Open a chapter to read it with the outline and the source-grounded tutor. Every published question can be answered and graded; answers below 7/10 go to the mistake bank, and every graded question joins the spaced-repetition deck. Mastery on each course item is yours to set. Activity (answers, reviews, mocks, resolved mistakes, chapters read) feeds the streak and weekly totals on Home.</p><p>AI is used only for the tutor, extra exercises you request, and document reading; allowances are shown under <strong>Account → AI usage</strong>.</p></section>
          <section id="documents"><h2>3. Documents and calendars</h2><p><strong>Planning → Documents</strong> accepts a transcript, exam schedule, timetable, academic calendar, curriculum, or an <code>.ics</code> file at any time. The reader proposes a change set — results and grades, exam dates, new courses, course details, dates and events, programme details — and only the lines you tick are applied. Reading the same document again proposes nothing that is already in your plan.</p><p><strong>Calendar links</strong> (<code>https://…</code> or <code>webcal://…</code> feeds) can be previewed or saved to your plan; saved links show their last sync and can be re-synced or removed. Institution-wide dates maintained for your programme appear read-only in <strong>Calendar</strong> with an “Add to my plan” action.</p><p>Files are read for the update only; originals are not stored. Document reads count against the intake allowance; calendar feeds do not use AI.</p></section>
          <section id="keys"><h2>4. API keys</h2><p>Create keys under <strong>Account → API access</strong>. A key acts as you, limited to its scopes: <code>read</code> (every GET), <code>write</code> (study mutations and plan changes), <code>admin</code> (editorial content; administrators only). Keys are shown once and stored hashed; they cannot manage other keys, reset data, or delete the account.</p><Code>{`curl -H "Authorization: Bearer wsk_…" ${origin}/api/courses`}</Code></section>
          <section id="skill"><h2>5. Claude skill</h2><p>The skill teaches Claude Code how to read course material, study on your behalf, keep your plan current, and (with an admin key) maintain content. Install it once for your user, or into a project:</p><Code>{`# for every project (Claude Code user skills)
mkdir -p ~/.claude/skills/wicker-study
curl -fsSL ${origin}/skills/wicker-study/SKILL.md -o ~/.claude/skills/wicker-study/SKILL.md

# or inside one repository
mkdir -p .claude/skills/wicker-study
curl -fsSL ${origin}/skills/wicker-study/SKILL.md -o .claude/skills/wicker-study/SKILL.md`}</Code><p>Then export your key (<code>WICKER_STUDY_API_KEY=wsk_…</code>) and ask Claude to, for example, “summarise chapter 2 of Computer Security”, “update my plan from this transcript”, or “add these questions to BCS1520 chapter 3”. The skill reads <a href="/api/agent/manifest">/api/agent/manifest</a> when unsure.</p></section>
          <section id="mcp"><h2>6. MCP server</h2><p>The repository ships an MCP server (<code>mcp/server.mjs</code>) that wraps the same API as tools for Claude Desktop, Claude Code, Cursor, and others.</p><Code>{`{
  "mcpServers": {
    "wicker-study": {
      "command": "node",
      "args": ["/path/to/exam-study-platform/mcp/server.mjs"],
      "env": { "WICKER_STUDY_URL": "${origin}", "WICKER_STUDY_API_KEY": "wsk_…" }
    }
  }
}`}</Code><p>Tools cover reading (courses, chapters, search, questions, flashcards, mistakes, mocks, plan, activity), studying (answers, reviews, mastery, plan changes, documents, calendars), and the <code>admin_*</code> family.</p></section>
          <section id="api"><h2>7. HTTP API</h2><p>One JSON API serves the web app, agents, and administrators. Send <code>Content-Type: application/json</code>; errors return <code>{'{ "error": "…" }'}</code> with 401 (key), 403 (scope), 404, 409 (stale revision), or 501 (editorial write without a hosted database). The complete, versioned list of endpoints with body shapes is at <a href="/api/agent/manifest">/api/agent/manifest</a>.</p><div className="legal-table"><div><strong>Read</strong><span>/api/courses, /api/courses/{'{id}'}, /api/chapter/{'{course}'}/{'{chapter}'}, /api/retrieve, /api/questions/{'{course}'}/{'{chapter}'}, /api/flashcards/{'{course}'}, /api/sr/due, /api/mistakes, /api/mocks, /api/academics, /api/activity</span></div><div><strong>Write</strong><span>/api/grade, /api/items/{'{id}'}, /api/sr/review, /api/flashcards/…, /api/mistakes/{'{id}'}/resolve, /api/academics, /api/academics/documents/analyze + /apply, /api/academics/calendars</span></div><div><strong>Admin</strong><span>/api/admin/status, /api/admin/courses/{'{id}'} (+ chapters, materials, items, papers, questions, flashcards), /api/admin/programmes/{'{id}'} (+ calendar)</span></div></div></section>
          <section id="security"><h2>8. Security</h2><p>Every API route needs a session or a scoped, expiring API key stored as a hash. Requests are rate-limited per IP and per identity (tighter budgets for mutations, AI routes, uploads, key minting, and account resets), failed authentication is throttled, cookie-authenticated mutations must originate from this site, HTML is served with a strict Content Security Policy and HSTS, and server-side fetches of user-supplied URLs are confined to public hosts. Report a suspected vulnerability privately to <ContactLink kind="security" />. Details: <code>docs/SECURITY.md</code> in the repository.</p></section>
          <section id="admin"><h2>9. Administrators</h2><p>Administrators are the user ids listed in the <code>ADMIN_USER_IDS</code> environment variable. They can mint admin keys and use <strong>Account → Admin</strong> in the workspace to upload course materials (PDF text is extracted and indexed) and institution-wide academic calendars per known programme. Everything else — courses, chapters, mastery items, papers, question banks, editorial flashcards, the programme catalogue — is available through the admin API and MCP tools and takes effect immediately on the active release.</p></section>
        </article>
      </div>
    </main>
  )
}
