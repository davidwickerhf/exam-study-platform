import { createServer } from 'node:http'
import { readFile, writeFile, readdir, stat, mkdir, unlink } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { extname, join, resolve, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile, execFileSync, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const publicDir = resolve(__dirname, 'public')
const dataPath = resolve(__dirname, 'data/study-state.json')
const templatePath = resolve(__dirname, 'data/study-state.template.json')
const cacheDir = resolve(__dirname, 'data/cache')
const bundledContentDir = resolve(__dirname, 'content')
const port = Number(process.env.PORT || 4177)

// ─── LLM provider config ─────────────────────────────────────────────────────
// Three providers supported:
//   codex  — spawns the Anthropic Codex.app CLI (default; current user setup)
//   claude — spawns the `claude` CLI (Claude Code), if installed
//   api    — direct call to Anthropic Messages API via fetch (no CLI needed)
//
// Provider is picked in this order:
//   1. process.env.LLM_PROVIDER
//   2. data/llm-config.json (if it exists)
//   3. default: 'codex'
//
// For `api`, ANTHROPIC_API_KEY (env or config) is required.
const llmConfigPath = resolve(__dirname, 'data/llm-config.json')

function loadLlmConfig() {
  try {
    if (existsSync(llmConfigPath)) return JSON.parse(readFileSync(llmConfigPath, 'utf8'))
  } catch {}
  return {}
}
const llmConfig = loadLlmConfig()

const LLM_PROVIDER = (process.env.LLM_PROVIDER || llmConfig.provider || 'codex').toLowerCase()
const CODEX_BIN    = process.env.CODEX_BIN    || llmConfig.codexBin    || '/Applications/Codex.app/Contents/Resources/codex'
const CODEX_MODEL  = process.env.CODEX_MODEL  || llmConfig.codexModel  || ''
const CLAUDE_BIN   = process.env.CLAUDE_BIN   || llmConfig.claudeBin   || 'claude'
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || llmConfig.anthropicApiKey || ''
const ANTHROPIC_MODEL   = process.env.ANTHROPIC_MODEL   || llmConfig.anthropicModel  || 'claude-sonnet-4-5'

// ─── Self-update config ─────────────────────────────────────────────────────
// Read at boot — git HEAD + remote origin URL → parsed owner/repo for the
// GitHub commits API. Lets the client warn when there's a newer commit upstream.
function safeExec(cmd, args) {
  try { return execFileSync(cmd, args, { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() }
  catch { return '' }
}
const LOCAL_GIT_HEAD = safeExec('git', ['rev-parse', 'HEAD'])
const LOCAL_GIT_BRANCH = safeExec('git', ['rev-parse', '--abbrev-ref', 'HEAD']) || 'main'
const REMOTE_URL = safeExec('git', ['remote', 'get-url', 'origin'])
// Parse https://github.com/<owner>/<repo>(.git)? or git@github.com:<owner>/<repo>(.git)?
function parseGithubRemote(url) {
  if (!url) return null
  const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/)
  if (!m) return null
  return { owner: m[1], repo: m[2] }
}
const GITHUB_REPO = parseGithubRemote(REMOTE_URL)

// Remote-version cache so we don't slam GitHub's 60-req/hr unauthenticated limit
let remoteHeadCache = { sha: null, message: null, checkedAt: 0, ttlMs: 5 * 60 * 1000, error: null }
async function fetchRemoteHead({ force = false } = {}) {
  if (!GITHUB_REPO) return { error: 'No GitHub remote configured' }
  const now = Date.now()
  if (!force && remoteHeadCache.sha && now - remoteHeadCache.checkedAt < remoteHeadCache.ttlMs) {
    return remoteHeadCache
  }
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO.owner}/${GITHUB_REPO.repo}/commits/${LOCAL_GIT_BRANCH}`
    const resp = await fetch(url, { headers: { 'User-Agent': 'exam-study-platform', 'Accept': 'application/vnd.github+json' } })
    if (!resp.ok) {
      remoteHeadCache = { sha: null, message: null, checkedAt: now, ttlMs: 60 * 1000, error: `GitHub API ${resp.status}` }
      return remoteHeadCache
    }
    const data = await resp.json()
    remoteHeadCache = {
      sha: data.sha,
      message: (data.commit?.message || '').split('\n')[0].slice(0, 200),
      authoredAt: data.commit?.author?.date || null,
      checkedAt: now,
      ttlMs: 5 * 60 * 1000,
      error: null
    }
    return remoteHeadCache
  } catch (err) {
    remoteHeadCache = { sha: null, message: null, checkedAt: now, ttlMs: 60 * 1000, error: err.message }
    return remoteHeadCache
  }
}

// Update job state — keyed singleton (one update at a time)
let updateJob = null // { status: 'pulling'|'done'|'error', output, error, startedAt, finishedAt }

async function runGitPull() {
  updateJob = { status: 'pulling', output: '', error: null, startedAt: Date.now() }
  try {
    // First check there are no uncommitted changes that would block the pull
    const dirty = safeExec('git', ['status', '--porcelain'])
    if (dirty) {
      updateJob = {
        status: 'error',
        output: dirty,
        error: 'Local changes would be overwritten by git pull. Commit, stash, or discard them first.',
        startedAt: updateJob.startedAt,
        finishedAt: Date.now()
      }
      return
    }
    const { stdout, stderr } = await execFileAsync('git', ['pull', '--ff-only'], { cwd: __dirname })
    updateJob = {
      status: 'done',
      output: (stdout + stderr).trim(),
      error: null,
      startedAt: updateJob.startedAt,
      finishedAt: Date.now(),
      newHead: safeExec('git', ['rev-parse', 'HEAD'])
    }
  } catch (err) {
    updateJob = {
      status: 'error',
      output: (err.stdout || '') + (err.stderr || ''),
      error: err.message,
      startedAt: updateJob.startedAt,
      finishedAt: Date.now()
    }
  }
}

/**
 * Resolves the vault root to use for course content lookups. Precedence:
 *   1. VAULT_ROOT env var (absolute path or relative to platform root)
 *   2. state.meta.vaultRoot if set (relative paths resolve against platform root)
 *   3. The bundled content/ folder in the platform repo
 *
 * Always returns an absolute path. This abstraction is what makes the platform
 * machine-portable: shared users get bundled content out of the box, the
 * maintainer can keep pointing at their original vault via env or state.
 */
function getVaultRoot(state) {
  const candidate = process.env.VAULT_ROOT || state?.meta?.vaultRoot || ''
  if (candidate) return resolve(__dirname, candidate)
  return bundledContentDir
}
const execFileAsync = promisify(execFile)

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type })
  res.end(body)
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

async function readState() {
  // First-run bootstrap: if the working state file doesn't exist but the
  // shipped template does, copy the template across. Friends cloning the repo
  // get a clean working state without manual setup.
  if (!existsSync(dataPath) && existsSync(templatePath)) {
    await ensureDir(dirname(dataPath))
    await writeFile(dataPath, await readFile(templatePath, 'utf8'), 'utf8')
    console.log(`[bootstrap] Initialized data/study-state.json from template`)
  }
  return JSON.parse(await readFile(dataPath, 'utf8'))
}

async function writeState(state) {
  state.meta.updatedAt = new Date().toISOString()
  await writeFile(dataPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

function findItem(state, itemId) {
  for (const course of state.courses) {
    const item = course.items.find((candidate) => candidate.id === itemId)
    if (item) return { course, item }
  }
  return null
}

function applyPatch(item, patch) {
  const now = new Date().toISOString()

  if ('mastery' in patch) {
    const next = Math.max(0, Math.min(4, Number(patch.mastery) | 0))
    const prev = item.mastery ?? 0
    item.mastery = next
    item.masteryUpdatedAt = now
    if (next !== prev) {
      item.reviewLog = item.reviewLog || []
      item.reviewLog.push({
        at: now,
        mastery: next,
        prevMastery: prev,
        kind: 'mastery-change',
        note: patch.note || ''
      })
    }
  }

  if ('reviewEvent' in patch && patch.reviewEvent) {
    const ev = patch.reviewEvent
    item.reviewLog = item.reviewLog || []
    item.reviewLog.push({
      at: now,
      mastery: 'mastery' in ev ? ev.mastery : item.mastery,
      score: ev.score ?? null,
      kind: ev.kind || 'review',
      note: ev.note || ''
    })
  }

  if ('notes' in patch) item.notes = patch.notes
  if ('priority' in patch) item.priority = Number(patch.priority) | 0
}

async function ensureDir(p) {
  try {
    await mkdir(p, { recursive: true })
  } catch {}
}

function pathInside(parent, child) {
  const p = resolve(parent)
  const c = resolve(child)
  return c === p || c.startsWith(p + '/')
}

async function resolveChapterContent(state, courseId, chapterId, relPath) {
  const course = state.courses.find((c) => c.id === courseId)
  if (!course) throw new Error(`Unknown course: ${courseId}`)
  const chapter = course.chapters?.find((c) => c.id === chapterId)
  if (!chapter) throw new Error(`Unknown chapter: ${chapterId}`)
  const vaultRoot = getVaultRoot(state)

  const courseRoot = resolve(vaultRoot, course.knowledgeBase)
  if (!pathInside(vaultRoot, courseRoot)) throw new Error('Knowledge base path escapes vault')

  const chapterPath = resolve(courseRoot, chapter.file)
  if (!pathInside(courseRoot, chapterPath)) throw new Error('Chapter path escapes course root')

  let target = chapterPath
  if (relPath) {
    target = resolve(chapterPath, relPath)
    if (!pathInside(chapterPath, target)) throw new Error('Relative path escapes chapter folder')
  }

  if (!existsSync(target)) throw new Error(`Not found: ${relative(vaultRoot, target)}`)

  let st = await stat(target)
  const baseInfo = {
    title: chapter.name,
    chapter,
    course: { id: course.id, code: course.code, name: course.name, shortName: course.shortName, accent: course.accent },
    relPath: relPath || '',
    path: relative(vaultRoot, target)
  }

  if (st.isDirectory()) {
    const entries = await readdir(target, { withFileTypes: true })
    const files = entries.filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name).sort()
    const subdirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name).sort()
    if (files.length === 1 && subdirs.length === 0) {
      const childRel = relPath ? join(relPath, files[0]) : files[0]
      target = resolve(chapterPath, childRel)
      if (!pathInside(chapterPath, target)) throw new Error('Relative path escapes chapter folder')
      st = await stat(target)
      baseInfo.relPath = childRel
      baseInfo.path = relative(vaultRoot, target)
    } else {
      return { kind: 'directory', ...baseInfo, files, subdirs }
    }
  }

  const content = await readFile(target, 'utf8')

  let examples = null
  if (!relPath) {
    const chapterDir = dirname(target)
    const examplesPath = resolve(chapterDir, 'examples.md')
    if (existsSync(examplesPath) && pathInside(chapterDir, examplesPath)) {
      examples = await readFile(examplesPath, 'utf8')
    }
  }

  return { kind: 'file', ...baseInfo, content, examples }
}

function parseSelfTestSections(md) {
  const sections = []
  const lines = md.split('\n')
  let current = null
  let inAnswers = false
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)$/)
    if (h2 && !line.toLowerCase().includes('answer')) {
      if (current) sections.push(current)
      current = { title: h2[1].trim(), questions: [], answers: [] }
      inAnswers = false
      continue
    }
    if (!current) continue
    if (/^\*\*?answers?:?\*\*?/i.test(line.trim())) {
      inAnswers = true
      continue
    }
    if (line.trim() === '---') {
      inAnswers = false
      continue
    }
    const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/)
    if (numbered) {
      const target = inAnswers ? current.answers : current.questions
      target.push({ n: Number(numbered[1]), text: numbered[2] })
    } else if (line.trim() && current.questions.length > 0) {
      const target = inAnswers ? current.answers : current.questions
      const last = target[target.length - 1]
      if (last) last.text += '\n' + line
    }
  }
  if (current) sections.push(current)
  return sections
}

function pairQuestionsAnswers(section) {
  return section.questions.map((q) => {
    const answer = section.answers.find((a) => a.n === q.n)
    return {
      id: `selftest-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-q${q.n}`,
      source: `Self test: ${section.title}`,
      type: 'written',
      question: q.text.trim(),
      expected: answer ? answer.text.trim() : ''
    }
  })
}

const SECTION_MATCH_STOPWORDS = new Set([
  'the', 'and', 'with', 'algorithm', 'algorithms', 'programming', 'theorem', 'theory',
  'introduction', 'foundations', 'applications', 'chapter', 'topic'
])

function chapterTokens(chapter) {
  return new Set((chapter.name.toLowerCase().match(/[a-z]+/g) || []).filter((w) => w.length > 3 && !SECTION_MATCH_STOPWORDS.has(w)))
}

function sectionMatchesChapter(sectionTitle, chapter) {
  const sectionTokens = new Set(sectionTitle.toLowerCase().match(/[a-z]+/g) || [])
  const kws = chapterTokens(chapter)
  if (!kws.size) {
    // fall back to substring match if no meaningful tokens
    return sectionTitle.toLowerCase().includes(chapter.name.toLowerCase())
  }
  for (const k of kws) if (sectionTokens.has(k)) return true
  return false
}

// Mirror the client's slugify for stable heading anchors across server/client.
function slugifyHeading(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60)
}

function stripMarkdownNoise(s) {
  return String(s)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')                                   // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')                                // links
    .replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a)      // wikilinks
    .replace(/`([^`]+)`/g, '$1')                                            // inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1')                                      // bold **
    .replace(/__([^_]+)__/g, '$1')                                          // bold __
    .replace(/\*([^*]+)\*/g, '$1')                                          // italic *
    .replace(/(^|\s)_([^_]+)_(?=\s|$)/g, '$1$2')                            // italic _word_
    .replace(/~~([^~]+)~~/g, '$1')                                          // strikethrough
}

function extractMarkdownToc(markdown) {
  const seen = new Map()
  const headings = []
  let inFence = false
  let inFrontmatter = false
  const lines = String(markdown || '').split('\n')

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (i === 0 && trimmed === '---') { inFrontmatter = true; continue }
    if (inFrontmatter) {
      if (trimmed === '---') inFrontmatter = false
      continue
    }
    if (trimmed.startsWith('```')) { inFence = !inFence; continue }
    if (inFence) continue

    const m = raw.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/)
    if (!m) continue
    const text = stripMarkdownNoise(m[2]).replace(/<[^>]+>/g, '').trim()
    if (!text) continue
    const base = slugifyHeading(text) || 'section'
    const count = (seen.get(base) || 0) + 1
    seen.set(base, count)
    headings.push({
      id: count === 1 ? base : `${base}-${count}`,
      level: m[1].length,
      text
    })
  }

  return headings
}

async function searchCourse(state, course, query, limit = 30) {
  const q = String(query || '').trim().toLowerCase()
  if (!q || !course.chapters?.length) return []
  // Multi-term AND matching: every word of length >= 2 must appear somewhere in the line.
  const terms = q.split(/\s+/).filter((t) => t.length >= 2)
  if (!terms.length) return []
  const phrase = terms.length > 1 ? q : null // for proximity / phrase bonus

  const out = []
  for (const ch of course.chapters) {
    const content = await readKbFile(state, course, ch.file).catch(() => null)
    if (!content) continue
    const lines = content.split('\n')
    let currentHeading = null
    let inFence = false
    let inFrontmatter = false
    const headingSlugSeen = new Map()
    const perHeadingHits = new Map()      // slug -> number of body hits already emitted
    const emittedHeadingSlugs = new Set() // headings we've already emitted as their own result

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]
      const trimmed = raw.trim()

      // Frontmatter
      if (i === 0 && trimmed === '---') { inFrontmatter = true; continue }
      if (inFrontmatter) {
        if (trimmed === '---') inFrontmatter = false
        continue
      }
      // Code fences
      if (trimmed.startsWith('```')) { inFence = !inFence; continue }
      if (inFence) continue

      // Track headings (h2-h4) — also emit a result if the heading itself matches
      const hMatch = raw.match(/^(#{2,4})\s+(.+?)\s*$/)
      if (hMatch) {
        const text = stripMarkdownNoise(hMatch[2])
        const base = slugifyHeading(text) || 'section'
        const count = (headingSlugSeen.get(base) || 0) + 1
        headingSlugSeen.set(base, count)
        const slug = count === 1 ? base : `${base}-${count}`
        currentHeading = { text, slug, level: hMatch[1].length }
        const lc = text.toLowerCase()
        if (terms.every((t) => lc.includes(t))) {
          out.push({
            chapterId: ch.id,
            chapterName: ch.name,
            headingText: text,
            headingSlug: slug,
            snippet: text,
            line: i + 1,
            score: 100 + (phrase && lc.includes(phrase) ? 20 : 0) - currentHeading.level * 3
          })
          emittedHeadingSlugs.add(slug)
        }
        continue
      }

      if (!trimmed) continue
      // Skip pure callout opening lines like "> [!book] Title"
      if (/^>\s*\[!/.test(trimmed)) continue

      const lc = raw.toLowerCase()
      if (!terms.every((t) => lc.includes(t))) continue

      // Cap body matches per heading so one dense section can't dominate
      const hslug = currentHeading?.slug || `__${ch.id}_top`
      const seen = perHeadingHits.get(hslug) || 0
      if (seen >= 3) continue
      perHeadingHits.set(hslug, seen + 1)

      // Build a clean snippet around the first term match
      const cleaned = stripMarkdownNoise(raw)
        .replace(/^>\s*/, '')
        .replace(/^\s*[-*+]\s+/, '')
        .replace(/^\s*\d+\.\s+/, '')
        .trim()
      const lcClean = cleaned.toLowerCase()
      const idx0 = lcClean.indexOf(terms[0])
      const anchor = idx0 >= 0 ? idx0 : 0
      const start = Math.max(0, anchor - 40)
      const end = Math.min(cleaned.length, anchor + terms[0].length + 110)
      const prefix = start > 0 ? '…' : ''
      const suffix = end < cleaned.length ? '…' : ''
      const snippet = prefix + cleaned.slice(start, end).trim() + suffix

      // Scoring
      let score = 50
      if (phrase && lc.includes(phrase)) score += 18                  // phrase match
      // Proximity bonus when all terms cluster
      if (terms.length > 1) {
        const positions = terms.map((t) => lc.indexOf(t)).filter((p) => p >= 0)
        if (positions.length === terms.length) {
          const span = Math.max(...positions) - Math.min(...positions)
          if (span < 80) score += 8
          else if (span < 200) score += 3
        }
      }
      if (/^\s*[-*+]\s/.test(raw)) score += 3                         // bullet item: structured content
      if (/\*\*/.test(raw)) score += 2                                // bold-line bonus
      if (currentHeading?.level === 2) score += 2                     // top-level section preferred slightly

      out.push({
        chapterId: ch.id,
        chapterName: ch.name,
        headingText: currentHeading?.text || ch.name,
        headingSlug: currentHeading?.slug || '',
        snippet,
        line: i + 1,
        score
      })
      if (out.length >= limit * 3) break
    }
    if (out.length >= limit * 3) break
  }
  // Rank: score desc, then earlier chapters first, then earlier lines.
  out.sort((a, b) => b.score - a.score || a.chapterId.localeCompare(b.chapterId) || a.line - b.line)
  return out.slice(0, limit)
}

async function readKbFile(state, course, relPath) {
  const vaultRoot = getVaultRoot(state)
  const courseRoot = resolve(vaultRoot, course.knowledgeBase)
  const target = resolve(courseRoot, relPath)
  if (!pathInside(courseRoot, target)) return null
  if (!existsSync(target)) return null
  return readFile(target, 'utf8')
}

async function findSelfTestQuestions(state, course, chapter) {
  const candidates = ['10 Self Tests/10 Self Tests.md', '10 Self Tests/Self Tests.md', '12 Worked Drills/Mock Exam Full Walkthrough.md']
  for (const rel of candidates) {
    const content = await readKbFile(state, course, rel)
    if (!content) continue
    const sections = parseSelfTestSections(content)
    const matched = sections.filter((s) => sectionMatchesChapter(s.title, chapter))
    if (matched.length) {
      return matched.flatMap(pairQuestionsAnswers)
    }
  }
  return []
}

async function writeAttemptImages(imagesBase64) {
  if (!Array.isArray(imagesBase64) || !imagesBase64.length) return []
  await ensureDir('/tmp/exam-platform-images')
  const paths = []
  for (const data of imagesBase64) {
    const m = String(data).match(/^data:image\/(png|jpeg|jpg|webp|gif|heic);base64,(.+)$/i)
    if (!m) continue
    const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()
    const path = `/tmp/exam-platform-images/att-${randomUUID()}.${ext}`
    await writeFile(path, Buffer.from(m[2], 'base64'))
    paths.push(path)
  }
  return paths
}

/**
 * runCodex — historical name kept so call sites don't change. Dispatches to the
 * configured LLM provider (codex / claude / api).
 *
 * Options:
 *   schemaPath — JSON schema path for structured output (codex/claude use the
 *                CLI flag; api falls back to a prompt suffix).
 *   images     — paths to image files attached to the prompt (codex/claude support
 *                this via the -i flag; api would need base64 encoding — not
 *                implemented yet, will throw if provider=api and images present).
 */
async function runCodex(prompt, opts = {}) {
  switch (LLM_PROVIDER) {
    case 'codex':  return runCodexCli(prompt, opts)
    case 'claude': return runClaudeCli(prompt, opts)
    case 'api':    return runAnthropicApi(prompt, opts)
    default:
      throw new Error(`Unknown LLM_PROVIDER: ${LLM_PROVIDER} (expected codex|claude|api)`)
  }
}

async function runCodexCli(prompt, { schemaPath, images = [] } = {}) {
  await ensureDir('/tmp/exam-platform-codex')
  const id = randomUUID()
  const outFile = `/tmp/exam-platform-codex/out-${id}.txt`
  const args = ['exec', '--skip-git-repo-check', '-s', 'read-only', '-o', outFile, '--color', 'never']
  if (schemaPath) args.push('--output-schema', schemaPath)
  if (CODEX_MODEL) args.push('-m', CODEX_MODEL)
  for (const img of images) args.push('-i', img)
  args.push('-')
  return new Promise((res, rej) => {
    const child = spawn(CODEX_BIN, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    try { child.stdin.write(prompt); child.stdin.end() } catch {}
    let stderr = ''
    child.stderr.on('data', (d) => { stderr += d.toString() })
    child.on('error', rej)
    child.on('close', async (code) => {
      try {
        for (const img of images) {
          if (img.startsWith('/tmp/exam-platform-images/')) {
            try { await unlink(img) } catch {}
          }
        }
        if (code !== 0) {
          rej(new Error(`codex exited ${code}: ${stderr.slice(-500)}`))
          return
        }
        const text = existsSync(outFile) ? await readFile(outFile, 'utf8') : ''
        try { await unlink(outFile) } catch {}
        res(text.trim())
      } catch (e) {
        rej(e)
      }
    })
  })
}

async function runClaudeCli(prompt, { schemaPath, images = [] } = {}) {
  // Claude Code CLI: `claude --print [-p prompt]`. Reads stdin if no -p.
  // Schema enforcement isn't a first-class flag in claude CLI — we lean on the
  // prompt's "JSON only" instruction, same as the api provider.
  const args = ['--print']
  for (const img of images) args.push('--image', img)
  return new Promise((res, rej) => {
    const child = spawn(CLAUDE_BIN, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    try { child.stdin.write(prompt); child.stdin.end() } catch {}
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d.toString() })
    child.stderr.on('data', (d) => { stderr += d.toString() })
    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        rej(new Error(`claude CLI not found (CLAUDE_BIN=${CLAUDE_BIN}). Install Claude Code or switch provider to codex/api.`))
      } else rej(err)
    })
    child.on('close', async (code) => {
      for (const img of images) {
        if (img.startsWith('/tmp/exam-platform-images/')) {
          try { await unlink(img) } catch {}
        }
      }
      if (code !== 0) {
        rej(new Error(`claude exited ${code}: ${stderr.slice(-500)}`))
        return
      }
      res(stdout.trim())
    })
  })
}

async function runAnthropicApi(prompt, { schemaPath, images = [] } = {}) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set. Either set the env var, add anthropicApiKey to data/llm-config.json, or switch provider to codex/claude.')
  }
  if (images.length) {
    throw new Error('Image attachments are not yet supported with the api provider — use codex or claude for image input.')
  }
  // If a schema was supplied, append a "must return JSON conforming to this schema"
  // instruction. The prompt itself already asks for JSON in most call sites; this
  // is belt-and-braces.
  let userContent = prompt
  if (schemaPath) {
    try {
      const schema = await readFile(schemaPath, 'utf8')
      userContent += `\n\nIMPORTANT: Return strict JSON that conforms to this schema:\n${schema}`
    } catch {}
  }
  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: 16000,
    messages: [{ role: 'user', content: userContent }]
  }
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  })
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`Anthropic API ${resp.status}: ${errText.slice(0, 500)}`)
  }
  const data = await resp.json()
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim()
  if (!text) throw new Error(`Anthropic API returned no text content (stop_reason=${data.stop_reason})`)
  return text
}

async function loadOrGenerateQuestions(state, course, chapter) {
  const cachePath = resolve(cacheDir, 'questions', `${course.id}-${chapter.id}.json`)
  if (existsSync(cachePath)) {
    try {
      const cached = JSON.parse(await readFile(cachePath, 'utf8'))
      if (cached.questions && cached.questions.length) return cached
      // empty cache from a previous failed run — fall through and regenerate
    } catch {}
  }

  const fromSelfTest = await findSelfTestQuestions(state, course, chapter)

  const chapterContent = await readKbFile(state, course, chapter.file).catch(() => null)
  let generated = []
  let genError = null
  if (chapterContent) {
    try {
      generated = await generateQuestions(course, chapter, chapterContent, fromSelfTest.length)
    } catch (e) {
      genError = e.message
      console.error('Generation failed:', e.message)
    }
  } else {
    genError = `Chapter content not readable (${chapter.file})`
  }

  const questions = [...fromSelfTest, ...generated]
  if (!questions.length) {
    const detail = genError ? `Codex generation failed: ${genError}` : 'No self-test questions matched this chapter and codex returned nothing.'
    throw new Error(detail)
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    chapterId: chapter.id,
    questions,
    generationError: genError // surfaced if some questions still made it via self-test
  }
  await ensureDir(dirname(cachePath))
  await writeFile(cachePath, JSON.stringify(payload, null, 2), 'utf8')
  return payload
}

async function generateQuestions(course, chapter, content, alreadyHave) {
  const target = 16
  const want = Math.max(8, target - Math.min(alreadyHave, 6))
  const types = ['written', 'calc', 'tf', 'mc', 'pseudocode']
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      questions: {
        type: 'array',
        minItems: 8,
        maxItems: 24,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: types },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
            expected: { type: 'string' }
          },
          required: ['type', 'difficulty', 'question', 'options', 'expected']
        }
      }
    },
    required: ['questions']
  }
  await ensureDir(cacheDir)
  const schemaPath = resolve(cacheDir, 'schemas', `questions.schema.json`)
  await ensureDir(dirname(schemaPath))
  await writeFile(schemaPath, JSON.stringify(schema, null, 2), 'utf8')

  const truncated = content.length > 7000 ? content.slice(0, 7000) + '\n…(truncated)' : content

  const examProfileBlock = course.examProfile
    ? `=== EXAM PROFILE — this OVERRIDES the default five-type mix and difficulty guidance below; follow it ===\n${course.examProfile}\n`
    : ''

  const prompt = [
    `You are creating exam-prep questions for ${course.code} — ${course.name}, chapter "${chapter.name}".`,
    ``,
    MATH_FORMATTING_RULE,
    ``,
    examProfileBlock,
    `Generate exactly ${want} questions covering the chapter.${course.examProfile ? ' Follow the EXAM PROFILE above for type mix and difficulty.' : ' **You MUST include all five types**, with this minimum mix:'}`,
    course.examProfile ? '' : `- written: at least 3 (short-answer prose, exam-style)`,
    course.examProfile ? '' : `- calc: at least 3 (concrete numeric or formula application; "expected" must include the worked numeric answer and 1-2 line method)`,
    course.examProfile ? '' : `- mc: at least 3 (best-option; "options" array with 4 plausible choices; "expected" is the exact text of the correct option)`,
    course.examProfile ? '' : `- tf: at least 2 (true/false; "expected" starts with "True." or "False." followed by 1-2 sentence reason)`,
    course.examProfile ? '' : `- pseudocode: at least 2 (ask for an algorithm sketch; "expected" contains a fenced \\\`\\\`\\\` block of reference pseudocode)`,
    ``,
    `Type definitions (use whichever the EXAM PROFILE / mix calls for): mc = best-option with a 3–5 entry "options" array; tf = true/false; written = short-answer prose; calc = numeric/formula application; pseudocode = the student writes code/assembly (for an assembly course, "expected" holds a fenced \\\`\\\`\\\`arm block).`,
    `Quality bar:`,
    `- Most questions should be medium or hard difficulty — exam-prep, not warm-up.`,
    `- Cover **different sections** of the chapter; do not cluster on one topic.`,
    `- For calc: give specific numbers. The student should be able to verify by computing.`,
    `- For mc: distractors must be plausible misconceptions, not nonsense.`,
    `- For pseudocode: real working pseudocode with named variables, not pseudo-pseudocode.`,
    `- "expected" must be detailed enough to grade a student's attempt against — not just a hint.`,
    `- For non-mc questions set "options" to an empty array []. For mc questions provide exactly 3–5 options.`,
    `- "difficulty" is required on every question (easy/medium/hard).`,
    ``,
    `Output: strict JSON matching the provided schema. JSON only — no markdown, no preamble.`,
    ``,
    `Chapter content:`,
    ``,
    truncated
  ].join('\n')

  const out = await runCodex(prompt, { schemaPath })
  const jsonStart = out.indexOf('{')
  const jsonEnd = out.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd < 0) throw new Error('No JSON object in codex output')
  const parsed = JSON.parse(out.slice(jsonStart, jsonEnd + 1))
  return (parsed.questions || []).map((q, i) => ({
    id: `gen-${chapter.id}-${i}`,
    source: 'Generated',
    type: q.type,
    difficulty: q.difficulty || 'medium',
    question: postWrapMath(q.question),
    options: Array.isArray(q.options) ? q.options.map((o) => postWrapMath(o)) : q.options,
    expected: postWrapMath(q.expected)
  }))
}

async function loadCourseContext(state, course, currentChapter, limit = 180000) {
  const vaultRoot = getVaultRoot(state)
  const courseRoot = resolve(vaultRoot, course.knowledgeBase)
  const pieces = []
  let used = 0
  // current chapter first (full content)
  if (currentChapter) {
    const content = await readKbFile(state, course, currentChapter.file).catch(() => null)
    if (content) {
      const block = `### CURRENT CHAPTER (${currentChapter.id} ${currentChapter.name})\n\n${content}\n`
      pieces.push(block)
      used += block.length
      // optional examples.md
      const chapterDir = dirname(resolve(courseRoot, currentChapter.file))
      const examplesPath = resolve(chapterDir, 'examples.md')
      if (existsSync(examplesPath)) {
        const examples = await readFile(examplesPath, 'utf8').catch(() => null)
        if (examples) {
          const block2 = `### CURRENT CHAPTER EXAMPLES\n\n${examples}\n`
          pieces.push(block2)
          used += block2.length
        }
      }
    }
  }
  // other chapters (truncated)
  for (const ch of (course.chapters || [])) {
    if (currentChapter && ch.id === currentChapter.id) continue
    if (used >= limit) break
    const remain = limit - used
    const content = await readKbFile(state, course, ch.file).catch(() => null)
    if (!content) continue
    const trimmed = content.length > Math.min(remain, 8000) ? content.slice(0, Math.min(remain, 8000)) + '\n…(truncated)\n' : content
    const block = `### CHAPTER ${ch.id} — ${ch.name}\n\n${trimmed}\n`
    pieces.push(block)
    used += block.length
  }
  return pieces.join('\n\n')
}

// ----- Practice Exam -----

const practiceExamDir = resolve(__dirname, 'data/cache/practice-exam')

/**
 * Normalised list of mock-exam papers for a course. New format:
 *   course.mockExams = [{ id, label, pdf, solutionsPdf? }]
 * Legacy format (single exam) is migrated on the fly:
 *   course.mockExamPdf + course.mockExamSolutionsPdf
 */
function getMockExams(course) {
  if (Array.isArray(course?.mockExams) && course.mockExams.length) return course.mockExams
  if (course?.mockExamPdf) {
    return [{
      id: 'default',
      label: 'Mock exam',
      pdf: course.mockExamPdf,
      ...(course.mockExamSolutionsPdf ? { solutionsPdf: course.mockExamSolutionsPdf } : {})
    }]
  }
  return []
}

/** Resolve a single exam by id; falls back to the first exam if id is missing/unknown. */
function getMockExam(course, examId) {
  const exams = getMockExams(course)
  if (!exams.length) return null
  if (!examId) return exams[0]
  return exams.find((e) => e.id === examId) || exams[0]
}

/** Cache key used for per-paper caches: practice-exam parse output, guidance, etc. */
function examCacheKey(courseId, examId) {
  return `${courseId}__${examId || 'default'}`
}

function decodeBasicXmlEntities(s) {
  return String(s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripXmlTextBlock(s) {
  return decodeBasicXmlEntities(String(s || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

async function courseRootFor(state, course) {
  const vaultRoot = getVaultRoot(state)
  const courseRoot = resolve(vaultRoot, course.knowledgeBase)
  if (!pathInside(vaultRoot, courseRoot)) throw new Error('Knowledge base path escapes vault')
  return courseRoot
}

/**
 * Server-side per-page text extraction from a PDF, using pdftotext (poppler).
 * Used by the background generate-all job so practice-exam parsing doesn't
 * require a browser tab open. Returns [{ page, text }, …].
 *
 * Falls back to an empty array if pdftotext is missing or fails — caller can
 * decide to skip the parse step rather than break the whole batch.
 */
async function extractPdfPageText(pdfPath) {
  if (!existsSync(pdfPath)) return []
  // pdftotext -layout preserves spacing closer to the visual layout, which our
  // existing prompts (built for PDF.js output) expect.
  let allText = ''
  try {
    const { stdout } = await execFileAsync('pdftotext', ['-layout', '-enc', 'UTF-8', pdfPath, '-'], {
      maxBuffer: 32 * 1024 * 1024
    })
    allText = stdout
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('pdftotext not found — install poppler (brew install poppler) to enable background exam parsing')
    }
    throw err
  }
  // pdftotext separates pages with form-feed (\f). Split + emit per-page records.
  const pages = allText.split('\f')
  // Trailing form-feed gives an empty last entry — drop it
  if (pages.length && pages[pages.length - 1].trim() === '') pages.pop()
  return pages.map((text, idx) => ({
    page: idx + 1,
    text: text.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trimEnd()).join('\n').trim()
  }))
}

async function extractBoldOptionKeys(state, course, examId) {
  const exam = getMockExam(course, examId)
  if (!exam?.solutionsPdf) return {}
  const courseRoot = await courseRootFor(state, course)
  const pdfPath = resolve(courseRoot, exam.solutionsPdf)
  if (!pathInside(courseRoot, pdfPath) || !existsSync(pdfPath)) return {}

  let xml = ''
  try {
    const result = await execFileAsync('pdftohtml', ['-xml', '-i', '-stdout', pdfPath], {
      maxBuffer: 20 * 1024 * 1024
    })
    xml = result.stdout || ''
  } catch {
    return {}
  }

  const out = {}
  let currentQuestion = null
  const textRe = /<text\b[^>]*>([\s\S]*?)<\/text>/g
  for (const match of xml.matchAll(textRe)) {
    const raw = match[1] || ''
    const text = stripXmlTextBlock(raw)
    if (!text) continue

    const qMatch = text.match(/^(\d+)\.\s+/)
    if (qMatch) currentQuestion = `q${qMatch[1]}`

    const optionMatch = text.match(/^([a-f])\)\s*(.+)$/i)
    const isBold = /<b\b[^>]*>/i.test(raw)
    if (!currentQuestion || !optionMatch || !isBold) continue

    const key = currentQuestion
    out[key] = out[key] || []
    const letter = optionMatch[1].toLowerCase()
    if (!out[key].some((item) => item.letter === letter)) {
      out[key].push({ letter, text: optionMatch[2].trim() })
    }
  }
  return out
}

function questionNumberKey(q) {
  const src = `${q?.id || ''} ${q?.label || ''}`.trim()
  const match = src.match(/q\s*0*(\d+)/i) || src.match(/\b0*(\d+)\b/)
  return match ? `q${Number(match[1])}` : ''
}

function optionLetterForIndex(index) {
  return String.fromCharCode('a'.charCodeAt(0) + index)
}

function normalizePracticeQuestion(q, boldOptionKeys = {}) {
  let changed = false
  const next = { ...q }
  const key = questionNumberKey(next)
  const boldKeys = boldOptionKeys[key] || []

  if (!Number(next.marks) || Number(next.marks) <= 0) {
    next.marks = 1
    changed = true
  }

  if (boldKeys.length && Array.isArray(next.options) && next.options.length) {
    const wantedType = boldKeys.length > 1 ? 'multi' : 'mc'
    if (next.type !== wantedType) {
      next.type = wantedType
      changed = true
    }
    const lines = boldKeys.map(({ letter, text }) => {
      const idx = letter.charCodeAt(0) - 'a'.charCodeAt(0)
      const optionText = next.options[idx] || text
      return `- ${letter}) ${optionText}`
    })
    const modelAnswer = `Correct option(s):\n${lines.join('\n')}`
    if ((next.modelAnswer || '').trim() !== modelAnswer.trim()) {
      next.modelAnswer = modelAnswer
      changed = true
    }
  }

  return { question: next, changed }
}

async function normalizePracticeExamPayload(state, course, payload, examId) {
  if (!payload?.questions?.length) return { payload, changed: false }
  const boldOptionKeys = await extractBoldOptionKeys(state, course, examId)
  let changed = false
  const questions = payload.questions.map((q) => {
    const normalized = normalizePracticeQuestion(q, boldOptionKeys)
    changed = changed || normalized.changed
    return normalized.question
  })
  return { payload: { ...payload, questions }, changed }
}

async function loadPracticeExamPayload(courseId, examId, { writeBack = true } = {}) {
  const cachePath = resolve(practiceExamDir, `${examCacheKey(courseId, examId)}.json`)
  if (!existsSync(cachePath)) return null
  const state = await readState()
  const course = state.courses.find((c) => c.id === courseId)
  if (!course) throw new Error('Unknown course')
  const cached = JSON.parse(await readFile(cachePath, 'utf8'))
  const normalized = await normalizePracticeExamPayload(state, course, cached, examId)
  if (writeBack && normalized.changed) {
    await ensureDir(practiceExamDir)
    await writeFile(cachePath, JSON.stringify(normalized.payload, null, 2), 'utf8')
  }
  return normalized.payload
}

async function parseExamPaper(courseId, examId, questionPages, solutionsPages) {
  const cachePath = resolve(practiceExamDir, `${examCacheKey(courseId, examId)}.json`)
  if (existsSync(cachePath)) {
    try {
      const cached = await loadPracticeExamPayload(courseId, examId)
      if (cached?.questions?.length) return cached
    } catch {}
  }

  const state = await readState()
  const course = state.courses.find((c) => c.id === courseId)
  if (!course) throw new Error('Unknown course')

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      questions: {
        type: 'array',
        minItems: 1,
        maxItems: 60,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            marks: { type: 'number' },
            sharedContext: { type: 'string' },
            text: { type: 'string' },
            modelAnswer: { type: 'string' },
            page: { type: 'integer', minimum: 1 },
            type: { type: 'string', enum: ['written', 'mc', 'multi', 'tf', 'calc', 'pseudocode'] },
            options: { type: 'array', items: { type: 'string' } }
          },
          required: ['id', 'label', 'marks', 'sharedContext', 'text', 'modelAnswer', 'page', 'type', 'options']
        }
      }
    },
    required: ['questions']
  }
  await ensureDir(cacheDir)
  const schemaPath = resolve(cacheDir, 'schemas', 'practice-exam.schema.json')
  await ensureDir(dirname(schemaPath))
  await writeFile(schemaPath, JSON.stringify(schema, null, 2), 'utf8')

  // Preserve line breaks: collapse whitespace within lines, but keep newlines.
  const cleanPage = (s) => (s || '').split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trimEnd()).join('\n').trim()
  const questionsBlob = questionPages.map((p) => `=== Q-PAGE ${p.page} ===\n${cleanPage(p.text)}`).join('\n\n')
  const solutionsBlob = (solutionsPages || []).length
    ? '\n\n=== SOLUTIONS PDF ===\n' + solutionsPages.map((p) => `=== S-PAGE ${p.page} ===\n${cleanPage(p.text)}`).join('\n\n')
    : '\n\n(No solutions/model-answers PDF provided — fill modelAnswer using your knowledge of ' + course.code + ' best practice.)'

  const prompt = [
    `You are parsing a past/mock exam paper for ${course.code} — ${course.name} into individual gradable questions.`,
    ``,
    `CRITICAL VERBATIM RULE:`,
    `- Copy each question's wording from the PDF **VERBATIM**. Do not paraphrase. Do not summarise. Do not "clean up".`,
    `- A student should be able to read your "text" and "sharedContext" and see what's on the actual exam, word for word.`,
    ``,
    `FORMATTING RULES (output markdown):`,
    `- Preserve bullet points using "- " syntax.`,
    `- Preserve numbered lists using "1. " syntax.`,
    `- Preserve line breaks: separate paragraphs with a blank line.`,
    `- For inline mathematical formulas, use LaTeX inline math: \`$ ... $\` (e.g. \`$T(n) = 6T(n/2) + n$\`, \`$\\Theta(n \\log n)$\`, \`$d_1 \\leq d_2 \\leq \\ldots \\leq d_n$\`).`,
    `- For display formulas / set notations / aligned equations, use \`$$ ... $$\`.`,
    `- For pseudocode and code, use fenced code blocks (\\\`\\\`\\\`).`,
    `- For tables, use markdown tables.`,
    `- Preserve subscripts, superscripts, Greek letters as proper LaTeX.`,
    ``,
    `STRUCTURE RULES:`,
    `- Emit one entry per LEAF question (Q1(a), Q1(b), Q2, Q3(c)(i), …). Do not emit a parent "Q1" if it has sub-parts; emit each part separately.`,
    `- "id" is a short slug like "q1a", "q2", "q3bii". Unique per paper.`,
    `- "label" is the human form like "Q1(a)" or "Q4(b)(ii)".`,
    `- "marks" is the marks for that leaf question (integer).`,
    `- "sharedContext" is the PARENT question's setup (scenario / problem statement) that is shared across all sub-parts. Copy it VERBATIM. If a question has multiple parts, the same sharedContext should be repeated identically in each part. If a question has no sub-parts and the entire setup IS the question, leave sharedContext as an empty string and put everything in "text".`,
    `- "text" is the SPECIFIC subtask for this leaf part, VERBATIM. For "Q1(a) Write a greedy algorithm in pseudocode and a brief description of the main idea." the text is "(a) Write a greedy algorithm in pseudocode and a brief description of the main idea." — do not include the parent scenario here; that goes in sharedContext.`,
    `- "modelAnswer" is the ideal full-marks answer for this leaf part. Draw from the SOLUTIONS PDF if provided. Preserve original formatting (pseudocode in fenced code blocks, math in LaTeX, bullets where the model answer uses them). Do NOT summarise.`,
    `- "page" is the page number where this question begins.`,
    `- "type" is the question type: "mc" for single-choice / best-option questions where exactly one option is correct, "multi" for multiple-choice questions where more than one option can be correct, "tf" for true/false (binary choice), "calc" for explicit numeric/formula computation, "pseudocode" for asking the student to write code/pseudocode, "written" for everything else (short-answer prose, essay, explain-the-concept).`,
    `- If the stem or paper marker says "(SC)" or "Single Choice", type MUST be "mc". If it says "(MC)" or "Multiple Choice", type MUST be "multi" unless the wording explicitly says choose ONE.`,
    `- "options" — for "mc" and "multi" types, list the option texts in order (without the "a)"/"b)" prefix; just the option content). For "tf", use ["True", "False"]. For all other types, use an empty array [].`,
    `- When you detect an option question, REMOVE the "a) ... b) ... c) ..." enumeration from the "text" field (and any "(MC)" / "(SC)" marker) and put each option into the "options" array instead. The "text" should contain only the question stem.`,
    ``,
    `SOLUTION-PDF RULE FOR MC/SC ANSWERS:`,
    `- In the solutions PDF, correct option lines are indicated by bold text. Treat the bolded option line(s) as the authoritative correct answer.`,
    `- For "(SC)" / single-choice questions, exactly one bolded option line is correct. Put that option text in "modelAnswer" and include its letter if visible, e.g. "b) Monoalphabetic".`,
    `- For "(MC)" / multi-select questions, one OR MORE bolded option lines may be correct. Put ALL bolded correct option lines in "modelAnswer" as a bullet list or semicolon-separated list. Do not invent unbolded options as correct.`,
    `- If the PDF text extraction loses bold styling and you cannot identify bold option lines, use the explicit solution key if present. If neither is available, infer cautiously and say "Correct option(s): ..." in modelAnswer.`,
    `- Skip front matter, course-level instructions, formula sheets.`,
    ``,
    `Return strict JSON conforming to the schema. JSON only — no preamble.`,
    ``,
    `=== QUESTION PAPER ===`,
    questionsBlob,
    solutionsBlob
  ].join('\n')

  const out = await runCodex(prompt, { schemaPath })
  const start = out.indexOf('{')
  const end = out.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('No JSON in codex output')
  const parsed = JSON.parse(out.slice(start, end + 1))
  if (!parsed.questions?.length) throw new Error('Codex returned empty question list')
  const normalized = await normalizePracticeExamPayload(state, course, { generatedAt: new Date().toISOString(), courseId, examId: examId || 'default', questions: parsed.questions }, examId)
  const payload = normalized.payload
  await ensureDir(practiceExamDir)
  await writeFile(cachePath, JSON.stringify(payload, null, 2), 'utf8')
  return payload
}

async function practiceQuestion(courseId, examId, questionId) {
  const data = await loadPracticeExamPayload(courseId, examId)
  if (!data) return null
  return data.questions.find((q) => q.id === questionId)
}

async function generateGuidance(courseId, examId, questionId) {
  const guidanceCache = resolve(practiceExamDir, `${examCacheKey(courseId, examId)}.guidance.json`)
  let bucket = {}
  if (existsSync(guidanceCache)) {
    try { bucket = JSON.parse(await readFile(guidanceCache, 'utf8')) } catch {}
  }
  if (bucket[questionId]) return bucket[questionId]

  const state = await readState()
  const course = state.courses.find((c) => c.id === courseId)
  const q = await practiceQuestion(courseId, examId, questionId)
  if (!q) throw new Error('Unknown question')

  const prompt = [
    `You are a tutor for ${course.code} — ${course.name}.`,
    `A student is about to attempt this exam question:`,
    ``,
    `${q.label} (${q.marks} marks)`,
    q.text,
    ``,
    MATH_FORMATTING_RULE,
    ``,
    `Give them GUIDANCE — not the answer. Cover, in 4-6 short bullet points:`,
    `- What topic / answer template this question fits.`,
    `- What a top-marks answer must structurally include.`,
    `- Common pitfalls and what NOT to do.`,
    `- A concrete strategy hint (without giving away the solution).`,
    ``,
    `Markdown bullets. Do not reveal the answer. Be direct, exam-week tone.`
  ].join('\n')
  const guidance = await runCodex(prompt)
  bucket[questionId] = guidance
  await ensureDir(practiceExamDir)
  await writeFile(guidanceCache, JSON.stringify(bucket, null, 2), 'utf8')
  return guidance
}

function correctOptionLetters(q) {
  const text = String(q?.modelAnswer || '')
  const letters = Array.from(text.matchAll(/(?:^|[\n\s;-])([a-f])\)\s+/gi)).map((m) => m[1].toLowerCase())
  if (letters.length) return [...new Set(letters)]
  const options = Array.isArray(q?.options) ? q.options : []
  return options
    .map((opt, idx) => ({ letter: optionLetterForIndex(idx), opt }))
    .filter(({ opt }) => opt && text.includes(opt))
    .map(({ letter }) => letter)
}

function selectedOptionLetters(q, attempt) {
  const selected = String(attempt || '').split('\n').map((x) => x.trim()).filter(Boolean)
  const options = Array.isArray(q?.options) ? q.options : []
  if (!selected.length || !options.length) return []
  return selected.map((choice) => {
    const letterMatch = choice.match(/^([a-f])\)/i)
    if (letterMatch) return letterMatch[1].toLowerCase()
    const idx = options.findIndex((opt) => opt === choice)
    return idx >= 0 ? optionLetterForIndex(idx) : ''
  }).filter(Boolean)
}

function optionLine(q, letter) {
  const idx = letter.charCodeAt(0) - 'a'.charCodeAt(0)
  const opt = Array.isArray(q?.options) ? q.options[idx] : ''
  return opt ? `${letter}) ${opt}` : `${letter})`
}

function gradeOptionPracticeAttempt(q, attempt) {
  if (!['mc', 'multi', 'tf'].includes(q?.type) || !Array.isArray(q.options) || !q.options.length) return null
  const correct = new Set(correctOptionLetters(q))
  if (!correct.size) return null

  const selected = new Set(selectedOptionLetters(q, attempt))
  const marks = Number(q.marks) > 0 ? Number(q.marks) : 1
  const selectedCorrect = [...selected].filter((letter) => correct.has(letter))
  const selectedWrong = [...selected].filter((letter) => !correct.has(letter))
  const missed = [...correct].filter((letter) => !selected.has(letter))
  const exact = selectedWrong.length === 0 && missed.length === 0
  const score = exact ? marks : Math.max(0, (selectedCorrect.length - selectedWrong.length) / correct.size) * marks
  const prettyScore = Number.isInteger(score) ? String(score) : String(Math.round(score * 100) / 100)
  const prettyMarks = Number.isInteger(marks) ? String(marks) : String(marks)

  const right = selectedCorrect.length
    ? selectedCorrect.map((letter) => `- Correctly selected ${optionLine(q, letter)}.`)
    : ['- No correct option was selected.']
  const wrong = [
    ...selectedWrong.map((letter) => `- Selected ${optionLine(q, letter)}, but it is not in the official solution.`),
    ...missed.map((letter) => `- Missed ${optionLine(q, letter)}.`)
  ]

  return [
    `**Score:** ${prettyScore}/${prettyMarks}`,
    ``,
    `**What you got right**`,
    right.join('\n'),
    ``,
    `**Missing / wrong**`,
    wrong.length ? wrong.join('\n') : `- Nothing major.`,
    ``,
    `**How to improve**`,
    exact
      ? `- Keep using the solution-key logic: select exactly the official option set.`
      : `- For multi-select questions, select every official correct option and avoid adding unbolded distractors.`,
    ``,
    `**Model answer**`,
    [...correct].map((letter) => `- ${optionLine(q, letter)}`).join('\n')
  ].join('\n')
}

async function gradePracticeAttempt(courseId, examId, questionId, attempt, attemptImages) {
  const state = await readState()
  const course = state.courses.find((c) => c.id === courseId)
  const q = await practiceQuestion(courseId, examId, questionId)
  if (!q) throw new Error('Unknown question')
  const optionCorrection = gradeOptionPracticeAttempt(q, attempt)
  if (optionCorrection) return optionCorrection

  const imagePaths = await writeAttemptImages(attemptImages)
  const imageBlurb = imagePaths.length ? `\n[${imagePaths.length} image attachment${imagePaths.length === 1 ? '' : 's'} attached — examine carefully. The student's answer is in the image; treat the typed text as supplementary unless the image is unreadable.]` : ''

  const prompt = [
    `You are an exam grader for ${course.code} — ${course.name}.`,
    ``,
    MATH_FORMATTING_RULE,
    ``,
    `GRADING POLICY — focus on SUBSTANTIVE CORRECTNESS only:`,
    `- Award marks for: correct concepts, accurate application, named relationships, valid frameworks, correct logical structure.`,
    `- Deduct for: missing required elements, wrong concept/acronym names, factual errors, missing connections asked for in the question.`,
    `- IGNORE COMPLETELY: spelling mistakes, typos, minor wording differences from the model answer, grammar errors, capitalisation, stylistic phrasing, informal language. The student is fast-typing on a study tool — do not nitpick prose.`,
    `- DO flag only: misspelled critical acronyms when the misspelling changes meaning (e.g. "CRM" written as "CMR", "BIA" as "BIP", "TPS" as "TSP"). Otherwise spelling is irrelevant.`,
    `- Tips must address SUBSTANCE (missing concepts, weak connections, structural issues). NEVER write a Tip about wording, spelling, grammar, or style. If there is no substantive improvement to suggest, omit Tips or write "Tips: (none — answer is substantively solid)".`,
    ``,
    `QUESTION (${q.label}, ${q.marks} marks):`,
    q.text,
    ``,
    `MODEL ANSWER (ideal full-marks response):`,
    q.modelAnswer,
    ``,
    `STUDENT ATTEMPT:`,
    (attempt || '(no typed answer)') + imageBlurb,
    ``,
    `Grade the attempt against the model answer. Return clean, study-useful markdown with exactly these sections:`,
    `**Score:** X/${q.marks}`,
    ``,
    `**What you got right**`,
    `- 1–3 concrete substantive strengths.`,
    ``,
    `**Missing / wrong**`,
    `- Bullet each missing concept, incorrect step, or weak connection. Write "Nothing major." if the answer is substantively complete.`,
    ``,
    `**How to improve**`,
    `- 1–3 exam-actionable bullets: what to add, what structure to use, or what calculation step to show.`,
    ``,
    `**Model answer**`,
    `A compact full-marks answer the student could have written. Use 3–6 sentences or bullets, and include the critical terms/formulas.`,
    ``,
    `Be specific and direct. Do not lecture. Avoid dense paragraphs. Aim for 120–220 words unless the answer is trivially correct.`
  ].join('\n')
  return runCodex(prompt, { images: imagePaths })
}

async function generateAdditionalQuestions(course, chapter, content, existingQuestions, requestedTypes, count, customPrompt = '') {
  const types = ['written', 'calc', 'tf', 'mc', 'pseudocode']
  const allowed = requestedTypes.filter((t) => types.includes(t))
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      questions: {
        type: 'array',
        minItems: 1,
        maxItems: 30,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: allowed.length ? allowed : types },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
            expected: { type: 'string' }
          },
          required: ['type', 'difficulty', 'question', 'options', 'expected']
        }
      }
    },
    required: ['questions']
  }
  await ensureDir(cacheDir)
  const schemaPath = resolve(cacheDir, 'schemas', `questions.schema.json`)
  await ensureDir(dirname(schemaPath))
  await writeFile(schemaPath, JSON.stringify(schema, null, 2), 'utf8')

  const truncated = content.length > 7000 ? content.slice(0, 7000) + '\n…(truncated)' : content

  const existingSummary = existingQuestions.length
    ? `EXISTING QUESTIONS (${existingQuestions.length}, do NOT repeat — produce different ones):\n` +
      existingQuestions.slice(-12).map((q, i) => `- [${q.type}${q.difficulty ? '/' + q.difficulty : ''}] ${q.question.replace(/\s+/g, ' ').slice(0, 120)}${q.question.length > 120 ? '…' : ''}`).join('\n')
    : ''

  const typeRules = allowed.length === 0 || allowed.length === types.length
    ? `Mix all five types: written (short-answer prose), calc (numeric/formula application), tf (true/false with reason), mc (best option with 4 plausible options), pseudocode (fenced algorithm sketch).`
    : `Generate ONLY these question types: ${allowed.join(', ')}. Distribute the ${count} questions across these types roughly evenly.`

  const customGuidanceBlock = customPrompt
    ? [
        `=== USER STEERING (HIGH PRIORITY — overrides defaults where applicable) ===`,
        customPrompt,
        `=== END USER STEERING ===`,
      ].join('\n')
    : ''

  const examProfileBlock = course.examProfile
    ? `=== EXAM PROFILE — AUTHORITATIVE for difficulty + style (the explicit type filter above, if any, still wins on which types) ===\n${course.examProfile}\n`
    : ''

  const prompt = [
    `You are extending an exam-prep question bank for ${course.code} — ${course.name}, chapter "${chapter.name}".`,
    ``,
    MATH_FORMATTING_RULE,
    ``,
    examProfileBlock,
    `Generate exactly ${count} new questions.`,
    typeRules,
    ``,
    `Quality bar:`,
    `- Medium / hard difficulty. Exam-prep, not warm-up.`,
    `- Cover sections of the chapter NOT well covered by existing questions.`,
    `- For calc: concrete numbers, worked answer in "expected".`,
    `- For mc: 4 plausible distractors, exact correct text in "expected".`,
    `- For tf: "expected" starts "True." or "False." with 1-2 sentence reason.`,
    `- For pseudocode: fenced code block in "expected".`,
    `- For non-mc types: set "options" to [].`,
    `- "expected" must be detailed enough to grade against.`,
    ``,
    customGuidanceBlock,
    ``,
    existingSummary,
    ``,
    `Output: strict JSON conforming to the schema. JSON only.`,
    ``,
    `Chapter content:`,
    ``,
    truncated
  ].filter(Boolean).join('\n')

  const out = await runCodex(prompt, { schemaPath })
  const start = out.indexOf('{')
  const end = out.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('No JSON object in codex output')
  const parsed = JSON.parse(out.slice(start, end + 1))
  return (parsed.questions || []).map((q) => ({
    source: 'Generated',
    type: q.type,
    difficulty: q.difficulty || 'medium',
    question: postWrapMath(q.question),
    options: Array.isArray(q.options) ? q.options.map((o) => postWrapMath(o)) : q.options,
    expected: postWrapMath(q.expected)
  }))
}

// ----- Mock Questions (course-wide self-test) -----

const mockQuestionsDir = resolve(__dirname, 'data/cache/mock-questions')

async function generateMockQuestions(courseId) {
  const state = await readState()
  const course = state.courses.find((c) => c.id === courseId)
  if (!course) throw new Error('Unknown course')
  if (!course.chapters?.length) throw new Error('Course has no chapters')

  // Optional: parsed exam paper from any of the course's mock-exam caches,
  // used for style/type/depth hints. Reads the first cached exam found.
  let examPaper = null
  for (const exam of getMockExams(course)) {
    const examPath = resolve(practiceExamDir, `${examCacheKey(courseId, exam.id)}.json`)
    if (!existsSync(examPath)) continue
    try {
      const data = JSON.parse(await readFile(examPath, 'utf8'))
      if (data?.questions?.length) { examPaper = data; break }
    } catch {}
  }
  // Legacy single-exam cache (pre-migration)
  if (!examPaper) {
    const legacyPath = resolve(practiceExamDir, `${courseId}.json`)
    if (existsSync(legacyPath)) {
      try {
        const data = JSON.parse(await readFile(legacyPath, 'utf8'))
        if (data?.questions?.length) examPaper = data
      } catch {}
    }
  }

  // Build per-chapter content blocks with a per-chapter cap
  const perChapterCap = 7000
  const chapterBlocks = []
  for (const ch of course.chapters) {
    const content = await readKbFile(state, course, ch.file).catch(() => null)
    if (!content) continue
    const trimmed = content.length > perChapterCap ? content.slice(0, perChapterCap) + '\n…(truncated)' : content
    chapterBlocks.push(`### CHAPTER ${ch.id} — ${ch.name} (chapterId: "${ch.id}")\n\n${trimmed}`)
  }
  if (!chapterBlocks.length) throw new Error('No readable chapter content for this course')

  const chapterRoster = course.chapters.map((c) => `- chapterId: "${c.id}" — ${c.name}`).join('\n')

  const examBlob = examPaper
    ? `=== MOCK EXAM PAPER (for STYLE / TYPE / DEPTH analysis only — do NOT copy verbatim) ===\n` +
      examPaper.questions.map((q) => {
        const stem = (q.sharedContext ? q.sharedContext + ' ' : '') + (q.text || '')
        const model = (q.modelAnswer || '').slice(0, 700)
        return `[${q.label} · ${q.marks || '?'} marks] ${stem.slice(0, 600)}\n  MODEL ANSWER (depth ref): ${model}`
      }).join('\n\n')
    : '=== NO PARSED EXAM PAPER ===\n(No exam paper available — infer appropriate question types and depth from the course material itself. Default to written/short-answer + true/false + best-option, avoid heavy calculation/pseudocode unless the course content clearly involves it.)'

  const types = ['written', 'calc', 'tf', 'mc', 'pseudocode']
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      examTypeMix: { type: 'string' },
      questions: {
        type: 'array',
        minItems: 20,
        maxItems: 120,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            chapterId: { type: 'string' },
            chapterName: { type: 'string' },
            topic: { type: 'string' },
            type: { type: 'string', enum: types },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
            expected: { type: 'string' }
          },
          required: ['chapterId', 'chapterName', 'topic', 'type', 'difficulty', 'question', 'options', 'expected']
        }
      }
    },
    required: ['examTypeMix', 'questions']
  }
  await ensureDir(cacheDir)
  const schemaPath = resolve(cacheDir, 'schemas', 'mock-questions.schema.json')
  await ensureDir(dirname(schemaPath))
  await writeFile(schemaPath, JSON.stringify(schema, null, 2), 'utf8')

  const examProfileBlock = course.examProfile
    ? `=== EXAM PROFILE — AUTHORITATIVE: this overrides the exam-paper type inference in STEP 1 ===\n${course.examProfile}\n`
    : ''

  const prompt = [
    `You are generating exam-prep questions for the ENTIRE ${course.code} — ${course.name} course.`,
    `The purpose is course-wide self-test with multiple questions per topic and full chapter coverage.`,
    ``,
    MATH_FORMATTING_RULE,
    ``,
    examProfileBlock,
    course.examProfile
      ? `=== STEP 1: TYPE MIX ===\nUse the EXAM PROFILE above to decide the question-type mix and difficulty. Still report your chosen mix in the "examTypeMix" field (one sentence).`
      : `=== STEP 1: ANALYZE THE EXAM PAPER (if provided below) ===`,
    `Determine which question types this course's exam actually uses, and at what answer depth.`,
    `- If the exam has MC questions, include MC.`,
    `- If the exam has true/false, include true/false.`,
    `- If the exam has short-answer / essay / definition prompts, include "written".`,
    `- If the exam has explicit numeric/formula computation, include "calc".`,
    `- If the exam has algorithm / code / pseudocode questions, include "pseudocode".`,
    `- IMPORTANT: do NOT include "calc" or "pseudocode" if the exam paper has zero quantitative or algorithmic content (e.g. an IT-management / privacy / policy exam).`,
    `Report your chosen mix in the "examTypeMix" field (one sentence — e.g. "Mostly written short-answer + true/false + MC, mirroring the exam paper which is policy-focused and has no calculation questions").`,
    ``,
    `=== STEP 2: GENERATE QUESTIONS ===`,
    ``,
    `CHAPTER ROSTER — every question's "chapterId" MUST be one of these exact IDs:`,
    chapterRoster,
    ``,
    `COVERAGE RULES:`,
    `- At least 6 questions per chapter (more for larger chapters with more topics).`,
    `- Total: 40–100 questions depending on course size.`,
    `- Within each chapter, identify 2–5 distinct TOPICS. Produce MULTIPLE questions per topic (redundancy is intentional — same idea, different angle).`,
    `- The "topic" field is a short noun phrase (2–6 words), e.g. "Master Theorem", "TCP handshake", "GDPR lawful bases", "Risk register".`,
    `- "chapterName" must match the chapter's name from the roster above.`,
    ``,
    `ANSWER DEPTH:`,
    `- Match the depth/format of the model answers shown in the exam paper section below.`,
    `- "expected" must be detailed enough to grade a student attempt against — not just a hint. Aim for the kind of model answer a marker would write.`,
    ``,
    `TYPE-SPECIFIC RULES:`,
    `- mc: "options" array with 3–5 plausible choices. "expected" is the exact text of the correct option followed by a 1–2 sentence reason. Distractors must reflect plausible misconceptions, not nonsense.`,
    `- tf: "expected" starts with "True." or "False." followed by 1–2 sentence reason. Empty "options" array.`,
    `- written: short-answer prose. Empty "options" array. "expected" is a model answer matching exam-style depth.`,
    `- calc: include specific numbers. "expected" includes the worked answer with one-or-two-line method. Empty "options" array.`,
    `- pseudocode: ask for an algorithm sketch. "expected" includes a fenced \\\`\\\`\\\` block with reference pseudocode. Empty "options" array.`,
    `- For non-mc questions, "options" MUST be an empty array [].`,
    ``,
    `QUALITY:`,
    `- Most questions medium or hard.`,
    `- Cover different sections of each chapter — do not cluster.`,
    `- Do not duplicate questions verbatim across chapters or within a topic.`,
    ``,
    `Output: strict JSON conforming to the provided schema. JSON only — no markdown, no preamble.`,
    ``,
    `=== COURSE MATERIAL ===`,
    ``,
    chapterBlocks.join('\n\n'),
    ``,
    examBlob
  ].join('\n')

  const out = await runCodex(prompt, { schemaPath })
  const start = out.indexOf('{')
  const end = out.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('No JSON object in codex output')
  const parsed = JSON.parse(out.slice(start, end + 1))
  if (!parsed.questions?.length) throw new Error('Codex returned empty question list')

  const validChapterIds = new Set(course.chapters.map((c) => c.id))
  const questions = parsed.questions
    .filter((q) => validChapterIds.has(q.chapterId))
    .map((q, i) => ({
      id: `mq-${courseId}-${String(i + 1).padStart(3, '0')}`,
      source: 'Mock-questions',
      chapterId: q.chapterId,
      chapterName: q.chapterName,
      topic: (q.topic || '').trim() || 'General',
      type: q.type,
      difficulty: q.difficulty || 'medium',
      question: postWrapMath(q.question),
      options: Array.isArray(q.options) ? q.options.map((o) => postWrapMath(o)) : [],
      expected: postWrapMath(q.expected)
    }))

  const payload = {
    generatedAt: new Date().toISOString(),
    courseId,
    examTypeMix: parsed.examTypeMix || '',
    examPaperUsed: !!examPaper,
    questions
  }
  await ensureDir(mockQuestionsDir)
  await writeFile(resolve(mockQuestionsDir, `${courseId}.json`), JSON.stringify(payload, null, 2), 'utf8')
  return payload
}

async function loadOrGenerateMockQuestions(courseId, force = false) {
  const cachePath = resolve(mockQuestionsDir, `${courseId}.json`)
  if (!force && existsSync(cachePath)) {
    try {
      const cached = JSON.parse(await readFile(cachePath, 'utf8'))
      if (cached.questions?.length) return cached
    } catch {}
  }
  return generateMockQuestions(courseId)
}

function mockTocPath(courseId, examId) {
  return resolve(cacheDir, 'mock-toc', `${examCacheKey(courseId, examId)}.json`)
}

async function buildMockToc(courseId, examId, pages) {
  const cachePath = mockTocPath(courseId, examId)
  if (existsSync(cachePath)) {
    try {
      const cached = JSON.parse(await readFile(cachePath, 'utf8'))
      if (cached.items?.length) return cached
    } catch {}
  }
  // Legacy single-TOC fallback: if a per-course file exists from before the
  // multi-exam refactor, treat it as the TOC for the first exam.
  const legacyPath = resolve(cacheDir, 'mock-toc', `${courseId}.json`)
  if (existsSync(legacyPath)) {
    try {
      const cached = JSON.parse(await readFile(legacyPath, 'utf8'))
      if (cached.items?.length) return cached
    } catch {}
  }

  const state = await readState()
  const course = state.courses.find((c) => c.id === courseId)
  if (!course) throw new Error('Unknown course')

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      items: {
        type: 'array',
        minItems: 1,
        maxItems: 80,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            page: { type: 'integer', minimum: 1 },
            depth: { type: 'integer', minimum: 0, maximum: 3 },
            kind: { type: 'string', enum: ['section', 'question', 'subquestion', 'note'] }
          },
          required: ['title', 'page', 'depth', 'kind']
        }
      }
    },
    required: ['items']
  }
  await ensureDir(cacheDir)
  const schemaPath = resolve(cacheDir, 'schemas', `mock-toc.schema.json`)
  await ensureDir(dirname(schemaPath))
  await writeFile(schemaPath, JSON.stringify(schema, null, 2), 'utf8')

  // Compose a compact page-tagged text blob.
  const body = pages.map((p) => `=== PAGE ${p.page} ===\n${(p.text || '').replace(/\s+/g, ' ').trim()}`).join('\n\n')

  const prompt = [
    `You are reading a past/mock exam paper for ${course.code} — ${course.name}.`,
    `Produce a content table of contents (TOC) for the paper.`,
    ``,
    `Rules:`,
    `- One entry per discrete question, sub-question, or major section. Do NOT emit "Page 1, Page 2..." entries.`,
    `- "title" is a short human-readable label, e.g. "Q1 — Greedy proof (10 marks)", "Section A: Multiple choice", "Q3(b)".`,
    `- "page" is the page number where the entry begins (1-indexed, taken from the === PAGE N === markers).`,
    `- "depth" is 0 for top-level sections / main questions, 1 for sub-questions like Q1(a), 2 for sub-sub.`,
    `- "kind" is one of: section, question, subquestion, note.`,
    `- Skip front matter / instructions / footers unless they're a labelled section.`,
    `- Keep titles concise (< 80 chars).`,
    ``,
    `Return strict JSON conforming to the schema. JSON only.`,
    ``,
    body
  ].join('\n')

  const out = await runCodex(prompt, { schemaPath })
  const start = out.indexOf('{')
  const end = out.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('No JSON in codex output')
  const parsed = JSON.parse(out.slice(start, end + 1))
  const payload = { generatedAt: new Date().toISOString(), items: parsed.items || [] }
  if (!payload.items.length) throw new Error('Codex returned an empty TOC')
  await ensureDir(dirname(cachePath))
  await writeFile(cachePath, JSON.stringify(payload, null, 2), 'utf8')
  return payload
}

async function chat({ courseId, chapterId, messages, userMessage }) {
  const state = await readState()
  const course = state.courses.find((c) => c.id === courseId)
  if (!course) throw new Error('Unknown course')
  const chapter = course.chapters?.find((c) => c.id === chapterId)

  const context = await loadCourseContext(state, course, chapter)

  const history = (messages || []).map((m) => `${m.role === 'user' ? 'STUDENT' : 'TUTOR'}: ${m.content}`).join('\n\n')

  const prompt = `You are a focused exam tutor for ${course.code} — ${course.name}. ` +
    (chapter ? `The student is currently on chapter ${chapter.id} "${chapter.name}". ` : '') +
    `Use the course materials below as the source of truth. When a fact comes from a specific chapter, cite it inline like (Ch ${chapter ? chapter.id : 'NN'}). Be concise — exam-week tutor mode. Markdown OK.\n\n` +
    MATH_FORMATTING_RULE + '\n\n' +
    `${context ? `=== COURSE MATERIALS ===\n${context}\n=== END MATERIALS ===\n\n` : ''}` +
    `${history ? `=== CONVERSATION SO FAR ===\n${history}\n\n` : ''}` +
    `STUDENT: ${userMessage}\n\nRespond as TUTOR. No preamble, just the answer.`

  return runCodex(prompt)
}

// ----- Mistake Bank -----

const mistakesDir = resolve(__dirname, 'data/mistakes')
const mocksDir = resolve(__dirname, 'data/mocks')
const srPath = resolve(__dirname, 'data/sr-state.json')
const flashcardsPath = resolve(__dirname, 'data/flashcards.json')
const flashcardsTemplatePath = resolve(__dirname, 'data/flashcards.template.json')

async function readFlashcards() {
  // First-run bootstrap: if no working flashcards file but a shipped template
  // exists, seed it. Same pattern as study-state.json.
  if (!existsSync(flashcardsPath) && existsSync(flashcardsTemplatePath)) {
    await ensureDir(dirname(flashcardsPath))
    await writeFile(flashcardsPath, await readFile(flashcardsTemplatePath, 'utf8'), 'utf8')
    console.log(`[bootstrap] Initialized data/flashcards.json from template`)
  }
  if (!existsSync(flashcardsPath)) return { cards: [] }
  try { return JSON.parse(await readFile(flashcardsPath, 'utf8')) } catch { return { cards: [] } }
}

async function writeFlashcards(state) {
  await writeFile(flashcardsPath, JSON.stringify(state, null, 2), 'utf8')
}

function initialSr() {
  return { ease: 2.5, interval: 0, repetitions: 0, lastReviewed: null, dueAt: new Date().toISOString(), history: [] }
}

async function generateFlashcards(state, course, chapter, count, customPrompt) {
  const content = await readKbFile(state, course, chapter.file)
  if (!content) throw new Error('Chapter content not readable')
  const isAuto = count === 'auto' || count == null
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      cards: {
        type: 'array',
        minItems: 1,
        maxItems: 30,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            front: { type: 'string' },
            back: { type: 'string' }
          },
          required: ['front', 'back']
        }
      }
    },
    required: ['cards']
  }
  await ensureDir(cacheDir)
  const schemaPath = resolve(cacheDir, 'schemas', 'flashcards.schema.json')
  await ensureDir(dirname(schemaPath))
  await writeFile(schemaPath, JSON.stringify(schema, null, 2), 'utf8')

  const truncated = content.length > 10000 ? content.slice(0, 10000) + '\n…(truncated)' : content
  const countLine = isAuto
    ? `Decide HOW MANY cards this chapter actually needs (between 5 and 25). Base it on the substance of the content — short conceptual chapters get 5–8 cards, medium chapters 10–15, dense reference-style chapters with many distinct facts get 18–25. Do NOT pad with filler to hit a quota.`
    : `Generate exactly ${count} flashcards covering key concepts of the chapter.`
  const prompt = [
    `You are creating spaced-repetition flashcards for ${course.code} — ${course.name}, chapter "${chapter.name}".`,
    ``,
    MATH_FORMATTING_RULE,
    ``,
    countLine,
    `Each card has:`,
    `- "front": a precise prompt (question or fill-in-the-blank) testing recall of a SPECIFIC concept. 1 short sentence.`,
    `- "back": the answer, self-contained, 1–3 sentences. Include the precise definition / formula / mechanism.`,
    ``,
    `Quality rules:`,
    `- Atomic: one fact per card. Avoid "Explain X" broad prompts — prefer "What is X?" or "Why does X happen?".`,
    `- Cover diverse sections of the chapter, not clusters.`,
    `- For definitions, ask for the term given the definition AND vice-versa (mix both directions).`,
    `- Do not duplicate cards.`,
    customPrompt ? `\nADDITIONAL INSTRUCTIONS FROM USER:\n${customPrompt}\n` : '',
    `Output: strict JSON conforming to the schema. JSON only — no preamble.`,
    ``,
    `Chapter content:`,
    ``,
    truncated
  ].filter(Boolean).join('\n')

  const out = await runCodex(prompt, { schemaPath })
  const start = out.indexOf('{')
  const end = out.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('No JSON in codex output')
  const parsed = JSON.parse(out.slice(start, end + 1))
  return (parsed.cards || []).map((c) => ({
    front: postWrapMath(c.front),
    back: postWrapMath(c.back)
  }))
}

async function gradeFlashcardRecall({ courseCode, chapterName, card, attempt }) {
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      score: { type: 'number', minimum: 0, maximum: 10 },
      correction: { type: 'string' }
    },
    required: ['score', 'correction']
  }
  await ensureDir(cacheDir)
  const schemaPath = resolve(cacheDir, 'schemas', 'flashcard-grade.schema.json')
  await ensureDir(dirname(schemaPath))
  await writeFile(schemaPath, JSON.stringify(schema, null, 2), 'utf8')

  const prompt = [
    `You are grading an active-recall flashcard attempt for ${courseCode}, chapter "${chapterName}".`,
    ``,
    MATH_FORMATTING_RULE,
    ``,
    `FRONT / PROMPT:`,
    card.front,
    ``,
    `REFERENCE BACK / EXPECTED ANSWER:`,
    card.back,
    ``,
    `STUDENT RECALL ATTEMPT:`,
    attempt || '(blank)',
    ``,
    `Grade semantic recall against the reference answer.`,
    `- Award credit for meaning, not exact wording.`,
    `- Ignore spelling/grammar unless it changes a technical term.`,
    `- Penalize missing key distinctions, false claims, and vague answers.`,
    ``,
    `Return strict JSON only. The correction field must be concise markdown with:`,
    `**What matched**`,
    `- 1-2 bullets`,
    ``,
    `**Missing / fix**`,
    `- 1-3 bullets`,
    ``,
    `Do not include the score inside correction. Keep correction under 90 words.`
  ].join('\n')

  const out = await runCodex(prompt, { schemaPath })
  const start = out.indexOf('{')
  const end = out.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('No JSON in flashcard grader output')
  const parsed = JSON.parse(out.slice(start, end + 1))
  if (typeof parsed.score !== 'number' || typeof parsed.correction !== 'string') {
    throw new Error('Flashcard grader returned invalid shape')
  }
  return parsed
}

function parseScore(correction) {
  if (!correction) return null
  const m = correction.match(/score[:\s*]*?(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/i)
  return m ? Number(m[1]) : null
}

async function readMistakes(filter = {}) {
  if (!existsSync(mistakesDir)) return []
  const files = await readdir(mistakesDir)
  const all = []
  for (const f of files) {
    if (!f.endsWith('.json')) continue
    try {
      const data = JSON.parse(await readFile(resolve(mistakesDir, f), 'utf8'))
      for (const m of data) all.push(m)
    } catch {}
  }
  return all.filter((m) => {
    if (filter.courseId && m.courseId !== filter.courseId) return false
    if (filter.chapterId && m.chapterId !== filter.chapterId) return false
    if (filter.open !== undefined && (filter.open ? m.resolvedAt : !m.resolvedAt)) return false
    return true
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

async function writeMistakeBucket(courseId, chapterId, mistakes) {
  await ensureDir(mistakesDir)
  const path = resolve(mistakesDir, `${courseId}-${chapterId || 'misc'}.json`)
  await writeFile(path, JSON.stringify(mistakes, null, 2), 'utf8')
}

async function addMistake(record) {
  const path = resolve(mistakesDir, `${record.courseId}-${record.chapterId || 'misc'}.json`)
  await ensureDir(mistakesDir)
  let bucket = []
  if (existsSync(path)) {
    try { bucket = JSON.parse(await readFile(path, 'utf8')) } catch {}
  }
  // dedupe: if same questionId already exists and is open, replace it
  bucket = bucket.filter((m) => !(m.questionId === record.questionId && !m.resolvedAt))
  bucket.push(record)
  await writeFile(path, JSON.stringify(bucket, null, 2), 'utf8')
  return record
}

async function updateMistake(id, patch) {
  if (!existsSync(mistakesDir)) return null
  const files = await readdir(mistakesDir)
  for (const f of files) {
    if (!f.endsWith('.json')) continue
    const path = resolve(mistakesDir, f)
    try {
      const bucket = JSON.parse(await readFile(path, 'utf8'))
      const idx = bucket.findIndex((m) => m.id === id)
      if (idx < 0) continue
      Object.assign(bucket[idx], patch)
      await writeFile(path, JSON.stringify(bucket, null, 2), 'utf8')
      return bucket[idx]
    } catch {}
  }
  return null
}

async function deleteMistake(id) {
  if (!existsSync(mistakesDir)) return false
  const files = await readdir(mistakesDir)
  for (const f of files) {
    if (!f.endsWith('.json')) continue
    const path = resolve(mistakesDir, f)
    try {
      const bucket = JSON.parse(await readFile(path, 'utf8'))
      const next = bucket.filter((m) => m.id !== id)
      if (next.length !== bucket.length) {
        await writeFile(path, JSON.stringify(next, null, 2), 'utf8')
        return true
      }
    } catch {}
  }
  return false
}

// ----- SR (SM-2) -----

async function readSrState() {
  if (!existsSync(srPath)) return { cards: {} }
  try { return JSON.parse(await readFile(srPath, 'utf8')) } catch { return { cards: {} } }
}

async function writeSrState(state) {
  await writeFile(srPath, JSON.stringify(state, null, 2), 'utf8')
}

function sm2(card, quality) {
  // quality: 0-5
  let { ease = 2.5, interval = 0, repetitions = 0 } = card
  if (quality < 3) {
    repetitions = 0
    interval = 1
  } else {
    if (repetitions === 0) interval = 1
    else if (repetitions === 1) interval = 6
    else interval = Math.round(interval * ease)
    repetitions += 1
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
  const due = new Date()
  due.setDate(due.getDate() + interval)
  return { ease, interval, repetitions, lastReviewed: new Date().toISOString(), dueAt: due.toISOString() }
}

function nowDueIso() { return new Date().toISOString() }

async function gatherSrDue() {
  const state = await readSrState()
  const due = []
  for (const [id, card] of Object.entries(state.cards || {})) {
    if (!card.dueAt || card.dueAt <= nowDueIso()) due.push({ id, ...card })
  }
  due.sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || ''))
  return due
}

async function findQuestion(state, questionId) {
  const cacheRoot = resolve(cacheDir, 'questions')
  if (existsSync(cacheRoot)) {
    const files = await readdir(cacheRoot)
    for (const f of files) {
      try {
        const data = JSON.parse(await readFile(resolve(cacheRoot, f), 'utf8'))
        const q = data.questions?.find((x) => x.id === questionId)
        if (q) {
          const [courseId, chapterId] = f.replace(/\.json$/, '').split('-')
          return { question: q, courseId, chapterId }
        }
      } catch {}
    }
  }
  if (existsSync(mockQuestionsDir)) {
    const files = await readdir(mockQuestionsDir)
    for (const f of files) {
      try {
        const data = JSON.parse(await readFile(resolve(mockQuestionsDir, f), 'utf8'))
        const q = data.questions?.find((x) => x.id === questionId)
        if (q) {
          const courseId = f.replace(/\.json$/, '')
          return { question: q, courseId, chapterId: q.chapterId }
        }
      } catch {}
    }
  }
  return null
}

// ----- Mocks -----

async function listMockSessions() {
  if (!existsSync(mocksDir)) return []
  const files = await readdir(mocksDir)
  const out = []
  for (const f of files) {
    if (!f.endsWith('.json')) continue
    try {
      const s = JSON.parse(await readFile(resolve(mocksDir, f), 'utf8'))
      out.push({ id: s.id, courseId: s.courseId, chapterId: s.chapterId, submittedAt: s.submittedAt, totalScore: s.totalScore, totalMax: s.totalMax, count: s.questions?.length || 0, duration: s.duration })
    } catch {}
  }
  out.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
  return out
}

async function saveMockSession(session) {
  await ensureDir(mocksDir)
  await writeFile(resolve(mocksDir, `${session.id}.json`), JSON.stringify(session, null, 2), 'utf8')
  return session
}

async function readMockSession(id) {
  const p = resolve(mocksDir, `${id}.json`)
  if (!existsSync(p)) return null
  return JSON.parse(await readFile(p, 'utf8'))
}

const MATH_FORMATTING_RULE = [
  `MATH FORMATTING — strict, non-negotiable:`,
  ``,
  `Every mathematical expression in your output MUST be wrapped in LaTeX delimiters.`,
  `Inline math uses \`$ ... $\`. Display math uses \`$$ ... $$\`.`,
  ``,
  `Examples (BAD → GOOD):`,
  `- "T(n)=aT(n/b)+f(n)"               → "$T(n) = a\\,T(n/b) + f(n)$"`,
  `- "n^log_b a · log^3 n"             → "$n^{\\log_b a} \\cdot \\log^3 n$"`,
  `- "Θ(n log n)"                      → "$\\Theta(n \\log n)$"`,
  `- "Compare c with log_b a"          → "Compare $c$ with $\\log_b a$"`,
  `- "(log_2 6)" or "(\\log_2 6)"        → "$\\log_2 6$"`,
  `- "x_i", "n^c", "Σ_i x_i"           → "$x_i$", "$n^c$", "$\\sum_i x_i$"`,
  ``,
  `Rules:`,
  `- Any character that has a mathematical meaning (^, _, =, +, ·, ×, /, ≤, ≥, ≠, Greek letters, log, sin, sum, lim, sqrt, function notation like T(n) or f(x)) must live inside $...$.`,
  `- Use proper LaTeX commands: \\log, \\Theta, \\Omega, \\sum, \\leq, \\geq, \\cdot, \\sqrt, \\frac{a}{b}.`,
  `- Use braces for multi-char sub/superscripts: write \`n^{\\log_2 6}\`, never \`n^log_2 6\`.`,
  `- Output that contains bare math (math outside $...$) will be discarded and regenerated — write it right the first time.`
].join('\n')

// Server-side defensive post-pass: codex still slips occasionally. Wraps obvious bare-math
// fragments outside existing $...$ regions.
function postWrapMath(text) {
  if (!text || typeof text !== 'string') return text
  // Split on existing $...$ blocks; only transform "prose" segments (even indices).
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^\n$]+?\$)/)
  return parts.map((part, i) => {
    if (i % 2 === 1) return part
    let out = part
    // Wrap paren-bounded math (same as client autoWrap fallback).
    out = out.replace(/\(((?:[^()]|\([^()]*\))+)\)/g, (m, inner) => {
      if (inner.length > 200) return m
      if (/\\[a-zA-Z]+|\^\{|_\{|\^[A-Za-z0-9]\b|_[A-Za-z0-9]\b/.test(inner)) return `$${inner}$`
      return m
    })
    // Wrap function-equation runs like T(n)=aT(n/b)+f(n), Θ(...).
    out = out.replace(
      /\b[A-Za-zΘΩΣ][A-Za-z]*\([^()]{1,40}\)(?:\s*[+\-*/=·]\s*[A-Za-zΘΩΣ0-9][A-Za-z0-9]*(?:\([^()]{1,40}\)|\^[\w{}]+|_[\w{}]+)*)+/g,
      (m) => `$${m}$`
    )
    // Wrap bare sub/superscripted identifiers: log^3, n^c, log_b a, x_i, possibly with a trailing var.
    out = out.replace(
      /\b([A-Za-z][A-Za-z]*)([\^_])([A-Za-z0-9]+\b|\{[^{}]+\})(\s+[a-z]\b)?/g,
      (m) => `$${m.trim()}$`
    )
    return out
  }).join('')
}

async function gradeAttempt({ courseCode, chapterName, question, attempt, attemptImages, _meta }) {
  const imagePaths = await writeAttemptImages(attemptImages)
  const imageBlurb = imagePaths.length ? `\n[${imagePaths.length} image attachment${imagePaths.length === 1 ? '' : 's'} attached — examine carefully. The student's answer is in the image; treat the typed text as supplementary unless the image is unreadable.]` : ''
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      correction: { type: 'string' },
      score: { type: 'number', minimum: 0, maximum: 10 }
    },
    required: ['correction', 'score']
  }
  await ensureDir(cacheDir)
  const schemaPath = resolve(cacheDir, 'schemas', 'grade.schema.json')
  await ensureDir(dirname(schemaPath))
  await writeFile(schemaPath, JSON.stringify(schema, null, 2), 'utf8')

  const prompt = `You are an exam grader for course ${courseCode}, chapter "${chapterName}".\n\n` +
    MATH_FORMATTING_RULE + '\n\n' +
    `GRADING POLICY — focus on SUBSTANTIVE CORRECTNESS only:\n` +
    `- Award marks for: correct concepts, accurate application, named relationships, valid frameworks.\n` +
    `- Deduct for: missing required elements, wrong concept/acronym names, factual errors.\n` +
    `- IGNORE COMPLETELY: spelling mistakes, typos, minor wording differences, grammar errors, capitalisation, stylistic phrasing. The student is fast-typing — do not nitpick prose.\n` +
    `- DO flag only: misspelled critical acronyms that change meaning (e.g. "CRM" as "CMR", "BIA" as "BIP"). Otherwise spelling is irrelevant.\n` +
    `- Tips must address SUBSTANCE (missing concepts, weak structure). NEVER write a Tip about wording, spelling, grammar, or style. If no substantive improvement exists, omit Tip or write "Tip: (none — solid)".\n\n` +
    `QUESTION (type: ${question.type}):\n${question.question}\n` +
    (question.options ? `\nOPTIONS:\n${question.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n` : '') +
    `\nEXPECTED ANSWER / KEY POINTS:\n${question.expected || '(no reference provided — judge on correctness against the chapter)'}\n\n` +
    `STUDENT ATTEMPT:\n${attempt || '(no typed answer)'}${imageBlurb}\n\n` +
    `Return strict JSON conforming to the provided schema. The "correction" field must be clean, study-useful markdown with exactly these sections:\n` +
    `**Score:** X/10\n\n` +
    `**What you got right**\n` +
    `- 1–3 concrete substantive strengths. Write "Nothing yet." if the answer is mostly wrong.\n\n` +
    `**Missing / wrong**\n` +
    `- Bullet each missing concept, incorrect detail, or weak connection. Write "Nothing major." if substantively complete.\n\n` +
    `**How to improve**\n` +
    `- 1–3 exam-actionable bullets: what to add, what structure to use, or what distinction to make.\n\n` +
    `**Model answer**\n` +
    `A compact full-credit answer the student could have written. Use 3–6 sentences or bullets, and include the critical terms/acronyms.\n\n` +
    `Avoid dense paragraphs. Be clear enough that the correction can be revised from directly. Aim for 120–220 words unless the answer is trivially correct.\n\n` +
    `The "score" field is a number from 0 to 10 representing the grade. JSON only — no preamble.`

  const out = await runCodex(prompt, { images: imagePaths, schemaPath })
  const start = out.indexOf('{')
  const end = out.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('Grader returned no JSON')
  const parsed = JSON.parse(out.slice(start, end + 1))
  if (typeof parsed.score !== 'number' || !parsed.correction) {
    throw new Error('Grader response missing score or correction')
  }
  return parsed
}

// ----- Generate-all Jobs -----
//
// A small in-memory job system that backs the "Generate all content" button on
// the course landing page. Jobs run sequentially (one Codex call at a time per
// job, to avoid rate-limit thrashing) and update step status as they progress.
// The client polls /api/jobs/:jobId for live progress.

const generateJobs = new Map() // jobId -> job
const generateJobsByCourse = new Map() // courseId -> current jobId (running or recently done)
const JOB_TTL_MS = 30 * 60 * 1000 // 30 minutes after completion before GC

function newJobId() {
  return `gen-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`
}

function gcJobs() {
  const now = Date.now()
  for (const [id, job] of generateJobs) {
    if ((job.status === 'done' || job.status === 'error') && job.finishedAt && now - job.finishedAt > JOB_TTL_MS) {
      generateJobs.delete(id)
      if (generateJobsByCourse.get(job.courseId) === id) generateJobsByCourse.delete(job.courseId)
    }
  }
}

/**
 * Synchronous flashcards-by-chapter count for the planner. Reads flashcards.json
 * directly (sync) since planning runs ahead of the async work — keeps the
 * planner simple. Returns a Map<chapterId, cardCount> scoped to one course.
 */
function countFlashcardsByChapter(courseId) {
  const counts = new Map()
  if (!existsSync(flashcardsPath)) return counts
  try {
    const data = JSON.parse(readFileSync(flashcardsPath, 'utf8'))
    for (const c of data.cards || []) {
      if (c.courseId !== courseId) continue
      counts.set(c.chapterId, (counts.get(c.chapterId) || 0) + 1)
    }
  } catch {}
  return counts
}

function planGenerateAllSteps(state, course) {
  const steps = []
  const flashcardCounts = countFlashcardsByChapter(course.id)
  // 1. Per-chapter self-tests (skip support pages: cram sheets, drills, etc.)
  for (const ch of course.chapters || []) {
    const cachePath = resolve(cacheDir, 'questions', `${course.id}-${ch.id}.json`)
    steps.push({
      key: `chapter:${ch.id}`,
      label: `Self-test · Ch ${ch.id} — ${ch.name}`,
      status: existsSync(cachePath) ? 'skipped' : 'pending',
      kind: 'chapter',
      chapterId: ch.id
    })
  }
  // 2. Course-wide mock-questions bank
  const mockPath = resolve(cacheDir, 'mock-questions', `${course.id}.json`)
  steps.push({
    key: 'mock-questions',
    label: 'Mock questions bank (course-wide)',
    status: existsSync(mockPath) ? 'skipped' : 'pending',
    kind: 'mock-questions'
  })
  // 3. Per-chapter flashcards (skipped if the chapter already has any cards)
  for (const ch of course.chapters || []) {
    const existing = flashcardCounts.get(ch.id) || 0
    steps.push({
      key: `flashcards:${ch.id}`,
      label: `Flashcards · Ch ${ch.id} — ${ch.name}${existing ? ` (${existing} already)` : ''}`,
      status: existing > 0 ? 'skipped' : 'pending',
      kind: 'flashcards',
      chapterId: ch.id
    })
  }
  // 4. Mock exam parses, one per exam paper
  for (const exam of getMockExams(course)) {
    if (!exam.pdf) continue // no question paper, can't parse
    const examCachePath = resolve(cacheDir, 'practice-exam', `${examCacheKey(course.id, exam.id)}.json`)
    steps.push({
      key: `exam:${exam.id}`,
      label: `Mock exam — ${exam.label}`,
      status: existsSync(examCachePath) ? 'skipped' : 'pending',
      kind: 'exam',
      examId: exam.id
    })
  }
  // 5. PDF content TOC, one per exam paper (for the in-page outline navigator)
  for (const exam of getMockExams(course)) {
    if (!exam.pdf) continue
    const tocCachePath = mockTocPath(course.id, exam.id)
    steps.push({
      key: `mock-toc:${exam.id}`,
      label: `Content TOC — ${exam.label}`,
      status: existsSync(tocCachePath) ? 'skipped' : 'pending',
      kind: 'mock-toc',
      examId: exam.id
    })
  }
  return steps
}

async function runGenerateAllJob(jobId) {
  const job = generateJobs.get(jobId)
  if (!job) return
  job.status = 'running'
  job.startedAt = Date.now()

  try {
    const state = await readState()
    const course = state.courses.find((c) => c.id === job.courseId)
    if (!course) throw new Error(`Unknown course: ${job.courseId}`)

    for (const step of job.steps) {
      if (step.status !== 'pending') continue
      step.status = 'running'
      const startedAt = Date.now()
      try {
        if (step.kind === 'chapter') {
          const chapter = course.chapters.find((c) => c.id === step.chapterId)
          if (!chapter) throw new Error(`Unknown chapter: ${step.chapterId}`)
          await loadOrGenerateQuestions(state, course, chapter)
        } else if (step.kind === 'mock-questions') {
          await generateMockQuestions(job.courseId)
        } else if (step.kind === 'flashcards') {
          const chapter = course.chapters.find((c) => c.id === step.chapterId)
          if (!chapter) throw new Error(`Unknown chapter: ${step.chapterId}`)
          const generated = await generateFlashcards(state, course, chapter, 'auto', '')
          const newCards = generated.map((g) => ({
            id: `fc-${randomUUID()}`,
            courseId: job.courseId,
            chapterId: chapter.id,
            front: g.front,
            back: g.back,
            source: 'ai',
            createdAt: new Date().toISOString(),
            sr: initialSr()
          }))
          // Re-read flashcards.json fresh each time so concurrent UI edits
          // (manual card adds, deletes) aren't clobbered.
          const all = await readFlashcards()
          all.cards = (all.cards || []).concat(newCards)
          await writeFlashcards(all)
          step.generatedCount = newCards.length
        } else if (step.kind === 'exam') {
          const exam = getMockExams(course).find((e) => e.id === step.examId)
          if (!exam?.pdf) throw new Error(`Exam ${step.examId} has no PDF`)
          const vaultRoot = getVaultRoot(state)
          const pdfPath = resolve(vaultRoot, course.knowledgeBase, exam.pdf)
          const questionPages = await extractPdfPageText(pdfPath)
          let solutionsPages = []
          if (exam.solutionsPdf) {
            const sPath = resolve(vaultRoot, course.knowledgeBase, exam.solutionsPdf)
            try { solutionsPages = await extractPdfPageText(sPath) } catch {}
          }
          if (!questionPages.length) throw new Error('No text extracted from PDF')
          await parseExamPaper(job.courseId, step.examId, questionPages, solutionsPages)
        } else if (step.kind === 'mock-toc') {
          const exam = getMockExams(course).find((e) => e.id === step.examId)
          if (!exam?.pdf) throw new Error(`Exam ${step.examId} has no PDF`)
          const vaultRoot = getVaultRoot(state)
          const pdfPath = resolve(vaultRoot, course.knowledgeBase, exam.pdf)
          const pages = await extractPdfPageText(pdfPath)
          if (!pages.length) throw new Error('No text extracted from PDF')
          await buildMockToc(job.courseId, step.examId, pages)
        }
        step.status = 'done'
      } catch (err) {
        step.status = 'error'
        step.error = err.message || String(err)
      }
      step.durationMs = Date.now() - startedAt
    }

    job.status = 'done'
    job.finishedAt = Date.now()
  } catch (err) {
    job.status = 'error'
    job.error = err.message || String(err)
    job.finishedAt = Date.now()
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)

    if (url.pathname === '/api/state' && req.method === 'GET') {
      send(res, 200, JSON.stringify(await readState()))
      return
    }

    if (url.pathname === '/api/state' && req.method === 'PUT') {
      const state = await readBody(req)
      await writeState(state)
      send(res, 200, JSON.stringify({ ok: true, state }))
      return
    }

    if (url.pathname.startsWith('/api/items/') && req.method === 'PATCH') {
      const itemId = decodeURIComponent(url.pathname.replace('/api/items/', ''))
      const patch = await readBody(req)
      const state = await readState()
      const found = findItem(state, itemId)
      if (!found) {
        send(res, 404, JSON.stringify({ error: `Unknown item: ${itemId}` }))
        return
      }
      applyPatch(found.item, patch)
      await writeState(state)
      send(res, 200, JSON.stringify({ ok: true, item: found.item }))
      return
    }

    // Update course management fields (archived / order). Body: { archived?, order? }
    const courseMatch = url.pathname.match(/^\/api\/courses\/([^/]+)$/)
    if (courseMatch && req.method === 'PATCH') {
      const courseId = decodeURIComponent(courseMatch[1])
      const patch = await readBody(req)
      const state = await readState()
      const course = state.courses.find((c) => c.id === courseId)
      if (!course) {
        send(res, 404, JSON.stringify({ error: `Unknown course: ${courseId}` }))
        return
      }
      if (typeof patch.archived === 'boolean') course.archived = patch.archived
      if (typeof patch.order === 'number') course.order = patch.order
      state.meta.updatedAt = new Date().toISOString()
      await writeState(state)
      send(res, 200, JSON.stringify({ ok: true, course: { id: course.id, archived: !!course.archived, order: course.order } }))
      return
    }

    // ── Self-update endpoints ──────────────────────────────────────────────
    // GET  /api/version            — local + remote HEAD, whether up to date
    // POST /api/update/pull        — fire-and-forget git pull
    // GET  /api/update/status      — polled job state
    // POST /api/update/restart     — exits server with code 23 (runner respawns)
    if (url.pathname === '/api/version' && req.method === 'GET') {
      const force = url.searchParams.get('force') === '1'
      const remote = await fetchRemoteHead({ force })
      const upToDate = remote.sha && LOCAL_GIT_HEAD && remote.sha === LOCAL_GIT_HEAD
      send(res, 200, JSON.stringify({
        local: { head: LOCAL_GIT_HEAD, branch: LOCAL_GIT_BRANCH },
        remote: {
          head: remote.sha,
          message: remote.message,
          authoredAt: remote.authoredAt,
          checkedAt: remote.checkedAt,
          error: remote.error
        },
        upToDate: !!upToDate,
        repo: GITHUB_REPO
      }))
      return
    }
    if (url.pathname === '/api/update/pull' && req.method === 'POST') {
      if (updateJob?.status === 'pulling') {
        send(res, 200, JSON.stringify({ ...updateJob, alreadyRunning: true }))
        return
      }
      // Kick off in background and return immediately
      runGitPull().catch(() => {})
      send(res, 202, JSON.stringify({ status: 'pulling', startedAt: Date.now() }))
      return
    }
    if (url.pathname === '/api/update/status' && req.method === 'GET') {
      send(res, 200, JSON.stringify(updateJob || { status: 'idle' }))
      return
    }
    if (url.pathname === '/api/update/restart' && req.method === 'POST') {
      send(res, 200, JSON.stringify({ ok: true, message: 'Restarting…' }))
      // Give the response time to flush before exiting
      setTimeout(() => process.exit(23), 250)
      return
    }

    // ── Generate-all endpoints ──────────────────────────────────────────────
    // POST /api/courses/:courseId/generate-all       — kick off a job
    // GET  /api/courses/:courseId/generate-all       — get the current job (if any)
    // GET  /api/jobs/:jobId                          — get a specific job by id
    const genStartMatch = url.pathname.match(/^\/api\/courses\/([^/]+)\/generate-all$/)
    if (genStartMatch && req.method === 'POST') {
      gcJobs()
      const courseId = decodeURIComponent(genStartMatch[1])
      // If a job for this course is already running, return its id rather than spawning a duplicate
      const existingId = generateJobsByCourse.get(courseId)
      const existing = existingId ? generateJobs.get(existingId) : null
      if (existing && existing.status === 'running') {
        send(res, 200, JSON.stringify({ jobId: existing.id, status: existing.status, existing: true }))
        return
      }
      const state = await readState()
      const course = state.courses.find((c) => c.id === courseId)
      if (!course) {
        send(res, 404, JSON.stringify({ error: `Unknown course: ${courseId}` }))
        return
      }
      const id = newJobId()
      const job = {
        id,
        courseId,
        createdAt: Date.now(),
        status: 'queued',
        steps: planGenerateAllSteps(state, course)
      }
      generateJobs.set(id, job)
      generateJobsByCourse.set(courseId, id)
      // Fire and forget — the job updates its own state as it runs
      setImmediate(() => { runGenerateAllJob(id).catch(() => {}) })
      send(res, 202, JSON.stringify({ jobId: id, status: 'queued' }))
      return
    }
    if (genStartMatch && req.method === 'GET') {
      gcJobs()
      const courseId = decodeURIComponent(genStartMatch[1])
      const id = generateJobsByCourse.get(courseId)
      const job = id ? generateJobs.get(id) : null
      if (!job) {
        send(res, 404, JSON.stringify({ error: 'No job for this course' }))
        return
      }
      send(res, 200, JSON.stringify(job))
      return
    }
    const jobGetMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)$/)
    if (jobGetMatch && req.method === 'GET') {
      gcJobs()
      const id = decodeURIComponent(jobGetMatch[1])
      const job = generateJobs.get(id)
      if (!job) {
        send(res, 404, JSON.stringify({ error: 'Unknown job' }))
        return
      }
      send(res, 200, JSON.stringify(job))
      return
    }

    // Bulk-set course order. Body: { order: ["id1","id2",...] }
    if (url.pathname === '/api/courses/reorder' && req.method === 'POST') {
      const body = await readBody(req)
      const state = await readState()
      const ids = Array.isArray(body.order) ? body.order : []
      ids.forEach((id, i) => {
        const c = state.courses.find((x) => x.id === id)
        if (c) c.order = i + 1
      })
      state.meta.updatedAt = new Date().toISOString()
      await writeState(state)
      send(res, 200, JSON.stringify({ ok: true }))
      return
    }

    // PDF route — supports both shapes:
    //   /api/pdf/{courseId}                          → first exam, question paper
    //   /api/pdf/{courseId}/solutions                → first exam, solutions
    //   /api/pdf/{courseId}/{examId}                 → specific exam, question paper
    //   /api/pdf/{courseId}/{examId}/solutions       → specific exam, solutions
    const pdfMatch = url.pathname.match(/^\/api\/pdf\/([^/]+)(?:\/([^/]+))?(?:\/(solutions))?$/)
    if (pdfMatch && req.method === 'GET') {
      let [, courseIdRaw, segment2, segment3] = pdfMatch
      let variant = null
      let examIdRaw = null
      if (segment3 === 'solutions') { examIdRaw = segment2; variant = 'solutions' }
      else if (segment2 === 'solutions') { variant = 'solutions' }
      else if (segment2) { examIdRaw = segment2 }
      const courseId = decodeURIComponent(courseIdRaw)
      const examId = examIdRaw ? decodeURIComponent(examIdRaw) : null
      const state = await readState()
      const course = state.courses.find((c) => c.id === courseId)
      const exam = course ? getMockExam(course, examId) : null
      const filePath = variant === 'solutions' ? exam?.solutionsPdf : exam?.pdf
      if (!course || !exam || !filePath) {
        send(res, 404, JSON.stringify({ error: `No ${variant === 'solutions' ? 'solutions' : 'mock exam'} configured for this course/exam` }))
        return
      }
      const vaultRoot = getVaultRoot(state)
      const courseRoot = resolve(vaultRoot, course.knowledgeBase)
      const target = resolve(courseRoot, filePath)
      if (!pathInside(courseRoot, target)) {
        send(res, 400, JSON.stringify({ error: 'Path escapes course root' }))
        return
      }
      if (!existsSync(target)) {
        send(res, 404, JSON.stringify({ error: `PDF not found: ${filePath}` }))
        return
      }
      const buf = await readFile(target)
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': buf.length,
        'Content-Disposition': `inline; filename="${course.code}-${exam.id}-${variant === 'solutions' ? 'solutions' : 'paper'}.pdf"`,
        'Cache-Control': 'private, max-age=3600'
      })
      res.end(buf)
      return
    }

    const chapterMatch = url.pathname.match(/^\/api\/chapter\/([^/]+)\/([^/]+)\/?(.*)$/)
    if (chapterMatch && req.method === 'GET') {
      const [, courseId, chapterId, rest] = chapterMatch
      const state = await readState()
      try {
        const data = await resolveChapterContent(state, courseId, chapterId, rest ? decodeURIComponent(rest) : '')
        send(res, 200, JSON.stringify(data))
      } catch (err) {
        send(res, 404, JSON.stringify({ error: err.message }))
      }
      return
    }

    const courseTocMatch = url.pathname.match(/^\/api\/course-toc\/([^/]+)$/)
    if (courseTocMatch && req.method === 'GET') {
      const [, courseId] = courseTocMatch
      const state = await readState()
      const course = state.courses.find((c) => c.id === decodeURIComponent(courseId))
      if (!course) {
        send(res, 404, JSON.stringify({ error: 'Unknown course' }))
        return
      }
      const chapters = []
      for (const chapter of course.chapters || []) {
        const content = await readKbFile(state, course, chapter.file).catch(() => '')
        chapters.push({
          id: chapter.id,
          name: chapter.name,
          headings: extractMarkdownToc(content || '')
        })
      }
      send(res, 200, JSON.stringify({ courseId: course.id, chapters }))
      return
    }

    const questionsSummaryMatch = url.pathname.match(/^\/api\/questions-summary\/([^/]+)$/)
    if (questionsSummaryMatch && req.method === 'GET') {
      const courseId = decodeURIComponent(questionsSummaryMatch[1])
      const state = await readState()
      const course = state.courses.find((c) => c.id === courseId)
      if (!course) {
        send(res, 404, JSON.stringify({ error: 'Unknown course' }))
        return
      }
      const byChapter = {}
      for (const chapter of course.chapters || []) {
        const cachePath = resolve(cacheDir, 'questions', `${course.id}-${chapter.id}.json`)
        let questions = []
        if (existsSync(cachePath)) {
          try {
            const cached = JSON.parse(await readFile(cachePath, 'utf8'))
            questions = Array.isArray(cached.questions) ? cached.questions : []
          } catch {}
        }
        byChapter[chapter.id] = {
          total: questions.length,
          ids: questions.map((q) => q.id).filter(Boolean)
        }
      }
      send(res, 200, JSON.stringify({ courseId: course.id, byChapter }))
      return
    }

    const questionsMatch = url.pathname.match(/^\/api\/questions\/([^/]+)\/([^/]+)$/)
    if (questionsMatch && req.method === 'GET') {
      const [, courseId, chapterId] = questionsMatch
      const state = await readState()
      const course = state.courses.find((c) => c.id === courseId)
      const chapter = course?.chapters?.find((c) => c.id === chapterId)
      if (!course || !chapter) {
        send(res, 404, JSON.stringify({ error: 'Unknown course or chapter' }))
        return
      }
      try {
        const payload = await loadOrGenerateQuestions(state, course, chapter)
        send(res, 200, JSON.stringify(payload))
      } catch (err) {
        send(res, 500, JSON.stringify({ error: err.message }))
      }
      return
    }

    if (questionsMatch && req.method === 'DELETE') {
      const [, courseId, chapterId] = questionsMatch
      const cachePath = resolve(cacheDir, 'questions', `${courseId}-${chapterId}.json`)
      if (existsSync(cachePath)) await unlink(cachePath).catch(() => {})
      send(res, 200, JSON.stringify({ ok: true }))
      return
    }

    // DELETE a single question from a chapter's cached bank
    const deleteQMatch = url.pathname.match(/^\/api\/questions\/([^/]+)\/([^/]+)\/([^/]+)$/)
    if (deleteQMatch && req.method === 'DELETE') {
      const [, courseId, chapterId, questionId] = deleteQMatch
      const cachePath = resolve(cacheDir, 'questions', `${courseId}-${chapterId}.json`)
      if (!existsSync(cachePath)) {
        send(res, 404, JSON.stringify({ error: 'Chapter has no cached questions' }))
        return
      }
      try {
        const cached = JSON.parse(await readFile(cachePath, 'utf8'))
        const before = cached.questions?.length || 0
        cached.questions = (cached.questions || []).filter((q) => q.id !== questionId)
        const after = cached.questions.length
        if (before === after) {
          send(res, 404, JSON.stringify({ error: 'Question not found' }))
          return
        }
        await writeFile(cachePath, JSON.stringify(cached, null, 2), 'utf8')
        send(res, 200, JSON.stringify({ ok: true, removed: questionId, remaining: after }))
      } catch (err) {
        send(res, 500, JSON.stringify({ error: err.message }))
      }
      return
    }

    const regenMatch = url.pathname.match(/^\/api\/questions\/([^/]+)\/([^/]+)\/regenerate$/)
    if (regenMatch && req.method === 'POST') {
      const [, courseId, chapterId] = regenMatch
      const state = await readState()
      const course = state.courses.find((c) => c.id === courseId)
      const chapter = course?.chapters?.find((c) => c.id === chapterId)
      if (!course || !chapter) {
        send(res, 404, JSON.stringify({ error: 'Unknown course or chapter' }))
        return
      }
      try {
        const body = await readBody(req)
        const requestedTypes = Array.isArray(body.types) ? body.types : []
        const count = Math.max(4, Math.min(30, Number(body.count) || 16))
        const customPrompt = typeof body.customPrompt === 'string' ? body.customPrompt.trim().slice(0, 2000) : ''
        const cachePath = resolve(cacheDir, 'questions', `${courseId}-${chapterId}.json`)
        // Delete existing cache — regenerate replaces, not appends
        if (existsSync(cachePath)) await unlink(cachePath).catch(() => {})
        const chapterContent = await readKbFile(state, course, chapter.file).catch(() => null)
        if (!chapterContent) throw new Error(`Chapter content not readable (${chapter.file})`)
        // Use generateAdditionalQuestions with empty existing[] to generate from scratch
        // with the user's type/count/customPrompt overrides.
        const newOnes = await generateAdditionalQuestions(course, chapter, chapterContent, [], requestedTypes, count, customPrompt)
        const stamped = newOnes.map((q, i) => ({ ...q, id: `gen-${chapter.id}-${i}` }))
        const payload = {
          generatedAt: new Date().toISOString(),
          chapterId: chapter.id,
          questions: stamped
        }
        await ensureDir(dirname(cachePath))
        await writeFile(cachePath, JSON.stringify(payload, null, 2), 'utf8')
        send(res, 200, JSON.stringify({ ok: true, payload }))
      } catch (err) {
        send(res, 500, JSON.stringify({ error: err.message }))
      }
      return
    }

    const extendMatch = url.pathname.match(/^\/api\/questions\/([^/]+)\/([^/]+)\/extend$/)
    if (extendMatch && req.method === 'POST') {
      const [, courseId, chapterId] = extendMatch
      const state = await readState()
      const course = state.courses.find((c) => c.id === courseId)
      const chapter = course?.chapters?.find((c) => c.id === chapterId)
      if (!course || !chapter) {
        send(res, 404, JSON.stringify({ error: 'Unknown course or chapter' }))
        return
      }
      try {
        const body = await readBody(req)
        const requestedTypes = Array.isArray(body.types) && body.types.length ? body.types : ['written', 'calc', 'tf', 'mc', 'pseudocode']
        const count = Math.max(1, Math.min(30, Number(body.count) || 8))
        const customPrompt = typeof body.customPrompt === 'string' ? body.customPrompt.trim().slice(0, 2000) : ''
        const cachePath = resolve(cacheDir, 'questions', `${courseId}-${chapterId}.json`)
        const existing = existsSync(cachePath) ? JSON.parse(await readFile(cachePath, 'utf8')) : { questions: [] }
        const chapterContent = await readKbFile(state, course, chapter.file).catch(() => null)
        if (!chapterContent) throw new Error(`Chapter content not readable (${chapter.file})`)
        const newOnes = await generateAdditionalQuestions(course, chapter, chapterContent, existing.questions || [], requestedTypes, count, customPrompt)
        const idBase = (existing.questions || []).filter((q) => q.id.startsWith('gen-')).length
        const stamped = newOnes.map((q, i) => ({ ...q, id: `gen-${chapter.id}-${idBase + i}` }))
        const payload = {
          generatedAt: new Date().toISOString(),
          chapterId: chapter.id,
          questions: [...(existing.questions || []), ...stamped]
        }
        await ensureDir(dirname(cachePath))
        await writeFile(cachePath, JSON.stringify(payload, null, 2), 'utf8')
        send(res, 200, JSON.stringify({ added: stamped.length, total: payload.questions.length, payload }))
      } catch (err) {
        send(res, 500, JSON.stringify({ error: err.message }))
      }
      return
    }

    const searchMatch = url.pathname.match(/^\/api\/search\/([^/]+)$/)
    if (searchMatch && req.method === 'GET') {
      const courseId = decodeURIComponent(searchMatch[1])
      const q = url.searchParams.get('q') || ''
      const limit = Math.min(60, parseInt(url.searchParams.get('limit') || '30', 10) || 30)
      try {
        const state = await readState()
        const course = state.courses.find((c) => c.id === courseId)
        if (!course) { send(res, 404, JSON.stringify({ error: 'Unknown course' })); return }
        const results = q.length < 2 ? [] : await searchCourse(state, course, q, limit)
        send(res, 200, JSON.stringify({ query: q, results }))
      } catch (err) {
        send(res, 500, JSON.stringify({ error: err.message }))
      }
      return
    }

    if (url.pathname === '/api/grade' && req.method === 'POST') {
      const body = await readBody(req)
      try {
        const { correction, score } = await gradeAttempt(body)
        let savedAsMistake = null

        // Auto-save to mistake bank if score < 7
        if (score != null && score < 7 && body.question && body._meta?.courseId) {
          const record = {
            id: `mistake-${randomUUID()}`,
            courseId: body._meta.courseId,
            chapterId: body._meta.chapterId || null,
            questionId: body.question.id,
            type: body.question.type,
            difficulty: body.question.difficulty,
            question: body.question.question,
            options: body.question.options,
            expected: body.question.expected,
            source: body.question.source,
            attempt: body.attempt,
            correction,
            score,
            createdAt: new Date().toISOString(),
            resolvedAt: null
          }
          await addMistake(record)
          savedAsMistake = record.id
        }

        // Auto-add to SR deck for any graded question (so the deck fills up as you practice)
        if (body.question?.id) {
          const srState = await readSrState()
          srState.cards = srState.cards || {}
          if (!srState.cards[body.question.id]) {
            srState.cards[body.question.id] = {
              ease: 2.5, interval: 0, repetitions: 0,
              lastReviewed: null, dueAt: new Date().toISOString(), history: []
            }
            await writeSrState(srState)
          }
        }

        send(res, 200, JSON.stringify({ correction, score, savedAsMistake }))
      } catch (err) {
        send(res, 500, JSON.stringify({ error: err.message }))
      }
      return
    }

    if (url.pathname === '/api/sr/bulk-add' && req.method === 'POST') {
      const body = await readBody(req)
      const ids = Array.isArray(body.questionIds) ? body.questionIds : []
      const srState = await readSrState()
      srState.cards = srState.cards || {}
      let added = 0
      for (const id of ids) {
        if (!srState.cards[id]) {
          srState.cards[id] = { ease: 2.5, interval: 0, repetitions: 0, lastReviewed: null, dueAt: new Date().toISOString(), history: [] }
          added++
        }
      }
      if (added) await writeSrState(srState)
      send(res, 200, JSON.stringify({ added, total: Object.keys(srState.cards).length }))
      return
    }

    if (url.pathname === '/api/mistakes' && req.method === 'GET') {
      const filter = { open: url.searchParams.get('open') !== 'false' }
      if (url.searchParams.get('courseId')) filter.courseId = url.searchParams.get('courseId')
      if (url.searchParams.get('chapterId')) filter.chapterId = url.searchParams.get('chapterId')
      send(res, 200, JSON.stringify(await readMistakes(filter)))
      return
    }

    const mistakeMatch = url.pathname.match(/^\/api\/mistakes\/([^/]+)\/?(resolve)?$/)
    if (mistakeMatch && req.method === 'POST' && mistakeMatch[2] === 'resolve') {
      const updated = await updateMistake(mistakeMatch[1], { resolvedAt: new Date().toISOString() })
      send(res, updated ? 200 : 404, JSON.stringify(updated ? { ok: true, mistake: updated } : { error: 'Not found' }))
      return
    }
    if (mistakeMatch && req.method === 'DELETE') {
      const ok = await deleteMistake(mistakeMatch[1])
      send(res, ok ? 200 : 404, JSON.stringify({ ok }))
      return
    }

    if (url.pathname === '/api/sr/due' && req.method === 'GET') {
      const due = await gatherSrDue()
      const state = await readState()
      const enriched = []
      for (const card of due.slice(0, 60)) {
        const found = await findQuestion(state, card.id)
        if (found) enriched.push({ id: card.id, card, ...found })
      }
      const srState = await readSrState()
      const allIds = Object.keys(srState.cards || {})
      send(res, 200, JSON.stringify({ due: enriched, totalCards: allIds.length, dueCount: due.length, allIds }))
      return
    }

    if (url.pathname === '/api/sr/add' && req.method === 'POST') {
      const body = await readBody(req)
      const state = await readSrState()
      state.cards = state.cards || {}
      if (!state.cards[body.questionId]) {
        state.cards[body.questionId] = { ease: 2.5, interval: 0, repetitions: 0, lastReviewed: null, dueAt: new Date().toISOString(), history: [] }
        await writeSrState(state)
      }
      send(res, 200, JSON.stringify({ ok: true, card: state.cards[body.questionId] }))
      return
    }

    if (url.pathname === '/api/sr/review' && req.method === 'POST') {
      const body = await readBody(req)
      const state = await readSrState()
      state.cards = state.cards || {}
      const card = state.cards[body.questionId] || { ease: 2.5, interval: 0, repetitions: 0, lastReviewed: null, dueAt: nowDueIso(), history: [] }
      const updated = sm2(card, Number(body.quality))
      card.ease = updated.ease
      card.interval = updated.interval
      card.repetitions = updated.repetitions
      card.lastReviewed = updated.lastReviewed
      card.dueAt = updated.dueAt
      card.history = card.history || []
      card.history.push({ at: updated.lastReviewed, quality: Number(body.quality) })
      state.cards[body.questionId] = card
      await writeSrState(state)
      send(res, 200, JSON.stringify({ ok: true, card }))
      return
    }

    if (url.pathname === '/api/sr/remove' && req.method === 'POST') {
      const body = await readBody(req)
      const state = await readSrState()
      if (state.cards?.[body.questionId]) {
        delete state.cards[body.questionId]
        await writeSrState(state)
      }
      send(res, 200, JSON.stringify({ ok: true }))
      return
    }

    // ----- Per-course / per-chapter flashcards -----
    const fcGenAllMatch = url.pathname.match(/^\/api\/flashcards\/([^/]+)\/generate-all$/)
    if (fcGenAllMatch && req.method === 'POST') {
      const courseId = decodeURIComponent(fcGenAllMatch[1])
      try {
        const body = await readBody(req)
        const count = 'auto' // bulk runs always let codex pick per-chapter
        const customPrompt = (body.customPrompt || '').trim()
        const cstate = await readState()
        const course = cstate.courses.find((c) => c.id === courseId)
        if (!course || !course.chapters?.length) {
          send(res, 404, JSON.stringify({ error: 'Unknown course' }))
          return
        }
        const all = await readFlashcards()
        all.cards = all.cards || []
        const results = []
        for (const chapter of course.chapters) {
          try {
            const generated = await generateFlashcards(cstate, course, chapter, count, customPrompt)
            const newCards = generated.map((g) => ({
              id: `fc-${randomUUID()}`,
              courseId,
              chapterId: chapter.id,
              front: g.front,
              back: g.back,
              source: 'ai',
              createdAt: new Date().toISOString(),
              sr: initialSr()
            }))
            all.cards.push(...newCards)
            results.push({ chapterId: chapter.id, count: newCards.length })
          } catch (err) {
            results.push({ chapterId: chapter.id, error: err.message })
          }
        }
        await writeFlashcards(all)
        send(res, 200, JSON.stringify({ results }))
      } catch (err) {
        send(res, 500, JSON.stringify({ error: err.message }))
      }
      return
    }

    const fcGenMatch = url.pathname.match(/^\/api\/flashcards\/([^/]+)\/([^/]+)\/generate$/)
    if (fcGenMatch && req.method === 'POST') {
      const courseId = decodeURIComponent(fcGenMatch[1])
      const chapterId = decodeURIComponent(fcGenMatch[2])
      try {
        const body = await readBody(req)
        const count = body.count === 'auto'
          ? 'auto'
          : Math.min(30, Math.max(1, parseInt(body.count, 10) || 10))
        const customPrompt = (body.customPrompt || '').trim()
        const cstate = await readState()
        const course = cstate.courses.find((c) => c.id === courseId)
        const chapter = course?.chapters?.find((c) => c.id === chapterId)
        if (!course || !chapter) { send(res, 404, JSON.stringify({ error: 'Unknown course or chapter' })); return }
        const generated = await generateFlashcards(cstate, course, chapter, count, customPrompt)
        const all = await readFlashcards()
        all.cards = all.cards || []
        const newCards = generated.map((g) => ({
          id: `fc-${randomUUID()}`,
          courseId,
          chapterId,
          front: g.front,
          back: g.back,
          source: 'ai',
          createdAt: new Date().toISOString(),
          sr: initialSr()
        }))
        all.cards.push(...newCards)
        await writeFlashcards(all)
        send(res, 200, JSON.stringify({ cards: newCards }))
      } catch (err) {
        send(res, 500, JSON.stringify({ error: err.message }))
      }
      return
    }

    const fcReviewMatch = url.pathname.match(/^\/api\/flashcards\/([^/]+)\/([^/]+)\/([^/]+)\/review$/)
    if (fcReviewMatch && req.method === 'POST') {
      const cardId = decodeURIComponent(fcReviewMatch[3])
      const body = await readBody(req)
      const quality = Math.min(5, Math.max(0, parseInt(body.quality, 10)))
      if (isNaN(quality)) { send(res, 400, JSON.stringify({ error: 'quality (0-5) is required' })); return }
      const all = await readFlashcards()
      const c = (all.cards || []).find((x) => x.id === cardId)
      if (!c) { send(res, 404, JSON.stringify({ error: 'Not found' })); return }
      const newSr = sm2(c.sr || initialSr(), quality)
      const history = [...(c.sr?.history || []), { quality, at: new Date().toISOString() }]
      c.sr = { ...newSr, history }
      await writeFlashcards(all)
      send(res, 200, JSON.stringify(c))
      return
    }

    const fcGradeMatch = url.pathname.match(/^\/api\/flashcards\/([^/]+)\/([^/]+)\/([^/]+)\/grade$/)
    if (fcGradeMatch && req.method === 'POST') {
      const courseId = decodeURIComponent(fcGradeMatch[1])
      const chapterId = decodeURIComponent(fcGradeMatch[2])
      const cardId = decodeURIComponent(fcGradeMatch[3])
      try {
        const body = await readBody(req)
        const attempt = String(body.attempt || '').trim()
        if (!attempt) { send(res, 400, JSON.stringify({ error: 'Attempt is required' })); return }
        const cstate = await readState()
        const course = cstate.courses.find((c) => c.id === courseId)
        const chapter = course?.chapters?.find((c) => c.id === chapterId)
        const all = await readFlashcards()
        const card = (all.cards || []).find((x) => x.id === cardId && x.courseId === courseId && x.chapterId === chapterId)
        if (!course || !chapter || !card) { send(res, 404, JSON.stringify({ error: 'Unknown flashcard' })); return }
        const result = await gradeFlashcardRecall({ courseCode: course.code, chapterName: chapter.name, card, attempt })
        send(res, 200, JSON.stringify(result))
      } catch (err) {
        send(res, 500, JSON.stringify({ error: err.message }))
      }
      return
    }

    const fcCardMatch = url.pathname.match(/^\/api\/flashcards\/([^/]+)\/([^/]+)\/([^/]+)$/)
    if (fcCardMatch && req.method === 'PUT') {
      const cardId = decodeURIComponent(fcCardMatch[3])
      const body = await readBody(req)
      const all = await readFlashcards()
      const c = (all.cards || []).find((x) => x.id === cardId)
      if (!c) { send(res, 404, JSON.stringify({ error: 'Not found' })); return }
      if (typeof body.front === 'string' && body.front.trim()) c.front = body.front.trim()
      if (typeof body.back === 'string' && body.back.trim()) c.back = body.back.trim()
      await writeFlashcards(all)
      send(res, 200, JSON.stringify(c))
      return
    }
    if (fcCardMatch && req.method === 'DELETE') {
      const cardId = decodeURIComponent(fcCardMatch[3])
      const all = await readFlashcards()
      const before = (all.cards || []).length
      all.cards = (all.cards || []).filter((c) => c.id !== cardId)
      if (all.cards.length < before) await writeFlashcards(all)
      send(res, 200, JSON.stringify({ ok: true }))
      return
    }

    const fcChapterMatch = url.pathname.match(/^\/api\/flashcards\/([^/]+)\/([^/]+)$/)
    if (fcChapterMatch && req.method === 'POST') {
      const courseId = decodeURIComponent(fcChapterMatch[1])
      const chapterId = decodeURIComponent(fcChapterMatch[2])
      const body = await readBody(req)
      const front = (body.front || '').trim()
      const back = (body.back || '').trim()
      if (!front || !back) { send(res, 400, JSON.stringify({ error: 'front and back are required' })); return }
      const all = await readFlashcards()
      all.cards = all.cards || []
      const newCard = {
        id: `fc-${randomUUID()}`,
        courseId, chapterId,
        front, back,
        source: 'custom',
        createdAt: new Date().toISOString(),
        sr: initialSr()
      }
      all.cards.push(newCard)
      await writeFlashcards(all)
      send(res, 200, JSON.stringify(newCard))
      return
    }

    const fcListMatch = url.pathname.match(/^\/api\/flashcards\/([^/]+)$/)
    if (fcListMatch && req.method === 'GET') {
      const courseId = decodeURIComponent(fcListMatch[1])
      const all = await readFlashcards()
      const cards = (all.cards || []).filter((c) => c.courseId === courseId)
      const byChapter = {}
      for (const c of cards) {
        if (!byChapter[c.chapterId]) byChapter[c.chapterId] = []
        byChapter[c.chapterId].push(c)
      }
      send(res, 200, JSON.stringify({ byChapter }))
      return
    }

    if (url.pathname === '/api/mocks' && req.method === 'GET') {
      send(res, 200, JSON.stringify(await listMockSessions()))
      return
    }
    if (url.pathname === '/api/mocks' && req.method === 'POST') {
      const body = await readBody(req)
      const saved = await saveMockSession(body)
      send(res, 200, JSON.stringify(saved))
      return
    }
    const mockMatch = url.pathname.match(/^\/api\/mocks\/([^/]+)$/)
    if (mockMatch && req.method === 'GET') {
      const session = await readMockSession(mockMatch[1])
      send(res, session ? 200 : 404, JSON.stringify(session || { error: 'Not found' }))
      return
    }

    // /api/mock-toc/:cid          → first exam (legacy)
    // /api/mock-toc/:cid/:eid      → specific exam
    const mockTocMatch = url.pathname.match(/^\/api\/mock-toc\/([^/]+)(?:\/([^/]+))?$/)
    if (mockTocMatch && req.method === 'POST') {
      const courseId = decodeURIComponent(mockTocMatch[1])
      const examId = mockTocMatch[2] ? decodeURIComponent(mockTocMatch[2]) : null
      try {
        const body = await readBody(req)
        if (!Array.isArray(body.pages) || !body.pages.length) {
          send(res, 400, JSON.stringify({ error: 'pages[] is required' }))
          return
        }
        const payload = await buildMockToc(courseId, examId, body.pages)
        send(res, 200, JSON.stringify(payload))
      } catch (err) {
        send(res, 500, JSON.stringify({ error: err.message }))
      }
      return
    }
    if (mockTocMatch && req.method === 'DELETE') {
      const courseId = decodeURIComponent(mockTocMatch[1])
      const examId = mockTocMatch[2] ? decodeURIComponent(mockTocMatch[2]) : null
      const cachePath = mockTocPath(courseId, examId)
      if (existsSync(cachePath)) await unlink(cachePath).catch(() => {})
      send(res, 200, JSON.stringify({ ok: true }))
      return
    }
    if (mockTocMatch && req.method === 'GET') {
      const courseId = decodeURIComponent(mockTocMatch[1])
      const examId = mockTocMatch[2] ? decodeURIComponent(mockTocMatch[2]) : null
      const cachePath = mockTocPath(courseId, examId)
      if (existsSync(cachePath)) {
        try {
          const cached = JSON.parse(await readFile(cachePath, 'utf8'))
          send(res, 200, JSON.stringify(cached))
          return
        } catch {}
      }
      // Legacy fallback: pre-multi-exam single-file location
      const legacyPath = resolve(cacheDir, 'mock-toc', `${courseId}.json`)
      if (existsSync(legacyPath)) {
        try {
          const cached = JSON.parse(await readFile(legacyPath, 'utf8'))
          send(res, 200, JSON.stringify(cached))
          return
        } catch {}
      }
      send(res, 404, JSON.stringify({ error: 'No cached TOC' }))
      return
    }

    const mockQMatch = url.pathname.match(/^\/api\/mock-questions\/([^/]+)$/)
    if (mockQMatch && req.method === 'GET') {
      const courseId = decodeURIComponent(mockQMatch[1])
      const cachePath = resolve(mockQuestionsDir, `${courseId}.json`)
      if (existsSync(cachePath)) {
        try {
          const cached = JSON.parse(await readFile(cachePath, 'utf8'))
          send(res, 200, JSON.stringify(cached))
          return
        } catch {}
      }
      send(res, 404, JSON.stringify({ error: 'Not generated yet' }))
      return
    }
    if (mockQMatch && req.method === 'POST') {
      const courseId = decodeURIComponent(mockQMatch[1])
      try {
        const payload = await loadOrGenerateMockQuestions(courseId, true)
        send(res, 200, JSON.stringify(payload))
      } catch (err) {
        send(res, 500, JSON.stringify({ error: err.message }))
      }
      return
    }
    if (mockQMatch && req.method === 'DELETE') {
      const courseId = decodeURIComponent(mockQMatch[1])
      const cachePath = resolve(mockQuestionsDir, `${courseId}.json`)
      if (existsSync(cachePath)) await unlink(cachePath).catch(() => {})
      send(res, 200, JSON.stringify({ ok: true }))
      return
    }

    // Practice-exam routes are now exam-scoped:
    //   /api/practice-exam/{courseId}/{examId}/parse
    //   /api/practice-exam/{courseId}/{examId}                  (GET / DELETE)
    //   /api/practice-exam/{courseId}/{examId}/guidance/{qid}
    //   /api/practice-exam/{courseId}/{examId}/grade
    const practiceParseMatch = url.pathname.match(/^\/api\/practice-exam\/([^/]+)\/([^/]+)\/parse$/)
    if (practiceParseMatch && req.method === 'POST') {
      const courseId = decodeURIComponent(practiceParseMatch[1])
      const examId = decodeURIComponent(practiceParseMatch[2])
      try {
        const body = await readBody(req)
        if (!Array.isArray(body.questionPages) || !body.questionPages.length) {
          send(res, 400, JSON.stringify({ error: 'questionPages[] is required' }))
          return
        }
        const payload = await parseExamPaper(courseId, examId, body.questionPages, body.solutionsPages || [])
        send(res, 200, JSON.stringify(payload))
      } catch (err) {
        send(res, 500, JSON.stringify({ error: err.message }))
      }
      return
    }
    const practiceGetMatch = url.pathname.match(/^\/api\/practice-exam\/([^/]+)\/([^/]+)$/)
    if (practiceGetMatch && req.method === 'GET') {
      const courseId = decodeURIComponent(practiceGetMatch[1])
      const examId = decodeURIComponent(practiceGetMatch[2])
      try {
        const cached = await loadPracticeExamPayload(courseId, examId)
        if (cached) {
          send(res, 200, JSON.stringify(cached))
          return
        }
      } catch (err) {
        send(res, 500, JSON.stringify({ error: err.message }))
        return
      }
      send(res, 404, JSON.stringify({ error: 'Not parsed yet' }))
      return
    }
    if (practiceGetMatch && req.method === 'DELETE') {
      const courseId = decodeURIComponent(practiceGetMatch[1])
      const examId = decodeURIComponent(practiceGetMatch[2])
      const key = examCacheKey(courseId, examId)
      const cachePath = resolve(practiceExamDir, `${key}.json`)
      const guidancePath = resolve(practiceExamDir, `${key}.guidance.json`)
      if (existsSync(cachePath)) await unlink(cachePath).catch(() => {})
      if (existsSync(guidancePath)) await unlink(guidancePath).catch(() => {})
      send(res, 200, JSON.stringify({ ok: true }))
      return
    }
    const practiceGuidanceMatch = url.pathname.match(/^\/api\/practice-exam\/([^/]+)\/([^/]+)\/guidance\/([^/]+)$/)
    if (practiceGuidanceMatch && req.method === 'POST') {
      const [, courseId, examId, questionId] = practiceGuidanceMatch
      try {
        const guidance = await generateGuidance(decodeURIComponent(courseId), decodeURIComponent(examId), decodeURIComponent(questionId))
        send(res, 200, JSON.stringify({ guidance }))
      } catch (err) {
        send(res, 500, JSON.stringify({ error: err.message }))
      }
      return
    }
    const practiceGradeMatch = url.pathname.match(/^\/api\/practice-exam\/([^/]+)\/([^/]+)\/grade$/)
    if (practiceGradeMatch && req.method === 'POST') {
      const courseId = decodeURIComponent(practiceGradeMatch[1])
      const examId = decodeURIComponent(practiceGradeMatch[2])
      try {
        const body = await readBody(req)
        if (!body.questionId || (typeof body.attempt !== 'string' && !Array.isArray(body.attemptImages))) {
          send(res, 400, JSON.stringify({ error: 'questionId and attempt or attemptImages are required' }))
          return
        }
        const correction = await gradePracticeAttempt(courseId, examId, body.questionId, body.attempt || '', body.attemptImages)
        const score = parseScore(correction)
        send(res, 200, JSON.stringify({ correction, score }))
      } catch (err) {
        send(res, 500, JSON.stringify({ error: err.message }))
      }
      return
    }

    if (url.pathname === '/api/chat' && req.method === 'POST') {
      const body = await readBody(req)
      try {
        const reply = await chat(body)
        send(res, 200, JSON.stringify({ reply }))
      } catch (err) {
        send(res, 500, JSON.stringify({ error: err.message }))
      }
      return
    }

    const requested = url.pathname === '/' ? '/index.html' : url.pathname
    const filePath = resolve(join(publicDir, requested))
    if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
      send(res, 404, 'Not found', 'text/plain; charset=utf-8')
      return
    }

    res.writeHead(200, {
      'Content-Type': mime[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    })
    res.end(await readFile(filePath))
  } catch (error) {
    send(res, 500, JSON.stringify({ error: error.message }))
  }
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${port} is already in use.`)
    console.error(`Something else is listening — likely another copy of this server still running.`)
    console.error(`\nFix:`)
    console.error(`  lsof -ti:${port} | xargs kill        # stop the other one`)
    console.error(`  PORT=4178 npm start                  # or start on a different port`)
    process.exit(1)
  }
  if (err.code === 'EACCES') {
    console.error(`\nPermission denied binding to port ${port}.`)
    console.error(`Pick a port above 1024 (PORT=4177 npm start), or run with elevated privileges.`)
    process.exit(1)
  }
  console.error(`\nServer error: ${err.message}`)
  process.exit(1)
})

server.listen(port, () => {
  console.log(`Exam Study Platform running at http://localhost:${port}`)
  console.log(`State file: ${dataPath}`)
  console.log(`LLM provider: ${LLM_PROVIDER}`)
  if (LLM_PROVIDER === 'codex') console.log(`Codex bin: ${CODEX_BIN}${existsSync(CODEX_BIN) ? '' : ' (NOT FOUND)'}`)
  if (LLM_PROVIDER === 'claude') console.log(`Claude bin: ${CLAUDE_BIN}`)
  if (LLM_PROVIDER === 'api') console.log(`Model: ${ANTHROPIC_MODEL} (API key ${ANTHROPIC_API_KEY ? 'set' : 'MISSING'})`)
})
