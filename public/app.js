const app = document.querySelector('#app')

const categoryLabels = {
  material: 'Material',
  practice: 'Exercises',
  review: 'Review',
  'exam-practice': 'Exam practice',
  readiness: 'Readiness'
}

const categoryOrder = ['material', 'practice', 'review', 'exam-practice', 'readiness']

const masteryLabels = {
  0: 'Untouched',
  1: 'Seen',
  2: 'Understood',
  3: 'Fluent',
  4: 'Exam-ready'
}

const SORTS = {
  priority: { label: 'Priority (high→low)', cmp: (a, b) => (a.priority - b.priority) || (b.mastery - a.mastery) },
  'mastery-asc': { label: 'Mastery (low→high)', cmp: (a, b) => (a.mastery - b.mastery) || (a.priority - b.priority) },
  'mastery-desc': { label: 'Mastery (high→low)', cmp: (a, b) => (b.mastery - a.mastery) || (a.priority - b.priority) },
  'last-touched': { label: 'Last touched (recent first)', cmp: (a, b) => (b.masteryUpdatedAt || '').localeCompare(a.masteryUpdatedAt || '') },
  stale: { label: 'Stalest first', cmp: (a, b) => (a.masteryUpdatedAt || '').localeCompare(b.masteryUpdatedAt || '') },
  title: { label: 'Title (A→Z)', cmp: (a, b) => a.title.localeCompare(b.title) }
}

const QUESTION_TYPE_LABELS = {
  written: 'Written',
  calc: 'Calculation',
  tf: 'True/False',
  mc: 'Best option',
  multi: 'Multi-select',
  pseudocode: 'Pseudocode'
}

const PLANNING_TABS = [
  ['overview', 'Overview'],
  ['courses', 'Courses'],
  ['calendar', 'Calendar'],
  ['documents', 'Documents'],
  ['progress', 'Progress'],
  ['planner', 'Planner'],
  ['settings', 'Settings']
]
const PLANNING_TAB_ALIASES = { curriculum: 'courses', credits: 'progress', requirements: 'progress' }
let state = null
// Route tables are declared before parseRoute runs on cold load.
const PRACTICE_TABS = [['questions', 'Questions'], ['flashcards', 'Flashcards'], ['mistakes', 'Mistakes'], ['mocks', 'Mocks']]
const ACCOUNT_TABS = [['profile', 'Profile'], ['usage', 'AI usage'], ['api', 'API access'], ['data', 'Data & privacy']]

let route = parseRoute()
let academicsData = null
let academicsLoading = false
let academicsError = null
let editorialProgrammesData = null
let editorialProgrammesLoading = false
let editorialProgrammesError = null
let planningProfileEditing = false
let planningCourseComposerOpen = false
let planningEventComposerOpen = false
let planningGateComposerOpen = false
let planningStructureOpen = false
let planningExpandedCourse = null
let planningFocusApplied = null
let planningExpandedEvent = null
let planningExpandedGate = null
const planningIntake = {
  step: 'source',
  files: [],
  description: '',
  processingFiles: false,
  analysing: false,
  saving: false,
  error: null,
  draft: null,
  manual: false,
  programmeId: null,
  programmeVersionId: null,
  programmeConfig: null
}
const compactPlanningMedia = window.matchMedia('(max-width: 700px)')
compactPlanningMedia.addEventListener('change', () => {
  if (planningIntake.step === 'programme') render()
})
let chapterCache = new Map()
let questionsCache = new Map()
let practiceCache = null
const practiceView = { courseId: 'all', index: 0 }
let questionsSummaryCache = new Map()
let courseTocCache = new Map()
const attemptState = new Map()
let dialogReturnFocusSelector = null

function stableFocusSelector(element) {
  if (!element || element === document.body) return null
  if (element.id) return `#${CSS.escape(element.id)}`
  const dataAttribute = element.getAttributeNames?.().find((name) => name.startsWith('data-'))
  if (dataAttribute) {
    const value = element.getAttribute(dataAttribute)
    return value ? `[${dataAttribute}="${CSS.escape(value)}"]` : `[${dataAttribute}]`
  }
  const ariaLabel = element.getAttribute?.('aria-label')
  return ariaLabel ? `[aria-label="${CSS.escape(ariaLabel)}"]` : null
}

// ----- attemptState persistence (localStorage) -----
// Persists answers + corrections + scores across page refreshes so the user
// doesn't have to re-answer the same questions every reload.
const ATTEMPT_STORAGE_KEY = 'attempt-state:v1'

function saveAttemptState() {
  try {
    const obj = {}
    for (const [k, v] of attemptState) {
      // Never persist the transient `grading` flag — should always be false after reload
      const { grading, ...rest } = v
      obj[k] = rest
    }
    localStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(obj))
  } catch (e) {
    // Quota exceeded — fall back to a slimmer version that drops images
    if (e.name === 'QuotaExceededError' || /quota/i.test(e.message || '')) {
      try {
        const slim = {}
        for (const [k, v] of attemptState) {
          const { images, grading, ...rest } = v
          slim[k] = rest
        }
        localStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(slim))
      } catch {}
    }
  }
}

function loadAttemptState() {
  try {
    const raw = localStorage.getItem(ATTEMPT_STORAGE_KEY)
    if (!raw) return
    const obj = JSON.parse(raw)
    for (const [k, v] of Object.entries(obj || {})) {
      attemptState.set(k, v)
    }
  } catch {}
}

// Monkey-patch attemptState.set to auto-save (debounced).
// This means every existing call site (textarea input, image drop, grade response, etc.)
// automatically persists without needing per-callsite changes.
const _origAttemptSet = Map.prototype.set
attemptState.set = function (key, value) {
  const result = _origAttemptSet.call(this, key, value)
  clearTimeout(attemptState._saveTimer)
  attemptState._saveTimer = setTimeout(saveAttemptState, 300)
  return result
}

// Load any previously saved state immediately so the first render has it
loadAttemptState()

// ----- SR (flashcard deck) membership tracking -----
// Tracks which question IDs are already in the SR deck so the "+ Add to flashcards"
// button can render as "✓ In SR" (disabled) for cards already added.
let srMembership = new Set()

function uiIcon(name) {
  const paths = {
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    chevronRight: '<path d="m9 5 7 7-7 7"/>',
    chevronDown: '<path d="m5 9 7 7 7-7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    play: '<path d="m9 6 9 6-9 6z"/>',
    shuffle: '<path d="M4 7h3c4 0 6 10 10 10h3M17 4l3 3-3 3M4 17h3c1.5 0 2.7-1.3 3.8-3M17 14l3 3-3 3"/>',
    timer: '<circle cx="12" cy="13" r="7"/><path d="M9 2h6M12 6v7l4 2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
    sparkle: '<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3zM18 14l.7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14z"/>'
    ,search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>'
    ,refresh: '<path d="M20 7v5h-5M4 17v-5h5M6.1 8A7 7 0 0 1 18 6l2 6M17.9 16A7 7 0 0 1 6 18l-2-6"/>'
    ,edit: '<path d="M4 20h4l11-11-4-4L4 16v4zM13.5 6.5l4 4"/>'
    ,list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/>'
    ,download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>'
    ,trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>'
    ,upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>'
    ,file: '<path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6M9 17h6"/>'
    ,check: '<path d="m5 12 4 4L19 6"/>'
    ,arrowLeft: '<path d="m15 5-7 7 7 7"/>'
    ,user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>'
    ,home: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>'
    ,book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5V5.5M8 7h8"/>'
    ,layers: '<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5"/>'
    ,calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'
    ,chart: '<path d="M4 20h16M7 16v-5M12 16V6M17 16v-8"/>'
    ,flame: '<path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.5.5-2.5 1.5-3.5.2 1.2.8 2 1.5 2.5C11 8 11.5 5.5 12 3z"/>'
    ,database: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>'
    ,shield: '<path d="M12 3 5 6v6c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6z"/>'
    ,logout: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>'
    ,target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>'
    ,clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'
    ,alert: '<path d="M12 4 2.5 20h19zM12 10v4M12 17.5v.5"/>'
    ,zap: '<path d="M13 3 4 14h6l-1 7 9-11h-6z"/>'
  }
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`
}

function setSrMembership(ids) {
  srMembership = new Set(Array.isArray(ids) ? ids : [])
}

function isInSr(questionId) {
  return srMembership.has(questionId)
}

function srButtonHtml(questionId) {
  if (isInSr(questionId)) {
    return `<button type="button" class="btn btn-ghost btn-success" disabled title="Already in your flashcard deck">✓ In flashcards</button>`
  }
  return `<button type="button" class="btn btn-ghost" data-sr-add="${questionId}">${uiIcon('plus')} Add to flashcards</button>`
}

// ----- Course search + cross-chapter navigation -----
const searchState = {
  courseId: null,
  query: '',              // live input value (updated on every keystroke)
  lastFetchedQuery: null, // what was last actually fetched
  results: [],
  loading: false,
  error: null,
  open: false,
  selectedIdx: -1
}
let _searchDebounce = null
let _searchPendingFocus = false
let pendingHeadingScroll = null // { courseId, chapterId, slug }
let courseChaptersCollapsed = false
try {
  courseChaptersCollapsed = localStorage.getItem('course-chapters-collapsed') === 'true'
} catch {}

function resetSearch() {
  searchState.query = ''
  searchState.lastFetchedQuery = null
  searchState.results = []
  searchState.loading = false
  searchState.error = null
  searchState.open = false
  searchState.selectedIdx = -1
}

async function runSearch(courseId, query) {
  // Re-fetch only when query OR course actually changed since the last successful fetch.
  if (query === searchState.lastFetchedQuery && courseId === searchState.courseId && searchState.results.length) return
  searchState.courseId = courseId
  searchState.query = query
  if (query.trim().length < 2) {
    searchState.lastFetchedQuery = null
    searchState.results = []
    searchState.loading = false
    searchState.error = null
    searchState.selectedIdx = -1
    render()
    return
  }
  searchState.loading = true
  searchState.error = null
  render()
  try {
    const data = await fetchJson(`/api/search/${encodeURIComponent(courseId)}?q=${encodeURIComponent(query)}`)
    // Guard: if the user kept typing while we were waiting, drop this stale response.
    if (searchState.query !== query || searchState.courseId !== courseId) return
    searchState.lastFetchedQuery = query
    searchState.results = data.results || []
    searchState.selectedIdx = data.results.length ? 0 : -1
    searchState.loading = false
  } catch (err) {
    if (searchState.query !== query || searchState.courseId !== courseId) return
    searchState.error = err.message
    searchState.results = []
    searchState.loading = false
  }
  render()
}

function openSearchResult(r) {
  if (!r) return
  const cid = searchState.courseId
  pendingHeadingScroll = { courseId: cid, chapterId: r.chapterId, slug: r.headingSlug }
  resetSearch()
  searchState.open = false
  const target = `#/course/${cid}/chapter/${r.chapterId}`
  if (window.location.hash === target) {
    // Same page — hashchange won't fire, so close the popup and scroll directly.
    render()
  } else {
    window.location.hash = target
  }
}

function defaultSearchCourseId() {
  if (route.courseId) return route.courseId
  if (route.id && state?.courses?.find((c) => c.id === route.id)) return route.id
  return state?.courses?.[0]?.id || null
}

function openSearchPopup() {
  const cid = searchState.courseId || defaultSearchCourseId()
  if (!cid) return
  searchState.courseId = cid
  searchState.open = true
  _searchPendingFocus = true
  render()
}

function renderSearchTrigger() {
  return `
    <button type="button" class="app-search-trigger" data-search-open title="Search course (⌘⇧F)">
      <span class="nav-icon search-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg></span>
      <span class="nav-label app-search-label">Search<small>⌘⇧F</small></span>
    </button>
  `
}

function renderSearchPopup() {
  if (!searchState.open) return ''
  if (!searchState.courseId) searchState.courseId = defaultSearchCourseId()
  const cid = searchState.courseId
  const course = state?.courses?.find((c) => c.id === cid)
  return `
    <div class="search-overlay" data-search-overlay>
      <div class="search-popup" role="dialog" aria-modal="true" aria-labelledby="search-popup-title">
        <header class="search-popup-head">
          <div>
            <h2 id="search-popup-title">Search course material</h2>
            <p>${course ? `Searching ${escapeHtml(course.code)} · ${escapeHtml(course.name)}` : 'Find a chapter, topic, definition, or worked example.'}</p>
          </div>
          <button type="button" class="search-popup-close" data-search-close aria-label="Close search">${uiIcon('close')}</button>
        </header>
        <label class="search-popup-bar">
          <span class="search-popup-icon" aria-hidden="true">${uiIcon('search')}</span>
          <span class="sr-only">Search the selected course</span>
          <input type="search" class="search-popup-input" placeholder="Search chapters and topics" value="${escapeHtml(searchState.query)}" data-search-input="${cid || ''}" autocomplete="off" spellcheck="false" />
          ${searchState.query ? `<button type="button" class="search-popup-clear" data-search-clear aria-label="Clear search">${uiIcon('close')}</button>` : '<kbd class="search-popup-shortcut">⌘⇧F</kbd>'}
        </label>
        ${state?.courses?.length > 1 ? `
          <div class="search-popup-scope">
            <span>Search in</span>
            <div class="search-popup-courses" role="tablist" aria-label="Course to search">
              ${state.courses.map((c) => `
                <button type="button" role="tab" aria-selected="${c.id === cid}" class="search-popup-course-pill ${c.id === cid ? 'is-active' : ''}" data-search-course="${c.id}">
                  <span class="dot" style="background:${c.accent}"></span>
                  <strong>${escapeHtml(c.code)}</strong>${c.shortName ? `<em>${escapeHtml(c.shortName)}</em>` : ''}
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}
        <div class="search-popup-results" role="listbox">
          ${searchState.loading ? '<div class="search-popup-status"><span class="search-status-mark is-loading"></span><div><strong>Searching course material</strong><span>Checking chapter content and headings…</span></div></div>' : ''}
          ${searchState.error ? `<div class="search-popup-status error"><span class="search-status-mark">!</span><div><strong>Search unavailable</strong><span>${escapeHtml(searchState.error)}</span></div></div>` : ''}
          ${!searchState.loading && !searchState.error && searchState.query.trim().length < 2 ? `<div class="search-popup-status empty"><span class="search-status-mark">${uiIcon('search')}</span><div><strong>Find anything in this course</strong><span>Enter at least two characters to search chapters, topics, and examples.</span></div></div>` : ''}
          ${!searchState.loading && !searchState.error && searchState.query.trim().length >= 2 && searchState.results.length === 0 ? '<div class="search-popup-status empty"><span class="search-status-mark">0</span><div><strong>No matches</strong><span>Try a broader term or select another course.</span></div></div>' : ''}
          ${searchState.results.map((r, i) => `
            <button type="button" class="search-popup-result ${i === searchState.selectedIdx ? 'is-selected' : ''}" data-search-result="${i}" role="option" aria-selected="${i === searchState.selectedIdx}">
              <span class="search-popup-result-head">
                <small>Ch ${escapeHtml(r.chapterId)}</small><strong>${escapeHtml(r.chapterName)}</strong>
                ${r.headingText && r.headingText !== r.chapterName ? `<span class="search-popup-result-heading">${escapeHtml(r.headingText)}</span>` : ''}
              </span>
              <span class="search-popup-result-snippet">${escapeHtml(r.snippet)}</span>
              <span class="search-popup-result-open" aria-hidden="true">${uiIcon('chevronRight')}</span>
            </button>
          `).join('')}
        </div>
        <div class="search-popup-foot" aria-hidden="true">
          <span><kbd>↑↓</kbd> Select</span>
          <span><kbd>Enter</kbd> Open</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  `
}

function renderCourseChaptersSection(course, currentChapterId) {
  if (!course.chapters?.length) return ''
  const collapsed = courseChaptersCollapsed
  return `
    <div class="course-chapters-section ${collapsed ? 'is-collapsed' : ''}">
      <button type="button" class="course-chapters-toggle" data-course-chapters-toggle>
        <span class="course-chapters-caret">${uiIcon(collapsed ? 'chevronRight' : 'chevronDown')}</span>
        <span>Course chapters</span>
        <small>${course.chapters.length}</small>
      </button>
      ${!collapsed ? `
        <ol class="course-chapters-list">
          ${course.chapters.map((ch) => `
            <li class="${ch.id === currentChapterId ? 'is-current' : ''}">
              <a href="#/course/${course.id}/chapter/${ch.id}">
                <span class="course-chapter-num">${escapeHtml(ch.id)}</span>
                <span class="course-chapter-name">${escapeHtml(ch.name)}</span>
              </a>
            </li>
          `).join('')}
        </ol>
      ` : ''}
    </div>
  `
}

// ----- Custom multi-select dropdown (checkbox-style) for question filters -----
// filterKey: 'types' | 'sources' — key into questionFilter
// allLabel: text shown when no specific selection (default state)
// options: [{ value, label }]
function renderMultiSelect(filterKey, allLabel, options) {
  const selected = questionFilter[filterKey] || []
  const isOpen = questionFilter.openDd === filterKey

  let summary
  if (selected.length === 0 || selected.length === options.length) {
    summary = allLabel
  } else if (selected.length === 1) {
    const opt = options.find((o) => o.value === selected[0])
    summary = opt ? opt.label : `${selected.length} selected`
  } else if (selected.length <= 2) {
    summary = selected.map((v) => {
      const o = options.find((o) => o.value === v)
      return o ? o.label : v
    }).join(', ')
  } else {
    summary = `${selected.length} selected`
  }

  return `
    <div class="multi-dd ${isOpen ? 'is-open' : ''}" data-multi-dd="${filterKey}">
      <button type="button" class="multi-dd-toggle ${selected.length > 0 ? 'has-selection' : ''}" data-multi-dd-toggle="${filterKey}" aria-expanded="${isOpen}">
        <span class="multi-dd-label">${escapeHtml(summary)}</span>
        <span class="multi-dd-arrow">${uiIcon('chevronDown')}</span>
      </button>
      ${isOpen ? `
        <div class="multi-dd-panel" role="menu">
          <div class="multi-dd-actions">
            <button type="button" class="multi-dd-action" data-multi-dd-all="${filterKey}">All</button>
            <button type="button" class="multi-dd-action" data-multi-dd-clear="${filterKey}">Clear</button>
          </div>
          ${options.map((opt) => `
            <label class="multi-dd-option">
              <input type="checkbox" data-multi-dd-value="${filterKey}:${opt.value}" ${selected.includes(opt.value) ? 'checked' : ''}>
              <span>${escapeHtml(opt.label)}</span>
            </label>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8 MB / image

async function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(new Error('Could not read file'))
    r.readAsDataURL(file)
  })
}

async function pickedImages(items) {
  const out = []
  for (const it of items) {
    if (!it || !it.type || !it.type.startsWith('image/')) continue
    if (it.size && it.size > MAX_IMAGE_BYTES) {
      alert(`${it.name || 'image'} is ${(it.size / 1024 / 1024).toFixed(1)} MB — over the 8 MB limit.`)
      continue
    }
    try { out.push(await fileToDataURL(it)) } catch {}
  }
  return out
}

function shortImageLabel(dataUrl, idx) {
  const m = (dataUrl || '').match(/^data:image\/([a-zA-Z]+);/)
  return `${m ? m[1].toUpperCase() : 'IMG'} #${idx + 1}`
}

function renderImageThumbs(images, removeAttr) {
  if (!images || !images.length) return ''
  return `
    <div class="attempt-thumbs">
      ${images.map((src, i) => `
        <div class="attempt-thumb" title="${shortImageLabel(src, i)}">
          <img src="${src}" alt="attempt ${i + 1}"/>
          <button type="button" class="attempt-thumb-remove" data-${removeAttr}="${i}" title="Remove">${uiIcon('close')}</button>
        </div>
      `).join('')}
    </div>
  `
}

const MAX_PLANNING_SOURCES = 6
const MAX_PLANNING_SOURCE_BYTES = 15 * 1024 * 1024
const MAX_PLANNING_IMAGE_PAGES = 4

function formatFileSize(bytes) {
  const value = Math.max(0, Number(bytes) || 0)
  return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`
}

async function compressPlanningImage(file) {
  const bitmap = await createImageBitmap(file)
  const maxDimension = 1600
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return canvas.toDataURL('image/jpeg', 0.76)
}

async function extractPlanningPdf(file) {
  if (!window.__pdfjs) throw new Error('The PDF reader is still loading. Try the file again in a moment.')
  const pdf = await window.__pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const textPages = []
  const images = []
  const pageLimit = Math.min(pdf.numPages, 30)
  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim()
    if (pageText) textPages.push(`Page ${pageNumber}\n${pageText}`)
    if (pageText.length < 80 && images.length < MAX_PLANNING_IMAGE_PAGES) {
      const baseViewport = page.getViewport({ scale: 1 })
      const scale = Math.min(1.6, 1500 / Math.max(1, baseViewport.width))
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: context, viewport }).promise
      images.push(canvas.toDataURL('image/jpeg', 0.72))
    }
  }
  return { text: textPages.join('\n\n').slice(0, 120_000), images, pageCount: pdf.numPages }
}

async function planningSourcePayload(file) {
  if (file.size > MAX_PLANNING_SOURCE_BYTES) throw new Error(`${file.name} is larger than 15 MB.`)
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const extracted = await extractPlanningPdf(file)
    return { name: file.name, type: 'application/pdf', size: file.size, ...extracted }
  }
  if (file.type.startsWith('image/')) {
    return { name: file.name, type: file.type, size: file.size, text: '', images: [await compressPlanningImage(file)], pageCount: 1 }
  }
  if (file.type.startsWith('text/') || /\.(txt|csv)$/i.test(file.name)) {
    return { name: file.name, type: file.type || 'text/plain', size: file.size, text: (await file.text()).slice(0, 120_000), images: [], pageCount: 0 }
  }
  throw new Error(`${file.name} is not a supported PDF, image, or text file.`)
}

async function addPlanningSources(fileList) {
  const remaining = MAX_PLANNING_SOURCES - planningIntake.files.length
  const selected = [...(fileList || [])].slice(0, Math.max(0, remaining))
  if (!selected.length) {
    planningIntake.error = remaining <= 0 ? `You can add up to ${MAX_PLANNING_SOURCES} sources in one import.` : null
    render()
    return
  }
  planningIntake.processingFiles = true
  planningIntake.error = null
  render()
  const failures = []
  for (const file of selected) {
    try { planningIntake.files.push(await planningSourcePayload(file)) }
    catch (error) { failures.push(error.message) }
  }
  planningIntake.processingFiles = false
  planningIntake.error = failures.length ? failures.join(' ') : null
  render()
}

function emptyIntakeCourse() {
  return {
    code: '', name: '', ects: 5, yearLevel: '', period: '', passMark: 5.5, notes: '',
    editorialCourseId: null, attempts: [], _include: true
  }
}

function resetPlanningIntake() {
  Object.assign(planningIntake, {
    step: 'source', files: [], description: '', processingFiles: false,
    analysing: false, saving: false, error: null, draft: null, manual: false,
    programmeId: null, programmeVersionId: null, programmeConfig: null
  })
}

const chatState = new Map() // key: courseId/chapterId -> { messages: [{role, content}], sending: bool, draft: string }
let aiUsage = null
let aiUsageError = null

async function loadAiUsage() {
  aiUsageError = null
  try {
    aiUsage = await fetchJson('/api/ai/usage')
  } catch (error) {
    aiUsage = null
    aiUsageError = error?.message || 'Usage information is temporarily unavailable.'
  }
  return aiUsage
}

function aiAllowance(feature) {
  if (!aiUsage) return 'Usage allowance loads after sign-in.'
  const remaining = feature === 'chat' ? aiUsage.remaining?.chatToday : aiUsage.remaining?.exercisesToday
  const daily = aiUsage.limits?.[feature]?.requestsPerDay
  return `${remaining ?? '—'} of ${daily ?? '—'} ${feature === 'chat' ? 'tutor messages' : 'requests'} remaining today`
}
const questionNav = new Map() // key: courseId/chapterId -> { index: number }
const chapterTab = new Map() // key: courseId/chapterId -> 'content' | 'selftest'

function getChapterTab(courseId, chapterId) {
  const key = `${courseId}/${chapterId}`
  if (chapterTab.has(key)) return chapterTab.get(key)
  let tab = 'content'
  try {
    const stored = localStorage.getItem(`chapter-tab:${key}`)
    if (stored === 'content' || stored === 'selftest' || stored === 'esq') tab = stored
  } catch {}
  chapterTab.set(key, tab)
  return tab
}

function setChapterTab(courseId, chapterId, tab) {
  const key = `${courseId}/${chapterId}`
  chapterTab.set(key, tab)
  try { localStorage.setItem(`chapter-tab:${key}`, tab) } catch {}
}

let mobileStudyPanel = null
let studyToolsTab = 'progress'
const filterState = { category: 'all', mastery: 'all', sort: 'priority', search: '' }
// questionFilter: checkbox-style multi-select.
// types: array of question type ids selected ('written','calc','tf','mc','pseudocode'). Empty = show ALL.
// sources: array of source ids selected ('kb','gen'). Empty = show ALL.
// openDd: which dropdown is currently expanded ('types' | 'sources' | null).
const questionFilter = { types: [], sources: [], openDd: null }

window.addEventListener('hashchange', () => {
  mobileStudyPanel = null
  route = parseRoute()
  render()
  if (route.page === 'planning') loadAcademics()
})

init()

// Reader libraries (markdown, math, code, diagrams, PDF) stream in after the
// shell. Surfaces that need them render a placeholder until they arrive.
let studyDepsReady = typeof marked !== 'undefined'
let studyDepsError = null
function ensureStudyDeps() {
  if (studyDepsReady) return Promise.resolve()
  const pending = window.__ensureStudyDeps ? window.__ensureStudyDeps() : Promise.resolve()
  return pending.then(() => { studyDepsReady = true; render() }).catch((error) => { studyDepsError = error; render() })
}
function depsPlaceholder(label = 'Loading the reader…') {
  ensureStudyDeps()
  return studyDepsError
    ? `<div class="deps-pending"><p>The reader libraries could not be loaded. Check your connection and <button type="button" class="pl-link pl-link-button" onclick="location.reload()">reload</button>.</p></div>`
    : `<div class="deps-pending"><p><span class="boot-spinner"></span>${label}</p></div>`
}

async function init() {
  window.__bootStatus?.('Loading your courses…')
  state = await fetchJson('/api/state')
  loadAiUsage().then(() => render()).catch(() => {})
  render()
  // Pre-load SR membership so the "+ Add to flashcards" buttons correctly
  // show "✓ In SR" for cards already in the deck — works regardless of
  // whether the user lands on dashboard or directly on a chapter page.
  loadSrDue().then(() => render()).catch(() => {})

  // Outside-click closes any open multi-select dropdown or toolbar overflow menu
  document.addEventListener('click', (event) => {
    let needsRender = false
    if (questionFilter.openDd && !event.target.closest('.multi-dd')) {
      questionFilter.openDd = null
      needsRender = true
    }
    if (mockQuestionsView.openDd && !event.target.closest('.multi-dd')) {
      mockQuestionsView.openDd = null
      needsRender = true
    }
    if (toolbarMoreOpen && !event.target.closest('.tb-more')) {
      toolbarMoreOpen = null
      needsRender = true
    }
    if (needsRender) render()
  })
  // Esc key closes dropdowns, overflow menu, and confirm modal
  // Cmd+Shift+F (or Ctrl+Shift+F) opens the course-search popup
  document.addEventListener('keydown', (event) => {
    const cmd = event.metaKey || event.ctrlKey
    if (cmd && event.shiftKey && (event.key === 'F' || event.key === 'f')) {
      event.preventDefault()
      if (searchState.open) {
        const input = document.querySelector('[data-search-input]')
        if (input) { input.focus(); input.select() }
      } else {
        openSearchPopup()
      }
      return
    }
    if (event.key === 'Escape') {
      if (mobileStudyPanel) {
        mobileStudyPanel = null
        render()
        return
      }
      if (accountDeleteState.open && !accountDeleteState.deleting) {
        accountDeleteState.open = false
        accountDeleteState.confirmation = ''
        accountDeleteState.error = null
        render()
        return
      }
      if (accountResetState.open && !accountResetState.working) {
        Object.assign(accountResetState, { open: false, confirmation: '', error: null })
        render()
        return
      }
      if (confirmModal) {
        resolveConfirm(false)
        return
      }
      let needsRender = false
      if (questionFilter.openDd) { questionFilter.openDd = null; needsRender = true }
      if (mockQuestionsView.openDd) { mockQuestionsView.openDd = null; needsRender = true }
      if (toolbarMoreOpen) { toolbarMoreOpen = null; needsRender = true }
      if (searchState.open) { searchState.open = false; needsRender = true }
      if (needsRender) render()
    }
  })
}

async function fetchJson(url, options = {}) {
  const method = String(options.method || 'GET').toUpperCase()
  const timeoutMs = Number(options.timeoutMs ?? (method === 'GET' ? 18000 : 0))
  const controller = !options.signal && timeoutMs > 0 ? new AbortController() : null
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
  const { timeoutMs: _ignored, ...fetchOptions } = options
  if (controller) fetchOptions.signal = controller.signal
  let response
  try {
    response = await fetch(url, fetchOptions)
    if (!response.ok) {
      const raw = await response.text()
      let payload = null
      try { payload = JSON.parse(raw) } catch {}
      const error = new Error(payload?.error || raw || `Request failed (${response.status})`)
      error.status = response.status
      error.code = payload?.code
      error.retryAfter = payload?.retryAfter
      error.usage = payload?.usage
      throw error
    }
    return await response.json()
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('This request took too long. Check your connection and try again.')
    }
    throw error
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function parseRoute() {
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash || hash === '/') return { page: 'dashboard' }
  const parts = hash.split('/').filter(Boolean)
  if (parts[0] === 'course' && parts[2] === 'chapter') {
    return {
      page: 'chapter',
      courseId: decodeURIComponent(parts[1]),
      chapterId: decodeURIComponent(parts[3]),
      relPath: parts.slice(4).map(decodeURIComponent).join('/')
    }
  }
  if (parts[0] === 'course' && parts[2] === 'mock-exam') {
    return { page: 'mock-exam', courseId: decodeURIComponent(parts[1]) }
  }
  if (parts[0] === 'courses') return { page: 'courses' }
  if (parts[0] === 'mistakes') return { page: 'practice', tab: 'mistakes' }
  if (parts[0] === 'sr') return { page: 'practice', tab: 'flashcards' }
  if (parts[0] === 'mocks') return { page: 'practice', tab: 'mocks', sessionId: parts[1] ? decodeURIComponent(parts[1]) : null }
  if (parts[0] === 'practice') {
    const tab = PRACTICE_TABS.some(([id]) => id === parts[1]) ? parts[1] : 'questions'
    return { page: 'practice', tab, sessionId: tab === 'mocks' && parts[2] ? decodeURIComponent(parts[2]) : null }
  }
  if (parts[0] === 'settings' || parts[0] === 'account') {
    const requested = parts[1] === 'usage' ? 'usage' : parts[1] === 'data' ? 'data' : parts[1] === 'api' ? 'api' : parts[1] === 'account' ? 'data' : 'profile'
    return { page: 'account', tab: requested }
  }
  if (parts[0] === 'planning') {
    const requestedTab = PLANNING_TAB_ALIASES[parts[1]] || parts[1] || 'overview'
    const tab = PLANNING_TABS.some(([id]) => id === requestedTab) ? requestedTab : 'overview'
    const focus = parts[2] ? decodeURIComponent(parts[2]) : null
    return { page: 'planning', tab, focus }
  }
  if (parts[0] === 'course') {
    return {
      page: 'course',
      id: decodeURIComponent(parts[1]),
      itemId: parts[2] === 'item' ? decodeURIComponent(parts[3]) : undefined
    }
  }
  return { page: 'dashboard' }
}

function doneThreshold() { return state?.meta?.doneThreshold ?? 3 }
function isDone(item) { return (item.mastery ?? 0) >= doneThreshold() }
function allItems() { return state.courses.flatMap((c) => c.items.map((i) => ({ ...i, course: c }))) }
function itemById(itemId) { return allItems().find(({ id }) => id === itemId) }

function avgMastery(items) {
  if (!items.length) return 0
  return items.reduce((acc, i) => acc + (i.mastery ?? 0), 0) / items.length
}

function progressOf(items) {
  const total = items.length
  const done = items.filter(isDone).length
  const avg = avgMastery(items)
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0, masteryPct: total ? Math.round((avg / 4) * 100) : 0, avg }
}

function categoryProgress(course, category) { return progressOf(course.items.filter((i) => i.category === category)) }
function blockProgress(block) { return progressOf(block.itemIds.map(itemById).filter(Boolean)) }
function chapterItems(course, chapterId) { return course.items.filter((i) => (i.chapterIds || []).includes(chapterId)) }

// ----- Activity-based chapter progress (replaces the old item-mastery model) -----
// Persisted "chapter read" state lives in localStorage keyed by `chapter-read:{cid}/{chid}`.
const chapterReadState = new Map() // `cid/chid` -> ISO timestamp or true
try {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('chapter-read:')) {
      const val = localStorage.getItem(key)
      chapterReadState.set(key.slice('chapter-read:'.length), val)
    }
  }
} catch {}

function isChapterRead(courseId, chapterId) {
  return !!chapterReadState.get(`${courseId}/${chapterId}`)
}

function setChapterRead(courseId, chapterId, read = true) {
  const k = `${courseId}/${chapterId}`
  if (read) {
    const stamp = new Date().toISOString()
    chapterReadState.set(k, stamp)
    try { localStorage.setItem(`chapter-read:${k}`, stamp) } catch {}
  } else {
    chapterReadState.delete(k)
    try { localStorage.removeItem(`chapter-read:${k}`) } catch {}
  }
}

// ─── Clear progress ──────────────────────────────────────────────────────────
// Single entry point used by every "Clear progress" button across the app.
// Wraps showConfirm with a scope-specific irreversibility warning, then wipes
// the matching client-side localStorage entries AND fires the server endpoint
// for SR / mistakes / mock sessions.
const CLEAR_DESCRIPTIONS = {
  course:           (o) => `Reset every trace of progress on ${o.courseName || 'this course'}.\n\n• Chapter read flags (every chapter)\n• Self-test attempts, checks, and revealed answers (every chapter)\n• Mock-question attempts and checks (entire course-wide bank)\n• Practice-exam attempts and checks (every mock exam)\n• Flashcards' spaced-repetition state (every card resets to fresh)\n• Per-chapter mistake bank entries\n• Mini-mock session history\n\nThis is IRREVERSIBLE.`,
  chapter:          (o) => `Reset every trace of progress on Ch ${o.chapterId} of ${o.courseName || 'this course'}.\n\n• Chapter read flag\n• Self-test attempts + grades for this chapter\n• Mock-question attempts + grades for this chapter\n• Flashcards' spaced-repetition state for cards in this chapter\n• This chapter's mistake bank entries\n\nThis is IRREVERSIBLE.`,
  'self-test':      (o) => `Clear all self-test attempts, grades, and revealed answers for Ch ${o.chapterId}.\n\nReading status, mock questions, and flashcards are kept.\n\nThis is IRREVERSIBLE.`,
  'esq':            (o) => `Clear all exam-style-question attempts and grades for Ch ${o.chapterId}.\n\nThe questions themselves stay; only your answers, grades, and revealed-answer toggles are cleared.\n\nThis is IRREVERSIBLE.`,
  'mock-questions': (o) => `Clear all course-wide mock-question attempts and grades for ${o.courseName || 'this course'}.\n\nThe question bank itself stays; only your answers, grades, and revealed answers are cleared.\n\nThis is IRREVERSIBLE.`,
  exam:             (o) => `Clear all attempts and answer checks for ${o.examLabel || 'this practice exam'}.\n\nThe prepared paper itself stays.\n\nThis is IRREVERSIBLE.`,
  question:         (o) => `Clear your answer and grade for this question.\n\nThis is IRREVERSIBLE.`,
  flashcards:       (o) => `Reset spaced-repetition state for every flashcard in Ch ${o.chapterId || 'this scope'}. The cards themselves stay; only your due-dates, ease, and review history are wiped.\n\nThis is IRREVERSIBLE.`
}

async function clearProgress(opts) {
  const { scope, courseId, chapterId, examId, questionId, courseName, examLabel, skipConfirm } = opts
  const describe = CLEAR_DESCRIPTIONS[scope]
  if (!describe) { console.warn('clearProgress: unknown scope', scope); return }
  if (!skipConfirm) {
    const ok = await showConfirm({
      title: scope === 'course' ? 'Reset course progress?' : scope === 'question' ? 'Clear this answer?' : 'Clear progress?',
      message: describe(opts),
      okLabel: scope === 'question' ? 'Clear answer' : 'Yes, clear progress',
      cancelLabel: 'Cancel',
      danger: true
    })
    if (!ok) return false
  }

  // Client-side: attemptState (self-test + mock-questions), chapter-read,
  // practice-exam localStorage. The Maps are mutated in place; the localStorage
  // back-pen syncs via the monkey-patched .set / our explicit removeItem calls.
  const wipeAttemptKey = (k) => attemptState.delete(k)
  const wipeAttemptsMatching = (prefixOrFn) => {
    const pred = typeof prefixOrFn === 'function' ? prefixOrFn : (k) => k.startsWith(prefixOrFn)
    for (const k of [...attemptState.keys()]) if (pred(k)) attemptState.delete(k)
  }
  const persistAttempts = () => {
    try {
      const obj = {}
      for (const [k, v] of attemptState) obj[k] = v
      localStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(obj))
    } catch {}
  }
  const wipePracticeExam = (cid, eid) => {
    try { localStorage.removeItem(practiceStorageKey(cid, eid)) } catch {}
    if (practiceExamView.courseId === cid && practiceExamView._loadedPaperId === eid) {
      practiceExamView.attempts = {}
      practiceExamView.attemptImages = {}
      practiceExamView.grades = {}
      practiceExamView.guidance = {}
      practiceExamView.grading = {}
      practiceExamView.showGuidance = {}
      practiceExamView.showAnswer = {}
      practiceExamView.currentQid = null
    }
  }
  const wipePracticeExamsForCourse = (cid) => {
    const course = state.courses?.find((c) => c.id === cid)
    if (!course) return
    for (const e of (getMockExams ? getMockExams(course) : [])) wipePracticeExam(cid, e.id)
    for (const t of (getTutorials ? getTutorials(course) : [])) wipePracticeExam(cid, t.id)
  }

  switch (scope) {
    case 'question': {
      wipeAttemptKey(`${courseId}/${chapterId}/${questionId}`)
      // Practice-exam questions live in practiceExamView, not attemptState.
      if (practiceExamView.courseId === courseId && practiceExamView.attempts[questionId] !== undefined) {
        delete practiceExamView.attempts[questionId]
        delete practiceExamView.attemptImages[questionId]
        delete practiceExamView.grades[questionId]
        delete practiceExamView.guidance[questionId]
        delete practiceExamView.grading[questionId]
        delete practiceExamView.showGuidance[questionId]
        delete practiceExamView.showAnswer[questionId]
        persistPracticeAttempts(courseId, practiceExamView._loadedPaperId)
      }
      persistAttempts()
      break
    }
    case 'self-test': {
      // Only the IDs that belong to the chapter's self-test bank — the same
      // attemptState Map also holds mock-question attempts under the same
      // prefix, and clearing those would be too aggressive for a per-chapter
      // self-test reset.
      const cache = questionsCache.get(`${courseId}/${chapterId}`)
      const ids = new Set((cache?.questions || []).map((q) => q.id))
      for (const k of [...attemptState.keys()]) {
        if (!k.startsWith(`${courseId}/${chapterId}/`)) continue
        const qid = k.slice(k.lastIndexOf('/') + 1)
        if (ids.has(qid)) attemptState.delete(k)
      }
      persistAttempts()
      break
    }
    case 'esq': {
      // Only the mock-question IDs for this chapter
      const cache = (typeof mockQuestionsCache !== 'undefined') ? mockQuestionsCache.get(courseId) : null
      const ids = new Set((cache?.questions || []).filter((q) => q.chapterId === chapterId).map((q) => q.id))
      for (const k of [...attemptState.keys()]) {
        if (!k.startsWith(`${courseId}/${chapterId}/`)) continue
        const qid = k.slice(k.lastIndexOf('/') + 1)
        if (ids.has(qid)) attemptState.delete(k)
      }
      persistAttempts()
      break
    }
    case 'mock-questions': {
      wipeAttemptsMatching((k) => k.startsWith(`${courseId}/`))
      persistAttempts()
      break
    }
    case 'exam': {
      wipePracticeExam(courseId, examId)
      break
    }
    case 'chapter': {
      setChapterRead(courseId, chapterId, false)
      wipeAttemptsMatching(`${courseId}/${chapterId}/`)
      persistAttempts()
      await fetch('/api/progress/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'chapter', courseId, chapterId })
      }).catch(() => {})
      break
    }
    case 'course': {
      // Chapter-read flags for every chapter of the course
      const course = state.courses?.find((c) => c.id === courseId)
      for (const ch of course?.chapters || []) setChapterRead(courseId, ch.id, false)
      // attemptState: any key beginning with the course id
      wipeAttemptsMatching((k) => k.startsWith(`${courseId}/`))
      persistAttempts()
      // Practice exams: clear local state for each exam
      wipePracticeExamsForCourse(courseId)
      // Server-side: mistakes (all chapters), SR (all course cards), mock sessions
      await fetch('/api/progress/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'course', courseId })
      }).catch(() => {})
      break
    }
    case 'flashcards': {
      await fetch('/api/progress/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: chapterId ? 'flashcards-chapter' : 'flashcards-course', courseId, chapterId })
      }).catch(() => {})
      if (typeof flashcardsCache !== 'undefined') flashcardsCache.delete(courseId)
      break
    }
  }
  // Invalidate caches that summarize progress so the UI reflects the wipe
  if (typeof questionsSummaryCache !== 'undefined') questionsSummaryCache.delete(courseId)
  render()
  return true
}

// Per-chapter progress derived from real activity. Each "signal" returns 0..1.
// The final masteryPct is the weighted average of signals that have any data.
function chapterProgress(course, chapter) {
  const cid = course.id, chid = chapter.id
  const read = isChapterRead(cid, chid)

  // Practice questions (per-chapter cache)
  const qCache = (typeof questionsCache !== 'undefined') ? questionsCache.get(`${cid}/${chid}`) : null
  const qSummary = (typeof questionsSummaryCache !== 'undefined') ? questionsSummaryCache.get(cid)?.byChapter?.[chid] : null
  const practiceQs = qCache?.questions || []
  const practiceIds = practiceQs.length ? practiceQs.map((q) => q.id) : (qSummary?.ids || [])
  const practiceTotal = practiceQs.length || qSummary?.total || 0
  const practiceScores = []
  if (practiceIds.length) {
    for (const qid of practiceIds) {
      const att = attemptState.get(`${cid}/${chid}/${qid}`)
      const score = numericScore(att?.score ?? scoreFromCorrection(att?.correction))
      if (score != null) practiceScores.push(score)
    }
  } else if (practiceTotal) {
    const prefix = `${cid}/${chid}/`
    for (const [key, att] of attemptState) {
      if (!key.startsWith(prefix)) continue
      const score = numericScore(att?.score ?? scoreFromCorrection(att?.correction))
      if (score != null) practiceScores.push(score)
    }
  }

  // Mock questions filtered to this chapter
  const mqCache = (typeof mockQuestionsCache !== 'undefined') ? mockQuestionsCache.get(cid) : null
  const mockQs = (mqCache?.questions || []).filter((q) => q.chapterId === chid)
  const mockScores = []
  for (const q of mockQs) {
    const att = attemptState.get(`${cid}/${chid}/${q.id}`)
    if (att && typeof att.score === 'number') mockScores.push(att.score)
  }

  // Flashcards for this chapter
  const fcCache = (typeof flashcardsCache !== 'undefined') ? flashcardsCache.get(cid) : null
  const fcCards = fcCache?.byChapter?.[chid] || []
  const fcMature = fcCards.filter((c) => (c.sr?.repetitions || 0) >= 2).length

  // Signals (0..1) + weights
  const signals = []
  signals.push({ key: 'read', weight: 1.0, value: read ? 1 : 0, present: true })
  if (practiceTotal) {
    const pct = practiceScores.length / practiceTotal
    const avg = practiceScores.length ? practiceScores.reduce((a, s) => a + s, 0) / practiceScores.length / 10 : 0
    signals.push({ key: 'practice', weight: 1.5, value: pct * avg, present: true })
  }
  if (mockQs.length) {
    const pct = mockScores.length / mockQs.length
    const avg = mockScores.length ? mockScores.reduce((a, s) => a + s, 0) / mockScores.length / 10 : 0
    signals.push({ key: 'mock', weight: 1.5, value: pct * avg, present: true })
  }
  if (fcCards.length) {
    signals.push({ key: 'flashcards', weight: 1.0, value: fcCards.length ? fcMature / fcCards.length : 0, present: true })
  }
  const sumW = signals.reduce((a, s) => a + s.weight, 0)
  const masteryPct = sumW ? Math.round((signals.reduce((a, s) => a + s.value * s.weight, 0) / sumW) * 100) : 0

  return {
    read,
    practice: { total: practiceTotal, done: practiceScores.length, avg: practiceScores.length ? practiceScores.reduce((a, s) => a + s, 0) / practiceScores.length : 0 },
    mock: { total: mockQs.length, done: mockScores.length, avg: mockScores.length ? mockScores.reduce((a, s) => a + s, 0) / mockScores.length : 0 },
    flashcards: { total: fcCards.length, mature: fcMature },
    signals,
    masteryPct
  }
}

function courseProgress(course) {
  const chapters = course.chapters || []
  if (!chapters.length) return { total: 0, done: 0, masteryPct: 0, avg: 0, pct: 0 }
  const perCh = chapters.map((ch) => chapterProgress(course, ch))
  const readCount = perCh.filter((p) => p.read).length
  const masteryPct = Math.round(perCh.reduce((a, p) => a + p.masteryPct, 0) / chapters.length)
  return {
    total: chapters.length,
    done: readCount,
    pct: Math.round((readCount / chapters.length) * 100),
    masteryPct,
    // Legacy field expected by old call sites (`progress.avg.toFixed(2)/4`). Map to 0..4 for compat.
    avg: (masteryPct / 100) * 4
  }
}

async function setMastery(itemId, mastery) {
  await fetchJson(`/api/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mastery })
  })
  const found = state.courses.flatMap((c) => c.items).find((i) => i.id === itemId)
  const prev = found.mastery ?? 0
  found.mastery = mastery
  found.masteryUpdatedAt = new Date().toISOString()
  if (prev !== mastery) {
    found.reviewLog = found.reviewLog || []
    found.reviewLog.push({ at: found.masteryUpdatedAt, mastery, prevMastery: prev, kind: 'mastery-change', note: '' })
  }
  render()
}

async function updateNotes(itemId, notes) {
  await fetchJson(`/api/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes })
  })
  const found = state.courses.flatMap((c) => c.items).find((i) => i.id === itemId)
  found.notes = notes
}

async function logReviewEvent(itemId, ev) {
  await fetchJson(`/api/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewEvent: ev })
  })
  const found = state.courses.flatMap((c) => c.items).find((i) => i.id === itemId)
  found.reviewLog = found.reviewLog || []
  found.reviewLog.push({ at: new Date().toISOString(), mastery: ev.mastery ?? found.mastery, score: ev.score ?? null, kind: ev.kind || 'review', note: ev.note || '' })
  render()
}

function relativeTime(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return 'just now'
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
  ad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"/><circle cx="5" cy="14" r="2"/><circle cx="12" cy="20" r="2"/><circle cx="19" cy="14" r="2"/><path d="M11 5.5 L6 12.5"/><path d="M13 5.5 L18 12.5"/><path d="M6 15.5 L11 19"/><path d="M18 15.5 L13 19"/></svg>',
  itms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="11" width="18" height="5" rx="1"/><rect x="3" y="18" width="18" height="3" rx="1"/><circle cx="6.5" cy="6.5" r="0.8" fill="currentColor"/><circle cx="6.5" cy="13.5" r="0.8" fill="currentColor"/></svg>',
  stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20 L21 20"/><rect x="5" y="13" width="3.5" height="7"/><rect x="10.25" y="9" width="3.5" height="11"/><rect x="15.5" y="5" width="3.5" height="15"/></svg>',
  cyber: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L20 6 V12 C20 16.5 16.5 19.5 12 21 C7.5 19.5 4 16.5 4 12 V6 Z"/><path d="M9 12 L11.5 14.5 L15.5 10"/></svg>',
  embedded: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="7" width="10" height="10" rx="1.5"/><rect x="10" y="10" width="4" height="4" rx="0.8"/><path d="M4 9 H7 M4 12 H7 M4 15 H7 M17 9 H20 M17 12 H20 M17 15 H20 M9 4 V7 M12 4 V7 M15 4 V7 M9 17 V20 M12 17 V20 M15 17 V20"/></svg>',
  compsec: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10" width="14" height="10" rx="1.5"/><path d="M8 10 V7.5 C8 5.2 9.7 3.5 12 3.5 C14.3 3.5 16 5.2 16 7.5 V10"/><path d="M9 15 L11 17 L15 13"/></svg>',
  flashcards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="7" width="14" height="13" rx="1.5"/><rect x="6.5" y="4" width="14" height="13" rx="1.5"/><path d="M10 9 L17 9 M10 13 L15 13"/></svg>',
  practice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h11M4 10h8M4 14.5h6"/><path d="m13.5 17 2.2 2.2L21 13.5"/></svg>',
  mistakes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L22 20 L2 20 Z"/><path d="M12 10 L12 14"/><circle cx="12" cy="17" r="0.8" fill="currentColor"/></svg>',
  mocks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 8 V13 L15 15"/><path d="M9 3 L15 3"/><path d="M12 3 V5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6 L9 12 L15 18"/></svg>'
}

function courseIconKey(course) {
  const code = course.code || ''
  if (/AD\b|1540/.test(code) || course.id === 'alg') return 'ad'
  if (/ITMS|2510/.test(code) || course.id === 'it') return 'itms'
  if (/Stats|1520/.test(code) || course.id === 'stats') return 'stats'
  if (/CyberSec|2740/.test(code) || course.id === 'cyber') return 'cyber'
  if (/2410/.test(code) || course.id === 'emb') return 'embedded'
  if (/2420/.test(code) || course.id === 'sec') return 'compsec'
  return 'dashboard'
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60)
}

function computeTitle() {
  const suffix = ' · Wicker Study'
  if (!state) return 'Wicker Study'
  if (route.page === 'dashboard') return 'Home' + suffix
  if (route.page === 'courses') return 'Courses' + suffix
  if (route.page === 'practice') return (PRACTICE_TABS.find(([id]) => id === route.tab)?.[1] || 'Practice') + ' · Practice' + suffix
  if (route.page === 'mocks') return (route.sessionId ? 'Mock session' : 'Mock sessions') + suffix
  if (route.page === 'account') return (ACCOUNT_TABS.find(([id]) => id === route.tab)?.[1] || 'Account') + ' · Account' + suffix
  if (route.page === 'planning') {
    const label = route.tab === 'overview' ? 'Academic plan' : (PLANNING_TABS.find(([id]) => id === route.tab)?.[1] || 'Academic planning')
    return `${label} — Academic planning${suffix}`
  }
  if (route.page === 'course') {
    const c = state.courses.find((c) => c.id === route.id)
    return c ? `${c.code}${c.shortName ? ' ' + c.shortName : ''}${suffix}` : 'Course' + suffix
  }
  if (route.page === 'mock-exam') {
    const c = state.courses.find((c) => c.id === route.courseId)
    return c ? `${c.code} mock exam${suffix}` : 'Mock exam' + suffix
  }
  if (route.page === 'chapter') {
    const c = state.courses.find((c) => c.id === route.courseId)
    const ch = c?.chapters?.find((ch) => ch.id === route.chapterId)
    if (c && ch) return `Ch ${ch.id} · ${ch.name} — ${c.code}${suffix}`
    return 'Chapter' + suffix
  }
  return 'Wicker Study'
}

let _suppressNextScrollRestore = false

function captureScrollState() {
  const snap = {}
  const studyScroller = getStudyScroller()
  const studyScrollerSelector = studyScroller?.matches('.chapter-page > .chapter-main')
    ? '.chapter-page > .chapter-main'
    : studyScroller?.matches('.study-surface-page > .study-surface-main')
      ? '.study-surface-page > .study-surface-main'
      : '.content'
  const targets = [
    [studyScrollerSelector, studyScroller],
    ['.study-drawer.is-open .study-drawer-scroll', document.querySelector('.study-drawer.is-open .study-drawer-scroll')],
    ['.study-drawer.is-open .study-tools-panel', document.querySelector('.study-drawer.is-open .study-tools-panel')],
    ['.study-drawer.is-open .chat-messages', document.querySelector('.study-drawer.is-open .chat-messages')],
  ]
  targets.forEach(([selector, element]) => {
    if (element) snap[selector] = element.scrollTop
  })
  return snap
}

function restoreScrollState(snap) {
  if (!snap || _suppressNextScrollRestore) { _suppressNextScrollRestore = false; return }
  for (const [sel, top] of Object.entries(snap)) {
    const el = document.querySelector(sel)
    if (el) el.scrollTop = top
  }
}

function scrollWithin(container, target, { behavior = 'smooth', offset = 14 } = {}) {
  if (!container || !target) return
  const cRect = container.getBoundingClientRect()
  const tRect = target.getBoundingClientRect()
  const top = container.scrollTop + (tRect.top - cRect.top) - offset
  container.scrollTo({ top: Math.max(0, top), behavior })
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
}

function getStudyScroller() {
  return document.querySelector('.chapter-page > .chapter-main')
    || document.querySelector('.study-surface-page > .study-surface-main')
    || document.querySelector('.content')
}

function render() {
  if (!state) return
  document.title = computeTitle()
  const previousDialogOpen = Boolean(document.querySelector('[role="dialog"], [role="alertdialog"]'))
  const activeFocusSelector = stableFocusSelector(document.activeElement)
  const scrollSnap = captureScrollState()
  // Capture search-input focus + caret so the popup survives re-renders without losing focus.
  const activeSearchInput = document.activeElement?.matches?.('[data-search-input]') ? document.activeElement : null
  const searchCaret = activeSearchInput ? { start: activeSearchInput.selectionStart, end: activeSearchInput.selectionEnd } : null
  // Same idea for the in-course filter input.
  const activeCourseFilterInput = document.activeElement?.matches?.('[data-course-filter]') ? document.activeElement : null
  const courseFilterCaret = activeCourseFilterInput
    ? { courseId: activeCourseFilterInput.dataset.courseFilter, start: activeCourseFilterInput.selectionStart, end: activeCourseFilterInput.selectionEnd }
    : null
  const isChapter = route.page === 'chapter'
  const isMock = route.page === 'mock-exam'
  const isCourse = route.page === 'course'
  app.innerHTML = `
    <div class="dash ${isChapter || isMock || isCourse ? 'is-study' : ''}" data-route="${route.page}">
      ${renderSidebar()}
      <main id="main-content" class="content route-${route.page} ${isChapter || isMock || isCourse ? 'chapter-content' : ''}">
        ${routeView()}
      </main>
    </div>
    ${renderMiniMockOverlay()}
    ${renderExtendModal()}
    ${renderConfirmModal()}
    ${renderAccountDeleteModal()}
    ${renderAccountResetModal()}
    ${renderSearchPopup()}
    ${renderFlashcardStudyModal()}
    ${renderBgJobsBanner()}
  `
  bindEvents()
  const openDialog = document.querySelector('[role="dialog"], [role="alertdialog"]')
  if (openDialog) {
    if (!previousDialogOpen) dialogReturnFocusSelector = activeFocusSelector
    openDialog.tabIndex = -1
    const initialFocus = openDialog.querySelector('[data-account-delete-input], [data-confirm-cancel], input:not([disabled]), textarea:not([disabled]), select:not([disabled])') || openDialog
    initialFocus.focus({ preventScroll: true })
    openDialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return
      const focusable = [...openDialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) { event.preventDefault(); return }
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    })
  } else if (previousDialogOpen && dialogReturnFocusSelector) {
    const returnTarget = document.querySelector(dialogReturnFocusSelector)
    if (returnTarget) returnTarget.focus({ preventScroll: true })
    dialogReturnFocusSelector = null
  }
  autosizeAnswerTextareas()
  restoreScrollState(scrollSnap)
  // Restore focus to the search input across re-renders so arrow keys / Enter keep working.
  if (searchState.open && (activeSearchInput || _searchPendingFocus)) {
    const newInput = document.querySelector('[data-search-input]')
    if (newInput) {
      newInput.focus()
      try {
        if (searchCaret) newInput.setSelectionRange(searchCaret.start, searchCaret.end)
      } catch {}
    }
    _searchPendingFocus = false
  }
  // Restore focus to the in-course filter input so typing remains uninterrupted.
  if (courseFilterCaret) {
    const newFilter = document.querySelector(`[data-course-filter="${courseFilterCaret.courseId}"]`)
    if (newFilter) {
      newFilter.focus()
      try { newFilter.setSelectionRange(courseFilterCaret.start, courseFilterCaret.end) } catch {}
    }
  }
  if (route.page === 'course' && route.itemId) {
    setTimeout(() => {
      const target = document.getElementById(`item-${route.itemId}`)
      if (target) scrollWithin(getStudyScroller(), target)
    }, 50)
  }
  // Scroll to a heading after navigating from a search result
  if (pendingHeadingScroll && route.page === 'chapter'
    && route.courseId === pendingHeadingScroll.courseId
    && route.chapterId === pendingHeadingScroll.chapterId) {
    const slug = pendingHeadingScroll.slug
    pendingHeadingScroll = null
    if (slug) {
      setTimeout(() => {
        const target = document.getElementById(slug)
        if (target) {
          scrollWithin(getStudyScroller(), target)
          target.classList.add('search-flash')
          setTimeout(() => target.classList.remove('search-flash'), 1800)
        }
      }, 220) // give markdown a moment to mount + assignHeadingIds to run
    }
  }
  scheduleRichContentEnhancements()
}

function autosizeTextarea(el) {
  if (!el || el.tagName !== 'TEXTAREA') return
  el.style.height = 'auto'
  const styles = window.getComputedStyle(el)
  const maxHeight = Number.parseFloat(styles.maxHeight)
  const nextHeight = el.scrollHeight + 2
  if (Number.isFinite(maxHeight) && maxHeight > 0 && nextHeight > maxHeight) {
    el.style.height = `${maxHeight}px`
    el.style.overflowY = 'auto'
  } else {
    el.style.height = `${nextHeight}px`
    el.style.overflowY = 'hidden'
  }
}

function autosizeAnswerTextareas(root = document) {
  root.querySelectorAll('textarea.q-input, textarea.fc-recall-input').forEach(autosizeTextarea)
}

function routeView() {
  if (route.page === 'chapter') return renderChapterPage()
  if (route.page === 'mock-exam') return renderMockExamPage()
  if (route.page === 'courses') return renderCoursesPage()
  if (route.page === 'practice') return renderPracticeShell()
  if (route.page === 'account') return renderAccountPage()
  if (route.page === 'planning') return renderAcademicPlanningPage()
  if (route.page === 'course') return renderCourse(route.id)
  return renderDashboard()
}

const accountDeleteState = { open: false, confirmation: '', deleting: false, error: null }

async function loadAcademics({ force = false } = {}) {
  if ((academicsData && !force) || academicsLoading) return
  academicsLoading = true
  academicsError = null
  render()
  try { academicsData = await fetchJson('/api/academics') }
  catch (error) { academicsError = error.message }
  finally { academicsLoading = false; render() }
}

async function loadEditorialProgrammes({ force = false } = {}) {
  if ((editorialProgrammesData && !force) || editorialProgrammesLoading) return
  editorialProgrammesLoading = true
  editorialProgrammesError = null
  render()
  try { editorialProgrammesData = await fetchJson('/api/editorial-programmes') }
  catch (error) { editorialProgrammesError = error.message || 'Known programmes could not be loaded.' }
  finally { editorialProgrammesLoading = false; render() }
}

async function saveAcademics(workspace) {
  if (!academicsData || academicsLoading) return false
  const previousData = academicsData
  const expectedRevision = academicsData.workspace.revision
  academicsData = { ...academicsData, workspace, summary: academicsData.summary }
  academicsLoading = true
  academicsError = null
  render()
  try {
    academicsData = await fetchJson('/api/academics', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace, expectedRevision })
    })
    return true
  } catch (error) {
    academicsData = previousData
    academicsError = error.message
    return false
  }
  finally { academicsLoading = false; render() }
}

function academicDate(value) {
  if (!value) return 'Date not set'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function normalizedCourseCode(value) {
  return String(value || '').trim().toUpperCase()
}

function editorialCourseForAcademic(course) {
  if (!course || !state?.courses) return null
  if (course.editorialCourseId) {
    const explicit = state.courses.find((candidate) => candidate.id === course.editorialCourseId)
    if (explicit) return explicit
  }
  const code = normalizedCourseCode(course.code)
  return code ? state.courses.find((candidate) => normalizedCourseCode(candidate.code) === code) || null : null
}

function academicCourseForEditorial(course) {
  const courses = academicsData?.workspace?.courses || []
  return courses.find((candidate) => candidate.editorialCourseId === course.id)
    || courses.find((candidate) => normalizedCourseCode(candidate.code) === normalizedCourseCode(course.code))
    || null
}

function academicStudyLink(course, label = 'Open course materials') {
  const editorial = editorialCourseForAcademic(course)
  return editorial
    ? `<a class="planning-study-link" href="#/course/${encodeURIComponent(editorial.id)}">${uiIcon('chevronRight')}<span>${escapeHtml(label)}</span></a>`
    : '<span class="planning-study-unlinked">No matching study material</span>'
}

function renderCoursePlanningContext(course) {
  if (!academicsData?.workspace) return ''
  const academicCourse = academicCourseForEditorial(course)
  if (!academicCourse) {
    return `<aside class="course-planning-context is-unlinked" aria-label="Academic planning status">
      <div><p class="eyebrow">Personal plan</p><strong>This course is not in your active programme</strong><span>Add the matching course code in Planning to connect dates, credits, and study material.</span></div>
      <a class="btn btn-secondary" href="#/planning/overview">Open Planning</a>
    </aside>`
  }
  const passed = academicCourse.attempts.some((attempt) => attempt.status === 'passed')
  const next = academicCourse.attempts
    .filter((attempt) => attempt.status === 'upcoming')
    .sort((a, b) => String(a.examDate || '9999').localeCompare(String(b.examDate || '9999')))[0]
  const days = next ? daysUntil(next.examDate) : null
  const status = passed ? 'Passed' : next ? (next.examDate ? `${countdownLabel(days)} · ${academicDate(next.examDate)}${next.type === 'resit' ? ' · resit' : ''}` : 'Exam date not set') : 'No active attempt'
  return `<aside class="course-planning-context" aria-label="Academic planning status">
    <div><p class="eyebrow">Personal plan</p><strong>${escapeHtml(status)}</strong><span>${academicCourse.ects} ECTS${academicCourse.period ? ` · ${escapeHtml(academicCourse.period)}` : ''}</span></div>
    <a class="btn btn-secondary" href="#/planning/courses">View plan</a>
  </aside>`
}

function planningDraftConnection(course) {
  if (!course) return null
  const code = normalizedCourseCode(course.code)
  return code ? state?.courses?.find((candidate) => normalizedCourseCode(candidate.code) === code) || null : null
}

function editorialProgrammeReference(programmeId, versionId) {
  const programme = editorialProgrammesData?.programmes?.find((item) => item.id === programmeId)
  if (!programme) return null
  const version = programme.versions?.find((item) => item.id === versionId) || programme.versions?.[0]
  return version ? { programme, version } : null
}

function activeEditorialProgrammeReference(workspace = academicsData?.workspace) {
  const template = workspace?.programmeTemplate
  return template ? editorialProgrammeReference(template.programmeId, template.versionId) : null
}

function programmeSelections(version, config) {
  const selected = new Set(version.courses.filter((course) => course.requirement === 'required').map((course) => course.id))
  for (const group of version.choiceGroups || []) {
    if (group.pathwayId && group.pathwayId !== config.pathwayId) continue
    for (const courseId of config.selectedChoices?.[group.id] || []) {
      if (group.courseIds.includes(courseId)) selected.add(courseId)
    }
  }
  const pathway = version.pathways?.find((item) => item.id === config.pathwayId)
  for (const courseId of pathway?.includedCourseIds || []) selected.add(courseId)
  return selected
}

function applyEditorialProgramme(workspace, programme, version, config) {
  const selectedIds = programmeSelections(version, config)
  const existingByTemplateId = new Map(workspace.courses.filter((course) => course.templateCourseId).map((course) => [course.templateCourseId, course]))
  const retained = workspace.courses.flatMap((course) => {
    if (!course.templateCourseId || selectedIds.has(course.templateCourseId)) return []
    if (!course.attempts?.length) return []
    return [{ ...course, programmeRequirement: 'historical', choiceGroupId: null, pathwayId: null }]
  })
  const courses = version.courses.filter((course) => selectedIds.has(course.id)).map((templateCourse) => {
    const existing = existingByTemplateId.get(templateCourse.id)
    const match = planningDraftConnection(templateCourse)
    return {
      id: existing?.id || `programme-${templateCourse.id}`,
      code: templateCourse.code,
      name: templateCourse.name,
      ects: templateCourse.ects,
      yearLevel: templateCourse.yearLevel,
      period: templateCourse.period,
      passMark: existing?.passMark ?? version.grading?.passMark ?? 5.5,
      notes: existing?.notes || '',
      hiddenFromStats: existing?.hiddenFromStats === true,
      editorialCourseId: match?.id || existing?.editorialCourseId || null,
      templateCourseId: templateCourse.id,
      programmeRequirement: templateCourse.requirement,
      choiceGroupId: templateCourse.choiceGroupId || null,
      pathwayId: templateCourse.pathwayId || null,
      attempts: existing?.attempts || []
    }
  })
  const customCourses = workspace.courses.filter((course) => !course.templateCourseId)
  const academicYear = String(config.academicYear || workspace.profile.academicYear || '').trim()
  return {
    ...workspace,
    profile: {
      ...workspace.profile,
      university: programme.institution.name,
      programme: `${programme.degree} ${programme.name}`,
      academicYear,
      currentYearKey: academicYear
    },
    programmeTemplate: {
      programmeId: programme.id,
      versionId: version.id,
      currentStudyYear: config.currentStudyYear || '',
      pathwayId: config.pathwayId || null,
      selectedChoices: Object.fromEntries(Object.entries(config.selectedChoices || {}).map(([groupId, ids]) => [groupId, [...ids]]))
    },
    courses: [...courses, ...retained, ...customCourses]
  }
}

function planningIntakeSteps(active = planningIntake.step) {
  const steps = active === 'programme' || planningIntake.programmeId
    ? [['source', 'Choose source'], ['programme', 'Confirm structure'], ['connected', 'Connect courses']]
    : [['source', 'Choose source'], ['review', 'Review plan'], ['connected', 'Connect courses']]
  const activeIndex = Math.max(0, steps.findIndex(([id]) => id === active))
  return `<ol class="planning-intake-steps" aria-label="Plan setup progress">${steps.map(([id, label], index) => `<li class="${index < activeIndex ? 'is-complete' : index === activeIndex ? 'is-active' : ''}"${index === activeIndex ? ' aria-current="step"' : ''}><span>${index < activeIndex ? uiIcon('check') : index + 1}</span><strong>${label}</strong></li>`).join('')}</ol>`
}

function renderKnownProgrammePicker() {
  if (!editorialProgrammesData && !editorialProgrammesLoading && !editorialProgrammesError) queueMicrotask(() => loadEditorialProgrammes())
  if (editorialProgrammesLoading && !editorialProgrammesData) return `<section class="planning-known-programmes" aria-labelledby="known-programmes-title"><div class="planning-intake-section-head"><span class="planning-intake-number">1</span><div><h2 id="known-programmes-title">Start from a known programme</h2><p>Loading maintained programme structures…</p></div></div><div class="planning-known-loading"><span></span><span></span></div></section>`
  const programmes = editorialProgrammesData?.programmes || []
  return `<section class="planning-known-programmes" aria-labelledby="known-programmes-title">
    <div class="planning-intake-section-head"><span class="planning-intake-number">1</span><div><h2 id="known-programmes-title">Start from a known programme</h2><p>The fastest route when your programme is in our maintained catalogue.</p></div></div>
    ${programmes.length ? `<div class="planning-known-list">${programmes.map((programme) => {
      const version = programme.versions?.[0]
      const connected = version?.courses?.filter(planningDraftConnection).length || 0
      return `<article class="planning-known-row">
        <div class="planning-known-mark" aria-hidden="true">${escapeHtml(programme.institution.name.slice(0, 2).toUpperCase())}</div>
        <div class="planning-known-copy"><h3>${escapeHtml(programme.degree)} ${escapeHtml(programme.name)}</h3><p>${escapeHtml(programme.institution.name)} · ${programme.durationYears} years · ${programme.totalEcts} ECTS</p><span>${escapeHtml(version.label)} · ${connected} maintained course${connected === 1 ? '' : 's'} available</span></div>
        <div class="planning-known-actions"><a href="${escapeHtml(version.sources?.[0]?.url || '#')}" target="_blank" rel="noreferrer">Official curriculum</a><button type="button" class="btn btn-primary" data-planning-programme-use="${escapeHtml(programme.id)}" data-planning-programme-version="${escapeHtml(version.id)}">Use programme ${uiIcon('chevronRight')}</button></div>
      </article>`
    }).join('')}</div>` : `<div class="planning-known-empty"><p>${editorialProgrammesError ? `Known programmes are temporarily unavailable: ${escapeHtml(editorialProgrammesError)}` : 'No maintained programmes are available yet.'}</p>${editorialProgrammesError ? '<button type="button" class="btn btn-secondary" data-editorial-programmes-retry>Try again</button>' : ''}</div>`}
  </section>`
}

function renderPlanningIntakeSource(workspace) {
  const files = planningIntake.files
  const canAnalyse = !planningIntake.processingFiles && !planningIntake.analysing && (files.length > 0 || planningIntake.description.trim().length > 0)
  return `<div class="planning-page planning-intake-page">
    <header class="planning-intake-header">
      <div><h1>Set up your academic plan</h1><p>Bring what you already have. Wicker Study will turn it into a course list for you to review before anything is saved.</p></div>
      <span class="planning-private"><span aria-hidden="true"></span>Private draft</span>
    </header>
    ${planningIntakeSteps('source')}
    ${renderKnownProgrammePicker()}
    <div class="planning-intake-divider"><span>Or build a plan from your own information</span></div>
    <div class="planning-intake-source-layout">
      <main class="planning-intake-source-main">
        <section aria-labelledby="planning-source-title">
          <div class="planning-intake-section-head"><span class="planning-intake-number">2</span><div><h2 id="planning-source-title">Add your academic information</h2><p>Use a curriculum or programme PDF, transcript, screenshots, or any combination.</p></div></div>
          <label class="planning-dropzone${planningIntake.processingFiles ? ' is-processing' : ''}" data-planning-dropzone>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,application/pdf,image/*,text/plain,text/csv" multiple data-planning-files ${planningIntake.processingFiles || planningIntake.analysing ? 'disabled' : ''}>
            <span class="planning-dropzone-icon">${uiIcon('upload')}</span>
            <span><strong>${planningIntake.processingFiles ? 'Reading your files…' : 'Drop files here or choose from your device'}</strong><small>PDF, screenshots, JPG, PNG, text, or CSV · up to 6 files</small></span>
            <span class="btn btn-secondary">Choose files</span>
          </label>
          ${files.length ? `<ul class="planning-source-list" aria-label="Added sources">${files.map((file, index) => `<li><span class="planning-source-file-icon">${uiIcon('file')}</span><span><strong>${escapeHtml(file.name)}</strong><small>${file.type === 'application/pdf' ? `${file.pageCount || '—'} pages · ` : ''}${formatFileSize(file.size)}${file.images?.length ? ` · ${file.images.length} image${file.images.length === 1 ? '' : 's'} ready` : ''}</small></span><button type="button" data-planning-source-remove="${index}" aria-label="Remove ${escapeHtml(file.name)}">${uiIcon('close')}</button></li>`).join('')}</ul>` : ''}
        </section>
        <section class="planning-intake-description" aria-labelledby="planning-description-title">
          <div class="planning-intake-section-head"><span class="planning-intake-number">3</span><div><h2 id="planning-description-title">Add anything the files miss</h2><p>Paste a curriculum description, list your current courses, or explain your grading and exam situation in your own words.</p></div></div>
          <label><span class="sr-only">Academic plan description</span><textarea data-planning-description maxlength="20000" placeholder="For example: I study BSc Computer Science at… I am in year 2. My current courses are… I have already passed…">${escapeHtml(planningIntake.description)}</textarea></label>
        </section>
      </main>
      <aside class="planning-intake-source-aside" aria-label="What happens next">
        <h2>What happens next</h2>
        <ol><li><span>1</span><div><strong>We organise the facts</strong><p>Courses, credits, dates, grades, and programme details are extracted into a draft.</p></div></li><li><span>2</span><div><strong>You review every field</strong><p>Nothing enters your record until you confirm it.</p></div></li><li><span>3</span><div><strong>Study material connects</strong><p>Matching course codes link directly to available chapters and practice.</p></div></li></ol>
        <div class="planning-intake-privacy">${uiIcon('check')}<p><strong>Your originals are not stored.</strong> Files are read for this import. Only the academic details you approve are saved to your private record.</p></div>
      </aside>
    </div>
    ${planningIntake.error ? `<div class="planning-intake-error" role="alert">${escapeHtml(planningIntake.error)}</div>` : ''}
    <footer class="planning-intake-actions"><button type="button" class="btn btn-ghost" data-planning-manual>Enter everything manually</button><button type="button" class="btn btn-primary" data-planning-analyse ${canAnalyse ? '' : 'disabled'}>${planningIntake.analysing ? '<span class="button-spinner"></span> Building your draft…' : `Review my plan ${uiIcon('chevronRight')}`}</button></footer>
  </div>`
}

function renderPlanningProgramme() {
  const reference = editorialProgrammeReference(planningIntake.programmeId, planningIntake.programmeVersionId)
  if (!reference) return `<div class="planning-page planning-intake-page"><div class="planning-error" role="alert"><h1>Programme reference unavailable</h1><p>Return to the previous step and reload the programme catalogue.</p><button type="button" class="btn btn-secondary" data-planning-intake-back>Back to sources</button></div></div>`
  const { programme, version } = reference
  const config = planningIntake.programmeConfig || { academicYear: '', currentStudyYear: 'Year 1', pathwayId: '', selectedChoices: {} }
  const coreCourses = version.courses.filter((course) => course.requirement === 'required')
  const coreEcts = coreCourses.reduce((sum, course) => sum + course.ects, 0)
  const connected = coreCourses.filter(planningDraftConnection).length
  const moduleGroups = version.choiceGroups.filter((group) => !group.pathwayId)
  const selectedIds = programmeSelections(version, config)
  const compactChoices = compactPlanningMedia.matches
  return `<div class="planning-page planning-intake-page planning-programme-page">
    <header class="planning-intake-header planning-programme-header">
      <div><button type="button" class="planning-inline-back" data-planning-intake-back>${uiIcon('arrowLeft')} All setup options</button><h1>${escapeHtml(programme.name)}</h1><p>${escapeHtml(programme.degree)} · ${escapeHtml(programme.institution.name)} · ${programme.totalEcts} ECTS</p></div>
      <span class="planning-private"><span aria-hidden="true"></span>Private plan</span>
    </header>
    ${planningIntakeSteps('programme')}
    <section class="planning-programme-source" aria-labelledby="programme-reference-title">
      <div><h2 id="programme-reference-title">Confirm the programme structure</h2><p>This starter uses the official ${escapeHtml(version.label.toLowerCase())}. Check the version against your own cohort before relying on progression rules.</p></div>
      <div><span>Verified ${escapeHtml(academicDate(version.lastVerified))}</span><a href="${escapeHtml(version.sources?.[0]?.url || '#')}" target="_blank" rel="noreferrer">View official curriculum ${uiIcon('chevronRight')}</a></div>
    </section>
    <div class="planning-programme-layout">
      <main class="planning-programme-main">
        <section class="planning-programme-context" aria-labelledby="programme-context-title">
          <div class="planning-review-section-head"><div><h2 id="programme-context-title">Your starting point</h2><p>This does not change the official structure; it helps Planning focus the first view.</p></div></div>
          <div class="planning-programme-context-fields">
            <label><span>Academic year or cohort</span><input data-programme-config="academicYear" value="${escapeHtml(config.academicYear || '')}" maxlength="30" placeholder="2026–2027"></label>
            <label><span>Current study year</span><select data-programme-config="currentStudyYear">${['Year 1','Year 2','Year 3'].map((year) => `<option value="${year}" ${config.currentStudyYear === year ? 'selected' : ''}>${year}</option>`).join('')}</select></label>
          </div>
        </section>
        <section class="planning-programme-structure" aria-labelledby="programme-structure-title">
          <div class="planning-review-section-head"><div><h2 id="programme-structure-title">Three-year structure</h2><p>${coreEcts} ECTS are fixed. Modules, electives, and the Year 3 pathway complete the 180 ECTS programme.</p></div></div>
          <div class="planning-programme-years">
            <div><strong>Year 1</strong><span>Shared foundation</span><b>60 ECTS fixed</b></div>
            <div><strong>Year 2</strong><span>Core + two module choices</span><b>40 + 20 ECTS</b></div>
            <div><strong>Year 3</strong><span>Final core + one pathway</span><b>30 + 30 ECTS</b></div>
          </div>
        </section>
        <section class="planning-programme-decisions" aria-labelledby="programme-decisions-title">
          <div class="planning-review-section-head"><div><h2 id="programme-decisions-title">Choices you already know</h2><p>Leave any choice open. You can complete or change it from Curriculum later.</p></div></div>
          ${compactChoices ? `<div class="planning-programme-mobile-choices">${moduleGroups.map((group) => `<label><span>${escapeHtml(group.label)}</span><select data-programme-choice-select="${escapeHtml(group.id)}"><option value="">Decide later</option>${group.courseIds.map((courseId) => { const course = version.courses.find((item) => item.id === courseId); return `<option value="${escapeHtml(courseId)}" ${(config.selectedChoices?.[group.id] || []).includes(courseId) ? 'selected' : ''}>${escapeHtml(course.name.replace(/^M2-\d:\s*/, ''))}</option>` }).join('')}</select><small>${escapeHtml(group.description)}</small></label>`).join('')}<label><span>Year 3 · Semester 1 pathway</span><select data-programme-pathway-select><option value="">Decide later</option>${version.pathways.map((pathway) => `<option value="${escapeHtml(pathway.id)}" ${config.pathwayId === pathway.id ? 'selected' : ''}>${escapeHtml(pathway.label)}</option>`).join('')}</select><small>Choose a course-based semester, minor, exchange, or approved honours route.</small></label></div>` : `${moduleGroups.map((group) => `<fieldset><legend><strong>${escapeHtml(group.label)}</strong><span>${escapeHtml(group.description)}</span></legend><div class="planning-programme-options"><label><input type="radio" name="programme-choice-${escapeHtml(group.id)}" data-programme-choice="${escapeHtml(group.id)}" value="" ${!(config.selectedChoices?.[group.id] || []).length ? 'checked' : ''}><span><strong>Decide later</strong><small>Keep this requirement open</small></span></label>${group.courseIds.map((courseId) => { const course = version.courses.find((item) => item.id === courseId); return `<label><input type="radio" name="programme-choice-${escapeHtml(group.id)}" data-programme-choice="${escapeHtml(group.id)}" value="${escapeHtml(courseId)}" ${(config.selectedChoices?.[group.id] || []).includes(courseId) ? 'checked' : ''}><span><strong>${escapeHtml(course.name.replace(/^M2-\d:\s*/, ''))}</strong><small>${course.ects} ECTS</small></span></label>` }).join('')}</div></fieldset>`).join('')}<fieldset><legend><strong>Year 3 · Semester 1 pathway</strong><span>Choose a course-based semester, minor, exchange, or approved honours route.</span></legend><div class="planning-programme-pathways"><label><input type="radio" name="programme-pathway" data-programme-pathway value="" ${!config.pathwayId ? 'checked' : ''}><span><strong>Decide later</strong><small>Keep the 30 ECTS pathway open</small></span></label>${version.pathways.map((pathway) => `<label><input type="radio" name="programme-pathway" data-programme-pathway value="${escapeHtml(pathway.id)}" ${config.pathwayId === pathway.id ? 'checked' : ''}><span><strong>${escapeHtml(pathway.label)}</strong><small>${escapeHtml(pathway.description)}</small></span></label>`).join('')}</div></fieldset>`}
        </section>
      </main>
      <aside class="planning-programme-summary" aria-label="Programme import summary">
        <h2>What will be created</h2>
        <dl><div><dt>Courses now</dt><dd>${selectedIds.size}</dd></div><div><dt>Fixed curriculum</dt><dd>${coreEcts} ECTS</dd></div><div><dt>Study connections</dt><dd>${connected}</dd></div></dl>
        <p>${connected} fixed course${connected === 1 ? '' : 's'} already connect to maintained notes, questions, and practice. Open choices stay visible instead of being guessed.</p>
      </aside>
    </div>
    ${planningIntake.error ? `<div class="planning-intake-error" role="alert">${escapeHtml(planningIntake.error)}</div>` : ''}
    <footer class="planning-intake-actions"><button type="button" class="btn btn-secondary" data-planning-intake-back>${uiIcon('arrowLeft')} Back</button><p>Official structure · personal choices</p><button type="button" class="btn btn-primary" data-planning-programme-save ${planningIntake.saving ? 'disabled' : ''}>${planningIntake.saving ? '<span class="button-spinner"></span> Creating plan…' : `Create this plan ${uiIcon('chevronRight')}`}</button></footer>
  </div>`
}

function renderPlanningIntakeReview(workspace) {
  const draft = planningIntake.draft || { profile: { ...workspace.profile }, courses: [emptyIntakeCourse()], events: [], warnings: [] }
  const courses = draft.courses?.length ? draft.courses : [emptyIntakeCourse()]
  const included = courses.filter((course) => course._include !== false)
  const connected = included.filter(planningDraftConnection).length
  return `<div class="planning-page planning-intake-page planning-intake-review-page">
    <header class="planning-intake-header"><div><h1>Review your academic plan</h1><p>Correct anything that is unclear. Only checked courses will be added to your private record.</p></div><div class="planning-intake-connection-count"><strong>${connected}</strong><span>of ${included.length} course${included.length === 1 ? '' : 's'} connect to study material</span></div></header>
    ${planningIntakeSteps('review')}
    ${draft.warnings?.length ? `<div class="planning-intake-warnings" role="status"><strong>Needs your attention</strong><ul>${draft.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul></div>` : ''}
    <section class="planning-review-section" aria-labelledby="review-programme-title">
      <div class="planning-review-section-head"><div><h2 id="review-programme-title">Programme</h2><p>Use the wording shown by your university. Blank fields are fine.</p></div></div>
      <div class="planning-review-profile">
        <label><span>University</span><input data-intake-profile-field="university" value="${escapeHtml(draft.profile?.university || '')}" maxlength="200" placeholder="University name"></label>
        <label><span>Programme</span><input data-intake-profile-field="programme" value="${escapeHtml(draft.profile?.programme || '')}" maxlength="200" placeholder="Programme name"></label>
        <label><span>Academic year</span><input data-intake-profile-field="academicYear" value="${escapeHtml(draft.profile?.academicYear || '')}" maxlength="30" placeholder="2026–2027"></label>
      </div>
    </section>
    <section class="planning-review-section" aria-labelledby="review-courses-title">
      <div class="planning-review-section-head"><div><h2 id="review-courses-title">Courses</h2><p>Course codes make the connection to maintained study material.</p></div><button type="button" class="btn btn-secondary" data-intake-course-add>${uiIcon('plus')} Add course</button></div>
      <div class="planning-review-courses">${courses.map((course, index) => {
        const match = planningDraftConnection(course)
        const attempt = course.attempts?.[0] || {}
        return `<article class="planning-review-course${course._include === false ? ' is-excluded' : ''}" data-intake-course-row="${index}">
          <div class="planning-review-course-top"><label class="planning-review-include"><input type="checkbox" data-intake-course-include="${index}" ${course._include === false ? '' : 'checked'}><span>Include</span></label><span class="planning-review-match ${match ? 'is-connected' : ''}">${match ? `${uiIcon('check')} Connects to ${escapeHtml(match.name)}` : 'Planning only — no course-code match'}</span><button type="button" class="planning-review-remove" data-intake-course-remove="${index}">Remove</button></div>
          <div class="planning-review-course-fields">
            <label><span>Course code</span><input data-intake-course="${index}" data-intake-course-field="code" value="${escapeHtml(course.code || '')}" maxlength="40" placeholder="CS101"></label>
            <label class="course-name"><span>Course name</span><input data-intake-course="${index}" data-intake-course-field="name" value="${escapeHtml(course.name || '')}" maxlength="200" placeholder="Course name"></label>
            <label><span>Credits / ECTS</span><input data-intake-course="${index}" data-intake-course-field="ects" type="number" min="0" step="0.5" value="${Number(course.ects) || 0}"></label>
            <label><span>Year / level</span><input data-intake-course="${index}" data-intake-course-field="yearLevel" value="${escapeHtml(course.yearLevel || '')}" maxlength="40" placeholder="Year 2"></label>
            <label><span>Period</span><input data-intake-course="${index}" data-intake-course-field="period" value="${escapeHtml(course.period || '')}" maxlength="40" placeholder="Semester 1"></label>
          </div>
          <details class="planning-review-attempt" ${attempt.status || attempt.grade !== null && attempt.grade !== undefined || attempt.examDate ? 'open' : ''}><summary>Current result or next attempt <span>${attempt.status ? escapeHtml(attempt.status) : 'Optional'}</span></summary><div>
            <label><span>Status</span><select data-intake-course="${index}" data-intake-attempt-field="status"><option value="">Not recorded</option>${['upcoming','passed','failed','no-show'].map((value) => `<option value="${value}" ${attempt.status === value ? 'selected' : ''}>${value.replace('-', ' ')}</option>`).join('')}</select></label>
            <label><span>Attempt</span><select data-intake-course="${index}" data-intake-attempt-field="type">${['first','resit','carry-over','other'].map((value) => `<option value="${value}" ${(attempt.type || 'first') === value ? 'selected' : ''}>${value.replace('-', ' ')}</option>`).join('')}</select></label>
            <label><span>Exam date</span><input data-intake-course="${index}" data-intake-attempt-field="examDate" type="date" value="${escapeHtml(attempt.examDate || '')}"></label>
            <label><span>Grade</span><input data-intake-course="${index}" data-intake-attempt-field="grade" type="number" min="0" max="100" step="0.01" value="${attempt.grade ?? ''}" placeholder="Optional"></label>
          </div></details>
        </article>`
      }).join('')}</div>
    </section>
    ${draft.events?.length ? `<section class="planning-review-section" aria-labelledby="review-dates-title"><div class="planning-review-section-head"><div><h2 id="review-dates-title">Other dates</h2><p>Registration windows and deadlines found in your sources.</p></div></div><div class="planning-review-events">${draft.events.map((item, index) => `<div><input data-intake-event="${index}" data-intake-event-field="title" value="${escapeHtml(item.title || '')}" aria-label="Date title"><input data-intake-event="${index}" data-intake-event-field="date" type="date" value="${escapeHtml(item.date || '')}" aria-label="Date"><button type="button" data-intake-event-remove="${index}" aria-label="Remove date">${uiIcon('close')}</button></div>`).join('')}</div></section>` : ''}
    ${planningIntake.error ? `<div class="planning-intake-error" role="alert">${escapeHtml(planningIntake.error)}</div>` : ''}
    <footer class="planning-intake-actions"><button type="button" class="btn btn-secondary" data-planning-intake-back>${uiIcon('arrowLeft')} Back to sources</button><p>${included.length ? `${included.length} course${included.length === 1 ? '' : 's'} will be added · ${connected} connected` : 'Choose at least one course'}</p><button type="button" class="btn btn-primary" data-planning-intake-save ${planningIntake.saving ? 'disabled' : ''}>${planningIntake.saving ? '<span class="button-spinner"></span> Creating plan…' : `Create my plan ${uiIcon('chevronRight')}`}</button></footer>
  </div>`
}

function renderPlanningIntakeConnected(workspace) {
  const connected = workspace.courses.filter(editorialCourseForAcademic)
  const planningOnly = workspace.courses.length - connected.length
  const firstCourse = connected[0] ? editorialCourseForAcademic(connected[0]) : null
  return `<div class="planning-page planning-intake-page planning-intake-connected-page">
    ${planningIntakeSteps('connected')}
    <main class="planning-connected">
      <span class="planning-connected-mark">${uiIcon('check')}</span>
      <div><h1>Your academic plan is connected</h1><p>${workspace.courses.length} course${workspace.courses.length === 1 ? '' : 's'} added to your private record. ${connected.length ? `${connected.length} ${connected.length === 1 ? 'is' : 'are'} ready with maintained study material.` : 'You can connect study material later by adding matching course codes.'}</p></div>
      <dl><div><dt>Courses added</dt><dd>${workspace.courses.length}</dd></div><div><dt>Study connections</dt><dd>${connected.length}</dd></div><div><dt>Planning only</dt><dd>${planningOnly}</dd></div></dl>
      <div class="planning-connected-courses">${workspace.courses.map((course) => {
        const editorial = editorialCourseForAcademic(course)
        return `<div><span><strong>${escapeHtml(course.code || 'No code')}</strong>${escapeHtml(course.name)}</span>${editorial ? `<a href="#/course/${encodeURIComponent(editorial.id)}" data-planning-intake-finish>Open material ${uiIcon('chevronRight')}</a>` : '<small>Planning record</small>'}</div>`
      }).join('')}</div>
      <div class="planning-connected-actions">${firstCourse ? `<a class="btn btn-secondary" href="#/course/${encodeURIComponent(firstCourse.id)}" data-planning-intake-finish>Start studying</a>` : ''}<a class="btn btn-primary" href="#/planning/overview" data-planning-intake-finish>Open my academic plan ${uiIcon('chevronRight')}</a></div>
    </main>
  </div>`
}

function renderPlanningIntake(workspace) {
  if (planningIntake.step === 'connected') return renderPlanningIntakeConnected(workspace)
  if (planningIntake.step === 'programme') return renderPlanningProgramme()
  return planningIntake.step === 'review' ? renderPlanningIntakeReview(workspace) : renderPlanningIntakeSource(workspace)
}

function planningCourseStatus(course) {
  const attempts = course.attempts || []
  const passed = [...attempts].reverse().find((attempt) => attempt.status === 'passed')
  if (passed) return { key: 'passed', label: passed.grade === null || passed.grade === undefined ? 'Passed' : `Passed · ${passed.grade}`, attempt: passed }
  const upcoming = attempts.filter((attempt) => attempt.status === 'upcoming').sort((a, b) => String(a.examDate || '9999').localeCompare(String(b.examDate || '9999')))[0]
  if (upcoming) return { key: 'upcoming', label: upcoming.examDate ? `${upcoming.type === 'resit' ? 'Resit' : 'Exam'} · ${academicDate(upcoming.examDate)}` : `${upcoming.type === 'resit' ? 'Resit' : 'Exam'} · date not set`, attempt: upcoming }
  const failed = [...attempts].reverse().find((attempt) => attempt.status === 'failed' || attempt.status === 'no-show')
  if (failed) return { key: 'failed', label: failed.status === 'no-show' ? 'No-show' : failed.grade === null || failed.grade === undefined ? 'Failed' : `Failed · ${failed.grade}`, attempt: failed }
  return { key: 'open', label: 'Not recorded', attempt: null }
}

function planningStatusPill(course) {
  const status = planningCourseStatus(course)
  return `<span class="pl-pill is-${status.key}">${escapeHtml(status.label)}</span>`
}

function planningYearGroups(courses) {
  const groups = new Map()
  for (const course of courses) {
    const level = course.yearLevel || 'Unassigned level'
    groups.set(level, [...(groups.get(level) || []), course])
  }
  return [...groups.entries()].map(([level, list]) => ({ level, courses: list, ects: list.reduce((sum, course) => sum + course.ects, 0) }))
}

function planningStudyCell(course) {
  const editorial = editorialCourseForAcademic(course)
  return editorial
    ? `<a class="pl-study" href="#/course/${encodeURIComponent(editorial.id)}" title="Open ${escapeHtml(editorial.name)}">${uiIcon('chevronRight')}<span>Materials</span></a>`
    : '<span class="pl-study is-none">—</span>'
}

function planningStats(cells) {
  return `<dl class="pl-stats">${cells.map(([label, value, note]) => `<div><dt>${escapeHtml(label)}</dt><dd>${value}</dd>${note ? `<span>${escapeHtml(note)}</span>` : ''}</div>`).join('')}</dl>`
}

function planningPageHeader(title, description, actions = '') {
  return `<header class="pl-view-head">
    <div><h2>${escapeHtml(title)}</h2>${description ? `<p>${description}</p>` : ''}</div>
    ${actions ? `<div class="pl-head-actions">${actions}</div>` : ''}
  </header>`
}

function planningShellHead() {
  const profile = academicsData?.workspace?.profile || {}
  const title = String(profile.programme || '').trim() || 'Academic plan'
  const sub = [profile.degree, profile.university, profile.academicYear].filter((value) => String(value || '').trim()).map(escapeHtml).join(' · ')
  return `<header class="page-head"><div><p class="page-eyebrow">Planning</p><h1>${escapeHtml(title)}</h1><p class="page-sub">${sub || 'Your programme, courses, exam dates, and progress — private to your account.'}</p></div><div class="page-head-actions"><span class="pl-private" title="Only visible to your account">Private record</span>${academicsLoading ? '<span class="pl-saving" role="status">Saving…</span>' : ''}${academicsData?.workspace?.courses?.length && route.tab !== 'documents' ? `<a class="btn btn-secondary btn-sm" href="#/planning/documents">${uiIcon('upload')} Upload document</a>` : ''}</div></header>`
}

function planningSectionHead(title, description, actions = '') {
  return `<div class="pl-section-head"><div><h2>${escapeHtml(title)}</h2>${description ? `<p>${description}</p>` : ''}</div>${actions ? `<div class="pl-section-actions">${actions}</div>` : ''}</div>`
}

function planningEmpty(title, copy, action = '') {
  return `<div class="pl-empty"><div><strong>${escapeHtml(title)}</strong><p>${copy}</p></div>${action}</div>`
}

function planningProfileLine(profile) {
  return [profile.programme, profile.university, profile.academicYear].filter((value) => String(value || '').trim()).map(escapeHtml).join(' · ')
}

function planningProgrammeOptions(course) {
  return ['first', 'resit', 'carry-over', 'other'].map((value) => `<option value="${value}" ${course === value ? 'selected' : ''}>${value === 'first' ? 'First sit' : value === 'resit' ? 'Resit' : value === 'carry-over' ? 'Carry-over' : 'Other'}</option>`).join('')
}

function renderPlanningComposer() {
  const profile = academicsData.workspace.profile
  return `<form class="pl-composer" data-academic-course aria-label="Add a course">
    <div class="pl-composer-head"><strong>Add a course</strong><span>Course codes connect maintained study material automatically.</span></div>
    <div class="pl-fields pl-fields-course">
      <label><span>Course code</span><input name="code" maxlength="40" placeholder="BCS1520" autocomplete="off"></label>
      <label class="wide"><span>Course name</span><input name="name" maxlength="200" placeholder="Course name" required></label>
      <label><span>ECTS</span><input name="ects" type="number" min="0" step="0.5" value="5"></label>
      <label><span>Year or level</span><input name="yearLevel" maxlength="40" placeholder="Year 2"></label>
      <label><span>Period</span><input name="period" maxlength="40" placeholder="Period 1"></label>
    </div>
    <div class="pl-fields pl-fields-attempt">
      <label><span>Attempt</span><select name="attemptType">${planningProgrammeOptions('first')}</select></label>
      <label><span>Status</span><select name="attemptStatus"><option value="upcoming">Upcoming</option><option value="passed">Passed</option><option value="failed">Failed</option><option value="no-show">No-show</option></select></label>
      <label><span>Exam date</span><input name="examDate" type="date"></label>
      <label><span>Grade</span><input name="grade" type="number" step="0.01" placeholder="Optional"></label>
    </div>
    <div class="pl-form-actions"><span>${escapeHtml(profile.academicYear || 'Current academic year')}</span><button class="btn btn-secondary" type="button" data-planning-course-toggle>Cancel</button><button class="btn btn-primary" type="submit" ${academicsLoading ? 'disabled' : ''}>Add course</button></div>
  </form>`
}

function renderPlanningOverview() {
  if (!academicsData && !academicsLoading && !academicsError) queueMicrotask(() => loadAcademics())
  if (academicsLoading && !academicsData) return '<div class="pl-page"><div class="pl-loading"><span></span><p>Loading your academic record…</p></div></div>'
  if (academicsError && !academicsData) return `<div class="pl-page"><div class="pl-error" role="alert"><h1>Academic planning is unavailable</h1><p>${escapeHtml(academicsError)}</p><button class="btn btn-secondary" data-academics-retry>Try again</button></div></div>`
  const workspace = academicsData?.workspace
  if (!workspace) return '<div class="pl-page"></div>'
  if (!workspace.courses.length || planningIntake.step === 'connected') return renderPlanningIntake(workspace)
  const summary = academicsData.summary
  const profile = workspace.profile
  const upcoming = (summary.upcoming || []).slice(0, 6)
  const hasProfile = Boolean(String(profile.programme || '').trim())
  const showProfileEditor = planningProfileEditing || !hasProfile
  const groups = planningYearGroups(workspace.courses)
  const totalEcts = workspace.courses.filter((course) => !course.hiddenFromStats).reduce((sum, course) => sum + course.ects, 0)
  const gatesMet = workspace.gates.filter((gate) => gateResolved(gate, workspace)).length
  const reference = activeEditorialProgrammeReference()
  const template = workspace.programmeTemplate
  const openChoices = reference ? reference.version.choiceGroups.filter((group) => !group.pathwayId && !(template.selectedChoices?.[group.id] || []).length).length + (template.pathwayId ? 0 : 1) : 0
  const insights = planningInsights(workspace)
  const focus = insights.priority.filter((item) => item.days !== null || item.risk === 'critical').slice(0, 4)
  return `<div class="pl-page">
    ${planningPageHeader('Overview', hasProfile ? 'Credits, what is next, and the curriculum at a glance.' : 'Add your programme details to give this record its context.', hasProfile ? `<button type="button" class="btn btn-secondary btn-sm" data-planning-profile-toggle>${showProfileEditor ? 'Close' : `${uiIcon('edit')} Edit details`}</button>` : '')}
    ${showProfileEditor ? `<form class="pl-composer pl-profile" data-academic-profile aria-label="Programme details">
      <div class="pl-composer-head"><strong>Programme details</strong><span>Personal to your record. The shared course catalogue is not changed.</span></div>
      <div class="pl-fields">
        <label><span>University</span><input name="university" value="${escapeHtml(profile.university)}" maxlength="200" placeholder="University name"></label>
        <label><span>Programme</span><input name="programme" value="${escapeHtml(profile.programme)}" maxlength="200" placeholder="Programme name" required></label>
        <label><span>Academic year</span><input name="academicYear" value="${escapeHtml(profile.academicYear)}" maxlength="30" placeholder="2026–2027"></label>
      </div>
      <div class="pl-form-actions">${hasProfile ? '<button class="btn btn-secondary" type="button" data-planning-profile-toggle>Cancel</button>' : ''}<button class="btn btn-primary" type="submit" ${academicsLoading ? 'disabled' : ''}>Save details</button></div>
    </form>` : ''}
    ${planningStats([
      ['Earned credits', `${summary.earnedEcts}<small> / ${totalEcts}</small>`, 'ECTS from passed attempts'],
      ['Weighted GPA', summary.gpa ?? '—', profile.gpaIncludesFailedCourses ? 'Includes failed attempts' : 'Passed attempts only'],
      ['Courses passed', `${summary.passedCourses}<small> / ${summary.totalCourses}</small>`, 'In this programme record'],
      ['Upcoming exams', (summary.upcoming || []).length, workspace.gates.length ? `${gatesMet} of ${workspace.gates.length} requirements met` : 'No requirements configured']
    ])}
    <div class="pl-columns">
      <div class="pl-main">
        ${planningSectionHead('Next up', 'Dated attempts and personal events, soonest first.', '<a class="pl-link" href="#/planning/calendar">Calendar</a>')}
        ${upcoming.length ? `<ol class="pl-upcoming">${upcoming.map((attempt) => {
          const course = workspace.courses.find((item) => item.id === attempt.courseId)
          return `<li><time datetime="${escapeHtml(attempt.examDate)}">${academicDate(attempt.examDate)}</time><div><strong>${escapeHtml(attempt.code || attempt.name)}</strong><span>${escapeHtml(attempt.name)} · ${escapeHtml(attempt.type)}</span></div>${course ? planningStudyCell(course) : ''}</li>`
        }).join('')}</ol>` : planningEmpty('No upcoming exam dates', 'Add an exam date to any course to see it here and on the course page.', '<a class="btn btn-secondary btn-sm" href="#/planning/courses">Open courses</a>')}

        ${planningSectionHead('Curriculum', `${workspace.courses.length} course${workspace.courses.length === 1 ? '' : 's'} · ${totalEcts} ECTS in your record.`, `<a class="pl-link" href="#/planning/courses">Manage</a><button type="button" class="btn ${planningCourseComposerOpen ? 'btn-secondary' : 'btn-primary'} btn-sm" data-planning-course-toggle>${planningCourseComposerOpen ? 'Close' : `${uiIcon('plus')} Add course`}</button>`)}
        ${planningCourseComposerOpen ? renderPlanningComposer() : ''}
        ${groups.map((group) => `<section class="pl-group">
          <header><h3>${escapeHtml(group.level)}</h3><span>${group.courses.length} course${group.courses.length === 1 ? '' : 's'} · ${group.ects} ECTS</span></header>
          <div class="pl-table-wrap"><table class="pl-table pl-table-overview">
            <thead><tr><th class="col-code">Code</th><th>Course</th><th class="col-period">Period</th><th class="col-num">ECTS</th><th class="col-status">Status</th><th class="col-study"><span class="sr-only">Study material</span></th></tr></thead>
            <tbody>${group.courses.map((course) => `<tr>
              <td class="col-code"><a href="#/planning/courses/${encodeURIComponent(course.id)}">${escapeHtml(course.code || '—')}</a></td>
              <td class="col-name"><a href="#/planning/courses/${encodeURIComponent(course.id)}">${escapeHtml(course.name)}</a></td>
              <td class="col-period">${escapeHtml(course.period || '—')}</td>
              <td class="col-num">${course.ects}</td>
              <td class="col-status">${planningStatusPill(course)}</td>
              <td class="col-study">${planningStudyCell(course)}</td>
            </tr>`).join('')}</tbody>
          </table></div>
        </section>`).join('')}
      </div>
      <aside class="pl-aside">
        ${reference ? `<section class="pl-aside-block">
          <h2>Programme</h2>
          <p>${escapeHtml(reference.programme.degree)} ${escapeHtml(reference.programme.name)}<br><span>${escapeHtml(reference.version.label)}</span></p>
          <dl class="pl-facts"><div><dt>Current study year</dt><dd>${escapeHtml(template.currentStudyYear || '—')}</dd></div><div><dt>Open choices</dt><dd>${openChoices}</dd></div></dl>
          <a class="pl-link" href="#/planning/courses">${openChoices ? 'Complete programme choices' : 'Review programme choices'}</a>
        </section>` : ''}
        <section class="pl-aside-block">
          <h2>Where to focus</h2>
          ${focus.length ? `<ul class="pl-focus">${focus.map((item) => `<li><span class="pl-risk is-${item.risk}">${item.risk}</span><div><strong>${escapeHtml(item.course.code || item.course.name)}</strong><span>${item.days === null ? 'No exam date' : item.days < 0 ? `${Math.abs(item.days)} days ago` : item.days === 0 ? 'Today' : `In ${item.days} day${item.days === 1 ? '' : 's'}`} · ${item.course.ects} ECTS</span></div></li>`).join('')}</ul>` : `<p>Record exam dates and requirements to see what needs attention first.</p>`}
          <a class="pl-link" href="#/planning/planner">Open scenario planner</a>
        </section>
        <section class="pl-aside-block">
          <h2>Requirements</h2>
          ${workspace.gates.length ? `<ul class="pl-gate-list">${workspace.gates.slice(0, 5).map((gate) => `<li><span class="pl-gate-dot ${gateResolved(gate, workspace) ? 'is-met' : ''}"></span><span>${escapeHtml(gate.label)}</span></li>`).join('')}</ul>` : '<p>No progression or completion rules recorded for this cohort.</p>'}
          <a class="pl-link" href="#/planning/progress">${workspace.gates.length ? 'Review progress' : 'Add requirements'}</a>
        </section>
      </aside>
    </div>
    ${academicsError ? `<p class="pl-save-error" role="alert">Changes could not be saved: ${escapeHtml(academicsError)}</p>` : ''}
  </div>`
}

function planningShell(body) {
  const isOnboarding = Boolean(academicsData?.workspace && (!academicsData.workspace.courses.length || planningIntake.step === 'connected'))
  const programmes = academicsData?.index?.programmes || []
  if (isOnboarding && programmes.length > 1 && planningIntake.step !== 'connected') {
    const active = programmes.find((item) => item.id === academicsData.index.activeProgrammeId)
    return `<div class="planning-shell is-onboarding${academicsLoading ? ' is-saving' : ''}">${planningShellHead()}<nav class="page-tabs" aria-label="Academic planning sections"><div><a href="#/planning/overview" class="${route.tab !== 'settings' ? 'active' : ''}">Set up ${escapeHtml(active?.programme || 'programme')}</a><a href="#/planning/settings" class="${route.tab === 'settings' ? 'active' : ''}">Programmes</a></div></nav>${body}</div>`
  }
  return `<div class="planning-shell${academicsLoading ? ' is-saving' : ''}${isOnboarding ? ' is-onboarding' : ''}"${academicsLoading ? ' aria-busy="true"' : ''}>${isOnboarding ? '' : `${planningShellHead()}<nav class="page-tabs" aria-label="Academic planning sections"><div>${PLANNING_TABS.map(([id, label]) => `<a href="#/planning/${id}" class="${route.tab === id ? 'active' : ''}"${route.tab === id ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</div></nav>`}${body}</div>`
}

function renderAcademicPlanningPage() {
  if (!academicsData && !academicsLoading && !academicsError) queueMicrotask(() => loadAcademics())
  if (!academicsData) return planningShell(renderPlanningOverview())
  if (!academicsData.workspace.courses.length && route.tab === 'settings' && academicsData.index?.programmes?.length > 1) return planningShell(renderPlanningSettings())
  if (!academicsData.workspace.courses.length || planningIntake.step === 'connected') return planningShell(renderPlanningOverview())
  if (route.tab === 'courses' && route.focus && planningFocusApplied !== route.focus) { planningExpandedCourse = route.focus; planningFocusApplied = route.focus }
  const views = { overview: renderPlanningOverview, courses: renderPlanningCourses, calendar: renderPlanningCalendar, documents: renderPlanningDocuments, progress: renderPlanningProgress, planner: renderPlanningPlanner, settings: renderPlanningSettings }
  return planningShell((views[route.tab] || renderPlanningOverview)())
}

function renderPlanningStructure(workspace) {
  if (workspace.programmeTemplate && !editorialProgrammesData && !editorialProgrammesLoading && !editorialProgrammesError) queueMicrotask(() => loadEditorialProgrammes())
  const reference = activeEditorialProgrammeReference()
  const template = workspace.programmeTemplate
  if (!template) return ''
  if (!reference) return `<section class="pl-structure"><div class="pl-empty"><div><strong>Programme reference unavailable</strong><p>${editorialProgrammesLoading ? 'Loading the programme reference…' : `The saved programme reference could not be loaded${editorialProgrammesError ? `: ${escapeHtml(editorialProgrammesError)}` : '.'}`}</p></div>${editorialProgrammesError ? '<button type="button" class="btn btn-secondary btn-sm" data-editorial-programmes-retry>Try again</button>' : ''}</div></section>`
  const { programme, version } = reference
  const moduleGroups = version.choiceGroups.filter((group) => !group.pathwayId)
  const electiveGroup = version.choiceGroups.find((group) => group.id === 'year-3-electives')
  const selectedElectives = template.selectedChoices?.[electiveGroup?.id] || []
  const courseBased = template.pathwayId === 'course-based'
  const open = planningStructureOpen
  return `<section class="pl-structure${open ? ' is-open' : ''}" aria-labelledby="pl-structure-title">
    <button type="button" class="pl-structure-toggle" data-planning-structure-toggle aria-expanded="${open}">
      <div><h2 id="pl-structure-title">Programme structure</h2><p>${escapeHtml(programme.degree)} ${escapeHtml(programme.name)} · ${escapeHtml(version.label)} · verified ${escapeHtml(academicDate(version.lastVerified))}</p></div>
      <span>${moduleGroups.filter((group) => (template.selectedChoices?.[group.id] || []).length).length + (template.pathwayId ? 1 : 0)} of ${moduleGroups.length + 1} choices made ${uiIcon('chevronDown')}</span>
    </button>
    ${open ? `<form data-academic-programme-structure>
      <p class="pl-note">Reference only — check the official curriculum against your cohort rules. Changing a choice updates your curriculum and keeps recorded attempts. <a href="${escapeHtml(version.sources?.[0]?.url || '#')}" target="_blank" rel="noreferrer">Official source</a></p>
      <div class="pl-fields pl-fields-structure">
        ${moduleGroups.map((group) => `<label><span>${escapeHtml(group.label)}</span><select name="choice-${escapeHtml(group.id)}"><option value="">Decide later</option>${group.courseIds.map((courseId) => { const course = version.courses.find((item) => item.id === courseId); return `<option value="${escapeHtml(courseId)}" ${(template.selectedChoices?.[group.id] || []).includes(courseId) ? 'selected' : ''}>${escapeHtml(course.name.replace(/^M2-\d:\s*/, ''))}</option>` }).join('')}</select><small>${escapeHtml(group.description)}</small></label>`).join('')}
        <label><span>Year 3 · Semester 1 pathway</span><select name="pathwayId" data-programme-structure-pathway><option value="">Decide later</option>${version.pathways.map((pathway) => `<option value="${escapeHtml(pathway.id)}" ${template.pathwayId === pathway.id ? 'selected' : ''}>${escapeHtml(pathway.label)}</option>`).join('')}</select><small>The selected route determines the remaining 30 ECTS.</small></label>
      </div>
      ${electiveGroup ? `<details class="pl-electives" data-programme-electives ${courseBased ? '' : 'hidden'} ${courseBased && !compactPlanningMedia.matches ? 'open' : ''}><summary><strong>${escapeHtml(electiveGroup.label)}</strong><span><b data-programme-elective-count>${selectedElectives.length}</b> of ${electiveGroup.maxSelections} selected</span></summary><div>${electiveGroup.courseIds.map((courseId) => { const course = version.courses.find((item) => item.id === courseId); return `<label><input type="checkbox" name="choice-${escapeHtml(electiveGroup.id)}" value="${escapeHtml(courseId)}" ${selectedElectives.includes(courseId) ? 'checked' : ''} ${courseBased ? '' : 'disabled'}><span><strong>${escapeHtml(course.name)}</strong><small>${escapeHtml(course.period)} · ${course.ects} ECTS</small></span></label>` }).join('')}</div></details>` : ''}
      <div class="pl-form-actions"><span>Unselected requirements stay open; nothing is guessed.</span><button class="btn btn-primary" type="submit" ${academicsLoading ? 'disabled' : ''}>Save choices</button></div>
    </form>` : ''}
  </section>`
}

function renderPlanningCourseEditor(course, workspace) {
  const editorial = editorialCourseForAcademic(course)
  return `<tr class="pl-editor-row"><td colspan="7"><div class="pl-editor" id="pl-editor-${escapeHtml(course.id)}">
    <form class="pl-editor-course" data-academic-course-edit="${escapeHtml(course.id)}">
      <div class="pl-editor-head"><strong>Course record</strong><span>${editorial ? `Connected to ${escapeHtml(editorial.name)}` : 'No maintained study material matches this code'}</span></div>
      <div class="pl-fields pl-fields-course">
        <label><span>Code</span><input name="code" value="${escapeHtml(course.code)}" maxlength="40"></label>
        <label class="wide"><span>Course</span><input name="name" value="${escapeHtml(course.name)}" maxlength="200" required></label>
        <label><span>ECTS</span><input name="ects" type="number" step="0.5" min="0" value="${course.ects}"></label>
        <label><span>Year or level</span><input name="yearLevel" value="${escapeHtml(course.yearLevel)}" maxlength="40"></label>
        <label><span>Period</span><input name="period" value="${escapeHtml(course.period)}" maxlength="40"></label>
        <label><span>Pass mark</span><input name="passMark" type="number" step="0.01" min="0" max="100" value="${course.passMark}"></label>
        <label class="wide"><span>Notes</span><input name="notes" value="${escapeHtml(course.notes)}" maxlength="2000"></label>
        <label class="pl-check"><input name="hiddenFromStats" type="checkbox" ${course.hiddenFromStats ? 'checked' : ''}><span>Exclude from credits and GPA</span></label>
      </div>
      <div class="pl-form-actions"><button type="button" class="pl-danger-link" data-academic-remove="${escapeHtml(course.id)}">Remove course</button><span class="pl-spacer"></span><button class="btn btn-secondary btn-sm" type="button" data-planning-expand="${escapeHtml(course.id)}">Close</button><button class="btn btn-primary btn-sm" type="submit" ${academicsLoading ? 'disabled' : ''}>Save course</button></div>
    </form>
    <div class="pl-attempts">
      <div class="pl-editor-head"><strong>Attempts</strong><span>${course.attempts.length ? `${course.attempts.length} recorded` : 'Nothing recorded yet'}</span></div>
      ${course.attempts.map((attempt) => `<form class="pl-attempt" data-academic-attempt-edit="${escapeHtml(course.id)}/${escapeHtml(attempt.id)}">
        <label><span>Academic year</span><input name="academicYear" value="${escapeHtml(attempt.academicYear)}" maxlength="30"></label>
        <label><span>Attempt</span><select name="type">${planningProgrammeOptions(attempt.type)}</select></label>
        <label><span>Exam date</span><input name="examDate" type="date" value="${escapeHtml(attempt.examDate || '')}"></label>
        <label><span>Status</span><select name="status">${['upcoming', 'passed', 'failed', 'no-show'].map((value) => `<option value="${value}" ${attempt.status === value ? 'selected' : ''}>${value === 'no-show' ? 'No-show' : value[0].toUpperCase() + value.slice(1)}</option>`).join('')}</select></label>
        <label><span>Grade</span><input name="grade" type="number" step="0.01" value="${attempt.grade ?? ''}" placeholder="—"></label>
        <div class="pl-attempt-actions"><button class="btn btn-secondary btn-sm" type="submit">Save</button><button class="pl-danger-link" type="button" data-academic-attempt-remove="${escapeHtml(course.id)}/${escapeHtml(attempt.id)}" title="Remove attempt">${uiIcon('trash')}<span class="sr-only">Remove attempt</span></button></div>
      </form>`).join('')}
      <form class="pl-attempt is-new" data-academic-attempt-add="${escapeHtml(course.id)}">
        <label><span>Academic year</span><input name="academicYear" value="${escapeHtml(workspace.profile.academicYear)}" maxlength="30"></label>
        <label><span>Attempt</span><select name="type">${planningProgrammeOptions('first')}</select></label>
        <label><span>Exam date</span><input name="examDate" type="date"></label>
        <div class="pl-attempt-actions"><button class="btn btn-secondary btn-sm" type="submit">${uiIcon('plus')} Add attempt</button></div>
      </form>
    </div>
  </div></td></tr>`
}

function renderPlanningCourses() {
  const workspace = academicsData.workspace
  const groups = planningYearGroups(workspace.courses)
  const totalEcts = workspace.courses.reduce((sum, course) => sum + course.ects, 0)
  return `<div class="pl-page">
    ${planningPageHeader('Courses', `${workspace.courses.length} course${workspace.courses.length === 1 ? '' : 's'} · ${totalEcts} ECTS · select a row to edit its record and attempts.`, `<button type="button" class="btn ${planningCourseComposerOpen ? 'btn-secondary' : 'btn-primary'} btn-sm" data-planning-course-toggle>${planningCourseComposerOpen ? 'Close' : `${uiIcon('plus')} Add course`}</button>`)}
    ${planningCourseComposerOpen ? renderPlanningComposer() : ''}
    ${renderPlanningStructure(workspace)}
    ${groups.length ? groups.map((group) => `<section class="pl-group">
      <header><h3>${escapeHtml(group.level)}</h3><span>${group.courses.length} course${group.courses.length === 1 ? '' : 's'} · ${group.ects} ECTS</span></header>
      <div class="pl-table-wrap"><table class="pl-table pl-table-courses">
        <thead><tr><th class="col-code">Code</th><th>Course</th><th class="col-period">Period</th><th class="col-num">ECTS</th><th class="col-req">Requirement</th><th class="col-status">Status</th><th class="col-study"><span class="sr-only">Study material</span></th></tr></thead>
        <tbody>${group.courses.map((course) => {
          const expanded = planningExpandedCourse === course.id
          const requirement = course.programmeRequirement === 'historical' ? 'History' : course.programmeRequirement ? course.programmeRequirement[0].toUpperCase() + course.programmeRequirement.slice(1) : 'Personal'
          return `<tr class="pl-row${expanded ? ' is-expanded' : ''}${course.hiddenFromStats ? ' is-hidden' : ''}" data-planning-expand="${escapeHtml(course.id)}" tabindex="0" aria-expanded="${expanded}">
            <td class="col-code">${escapeHtml(course.code || '—')}</td>
            <td class="col-name"><span>${escapeHtml(course.name)}</span>${course.hiddenFromStats ? '<small>Excluded from statistics</small>' : ''}</td>
            <td class="col-period">${escapeHtml(course.period || '—')}</td>
            <td class="col-num">${course.ects}</td>
            <td class="col-req">${escapeHtml(requirement)}</td>
            <td class="col-status">${planningStatusPill(course)}</td>
            <td class="col-study">${planningStudyCell(course)}<span class="pl-chevron" aria-hidden="true">${uiIcon('chevronDown')}</span></td>
          </tr>${expanded ? renderPlanningCourseEditor(course, workspace) : ''}`
        }).join('')}</tbody>
      </table></div>
    </section>`).join('') : planningEmpty('No courses in this plan', 'Add the courses that apply to your programme. Matching study material connects by course code.', '<button type="button" class="btn btn-primary btn-sm" data-planning-course-toggle>Add your first course</button>')}
    ${academicsError ? `<p class="pl-save-error" role="alert">Changes could not be saved: ${escapeHtml(academicsError)}</p>` : ''}
  </div>`
}

function renderPlanningCalendar() {
  const workspace = academicsData.workspace
  const attempts = workspace.courses.flatMap((course) => course.attempts.filter((attempt) => attempt.examDate).map((attempt) => ({ id: `${course.id}/${attempt.id}`, date: attempt.examDate, title: course.name, code: course.code, kind: attempt.status === 'upcoming' ? (attempt.type === 'resit' ? 'Resit' : 'Exam') : attempt.status === 'passed' ? 'Passed' : attempt.status === 'failed' ? 'Failed' : 'No-show', status: attempt.status, courseId: course.id, editable: false })))
  const events = workspace.events.filter((event) => event.date).map((event) => ({ ...event, kind: event.type, editable: true }))
  const ownKeys = new Set(workspace.events.map((event) => `${event.title.toLowerCase()}|${event.date}`))
  const institution = (activeEditorialProgrammeReference()?.programme?.calendar || []).filter((event) => event.date && !ownKeys.has(`${event.title.toLowerCase()}|${event.date}`)).map((event) => ({ ...event, id: `institution:${event.id}`, kind: `${event.type} · institution calendar`, institution: true }))
  const entries = [...attempts, ...events, ...institution].sort((a, b) => a.date.localeCompare(b.date))
  const today = new Date().toISOString().slice(0, 10)
  const months = new Map()
  for (const entry of entries) {
    const key = entry.date.slice(0, 7)
    months.set(key, [...(months.get(key) || []), entry])
  }
  const monthLabel = (key) => new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(`${key}-01T00:00:00`))
  const firstUpcoming = entries.find((entry) => entry.date >= today)
  return `<div class="pl-page">
    ${planningPageHeader('Calendar', 'Exam attempts from your courses plus registration windows, deadlines, and personal dates.', `<button type="button" class="btn ${planningEventComposerOpen ? 'btn-secondary' : 'btn-primary'} btn-sm" data-planning-event-toggle>${planningEventComposerOpen ? 'Close' : `${uiIcon('plus')} Add event`}</button>`)}
    ${planningEventComposerOpen ? `<form class="pl-composer" data-academic-event aria-label="Add academic event">
      <div class="pl-composer-head"><strong>Add an event</strong><span>Exam dates belong to a course attempt; add them from Courses.</span></div>
      <div class="pl-fields pl-fields-event">
        <label class="wide"><span>Title</span><input name="title" maxlength="200" required placeholder="Resit registration closes"></label>
        <label><span>Date</span><input name="date" type="date" required></label>
        <label><span>End date</span><input name="endDate" type="date"></label>
        <label><span>Type</span><select name="type"><option value="registration">Registration</option><option value="deadline">Deadline</option><option value="ceremony">Ceremony</option><option value="other">Other</option></select></label>
        <label class="wide"><span>Notes</span><input name="notes" maxlength="2000"></label>
      </div>
      <div class="pl-form-actions"><button class="btn btn-secondary" type="button" data-planning-event-toggle>Cancel</button><button class="btn btn-primary" type="submit" ${academicsLoading ? 'disabled' : ''}>Add event</button></div>
    </form>` : ''}
    ${entries.length ? [...months.entries()].map(([key, list]) => `<section class="pl-group">
      <header><h3>${escapeHtml(monthLabel(key))}</h3><span>${list.length} ${list.length === 1 ? 'date' : 'dates'}</span></header>
      <ol class="pl-timeline">${list.map((entry) => {
        const expanded = entry.editable && planningExpandedEvent === entry.id
        const past = entry.date < today
        return `<li class="pl-timeline-item${past ? ' is-past' : ''}${firstUpcoming && firstUpcoming.id === entry.id ? ' is-next' : ''}${expanded ? ' is-expanded' : ''}">
          <div class="pl-timeline-row${entry.institution ? ' is-institution' : ''}"${entry.editable ? ` data-planning-expand-event="${escapeHtml(entry.id)}" tabindex="0" role="button" aria-expanded="${expanded}"` : ''}>
            <time datetime="${escapeHtml(entry.date)}"><strong>${new Date(`${entry.date}T00:00:00`).getDate()}</strong><span>${new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(`${entry.date}T00:00:00`))}</span></time>
            <div class="pl-timeline-copy"><strong>${escapeHtml(entry.code ? `${entry.code} · ${entry.title}` : entry.title)}</strong><span>${escapeHtml(entry.kind)}${entry.endDate ? ` · until ${academicDate(entry.endDate)}` : ''}${entry.notes ? ` · ${escapeHtml(entry.notes)}` : ''}</span></div>
            ${entry.courseId ? `<a class="pl-link" href="#/planning/courses/${encodeURIComponent(entry.courseId)}">Course</a>` : entry.institution ? `<button type="button" class="pl-link pl-link-button" data-institution-event-import="${escapeHtml(entry.id.slice(12))}">Add to my plan</button>` : `<span class="pl-chevron" aria-hidden="true">${uiIcon('chevronDown')}</span>`}
          </div>
          ${expanded ? `<form class="pl-editor pl-editor-event" data-academic-event-edit="${escapeHtml(entry.id)}">
            <div class="pl-fields pl-fields-event">
              <label class="wide"><span>Title</span><input name="title" value="${escapeHtml(entry.title)}" maxlength="200" required></label>
              <label><span>Date</span><input name="date" type="date" value="${escapeHtml(entry.date || '')}"></label>
              <label><span>End date</span><input name="endDate" type="date" value="${escapeHtml(entry.endDate || '')}"></label>
              <label class="wide"><span>Notes</span><input name="notes" value="${escapeHtml(entry.notes || '')}" maxlength="2000"></label>
            </div>
            <div class="pl-form-actions"><button type="button" class="pl-danger-link" data-academic-event-remove="${escapeHtml(entry.id)}">Remove event</button><span class="pl-spacer"></span><button type="button" class="btn btn-secondary btn-sm" data-planning-expand-event="${escapeHtml(entry.id)}">Close</button><button class="btn btn-primary btn-sm" type="submit">Save</button></div>
          </form>` : ''}
        </li>`
      }).join('')}</ol>
    </section>`).join('') : planningEmpty('No dated exams or events', 'Exam dates you add to course attempts appear here automatically, alongside any personal deadlines.', '<a class="btn btn-secondary btn-sm" href="#/planning/courses">Open courses</a>')}
    ${academicsError ? `<p class="pl-save-error" role="alert">Changes could not be saved: ${escapeHtml(academicsError)}</p>` : ''}
  </div>`
}

function gateDescription(gate, workspace) {
  if (gate.type === 'course') {
    const course = workspace.courses.find((item) => item.id === gate.courseId)
    return course ? `Pass ${course.code || course.name}` : 'Pass a specific course'
  }
  if (gate.type === 'all-level') return `Pass every course in ${gate.level || 'the level'}`
  if (gate.type === 'credit-level') return `${gate.target} ECTS in ${gate.level || 'the level'}`
  return `${gate.target} ECTS in total`
}

function gateProgress(gate, workspace) {
  const passed = (course) => course.attempts.some((attempt) => attempt.status === 'passed')
  if (gate.type === 'course') return null
  if (gate.type === 'all-level') {
    const list = workspace.courses.filter((course) => course.yearLevel === gate.level && !course.hiddenFromStats)
    return { value: list.filter(passed).length, target: list.length, unit: 'courses' }
  }
  const earned = workspace.courses.filter((course) => !course.hiddenFromStats && passed(course) && (gate.type !== 'credit-level' || course.yearLevel === gate.level)).reduce((sum, course) => sum + course.ects, 0)
  return { value: earned, target: gate.target, unit: 'ECTS' }
}

// ----- Documents: supporting files at any time → reviewable change set -----
const DOCUMENT_KINDS = [['auto', 'Detect automatically'], ['transcript', 'Transcript or grade list'], ['exam-schedule', 'Exam schedule'], ['timetable', 'Timetable or calendar'], ['academic-calendar', 'Academic calendar'], ['curriculum', 'Curriculum or handbook']]
const CHANGE_GROUPS = [['result', 'Results and grades'], ['exam-date', 'Exam dates'], ['new-course', 'New courses'], ['course-detail', 'Course details'], ['event', 'Dates and events'], ['profile', 'Programme details']]
const planningDocuments = { files: [], description: '', kind: 'auto', processing: false, analysing: false, error: null, result: null, selected: new Set(), applying: false, applied: null, calendarUrl: '', calendarLabel: '', calendarBusy: false, calendarError: null }

async function addDocumentSources(fileList) {
  const remaining = MAX_PLANNING_SOURCES - planningDocuments.files.length
  const selected = [...(fileList || [])].slice(0, Math.max(0, remaining))
  if (!selected.length) { planningDocuments.error = remaining <= 0 ? `You can add up to ${MAX_PLANNING_SOURCES} files at once.` : null; render(); return }
  planningDocuments.processing = true
  planningDocuments.error = null
  render()
  const failures = []
  for (const file of selected) {
    try { planningDocuments.files.push(await planningSourcePayload(file)) } catch (error) { failures.push(error.message) }
  }
  planningDocuments.processing = false
  planningDocuments.error = failures.length ? failures.join(' ') : null
  render()
}

function renderChangeSet(result, { selectable = true } = {}) {
  const changes = result?.changes || []
  if (!changes.length) return `<div class="pl-empty"><div><strong>Nothing new to apply</strong><p>Everything in ${result?.kind === 'timetable' ? 'this calendar' : 'these documents'} is already in your plan${result?.warnings?.length ? ', but see the notes above' : ''}.</p></div></div>`
  return CHANGE_GROUPS.map(([kind, label]) => {
    const list = changes.filter((change) => change.kind === kind)
    if (!list.length) return ''
    return `<section class="doc-group"><header><h3>${label}</h3><span>${list.length}</span></header><ul class="doc-changes">${list.map((change) => `<li><label><input type="checkbox" data-doc-toggle="${escapeHtml(change.id)}" ${planningDocuments.selected.has(change.id) ? 'checked' : ''} ${selectable ? '' : 'disabled'}><span><strong>${escapeHtml(change.label)}</strong><small>${escapeHtml(change.detail || '')}</small></span></label></li>`).join('')}</ul></section>`
  }).join('')
}

function renderPlanningDocuments() {
  const workspace = academicsData.workspace
  const docs = planningDocuments
  const files = docs.files
  const canAnalyse = !docs.processing && !docs.analysing && (files.length > 0 || docs.description.trim().length > 0)
  const result = docs.result
  const selectedCount = result ? result.changes.filter((change) => docs.selected.has(change.id)).length : 0
  const calendars = workspace.calendars || []
  const institution = activeEditorialProgrammeReference()?.programme?.calendar || []
  return `<div class="pl-page">
    ${planningPageHeader('Documents', 'Drop a transcript, exam schedule, timetable, or academic calendar whenever you get one. Wicker Study reads it and proposes updates; nothing changes until you apply them.')}
    ${docs.applied ? `<div class="doc-applied" role="status">${uiIcon('check')} <span>${docs.applied} change${docs.applied === 1 ? '' : 's'} applied to your plan.</span><a class="pl-link" href="#/planning/calendar">Calendar</a><a class="pl-link" href="#/planning/courses">Courses</a><button type="button" class="pl-link pl-link-button" data-doc-reset>Upload another</button></div>` : ''}
    ${result ? `<section class="panel doc-result">
      <div class="panel-top"><div><h2>Review proposed changes</h2><p>${result.usedAi === false ? 'Extracted with the basic text parser — check each line. ' : ''}${result.changes.length} proposed from ${result.sources?.length ? result.sources.map((source) => escapeHtml(source.name)).join(', ') : result.link ? escapeHtml(result.link.label) : 'your sources'}${result.kind && result.kind !== 'auto' ? ` · read as ${escapeHtml(DOCUMENT_KINDS.find(([id]) => id === result.kind)?.[1] || result.kind).toLowerCase()}` : ''}.</p></div><button type="button" class="btn btn-ghost btn-sm" data-doc-reset>Discard</button></div>
      ${result.warnings?.length ? `<div class="planning-intake-warnings" role="status"><strong>Notes from the reader</strong><ul>${result.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul></div>` : ''}
      ${renderChangeSet(result)}
      ${docs.error ? `<p class="account-delete-error" role="alert">${escapeHtml(docs.error)}</p>` : ''}
      ${result.changes.length ? `<div class="pl-form-actions"><button type="button" class="btn btn-secondary btn-sm" data-doc-select-all>${selectedCount === result.changes.length ? 'Clear all' : 'Select all'}</button><span class="pl-spacer"></span><span class="doc-count">${selectedCount} of ${result.changes.length} selected</span><button type="button" class="btn btn-primary" data-doc-apply ${selectedCount && !docs.applying ? '' : 'disabled'}>${docs.applying ? 'Applying…' : 'Apply selected'}</button></div>` : ''}
    </section>` : `<div class="doc-grid">
      <section class="panel">
        <div class="panel-top"><div><h2>Upload a document</h2><p>PDF, screenshot, or text. Files are read for this update only; originals are not stored.</p></div></div>
        <label class="planning-dropzone doc-dropzone${docs.processing ? ' is-processing' : ''}" data-doc-dropzone>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.ics,application/pdf,image/*,text/plain,text/csv,text/calendar" multiple data-doc-files ${docs.processing || docs.analysing ? 'disabled' : ''}>
          <span class="planning-dropzone-icon">${uiIcon('upload')}</span>
          <span><strong>${docs.processing ? 'Reading your files…' : 'Drop files here or choose from your device'}</strong><small>Up to ${MAX_PLANNING_SOURCES} files · PDF, JPG, PNG, TXT, CSV, ICS</small></span>
          <span class="btn btn-secondary">Choose files</span>
        </label>
        ${files.length ? `<ul class="planning-source-list" aria-label="Added files">${files.map((file, index) => `<li><span class="planning-source-file-icon">${uiIcon('file')}</span><span><strong>${escapeHtml(file.name)}</strong><small>${file.pageCount ? `${file.pageCount} page${file.pageCount === 1 ? '' : 's'}` : file.text ? `${Math.round(file.text.length / 1000)}k characters` : 'image'}</small></span><button type="button" class="pl-danger-link" data-doc-remove="${index}">Remove</button></li>`).join('')}</ul>` : ''}
        <div class="doc-fields">
          <label><span>What is it?</span><select data-doc-kind>${DOCUMENT_KINDS.map(([id, label]) => `<option value="${id}" ${docs.kind === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
          <label class="wide"><span>Anything to add (optional)</span><textarea data-doc-description maxlength="20000" rows="2" placeholder="e.g. This is my 2025–2026 transcript; grades are out of 10.">${escapeHtml(docs.description)}</textarea></label>
        </div>
        ${docs.error ? `<p class="account-delete-error" role="alert">${escapeHtml(docs.error)}</p>` : ''}
        <div class="pl-form-actions"><span class="panel-note">${aiAllowance('intake') === 'Usage allowance loads after sign-in.' ? '' : `${aiUsage?.remaining?.intakeToday ?? '—'} of ${aiUsage?.limits?.intake?.requestsPerDay ?? '—'} document reads left today`}</span><span class="pl-spacer"></span><button type="button" class="btn btn-primary" data-doc-analyse ${canAnalyse ? '' : 'disabled'}>${docs.analysing ? 'Reading…' : `${uiIcon('sparkle')} Read and propose updates`}</button></div>
      </section>
      <div class="account-stack">
        <section class="panel">
          <div class="panel-top"><div><h2>Calendar links</h2><p>Timetable or exam-schedule feeds (.ics / webcal). Saved links can be re-synced any time.</p></div></div>
          ${calendars.length ? `<ul class="doc-calendars">${calendars.map((link) => `<li><span class="nav-icon">${uiIcon('calendar')}</span><span><strong>${escapeHtml(link.label)}</strong><small>${link.eventCount} event${link.eventCount === 1 ? '' : 's'} · ${link.lastSyncedAt ? `synced ${relativeTime(link.lastSyncedAt)}` : 'never synced'}</small></span><button type="button" class="btn btn-sm btn-secondary" data-cal-sync="${escapeHtml(link.id)}" ${docs.calendarBusy ? 'disabled' : ''}>Sync</button><button type="button" class="pl-danger-link" data-cal-remove="${escapeHtml(link.id)}">Remove</button></li>`).join('')}</ul>` : ''}
          <form class="doc-calendar-form" data-cal-form>
            <label><span>Feed URL</span><input name="url" type="url" placeholder="https://… or webcal://…" value="${escapeHtml(docs.calendarUrl)}" ${docs.calendarBusy ? 'disabled' : ''} required></label>
            <label><span>Label</span><input name="label" maxlength="120" placeholder="Exam timetable" value="${escapeHtml(docs.calendarLabel)}" ${docs.calendarBusy ? 'disabled' : ''}></label>
            ${docs.calendarError ? `<p class="account-delete-error" role="alert">${escapeHtml(docs.calendarError)}</p>` : ''}
            <div class="pl-form-actions"><button type="button" class="btn btn-secondary btn-sm" data-cal-preview ${docs.calendarBusy ? 'disabled' : ''}>Preview</button><button type="submit" class="btn btn-primary btn-sm" ${docs.calendarBusy ? 'disabled' : ''}>${docs.calendarBusy ? 'Working…' : 'Save and sync'}</button></div>
          </form>
        </section>
        <section class="panel panel-aside">
          <div class="panel-top"><h2>Institution calendar</h2>${institution.length ? '<a class="pl-link" href="#/planning/calendar">Calendar</a>' : ''}</div>
          <p class="panel-note">${institution.length ? `${institution.length} institution-wide date${institution.length === 1 ? '' : 's'} are maintained for your programme and shown in your calendar. Add any of them to your plan from there.` : workspace.programmeTemplate ? 'No institution-wide calendar is maintained for your programme yet.' : 'Link your programme in Settings to see institution-wide dates.'}</p>
        </section>
      </div>
    </div>`}
  </div>`
}

function renderPlanningProgress() {
  const workspace = academicsData.workspace
  const summary = academicsData.summary
  const groups = planningYearGroups(workspace.courses)
  const totalEcts = workspace.courses.filter((course) => !course.hiddenFromStats).reduce((sum, course) => sum + course.ects, 0)
  const gatesMet = workspace.gates.filter((gate) => gateResolved(gate, workspace)).length
  return `<div class="pl-page">
    ${planningPageHeader('Progress', 'Credits, GPA, and requirements derived only from the attempts recorded in this programme.')}
    ${planningStats([
      ['Earned credits', `${summary.earnedEcts}<small> / ${totalEcts}</small>`, 'ECTS from passed attempts'],
      ['Weighted GPA', summary.gpa ?? '—', workspace.profile.gpaIncludesFailedCourses ? 'Includes failed attempts' : 'Passed attempts only'],
      ['Courses passed', `${summary.passedCourses}<small> / ${summary.totalCourses}</small>`, `${summary.totalCourses - summary.passedCourses} remaining`],
      ['Requirements met', workspace.gates.length ? `${gatesMet}<small> / ${workspace.gates.length}</small>` : '—', workspace.gates.length ? 'Configured for this cohort' : 'None configured']
    ])}

    ${planningSectionHead('Requirements', 'Progression and completion rules for your cohort. Nothing is assumed from the shared catalogue.', `<button type="button" class="btn ${planningGateComposerOpen ? 'btn-secondary' : 'btn-primary'} btn-sm" data-planning-gate-toggle>${planningGateComposerOpen ? 'Close' : `${uiIcon('plus')} Add requirement`}</button>`)}
    ${planningGateComposerOpen ? `<form class="pl-composer" data-academic-gate aria-label="Add requirement">
      <div class="pl-fields pl-fields-gate">
        <label class="wide"><span>Requirement</span><input name="label" maxlength="200" required placeholder="Binding study advice · 40 ECTS"></label>
        <label><span>Section</span><select name="section"><option value="progression">Progression</option><option value="completion">Completion</option><option value="thesis">Thesis</option><option value="other">Other</option></select></label>
        <label><span>Rule</span><select name="type" data-planning-gate-type><option value="total-credits">Total credits</option><option value="credit-level">Credits in a level</option><option value="all-level">All courses in a level</option><option value="course">Specific course</option></select></label>
        <label><span>Level</span><input name="level" maxlength="40" placeholder="Year 1"></label>
        <label><span>Target credits</span><input name="target" type="number" min="0" step="0.5"></label>
        <label><span>Course</span><select name="courseId"><option value="">None</option>${workspace.courses.map((course) => `<option value="${escapeHtml(course.id)}">${escapeHtml(course.code || course.name)}</option>`).join('')}</select></label>
      </div>
      <div class="pl-form-actions"><button class="btn btn-secondary" type="button" data-planning-gate-toggle>Cancel</button><button class="btn btn-primary" type="submit" ${academicsLoading ? 'disabled' : ''}>Add requirement</button></div>
    </form>` : ''}
    ${workspace.gates.length ? `<ul class="pl-gates">${workspace.gates.map((gate) => {
      const met = gateResolved(gate, workspace)
      const progress = gateProgress(gate, workspace)
      const expanded = planningExpandedGate === gate.id
      return `<li class="pl-gate${met ? ' is-met' : ''}${expanded ? ' is-expanded' : ''}">
        <div class="pl-gate-row" data-planning-expand-gate="${escapeHtml(gate.id)}" tabindex="0" role="button" aria-expanded="${expanded}">
          <span class="pl-gate-state">${met ? uiIcon('check') : ''}</span>
          <div class="pl-gate-copy"><strong>${escapeHtml(gate.label)}</strong><span>${escapeHtml(gate.section || 'other')} · ${escapeHtml(gateDescription(gate, workspace))}</span></div>
          <div class="pl-gate-progress">${progress ? `<span>${progress.value}<small> / ${progress.target} ${progress.unit}</small></span><i style="--pct:${progress.target ? Math.min(100, Math.round((progress.value / progress.target) * 100)) : 0}%"></i>` : `<span>${met ? 'Met' : 'Open'}</span>`}</div>
          <span class="pl-chevron" aria-hidden="true">${uiIcon('chevronDown')}</span>
        </div>
        ${expanded ? `<form class="pl-editor" data-academic-gate-edit="${escapeHtml(gate.id)}">
          <div class="pl-fields pl-fields-gate">
            <label class="wide"><span>Requirement</span><input name="label" value="${escapeHtml(gate.label)}" maxlength="200" required></label>
            <label><span>Level</span><input name="level" value="${escapeHtml(gate.level || '')}" maxlength="40"></label>
            <label><span>Target</span><input name="target" type="number" min="0" step="0.5" value="${gate.target}"></label>
          </div>
          <div class="pl-form-actions"><button type="button" class="pl-danger-link" data-academic-gate-remove="${escapeHtml(gate.id)}">Remove requirement</button><span class="pl-spacer"></span><button type="button" class="btn btn-secondary btn-sm" data-planning-expand-gate="${escapeHtml(gate.id)}">Close</button><button class="btn btn-primary btn-sm" type="submit">Save</button></div>
        </form>` : ''}
      </li>`
    }).join('')}</ul>` : planningEmpty('No requirements configured', 'Add the official progression and completion rules that apply to your cohort, such as a binding study advice threshold.')}

    ${planningSectionHead('Credits', 'Best passing grade per course. Excluded courses are shown but do not count.')}
    ${groups.map((group) => {
      const earned = group.courses.filter((course) => !course.hiddenFromStats && course.attempts.some((attempt) => attempt.status === 'passed')).reduce((sum, course) => sum + course.ects, 0)
      return `<section class="pl-group">
        <header><h3>${escapeHtml(group.level)}</h3><span>${earned} of ${group.courses.filter((course) => !course.hiddenFromStats).reduce((sum, course) => sum + course.ects, 0)} ECTS earned</span></header>
        <div class="pl-table-wrap"><table class="pl-table pl-table-credits">
          <thead><tr><th class="col-code">Code</th><th>Course</th><th class="col-num">ECTS</th><th class="col-num">Best grade</th><th class="col-num">Earned</th><th class="col-status">Status</th></tr></thead>
          <tbody>${group.courses.map((course) => {
            const passing = course.attempts.filter((attempt) => attempt.status === 'passed' && attempt.grade !== null && attempt.grade !== undefined)
            const best = passing.length ? Math.max(...passing.map((attempt) => attempt.grade)) : null
            const passed = course.attempts.some((attempt) => attempt.status === 'passed')
            return `<tr class="${course.hiddenFromStats ? 'is-hidden' : ''}">
              <td class="col-code">${escapeHtml(course.code || '—')}</td>
              <td class="col-name"><span>${escapeHtml(course.name)}</span>${course.hiddenFromStats ? '<small>Excluded from statistics</small>' : ''}</td>
              <td class="col-num">${course.ects}</td>
              <td class="col-num">${best ?? (passed ? 'Pass' : '—')}</td>
              <td class="col-num">${passed && !course.hiddenFromStats ? course.ects : 0}</td>
              <td class="col-status">${planningStatusPill(course)}</td>
            </tr>`
          }).join('')}</tbody>
        </table></div>
      </section>`
    }).join('')}
    ${academicsError ? `<p class="pl-save-error" role="alert">Changes could not be saved: ${escapeHtml(academicsError)}</p>` : ''}
  </div>`
}

function renderPlanningPlanner() {
  const workspace = academicsData.workspace
  const insights = planningInsights(workspace)
  const objectiveFor = (course) => workspace.planning.objectives?.[course.id] || { mode: 'current', outcome: 'actual' }
  const isPassed = (course) => course.attempts.some((attempt) => attempt.status === 'passed')
  const projectedCourses = workspace.courses.filter((course) => !course.hiddenFromStats && (isPassed(course) || (objectiveFor(course).mode !== 'none' && objectiveFor(course).outcome === 'pass')))
  const projectedCredits = projectedCourses.reduce((sum, course) => sum + course.ects, 0)
  const open = workspace.courses.filter((course) => !isPassed(course))
  const planned = open.filter((course) => objectiveFor(course).mode !== 'current' || objectiveFor(course).outcome !== 'actual').length
  const gatesProjected = workspace.gates.filter((gate) => gateResolved(gate, workspace, true)).length
  const groups = planningYearGroups(open)
  const totalEcts = workspace.courses.filter((course) => !course.hiddenFromStats).reduce((sum, course) => sum + course.ects, 0)
  return `<div class="pl-page">
    ${planningPageHeader('Scenario planner', 'Plan which courses you will sit and assume outcomes to see projected credits and requirements. Recorded grades are never changed.', planned ? `<button type="button" class="btn btn-secondary btn-sm" data-planning-scenario-reset>Reset scenario</button>` : '')}
    ${planningStats([
      ['Projected credits', `${projectedCredits}<small> / ${totalEcts}</small>`, `${academicsData.summary.earnedEcts} earned today`],
      ['Requirements', workspace.gates.length ? `${gatesProjected}<small> / ${workspace.gates.length}</small>` : '—', workspace.gates.length ? 'Met in this scenario' : 'None configured'],
      ['Open courses', open.length, `${planned} with planned outcomes`],
      ['Highest risk', insights.priority[0] ? escapeHtml(insights.priority[0].course.code || insights.priority[0].course.name) : '—', insights.priority[0] ? (insights.priority[0].days === null ? 'No exam date' : `${insights.priority[0].days} days to exam`) : 'No open courses']
    ])}
    <div class="pl-columns">
      <div class="pl-main">
        ${planningSectionHead('Assumptions', 'Passed courses are fixed. Set how you plan to sit each open course and the outcome to assume.')}
        ${groups.length ? groups.map((group) => `<section class="pl-group">
          <header><h3>${escapeHtml(group.level)}</h3><span>${group.courses.length} open · ${group.ects} ECTS</span></header>
          <div class="pl-table-wrap"><table class="pl-table pl-table-planner">
            <thead><tr><th class="col-code">Code</th><th>Course</th><th class="col-num">ECTS</th><th class="col-status">Recorded</th><th class="col-select">Plan</th><th class="col-select">Assume</th></tr></thead>
            <tbody>${group.courses.map((course) => {
              const objective = objectiveFor(course)
              const skipped = objective.mode === 'none'
              return `<tr class="${skipped ? 'is-hidden' : ''}${objective.outcome === 'pass' ? ' is-planned-pass' : objective.outcome === 'fail' ? ' is-planned-fail' : ''}">
                <td class="col-code">${escapeHtml(course.code || '—')}</td>
                <td class="col-name"><span>${escapeHtml(course.name)}</span></td>
                <td class="col-num">${course.ects}</td>
                <td class="col-status">${planningStatusPill(course)}</td>
                <td class="col-select"><select data-academic-objective-mode="${escapeHtml(course.id)}" aria-label="Plan for ${escapeHtml(course.name)}"><option value="current" ${objective.mode === 'current' ? 'selected' : ''}>Current sit</option><option value="resit" ${objective.mode === 'resit' ? 'selected' : ''}>Planned resit</option><option value="none" ${skipped ? 'selected' : ''}>Do not sit</option></select></td>
                <td class="col-select"><select data-academic-objective-outcome="${escapeHtml(course.id)}" aria-label="Assumed outcome for ${escapeHtml(course.name)}" ${skipped ? 'disabled' : ''}><option value="actual" ${objective.outcome === 'actual' ? 'selected' : ''}>As recorded</option><option value="pass" ${objective.outcome === 'pass' ? 'selected' : ''}>Pass</option><option value="fail" ${objective.outcome === 'fail' ? 'selected' : ''}>Fail</option></select></td>
              </tr>`
            }).join('')}</tbody>
          </table></div>
        </section>`).join('') : planningEmpty('Nothing left to simulate', 'Every course in this record has a passed attempt.')}
      </div>
      <aside class="pl-aside">
        <section class="pl-aside-block">
          <h2>Focus order</h2>
          ${insights.priority.length ? `<ul class="pl-focus">${insights.priority.slice(0, 8).map((item) => `<li><span class="pl-risk is-${item.risk}">${item.risk}</span><div><strong>${escapeHtml(item.course.code || item.course.name)}</strong><span>${item.days === null ? 'No exam date' : item.days < 0 ? `${Math.abs(item.days)} days ago` : item.days === 0 ? 'Today' : `In ${item.days} day${item.days === 1 ? '' : 's'}`} · ${item.course.ects} ECTS</span></div></li>`).join('')}</ul>` : '<p>No open courses in this scenario.</p>'}
        </section>
        <section class="pl-aside-block">
          <h2>Load per period</h2>
          ${insights.periods.length ? `<ul class="pl-periods">${insights.periods.map((item) => `<li><strong>${escapeHtml(item.period)}</strong><span>${item.count} course${item.count === 1 ? '' : 's'} · ${item.ects} ECTS</span></li>`).join('')}</ul>` : '<p>No open periods.</p>'}
        </section>
        <section class="pl-aside-block">
          <h2>Shortest route to credit targets</h2>
          ${insights.minimumPaths.length ? `<ul class="pl-paths">${insights.minimumPaths.map((item) => `<li><strong>${escapeHtml(item.gate.label)}</strong><span>${item.gap} ECTS short · ${item.courses.map((course) => escapeHtml(course.code || course.name)).join(', ') || 'no eligible courses'}</span></li>`).join('')}</ul>` : `<p>${workspace.gates.length ? 'Every credit target is already met.' : 'Add credit requirements in Progress to see the shortest path.'}</p>`}
        </section>
      </aside>
    </div>
    ${academicsError ? `<p class="pl-save-error" role="alert">Changes could not be saved: ${escapeHtml(academicsError)}</p>` : ''}
  </div>`
}

function renderPlanningSettings() {
  const index = academicsData.index
  const workspace = academicsData.workspace
  return `<div class="pl-page pl-page-narrow">
    ${planningPageHeader('Planning settings', 'Programmes, statistics rules, and portable copies of this record.')}
    <section class="pl-settings-section">
      ${planningSectionHead('Programmes', 'Each programme is a separate private record with its own curriculum, attempts, and rules.')}
      <ul class="pl-programmes">${index.programmes.map((item) => `<li class="${item.id === index.activeProgrammeId ? 'is-active' : ''}">
        <div><strong>${escapeHtml(item.programme || 'Untitled programme')}</strong><span>${escapeHtml(item.academicYear || 'No academic year')}</span></div>
        ${item.id === index.activeProgrammeId ? '<span class="pl-pill is-passed">Active</span>' : `<button type="button" class="btn btn-secondary btn-sm" data-academic-switch="${escapeHtml(item.id)}">Switch</button>`}
      </li>`).join('')}</ul>
      <form class="pl-composer" data-academic-programme-create aria-label="Create programme">
        <div class="pl-fields pl-fields-programme">
          <label class="wide"><span>New programme</span><input name="programme" maxlength="200" required placeholder="MSc Data Science"></label>
          <label><span>Academic year or cohort</span><input name="academicYear" maxlength="30" placeholder="2027–2028"></label>
        </div>
        <div class="pl-form-actions"><button class="btn btn-secondary" type="submit" ${academicsLoading ? 'disabled' : ''}>Create and switch</button></div>
      </form>
    </section>
    <section class="pl-settings-section">
      ${planningSectionHead('Statistics')}
      <label class="pl-setting-row"><div><strong>Include failed attempts in weighted GPA</strong><span>Some programmes average every recorded attempt; others count only passes.</span></div><input type="checkbox" role="switch" data-academic-failed-gpa ${workspace.profile.gpaIncludesFailedCourses ? 'checked' : ''}></label>
    </section>
    <section class="pl-settings-section">
      ${planningSectionHead('Portable data', 'Download this programme or import a Wicker Study academics file into a new programme. Course-code matches are shown before anything is saved.')}
      <div class="pl-setting-actions"><button class="btn btn-secondary" data-academic-export>${uiIcon('download')} Download JSON</button><label class="btn btn-secondary pl-import">${uiIcon('upload')} Import JSON<input type="file" accept="application/json" data-academic-import></label></div>
    </section>
    ${index.programmes.length > 1 ? `<section class="pl-settings-section pl-danger-zone">
      <div><strong>Delete the active programme</strong><p>Removes its curriculum, attempts, events, and scenarios. Other programmes are not affected.</p></div>
      <button class="btn btn-danger" data-academic-programme-delete>Delete programme</button>
    </section>` : ''}
    ${academicsError ? `<p class="pl-save-error" role="alert">Changes could not be saved: ${escapeHtml(academicsError)}</p>` : ''}
  </div>`
}

function gateResolved(gate, workspace, projected = false) {
  const passed = (course) => {
    if (course.attempts.some((a) => a.status === 'passed')) return true
    const objective = workspace.planning.objectives?.[course.id]
    return projected && objective?.mode !== 'none' && objective?.outcome === 'pass'
  }
  if (gate.type === 'course') return passed(workspace.courses.find((c) => c.id === gate.courseId) || { attempts: [] })
  if (gate.type === 'all-level') return workspace.courses.filter((c) => c.yearLevel === gate.level && !c.hiddenFromStats).every(passed)
  const earned = workspace.courses.filter((c) => !c.hiddenFromStats && passed(c) && (gate.type !== 'credit-level' || c.yearLevel === gate.level)).reduce((sum, c) => sum + c.ects, 0)
  return earned >= gate.target
}


function planningInsights(workspace) {
  const open = workspace.courses.filter((course) => {
    const objective = workspace.planning.objectives?.[course.id]
    return !course.hiddenFromStats && !course.attempts.some((a) => a.status === 'passed') && objective?.mode !== 'none' && objective?.outcome !== 'fail'
  })
  const courseGateIds = new Set(workspace.gates.filter((gate) => gate.type === 'course' && !gateResolved(gate, workspace)).map((gate) => gate.courseId))
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const priority = open.map((course) => {
    const active = course.attempts.find((attempt) => attempt.status === 'upcoming')
    const days = active?.examDate ? Math.ceil((new Date(`${active.examDate}T00:00:00`) - today) / 86400000) : null
    let score = courseGateIds.has(course.id) ? 100 : 0
    if (days !== null) score += days <= 7 ? 30 : days <= 14 ? 20 : days <= 30 ? 10 : 0
    score += Math.min(20, course.ects * 2)
    return { course, active, days, score, risk: score >= 100 ? 'critical' : score >= 30 ? 'high' : score >= 15 ? 'medium' : 'low' }
  }).sort((a, b) => b.score - a.score)
  const periodMap = new Map()
  for (const item of priority) {
    const period = item.course.period || 'Unscheduled'
    const current = periodMap.get(period) || { period, ects: 0, count: 0 }
    periodMap.set(period, { period, ects: current.ects + item.course.ects, count: current.count + 1 })
  }
  const creditGates = workspace.gates.filter((gate) => ['total-credits', 'credit-level'].includes(gate.type) && !gateResolved(gate, workspace))
  const minimumPaths = creditGates.map((gate) => {
    const eligible = priority.map((item) => item.course).filter((course) => gate.type !== 'credit-level' || course.yearLevel === gate.level).sort((a, b) => b.ects - a.ects)
    const current = workspace.courses.filter((course) => course.attempts.some((a) => a.status === 'passed') && (gate.type !== 'credit-level' || course.yearLevel === gate.level)).reduce((sum, course) => sum + course.ects, 0)
    let covered = current
    const courses = []
    for (const course of eligible) { if (covered >= gate.target) break; courses.push(course); covered += course.ects }
    return { gate, gap: Math.max(0, gate.target - current), courses }
  })
  return { priority, periods: [...periodMap.values()], minimumPaths }
}


function formatUsageNumber(value) {
  return new Intl.NumberFormat('en-GB').format(Math.max(0, Number(value) || 0))
}

function formatResetDate(value, mode = 'time') {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', mode === 'date'
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(date)
}

function usageBar(label, used, limit, detail) {
  const safeLimit = Math.max(1, Number(limit) || 1)
  const safeUsed = Math.max(0, Number(used) || 0)
  const pct = Math.min(100, Math.round((safeUsed / safeLimit) * 100))
  return `<div class="usage-row">
    <div class="usage-row-copy"><strong>${escapeHtml(label)}</strong><span>${formatUsageNumber(safeUsed)} of ${formatUsageNumber(limit)}</span></div>
    <div class="usage-track" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuemin="0" aria-valuemax="${safeLimit}" aria-valuenow="${safeUsed}"><span style="width:${pct}%"></span></div>
    <small>${escapeHtml(detail)}</small>
  </div>`
}

// ----- Account: profile, AI usage, data & privacy ---------------------------
let accountSummary = null
let accountSummaryError = null
let accountSummaryLoading = false
async function loadAccountSummary(force = false) {
  if ((accountSummary && !force) || accountSummaryLoading) return accountSummary
  accountSummaryLoading = true
  accountSummaryError = null
  try { accountSummary = await fetchJson('/api/account/summary') }
  catch (error) { accountSummary = null; accountSummaryError = error.message || 'Account details are temporarily unavailable.' }
  finally { accountSummaryLoading = false }
  return accountSummary
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function longDate(value) {
  if (!value) return null
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
}

function renderAccountPage() {
  ensureHomeData()
  if (!aiUsage && !aiUsageError) loadAiUsage().then(() => render())
  if (!accountSummary && !accountSummaryLoading && !accountSummaryError) loadAccountSummary().then(() => render())
  if (!activityLoading && (!activityCache || Date.now() - activityLoadedAt > 60_000)) loadActivity().then(() => render())
  const user = currentUser()
  const tab = ACCOUNT_TABS.some(([id]) => id === route.tab) ? route.tab : 'profile'
  const memberSince = longDate(user.createdAt || accountSummary?.account?.createdAt)
  const body = tab === 'usage' ? renderAccountUsage() : tab === 'data' ? renderAccountData() : tab === 'api' ? renderAccountApi() : renderAccountProfile(user)
  return `<section class="page-wrap account-page">
    <header class="page-head">
      <div class="page-head-identity">${renderAvatar(user, 'lg')}<div><p class="page-eyebrow">Account</p><h1>${escapeHtml(user.name)}</h1><p class="page-sub">${escapeHtml(user.email || 'Signed in')}${memberSince ? ` · Member since ${escapeHtml(memberSince)}` : ''}${window.__clerk ? '' : ' · No sign-in configured'}</p></div></div>
      <div class="page-head-actions">
        ${window.__clerk ? `<button type="button" class="btn btn-secondary" data-open-profile>${uiIcon('edit')} Edit profile</button><button type="button" class="btn btn-ghost" data-sign-out>${uiIcon('logout')} Sign out</button>` : ''}
      </div>
    </header>
    <nav class="page-tabs" aria-label="Account sections"><div>${ACCOUNT_TABS.map(([id, label]) => `<a href="#/account/${id}" class="${tab === id ? 'active' : ''}"${tab === id ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</div></nav>
    ${body}
  </section>`
}

function renderAccountProfile(user) {
  const activity = activityCache
  const summary = accountSummary
  const active = activeCourses().length
  const archived = archivedCourses().length
  const fact = (label, value, detail) => `<div class="fact"><dt>${label}</dt><dd>${value}</dd>${detail ? `<span>${detail}</span>` : ''}</div>`
  const identityRows = [
    ['Email', user.email || '—'],
    ['Sign-in', window.__clerk ? 'Managed by Clerk' : 'Local development (no sign-in)'],
    ['Storage', summary ? (summary.account?.storage === 'neon' ? 'Encrypted cloud database (Neon)' : 'Local files on this machine') : '…'],
    ['Account ID', summary?.account?.id ? `<code>${escapeHtml(String(summary.account.id).slice(0, 18))}${String(summary.account.id).length > 18 ? '…' : ''}</code>` : '…']
  ]
  return `<div class="account-grid">
    <section class="panel">
      <div class="panel-top"><div><h2>Identity</h2><p>Who you are signed in as and where your record lives.</p></div></div>
      <dl class="kv">${identityRows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>
      ${window.__clerk ? `<p class="panel-note">Name, email, password, and connected sign-in providers are managed in your profile. <button type="button" class="pl-link pl-link-button" data-open-profile>Open profile</button></p>` : '<p class="panel-note">Sign-in is disabled in local development. Every record is stored under the <code>local-dev</code> account.</p>'}
    </section>
    <div class="account-stack">
      <section class="panel">
        <div class="panel-top"><div><h2>Study record</h2><p>What Wicker Study currently holds for you.</p></div></div>
        <dl class="fact-grid">
          ${fact('Active courses', active, archived ? `${archived} archived` : 'None archived')}
          ${fact('Flashcards', srDueCache?.totalCards ?? '—', srDueCache ? `${srDueCache.dueCount || 0} due now` : 'Loading…')}
          ${fact('Open mistakes', mistakeCache?.items?.length ?? '—', 'Scored below 7/10')}
          ${fact('Study streak', activity ? `${activity.streak}<small>d</small>` : '—', activity ? `${activity.activeDays} active days of 28` : 'Loading…')}
          ${fact('Average score', activity?.averageScore != null ? `${activity.averageScore}<small>/10</small>` : '—', 'Graded answers, last 120 days')}
          ${fact('Stored records', summary ? summary.totals.documents : '—', summary ? `${formatBytes(summary.totals.bytes)} · updated ${summary.totals.updatedAt ? relativeTime(summary.totals.updatedAt) : 'never'}` : accountSummaryError ? 'Unavailable' : 'Loading…')}
        </dl>
      </section>
      <section class="panel">
        <div class="panel-top"><div><h2>Activity</h2><p>${activity ? `${activity.week?.total || 0} actions this week · ${activity.previousWeek || 0} the week before` : 'Loading your study ledger…'}</p></div><a class="pl-link" href="#/practice">Practise</a></div>
        ${activity ? renderActivityChart(activity) : '<div class="activity-chart is-loading"></div>'}
        ${activity ? renderActivityFeed(activity, 10) : ''}
      </section>
    </div>
  </div>`
}

// ----- API access: personal keys for agents and administrators -------------
let apiKeysCache = null
let apiKeysError = null
let apiKeysLoading = false
const apiKeyForm = { name: '', scopes: ['read'], creating: false, error: null, created: null }
async function loadApiKeys(force = false) {
  if ((apiKeysCache && !force) || apiKeysLoading) return apiKeysCache
  apiKeysLoading = true
  apiKeysError = null
  try { apiKeysCache = await fetchJson('/api/account/api-keys') }
  catch (error) { apiKeysCache = null; apiKeysError = error.message }
  finally { apiKeysLoading = false }
  return apiKeysCache
}

function renderAccountApi() {
  if (!apiKeysCache && !apiKeysLoading && !apiKeysError) loadApiKeys().then(() => render())
  const keys = apiKeysCache?.keys || []
  const admin = Boolean(apiKeysCache?.admin)
  const origin = window.location.origin
  const scopeCopy = { read: 'Read courses, chapters, questions, progress, plan, and activity', write: 'Record answers, reviews, flashcards, mistakes, mocks, and plan changes', admin: 'Manage editorial content and the programme catalogue' }
  return `<div class="account-stack">
    ${apiKeyForm.created ? `<section class="panel panel-success" role="status">
      <div class="panel-top"><div><h2>Key created</h2><p>Copy it now — it is shown once and stored only as a hash.</p></div><button type="button" class="btn btn-secondary btn-sm" data-api-key-dismiss>Done</button></div>
      <div class="secret-row"><code data-api-key-secret>${escapeHtml(apiKeyForm.created.secret)}</code><button type="button" class="btn btn-primary btn-sm" data-api-key-copy>${uiIcon('check')} Copy</button></div>
    </section>` : ''}
    <section class="panel">
      <div class="panel-top"><div><h2>Personal API keys</h2><p>Keys act as you, limited to their scopes. Send them as <code>Authorization: Bearer wsk_…</code>. Keys cannot manage other keys, reset data, or delete the account.</p></div></div>
      ${apiKeysError ? `<div class="settings-error" role="alert"><strong>Keys could not be loaded.</strong><p>${escapeHtml(apiKeysError)}</p></div>` : !apiKeysCache ? '<div class="settings-loading"><span></span><p>Loading keys…</p></div>' : keys.length ? `<div class="pl-table-wrap"><table class="pl-table keys-table"><thead><tr><th>Name</th><th>Key</th><th>Scopes</th><th>Created</th><th>Last used</th><th></th></tr></thead><tbody>${keys.map((key) => `<tr class="${key.revokedAt ? 'is-revoked' : ''}"><td><strong>${escapeHtml(key.name)}</strong></td><td><code>${escapeHtml(key.prefix)}…</code></td><td>${key.scopes.map((scope) => `<span class="pl-pill ${scope === 'admin' ? 'is-bad' : scope === 'write' ? 'is-pending' : 'is-ok'}">${scope}</span>`).join(' ')}</td><td><time>${relativeTime(key.createdAt)}</time></td><td>${key.lastUsedAt ? `<time>${relativeTime(key.lastUsedAt)}</time>` : '<span class="muted">never</span>'}</td><td class="num">${key.revokedAt ? '<span class="pl-pill">revoked</span>' : `<button type="button" class="btn btn-sm btn-danger-outline" data-api-key-revoke="${escapeHtml(key.id)}">Revoke</button>`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="panel-note">No keys yet. Create one to let an agent or the MCP server work with your record.</p>'}
      <form class="key-form" data-api-key-form>
        <label class="key-form-name"><span>Key name</span><input name="name" maxlength="80" placeholder="e.g. Claude Desktop" value="${escapeHtml(apiKeyForm.name)}" required ${apiKeyForm.creating ? 'disabled' : ''}></label>
        <fieldset class="key-form-scopes"><legend>Scopes</legend>
          ${['read', 'write', ...(admin ? ['admin'] : [])].map((scope) => `<label><input type="checkbox" name="scope" value="${scope}" ${apiKeyForm.scopes.includes(scope) ? 'checked' : ''} ${scope === 'read' ? 'disabled checked' : ''}><span><strong>${scope}</strong><small>${scopeCopy[scope]}</small></span></label>`).join('')}
        </fieldset>
        ${apiKeyForm.error ? `<p class="account-delete-error" role="alert">${escapeHtml(apiKeyForm.error)}</p>` : ''}
        <div class="key-form-actions"><button type="submit" class="btn btn-primary" ${apiKeyForm.creating ? 'disabled' : ''}>${apiKeyForm.creating ? 'Creating…' : `${uiIcon('plus')} Create key`}</button>${admin ? '<span class="pl-private">Administrator</span>' : ''}</div>
      </form>
    </section>
    <section class="panel">
      <div class="panel-top"><div><h2>Use it from an agent</h2><p>The full endpoint list with scopes is at <a href="/api/agent/manifest" target="_blank" rel="noopener">/api/agent/manifest</a>. The MCP server in the repository wraps the same API.</p></div></div>
      <pre class="code-block"><code>curl -H "Authorization: Bearer wsk_…" ${escapeHtml(origin)}/api/courses

# MCP (Claude Desktop / Claude Code)
{
  "mcpServers": {
    "wicker-study": {
      "command": "npx",
      "args": ["-y", "wicker-study-mcp"],
      "env": { "WICKER_STUDY_URL": "${escapeHtml(origin)}", "WICKER_STUDY_API_KEY": "wsk_…" }
    }
  }
}</code></pre>
      <p class="panel-note">From a checkout: <code>WICKER_STUDY_URL=${escapeHtml(origin)} WICKER_STUDY_API_KEY=wsk_… npm run mcp</code>.</p>
    </section>
  </div>`
}

function renderAccountUsage() {
  const chatUsed = aiUsage?.usage?.today?.requests?.chat || 0
  const exerciseUsed = aiUsage?.usage?.today?.requests?.exercises || 0
  const intakeUsed = aiUsage?.usage?.today?.requests?.intake || 0
  const dailyTokens = aiUsage?.usage?.today?.tokens || 0
  const monthlyTokens = aiUsage?.usage?.month?.tokens || 0
  const featureLabel = { chat: 'Tutor chat', exercises: 'Extra exercises', intake: 'Plan import' }
  return `<div class="account-stack">
    <section class="panel">
      <div class="panel-top"><div><h2>Allowance</h2><p>AI is used only for the source-grounded tutor, extra exercises you request, and academic documents you explicitly ask to organise.</p></div><button type="button" class="btn btn-secondary btn-sm" data-refresh-usage>${uiIcon('refresh')} Refresh</button></div>
      ${aiUsage ? `<div class="meter-grid">
        ${usageBar('Tutor chat today', chatUsed, aiUsage.limits.chat.requestsPerDay, `${aiUsage.remaining.chatToday} messages left · resets ${formatResetDate(aiUsage.resetsAt.day)}`)}
        ${usageBar('Extra exercises today', exerciseUsed, aiUsage.limits.exercises.requestsPerDay, `${aiUsage.remaining.exercisesToday} requests left · resets ${formatResetDate(aiUsage.resetsAt.day)}`)}
        ${usageBar('Plan imports today', intakeUsed, aiUsage.limits.intake.requestsPerDay, `${aiUsage.remaining.intakeToday} imports left · resets ${formatResetDate(aiUsage.resetsAt.day)}`)}
        ${usageBar('Tokens today', dailyTokens, aiUsage.limits.tokensPerDay, `${formatUsageNumber(aiUsage.remaining.tokensToday)} left`)}
        ${usageBar('Tokens this month', monthlyTokens, aiUsage.limits.tokensPerMonth, `${formatUsageNumber(aiUsage.remaining.tokensMonth)} left · resets ${formatResetDate(aiUsage.resetsAt.month, 'date')}`)}
      </div>` : aiUsageError
        ? `<div class="settings-error" role="alert"><strong>Usage is temporarily unavailable.</strong><p>${escapeHtml(aiUsageError)} Refresh to try again.</p></div>`
        : '<div class="settings-loading"><span></span><p>Loading your current allowance…</p></div>'}
    </section>
    <section class="panel">
      <div class="panel-top"><div><h2>Recent requests</h2><p>Every AI request this month, newest first. Pending requests reserve their maximum output so concurrent calls cannot exceed your limit.</p></div></div>
      ${aiUsage?.recent?.length ? `<div class="pl-table-wrap"><table class="pl-table usage-table"><thead><tr><th>Feature</th><th>Status</th><th class="num">Input</th><th class="num">Output</th><th>When</th></tr></thead><tbody>${aiUsage.recent.map((event) => `<tr><td>${featureLabel[event.feature] || escapeHtml(event.feature)}</td><td><span class="pl-pill is-${event.status === 'completed' ? 'ok' : event.status === 'failed' ? 'bad' : 'pending'}">${escapeHtml(event.status)}</span></td><td class="num">${formatUsageNumber(event.inputTokens)}${event.estimated && event.status === 'completed' ? '<small> est.</small>' : ''}</td><td class="num">${formatUsageNumber(event.status === 'pending' ? event.reservedTokens : event.outputTokens)}</td><td><time datetime="${event.createdAt}">${relativeTime(event.createdAt)}</time></td></tr>`).join('')}</tbody></table></div>` : aiUsage ? '<p class="panel-note">No AI requests yet this month.</p>' : ''}
      <p class="panel-note">Direct API calls use provider-reported token totals; local CLI providers use a conservative estimate.</p>
    </section>
  </div>`
}

function renderAccountData() {
  const summary = accountSummary
  return `<div class="account-stack">
    <section class="panel">
      <div class="panel-top"><div><h2>What is stored</h2><p>Your personal record, separated from shared course material. Nothing here is used to train models.</p></div>${summary ? `<span class="panel-stat"><strong>${formatBytes(summary.totals.bytes)}</strong><small>${summary.totals.documents} record${summary.totals.documents === 1 ? '' : 's'}</small></span>` : ''}</div>
      ${summary ? (summary.namespaces.length ? `<div class="pl-table-wrap"><table class="pl-table storage-table"><thead><tr><th>Record</th><th class="num">Rows</th><th class="num">Size</th><th>Updated</th><th>Reset</th></tr></thead><tbody>${summary.namespaces.map((entry) => `<tr><td><strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(entry.detail || entry.namespace.replace(/_/g, ' '))}</small></td><td class="num">${entry.count}</td><td class="num">${entry.bytes == null ? '—' : formatBytes(entry.bytes)}</td><td>${entry.updatedAt ? relativeTime(entry.updatedAt) : '—'}</td><td>${entry.study ? '<span class="pl-pill is-ok">Study data</span>' : '<span class="pl-pill">Kept on reset</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="panel-note">Nothing stored yet. Records appear as you read, practise, and plan.</p>') : accountSummaryError ? `<div class="settings-error" role="alert"><strong>Storage details are unavailable.</strong><p>${escapeHtml(accountSummaryError)}</p></div>` : '<div class="settings-loading"><span></span><p>Reading your record…</p></div>'}
    </section>
    <section class="panel">
      <div class="panel-top"><div><h2>Your data</h2><p>Export, reset, or remove what Wicker Study holds about you.</p></div></div>
      <div class="action-list">
        <div class="action-row"><div><strong>Export personal data</strong><p>A machine-readable JSON copy of your study records, plan, attempts, review history, account details, and AI usage events.</p></div><button type="button" class="btn btn-secondary" data-export-data>${uiIcon('download')} Download JSON</button></div>
        <div class="action-row"><div><strong>Reset study data</strong><p>Clears progress, flashcards, mistakes, mock sessions, personal exercises, and the activity log. Your account, academic plan, and AI usage ledger are kept.</p></div><button type="button" class="btn btn-secondary btn-danger-outline" data-account-reset-open="study">${uiIcon('refresh')} Reset study data</button></div>
        <div class="action-row"><div><strong>Erase all personal data</strong><p>Removes every record including your academic plan and usage ledger, but keeps your sign-in so you can start again.</p></div><button type="button" class="btn btn-secondary btn-danger-outline" data-account-reset-open="everything">${uiIcon('trash')} Erase everything</button></div>
      </div>
      <p class="settings-legal-note">For access, correction, restriction, or objection requests that are not available here, contact <a href="mailto:privacy@wicker.life">privacy@wicker.life</a>. See the <a href="/privacy">privacy notice</a>.</p>
    </section>
    <section class="panel panel-danger">
      <div class="action-row"><div><strong>Delete account</strong><p>Permanently removes your sign-in identity together with all personal data. This cannot be undone.</p></div><button type="button" class="btn btn-danger" data-account-delete-open>${uiIcon('trash')} Delete account</button></div>
    </section>
  </div>`
}

const accountResetState = { open: false, scope: 'study', confirmation: '', working: false, error: null }

function renderAccountResetModal() {
  if (!accountResetState.open) return ''
  const everything = accountResetState.scope === 'everything'
  const enabled = accountResetState.confirmation === 'RESET' && !accountResetState.working
  return `<div class="confirm-overlay account-delete-overlay" data-account-reset-overlay>
    <div class="account-delete-panel" role="alertdialog" aria-modal="true" aria-labelledby="account-reset-title" aria-describedby="account-reset-description">
      <div class="account-delete-head"><div><h2 id="account-reset-title">${everything ? 'Erase all personal data?' : 'Reset your study data?'}</h2><p id="account-reset-description">${everything ? 'Every personal record is removed. Your sign-in stays, so you can start from an empty workspace.' : 'Your study record is cleared. Your account, academic plan, and AI usage ledger are kept.'}</p></div><button type="button" class="icon-btn" data-account-reset-close aria-label="Close dialog" ${accountResetState.working ? 'disabled' : ''}>${uiIcon('close')}</button></div>
      <div class="account-delete-warning"><strong>This cannot be undone.</strong><ul><li>Reading progress, mastery, and course order</li><li>Flashcards, spaced-repetition history, and mistakes</li><li>Mock sessions, personal exercises, and the activity log</li>${everything ? '<li>Academic plan, programme choices, and AI usage ledger</li>' : ''}</ul></div>
      <label class="account-delete-confirm"><span>Type <b>RESET</b> to confirm</span><input type="text" aria-label="Type RESET to confirm" data-account-reset-input value="${escapeHtml(accountResetState.confirmation)}" autocomplete="off" autocapitalize="characters" spellcheck="false" ${accountResetState.working ? 'disabled' : ''}></label>
      ${accountResetState.error ? `<p class="account-delete-error" role="alert">${escapeHtml(accountResetState.error)}</p>` : ''}
      <div class="confirm-actions"><button type="button" class="btn btn-secondary" data-account-reset-close ${accountResetState.working ? 'disabled' : ''}>Keep my data</button><button type="button" class="btn btn-danger" data-account-reset-confirm ${enabled ? '' : 'disabled'}>${accountResetState.working ? 'Resetting…' : everything ? 'Erase everything' : 'Reset study data'}</button></div>
    </div>
  </div>`
}

function renderAccountDeleteModal() {
  if (!accountDeleteState.open) return ''
  const enabled = accountDeleteState.confirmation === 'DELETE' && !accountDeleteState.deleting
  return `<div class="confirm-overlay account-delete-overlay" data-account-delete-overlay>
    <div class="account-delete-panel" role="alertdialog" aria-modal="true" aria-labelledby="account-delete-title" aria-describedby="account-delete-description">
      <div class="account-delete-head"><div><h2 id="account-delete-title">Permanently delete your account?</h2><p id="account-delete-description">The account and all personal study data will be removed. Shared course material is unaffected.</p></div><button type="button" class="icon-btn" data-account-delete-close aria-label="Close deletion dialog" ${accountDeleteState.deleting ? 'disabled' : ''}>${uiIcon('close')}</button></div>
      <div class="account-delete-warning"><strong>This action cannot be undone.</strong><ul><li>Your Clerk authentication identity will be deleted.</li><li>Your progress, notes, answers, review history, chats, and usage records will be erased.</li><li>You will be signed out when deletion finishes.</li></ul></div>
      <label class="account-delete-confirm"><span>Type <b>DELETE</b> to confirm</span><input type="text" aria-label="Type DELETE to confirm account deletion" data-account-delete-input value="${escapeHtml(accountDeleteState.confirmation)}" autocomplete="off" autocapitalize="characters" spellcheck="false" ${accountDeleteState.deleting ? 'disabled' : ''}></label>
      ${accountDeleteState.error ? `<p class="account-delete-error" role="alert">${escapeHtml(accountDeleteState.error)}</p>` : ''}
      <div class="confirm-actions"><button type="button" class="btn btn-secondary" data-account-delete-close ${accountDeleteState.deleting ? 'disabled' : ''}>Keep account</button><button type="button" class="btn btn-danger" data-account-delete-confirm ${enabled ? '' : 'disabled'}>${accountDeleteState.deleting ? 'Deleting account…' : 'Delete account and data'}</button></div>
    </div>
  </div>`
}

// ----- Course ordering / archive helpers -----
let dashboardManageMode = false
let sidebarArchivedOpen = false

function sortedCourses() {
  return state.courses.slice().sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
}
function activeCourses() { return sortedCourses().filter((c) => !c.archived) }
function archivedCourses() { return sortedCourses().filter((c) => c.archived) }

async function setCourseArchived(courseId, archived) {
  const c = state.courses.find((x) => x.id === courseId)
  if (c) c.archived = archived // optimistic
  render()
  try {
    await fetchJson(`/api/courses/${encodeURIComponent(courseId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived })
    })
  } catch (err) {
    if (c) c.archived = !archived // revert on failure
    render()
    alert('Could not update course: ' + err.message)
  }
}

async function moveCourse(courseId, dir) {
  const actives = activeCourses()
  const idx = actives.findIndex((c) => c.id === courseId)
  const swap = dir === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || swap < 0 || swap >= actives.length) return
  ;[actives[idx], actives[swap]] = [actives[swap], actives[idx]]
  const full = [...actives, ...archivedCourses()]
  full.forEach((c, i) => { c.order = i + 1 })
  render()
  try {
    await fetchJson('/api/courses/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: full.map((c) => c.id) })
    })
  } catch (err) {
    alert('Could not save order: ' + err.message)
  }
}

// ----- Identity helpers (Clerk when configured, local otherwise) -----------
function currentUser() {
  const user = window.__clerk?.user
  const email = user?.primaryEmailAddress?.emailAddress || null
  const first = user?.firstName || null
  const last = user?.lastName || null
  const name = [first, last].filter(Boolean).join(' ') || (email ? email.split('@')[0] : null) || (window.__authMode === 'local' ? 'Local student' : 'Student')
  const initials = (first && last) ? `${first[0]}${last[0]}` : name.replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('') || 'W'
  return {
    name,
    firstName: first || null,
    email: email || (window.__authMode === 'local' ? 'Local development account' : null),
    initials: initials.toUpperCase(),
    createdAt: user?.createdAt ? new Date(user.createdAt) : null,
    imageUrl: user?.hasImage ? user.imageUrl : null,
    provider: window.__clerk ? 'Clerk' : 'Local'
  }
}

function renderAvatar(user, size = 'sm') {
  return user.imageUrl
    ? `<span class="dash-avatar dash-avatar-${size}"><img src="${escapeHtml(user.imageUrl)}" alt="" /></span>`
    : `<span class="dash-avatar dash-avatar-${size}" aria-hidden="true">${escapeHtml(user.initials)}</span>`
}

function renderSidebar() {
  const user = currentUser()
  const active = activeCourses().length
  const due = (srDueCache?.dueCount || 0) + (mistakeCache?.items?.length || 0)
  const link = (cls, href, label, icon, isActive, count) => `<a class="dash-nav-link ${cls}${isActive ? ' active' : ''}" href="${href}"${isActive ? ' aria-current="page"' : ''}><span class="nav-icon">${icon}</span><span class="nav-label">${label}</span>${count ? `<span class="dash-nav-count">${count}</span>` : ''}</a>`
  return `
    <aside class="dash-side">
      <a class="dash-brand" href="#/"><span class="brand-mark">W</span><span class="dash-brand-text"><strong>Wicker Study</strong><small>Academic workspace</small></span></a>
      <button type="button" class="dash-search" data-search-open title="Search course (⌘⇧F)"><span class="nav-icon">${uiIcon('search')}</span><span>Search</span><kbd>⌘⇧F</kbd></button>
      <nav class="dash-nav" aria-label="Primary navigation">
        <span class="dash-nav-group">Study</span>
        ${link('nav-home', '#/', 'Home', uiIcon('home'), route.page === 'dashboard')}
        ${link('nav-courses', '#/courses', 'Courses', uiIcon('book'), ['courses', 'course', 'chapter', 'mock-exam'].includes(route.page), active || null)}
        ${link('nav-practice', '#/practice', 'Practice', uiIcon('target'), route.page === 'practice', due || null)}
        <span class="dash-nav-group">Plan</span>
        ${link('nav-planning', '#/planning', 'Planning', uiIcon('chart'), route.page === 'planning' && route.tab !== 'calendar')}
        ${link('nav-calendar', '#/planning/calendar', 'Calendar', uiIcon('calendar'), route.page === 'planning' && route.tab === 'calendar')}
        ${link('nav-account nav-account-mobile', '#/account', 'Account', uiIcon('user'), route.page === 'account')}
      </nav>
      <div class="dash-side-foot">
        <a class="dash-user${route.page === 'account' ? ' active' : ''}" href="#/account" title="Account">
          ${renderAvatar(user)}
          <span class="dash-user-text"><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email || 'Signed in')}</small></span>
          <span class="nav-icon">${uiIcon('chevronRight')}</span>
        </a>
      </div>
    </aside>
  `
}

function renderChapterTopbar() {
  const course = state.courses.find((c) => c.id === route.courseId)
  const chapter = course?.chapters?.find((c) => c.id === route.chapterId)
  return `
    <header class="chapter-topbar" style="--accent:${course?.accent || '#3b6f5b'}">
      <a class="back-link" href="#/course/${route.courseId}">← ${course?.code || ''} ${course?.shortName || ''}</a>
      <span class="chapter-topbar-title">Ch ${chapter?.id || ''} · ${chapter?.name || 'Chapter'}</span>
      <nav class="chapter-topbar-nav">
        <a href="#/">All courses</a>
        <a href="#/mistakes">Mistake bank</a>
      </nav>
    </header>
  `
}

// ----- Self-update widget state -----
// Re-checked on dashboard render whenever the cached info is older than
// UPDATE_TTL_MS, and on tab focus, so a stale "Update available" banner
// disappears quickly after the user pulls or pushes.
let updateInfo = null      // { local, remote, upToDate, repo, _fetchedAt }
let updateJobState = null  // { status, output, error, newHead }
let updateChecking = false
const UPDATE_TTL_MS = 60 * 1000 // 60s

async function checkForUpdates({ force = false } = {}) {
  if (updateChecking) return
  updateChecking = true
  try {
    const url = force ? '/api/version?force=1' : '/api/version'
    const resp = await fetch(url)
    updateInfo = await resp.json()
    updateInfo._fetchedAt = Date.now()
  } catch (err) {
    updateInfo = { error: err.message, _fetchedAt: Date.now() }
  }
  updateChecking = false
  render()
}

function maybeRefreshUpdateInfo() {
  const age = updateInfo?._fetchedAt ? Date.now() - updateInfo._fetchedAt : Infinity
  if (age > UPDATE_TTL_MS && !updateChecking) checkForUpdates()
}
// Re-check on tab focus too — quickest path to a fresh state when the user
// switches back after a push or pull from elsewhere.
if (typeof window !== 'undefined') {
  window.addEventListener('focus', maybeRefreshUpdateInfo)
}

async function startUpdatePull() {
  try {
    const resp = await fetch('/api/update/pull', { method: 'POST' })
    updateJobState = await resp.json()
    render()
    // Poll until done
    const tick = async () => {
      try {
        const r = await fetch('/api/update/status')
        updateJobState = await r.json()
        render()
        if (updateJobState.status === 'pulling') setTimeout(tick, 1500)
      } catch {
        setTimeout(tick, 3000)
      }
    }
    setTimeout(tick, 1500)
  } catch (err) {
    updateJobState = { status: 'error', error: err.message }
    render()
  }
}

async function triggerRestartAndReload() {
  try {
    await fetch('/api/update/restart', { method: 'POST' })
  } catch {}
  // Server is exiting. Poll /api/version until it comes back, then reload.
  const startedAt = Date.now()
  const waitForBack = async () => {
    try {
      const r = await fetch('/api/version', { cache: 'no-store' })
      if (r.ok) { window.location.reload(); return }
    } catch {}
    if (Date.now() - startedAt > 60000) {
      alert('Server did not come back within 60s. Restart it manually with `npm start`.')
      return
    }
    setTimeout(waitForBack, 1000)
  }
  setTimeout(waitForBack, 1500)
}

function renderUpdateBanner() {
  if (!updateInfo) {
    // Kick a fetch on first render
    if (!updateChecking) checkForUpdates()
    return ''
  }
  // Auto-refresh if the cached info has gone stale (background, no spinner)
  maybeRefreshUpdateInfo()
  if (updateInfo.error || !updateInfo.remote?.head) return ''
  if (updateInfo.upToDate && !updateJobState) return ''

  const jobStatus = updateJobState?.status
  const isPulling = jobStatus === 'pulling'
  const isDone = jobStatus === 'done'
  const isError = jobStatus === 'error'

  return `
    <section class="update-banner ${isDone ? 'done' : isError ? 'error' : isPulling ? 'pulling' : ''}">
      <div class="update-banner-icon" aria-hidden="true">${isDone ? '✓' : isError ? '!' : isPulling ? '⟳' : '•'}</div>
      <div class="update-banner-body">
        <p class="eyebrow">${isDone ? 'Updated' : isError ? 'Update failed' : isPulling ? 'Pulling…' : 'Update available'}</p>
        <h3>${isDone
          ? 'Restart the server to apply the new version'
          : isError
            ? escapeHtml(updateJobState.error || 'git pull failed')
            : isPulling
              ? 'Fetching changes from origin'
              : escapeHtml(updateInfo.remote.message || 'A new commit is upstream')}</h3>
        ${!isDone && !isError && !isPulling ? `<small class="rail-meta">Local <code>${updateInfo.local.head.slice(0, 8)}</code> → upstream <code>${updateInfo.remote.head.slice(0, 8)}</code></small>` : ''}
        ${isError ? `<small class="rail-meta">${escapeHtml(updateJobState.output || '')}</small>` : ''}
        ${isDone && updateJobState.newHead ? `<small class="rail-meta">Now at <code>${updateJobState.newHead.slice(0, 8)}</code></small>` : ''}
      </div>
      <div class="update-banner-actions">
        ${isDone
          ? `<button type="button" class="kb-link kb-link-mock" data-update-restart>Restart &amp; reload</button>`
          : isPulling
            ? `<small class="rail-meta">Working…</small>`
            : isError
              ? `<button type="button" class="kb-link" data-update-recheck>Re-check</button>`
              : `<button type="button" class="kb-link kb-link-mock" data-update-pull>Pull updates</button>
                 <button type="button" class="kb-link" data-update-recheck>Re-check</button>`}
      </div>
    </section>
  `
}

// ----- Home, courses ledger, and the practice shell ---------------------------
const RECENT_CHAPTER_KEY = 'recent-chapter'

function rememberRecentChapter(courseId, chapterId) {
  try { localStorage.setItem(RECENT_CHAPTER_KEY, JSON.stringify({ courseId, chapterId, at: Date.now() })) } catch {}
}

function recentChapter() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_CHAPTER_KEY) || 'null')
    if (!raw) return null
    const course = state.courses.find((c) => c.id === raw.courseId)
    const chapter = course?.chapters?.find((ch) => ch.id === raw.chapterId)
    return course && chapter ? { course, chapter, at: raw.at } : null
  } catch { return null }
}

function daysUntil(isoDate) {
  if (!isoDate) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((new Date(`${isoDate}T00:00:00`) - today) / 86400000)
}

function countdownLabel(days) {
  if (days === null) return 'Date not set'
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? '' : 's'} ago`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

// Upcoming exam attempts from the personal academic record, soonest first.
function upcomingExams() {
  const workspace = academicsData?.workspace
  if (!workspace) return []
  return workspace.courses.flatMap((course) => course.attempts
    .filter((attempt) => attempt.status === 'upcoming' && attempt.examDate)
    .map((attempt) => ({ course, attempt, days: daysUntil(attempt.examDate), editorial: editorialCourseForAcademic(course) })))
    .filter((item) => item.days === null || item.days >= -1)
    .sort((a, b) => a.attempt.examDate.localeCompare(b.attempt.examDate))
}

function nextExamFor(course) {
  return upcomingExams().find((item) => item.editorial?.id === course.id) || null
}

function ensureHomeData() {
  if (!mistakeCache) loadMistakes().then(() => render())
  if (!srDueCache) loadSrDue().then(() => render())
  if (!academicsData && !academicsLoading && !academicsError) queueMicrotask(() => loadAcademics())
  ensureCoverage()
}

function renderCourseLedger(courses, { manage = false } = {}) {
  if (!courses.length) return '<p class="empty">No active courses.</p>'
  const sorted = [...courses].sort((a, b) => {
    const da = nextExamFor(a)?.days, db = nextExamFor(b)?.days
    if (da == null && db == null) return 0
    if (da == null) return 1
    if (db == null) return -1
    return da - db
  })
  return `<div class="ledger" role="list">${sorted.map((course, index) => {
    const progress = courseProgress(course)
    const exam = nextExamFor(course)
    const examCell = exam
      ? `<span class="ledger-exam"><strong>${countdownLabel(exam.days)}</strong><small>${academicDate(exam.attempt.examDate)} · ${escapeHtml(exam.attempt.type)}</small></span>`
      : course.exam ? `<span class="ledger-exam is-editorial"><strong>${escapeHtml(course.exam)}</strong><small>Catalogue date · not in your plan</small></span>` : '<span class="ledger-exam is-none"><strong>No exam date</strong><small>Not in your plan</small></span>'
    const body = `
      <span class="ledger-code">${escapeHtml(course.code)}<em>${escapeHtml(course.shortName || '')}</em></span>
      <span class="ledger-name"><strong>${escapeHtml(course.name)}</strong><small>${progress.done} of ${progress.total} chapters read</small></span>
      ${examCell}
      <span class="ledger-progress"><i><b style="width:${progress.masteryPct}%"></b></i><span>${progress.masteryPct}%</span></span>`
    if (!manage) return `<a class="ledger-row${course.archived ? ' is-archived' : ''}" role="listitem" href="#/course/${course.id}">${body}</a>`
    return `<article class="ledger-row is-managing${course.archived ? ' is-archived' : ''}" role="listitem">${body}
      <span class="ledger-manage">
        ${course.archived ? `<button type="button" class="btn btn-sm" data-course-archive="${course.id}" data-archived="false">Unarchive</button>` : `
          <button type="button" class="btn btn-sm" data-course-move="${course.id}" data-dir="up" ${index <= 0 ? 'disabled' : ''} title="Move up">↑</button>
          <button type="button" class="btn btn-sm" data-course-move="${course.id}" data-dir="down" ${index >= sorted.length - 1 ? 'disabled' : ''} title="Move down">↓</button>
          <button type="button" class="btn btn-sm" data-course-archive="${course.id}" data-archived="true">Archive</button>`}
        <a class="btn btn-sm" href="#/course/${course.id}">Open</a>
      </span></article>`
  }).join('')}</div>`
}

// ----- Activity (server-side study ledger) ---------------------------------
let activityCache = null
let activityLoadedAt = 0
let activityLoading = false
async function loadActivity(force = false) {
  if (activityLoading) return activityCache
  if (activityCache && !force && Date.now() - activityLoadedAt < 60_000) return activityCache
  activityLoading = true
  try { activityCache = await fetchJson('/api/activity?days=28') }
  catch (error) { activityCache = { error: error.message, series: [], streak: 0, week: { total: 0 }, recent: [] } }
  finally { activityLoading = false; activityLoadedAt = Date.now() }
  return activityCache
}
function invalidateActivity() { activityLoadedAt = 0 }

const ACTIVITY_LABELS = { answer: 'Answered', review: 'Reviewed', mock: 'Mock sat', resolve: 'Resolved', read: 'Read' }
const ACTIVITY_ICONS = { answer: 'edit', review: 'layers', mock: 'timer', resolve: 'check', read: 'book' }

function renderActivityChart(summary, { compact = false } = {}) {
  const series = summary?.series || []
  const max = Math.max(1, ...series.map((day) => day.total))
  const total = series.reduce((sum, day) => sum + day.total, 0)
  if (!series.length || !total) {
    return `<div class="activity-empty"><p>No study activity in the last ${summary?.days || 28} days. Answer a question, review a card, or sit a mock and it shows up here.</p><a class="btn btn-primary btn-sm" href="#/practice">Start practising</a></div>`
  }
  const today = new Date().toISOString().slice(0, 10)
  return `<div class="activity-chart${compact ? ' is-compact' : ''}" role="img" aria-label="Study activity, ${total} actions over ${series.length} days">
    ${series.map((day) => {
      const height = day.total ? Math.max(8, Math.round((day.total / max) * 100)) : 3
      const date = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${day.date}T12:00:00Z`))
      return `<span class="activity-bar${day.total ? ' has-value' : ''}${day.date === today ? ' is-today' : ''}" style="--h:${height}%" title="${date}: ${day.total} action${day.total === 1 ? '' : 's'}"></span>`
    }).join('')}
  </div>`
}

function renderActivityFeed(summary, limit = 6) {
  const recent = (summary?.recent || []).slice(0, limit)
  if (!recent.length) return ''
  return `<ol class="activity-feed">${recent.map((event) => {
    const course = event.courseId ? state.courses.find((c) => c.id === event.courseId) : null
    const where = [course?.code, event.chapterId ? `Ch ${event.chapterId}` : null].filter(Boolean).join(' · ')
    const score = typeof event.score === 'number' && event.type !== 'review' ? `<span class="activity-score${event.score >= 7 ? ' is-good' : event.score < 5 ? ' is-low' : ''}">${event.type === 'mock' ? `${Math.round(event.score * 10)}%` : `${event.score}/10`}</span>` : ''
    return `<li><span class="activity-icon is-${event.type}">${uiIcon(ACTIVITY_ICONS[event.type] || 'check')}</span><span class="activity-copy"><strong>${ACTIVITY_LABELS[event.type] || event.type}${where ? ` <em>${escapeHtml(where)}</em>` : ''}</strong><small>${escapeHtml(event.label || (event.type === 'review' ? 'Flashcard recall' : ''))}</small></span>${score}<time datetime="${event.at}">${relativeTime(event.at)}</time></li>`
  }).join('')}</ol>`
}

function greeting() {
  const hour = new Date().getHours()
  return hour < 5 ? 'Late night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

function renderHome() {
  ensureHomeData()
  if (!activityLoading && (!activityCache || Date.now() - activityLoadedAt > 60_000)) loadActivity().then(() => render())
  const user = currentUser()
  const mistakeCount = mistakeCache?.items?.length ?? null
  const srDue = srDueCache?.dueCount ?? null
  const srTotal = srDueCache?.totalCards ?? null
  const exams = upcomingExams().slice(0, 4)
  const recent = recentChapter()
  const courses = activeCourses()
  const fallback = courses[0]
  const resumeCourse = recent?.course || fallback
  const resumeChapter = recent?.chapter || fallback?.chapters?.find((ch) => ch.file?.endsWith('.md'))
  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  const hasPlan = Boolean(academicsData?.workspace?.courses?.length)
  const soonest = exams[0]
  const activity = activityCache
  const week = activity?.week?.total ?? null
  const streak = activity?.streak ?? null
  const delta = activity ? week - (activity.previousWeek || 0) : null
  const dueTotal = (srDue || 0) + (mistakeCount || 0)
  const nextLine = soonest
    ? `Next exam ${countdownLabel(soonest.days).toLowerCase()} — ${escapeHtml(soonest.course.code || '')} ${escapeHtml(soonest.course.name)}.`
    : hasPlan ? 'No exam dates recorded yet — add them in Planning and they appear here.' : academicsData ? 'Set up your academic plan to see exam countdowns here.' : 'Loading your plan…'
  const todayLine = dueTotal ? `${dueTotal} item${dueTotal === 1 ? '' : 's'} waiting in your queues.` : srDueCache && mistakeCache ? 'Your queues are clear.' : ''

  const kpi = (href, cls, icon, label, value, detail) => `<a class="kpi ${cls}" href="${href}"><span class="kpi-icon">${uiIcon(icon)}</span><span class="kpi-label">${label}</span><span class="kpi-value">${value}</span><span class="kpi-detail">${detail}</span></a>`

  return `
    <header class="page-head home-head">
      <div><p class="page-eyebrow">${escapeHtml(today)}</p><h1>${greeting()}${user.firstName ? `, ${escapeHtml(user.firstName)}` : ''}</h1><p class="page-sub">${nextLine} ${todayLine}</p></div>
      <div class="page-head-actions">${renderSearchTrigger()}<a class="btn btn-primary" href="#/practice">${uiIcon('play')} Practise</a></div>
    </header>

    <div class="kpi-strip">
      ${kpi('#/planning/calendar', soonest && soonest.days !== null && soonest.days <= 7 ? 'is-danger' : 'is-brand', 'calendar', 'Next exam',
        soonest ? (soonest.days === null ? '—' : soonest.days < 0 ? 'Today' : `${soonest.days}<small>${soonest.days === 1 ? 'day' : 'days'}</small>`) : '—',
        soonest ? `${escapeHtml(soonest.course.code || soonest.course.name)} · ${academicDate(soonest.attempt.examDate)}` : hasPlan ? 'No dates recorded' : 'No plan yet')}
      ${kpi('#/practice/flashcards', 'is-brand', 'layers', 'Flashcards due', srDue == null ? '—' : srDue, srTotal == null ? 'Loading…' : srTotal ? `${srTotal} card${srTotal === 1 ? '' : 's'} in your deck` : 'Add cards from any question')}
      ${kpi('#/practice/mistakes', mistakeCount ? 'is-warning' : 'is-success', 'alert', 'Open mistakes', mistakeCount == null ? '—' : mistakeCount, mistakeCount == null ? 'Loading…' : mistakeCount ? 'Scored below 7/10, unresolved' : 'Nothing to fix right now')}
      ${kpi('#/account/profile', streak ? 'is-flame' : 'is-neutral', 'flame', 'Study streak', streak == null ? '—' : `${streak}<small>${streak === 1 ? 'day' : 'days'}</small>`, week == null ? 'Loading…' : `${week} action${week === 1 ? '' : 's'} this week${delta ? ` · ${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)}` : ''}`)}
    </div>

    <div class="home-grid">
      <section class="home-main">
        ${resumeCourse && resumeChapter ? `<a class="resume-card" href="#/course/${resumeCourse.id}/chapter/${resumeChapter.id}">
          <span class="resume-label">${recent ? 'Continue where you left off' : 'Start reading'}</span>
          <span class="resume-title"><em>${escapeHtml(resumeCourse.code)} · Ch ${escapeHtml(resumeChapter.id)}</em><strong>${escapeHtml(resumeChapter.name)}</strong></span>
          <span class="resume-cta">${uiIcon('play')} Open chapter</span>
        </a>` : ''}

        <section class="panel">
          <div class="panel-top"><div><h2>Activity</h2><p>${activity ? `${activity.activeDays || 0} active day${activity.activeDays === 1 ? '' : 's'} in the last 28 · ${activity.week?.answer || 0} answered, ${activity.week?.review || 0} reviewed, ${activity.week?.mock || 0} mock${activity.week?.mock === 1 ? '' : 's'} this week` : 'Loading your study ledger…'}</p></div>${activity?.averageScore != null ? `<span class="panel-stat"><strong>${activity.averageScore}<small>/10</small></strong><small>avg. score</small></span>` : ''}</div>
          ${activity ? renderActivityChart(activity) : '<div class="activity-chart is-loading"></div>'}
          ${activity ? renderActivityFeed(activity) : ''}
        </section>

        <div class="section-head"><h2>Courses</h2><a class="pl-link" href="#/courses">Manage</a></div>
        ${renderCourseLedger(courses)}
      </section>

      <aside class="home-aside">
        <section class="panel panel-aside">
          <div class="panel-top"><h2>Upcoming exams</h2><a class="pl-link" href="#/planning/calendar">Calendar</a></div>
          ${exams.length ? `<ol class="exam-list">${exams.map((item) => `<li>
            <span class="exam-days${item.days !== null && item.days <= 7 ? ' is-soon' : ''}"><strong>${item.days === null ? '—' : item.days < 0 ? '0' : item.days}</strong><small>${item.days === 1 ? 'day' : 'days'}</small></span>
            <span class="exam-copy"><strong>${escapeHtml(item.course.code || item.course.name)}</strong><small>${escapeHtml(item.course.name)} · ${academicDate(item.attempt.examDate)}</small></span>
            ${item.editorial ? `<a class="pl-link" href="#/course/${item.editorial.id}">Study</a>` : '<span class="exam-noteditorial">No material</span>'}
          </li>`).join('')}</ol>` : `<div class="home-empty">${hasPlan ? '<p>No upcoming exam dates. Add one to a course attempt and it will appear here and on the course page.</p><a class="btn btn-secondary btn-sm" href="#/planning/courses">Add exam dates</a>' : academicsData ? '<p>Set up your academic plan to see exam countdowns, credits, and requirements alongside your study material.</p><a class="btn btn-primary btn-sm" href="#/planning">Set up plan</a>' : '<p>Loading your plan…</p>'}</div>`}
        </section>
        <section class="panel panel-aside">
          <div class="panel-top"><h2>Quick start</h2></div>
          <nav class="quick-list" aria-label="Quick start">
            <a href="#/practice"><span class="nav-icon">${uiIcon('target')}</span><span><strong>Mixed practice</strong><small>Every active course, balanced</small></span>${uiIcon('chevronRight')}</a>
            <a href="#/practice/mocks"><span class="nav-icon">${uiIcon('timer')}</span><span><strong>Timed mock</strong><small>A chapter under exam conditions</small></span>${uiIcon('chevronRight')}</a>
            <a href="#/practice/flashcards"><span class="nav-icon">${uiIcon('layers')}</span><span><strong>Flashcards</strong><small>${srTotal ? `${srTotal} in your deck` : 'Build your deck'}</small></span>${uiIcon('chevronRight')}</a>
            ${hasPlan ? `<a href="#/planning/documents"><span class="nav-icon">${uiIcon('upload')}</span><span><strong>Upload a document</strong><small>Transcript, exam schedule, timetable</small></span>${uiIcon('chevronRight')}</a>` : ''}
          </nav>
        </section>
        ${academicsData?.summary && hasPlan ? `<section class="panel panel-aside">
          <div class="panel-top"><h2>Programme</h2><a class="pl-link" href="#/planning">Plan</a></div>
          <dl class="pl-facts"><div><dt>Earned credits</dt><dd>${academicsData.summary.earnedEcts}</dd></div><div><dt>Courses passed</dt><dd>${academicsData.summary.passedCourses} / ${academicsData.summary.totalCourses}</dd></div>${academicsData.summary.gpa != null ? `<div><dt>Weighted GPA</dt><dd>${academicsData.summary.gpa}</dd></div>` : ''}</dl>
        </section>` : ''}
      </aside>
    </div>
    ${renderGenerateAllCoursesCard()}
  `
}

function renderCoursesPage() {
  ensureHomeData()
  return `
    <section class="page-wrap">
      <header class="page-hero page-hero-row">
        <div><h1>Courses</h1><p class="hero-copy">${activeCourses().length} active · ordered by the next exam in your plan. Archive courses you are not sitting this period.</p></div>
        <button type="button" class="btn ${dashboardManageMode ? 'btn-primary' : 'btn-secondary'} btn-sm" data-toggle-manage>${dashboardManageMode ? 'Done' : `${uiIcon('settings')} Manage`}</button>
      </header>
      ${renderCourseLedger(activeCourses(), { manage: dashboardManageMode })}
      ${archivedCourses().length ? `<div class="home-section-head archived-head"><h2>Archived <small>${archivedCourses().length}</small></h2></div>${renderCourseLedger(archivedCourses(), { manage: dashboardManageMode })}` : ''}
    </section>
  `
}


function renderPracticeShell() {
  if (!srDueCache) loadSrDue().then(() => render())
  if (!mistakeCache) loadMistakes().then(() => render())
  const counts = { flashcards: srDueCache?.dueCount, mistakes: mistakeCache?.items?.length }
  const tab = route.tab || 'questions'
  const body = tab === 'flashcards' ? renderSrPage() : tab === 'mistakes' ? renderMistakesPage() : tab === 'mocks' ? renderMocksPage() : renderPracticePage()
  const dueTotal = (counts.flashcards || 0) + (counts.mistakes || 0)
  const sub = dueTotal ? `${dueTotal} item${dueTotal === 1 ? '' : 's'} waiting — ${counts.flashcards || 0} flashcard${counts.flashcards === 1 ? '' : 's'} due, ${counts.mistakes || 0} open mistake${counts.mistakes === 1 ? '' : 's'}.` : srDueCache && mistakeCache ? 'Your queues are clear. Work through published questions or sit a timed mock.' : 'Loading your queues…'
  return `<div class="practice-shell">
    <header class="page-head"><div><p class="page-eyebrow">Practice</p><h1>${PRACTICE_TABS.find(([id]) => id === tab)?.[1] || 'Practice'}</h1><p class="page-sub">${sub}</p></div><div class="page-head-actions">${renderSearchTrigger()}</div></header>
    <nav class="page-tabs" aria-label="Practice sections"><div>${PRACTICE_TABS.map(([id, label]) => `<a href="#/practice/${id}" class="${tab === id ? 'active' : ''}"${tab === id ? ' aria-current="page"' : ''}>${label}${counts[id] ? `<span class="pl-tab-count">${counts[id]}</span>` : ''}</a>`).join('')}</div></nav>
    ${body}
  </div>`
}

function renderDashboard() { return renderHome() }

// ----- Master generate-all-courses widget (dashboard footer) ----------------
let generateAllCoursesJob = null   // { id, isMaster, status, currentCourseId, subJobs: {cid: {steps,…}} }
let generateAllCoursesPolling = false

function refreshGenerateAllCourses() {
  if (generateAllCoursesPolling) return
  generateAllCoursesPolling = true
  const tick = async () => {
    try {
      const resp = await fetch('/api/generate-all-courses')
      if (resp.status === 404) {
        generateAllCoursesPolling = false
        return
      }
      const prev = generateAllCoursesJob
      generateAllCoursesJob = await resp.json()
      const stillRunning = generateAllCoursesJob.status === 'running' || generateAllCoursesJob.status === 'queued'
      // Detect whether any sub-job transitioned from running→done since the
      // last tick. If so, the corresponding course's coverage just changed
      // (pieces moved from "not cached" → "cached") and any per-course view
      // would show stale info until we re-fetch.
      let aSubJobFinished = false
      const prevSubs = prev?.subJobs || {}
      const currSubs = generateAllCoursesJob?.subJobs || {}
      for (const cid of Object.keys(currSubs)) {
        const wasLive = prevSubs[cid] && (prevSubs[cid].status === 'running' || prevSubs[cid].status === 'queued')
        const nowDone = currSubs[cid] && (currSubs[cid].status === 'done' || currSubs[cid].status === 'error')
        if (wasLive && nowDone) { aSubJobFinished = true; break }
      }
      if (stillRunning) {
        setTimeout(tick, 4000)
      } else {
        generateAllCoursesPolling = false
        if (typeof mockQuestionsCache !== 'undefined') mockQuestionsCache.clear()
        if (typeof questionsSummaryCache !== 'undefined') questionsSummaryCache.clear()
      }
      // Re-fetch coverage when a sub-job just finished (so the chip/CTA on
      // each course's page reflects reality on the next render) or when the
      // master finishes.
      if (aSubJobFinished || !stillRunning) ensureCoverage({ force: true })
      // Update ONLY the master card in-place. A full render() here is what
      // was resetting dashboard scroll + closing expanded step lists every
      // 4 seconds. Falls back to full render if the card isn't in the DOM
      // (e.g. user is on a different page) or on the final transition so
      // the chip / hidden state can recompute cleanly.
      if (!refreshMasterCardInPlace() || !stillRunning) {
        if (!stillRunning) render()
      }
    } catch {
      setTimeout(tick, 8000)
    }
  }
  tick()
}

async function startGenerateAllCourses() {
  if (!confirm('Generate every missing piece of content for all active courses?\n\nThis runs sequentially and can take 1–3 hours total of Codex calls. You can close the tab — work continues in the background.')) return
  try {
    const resp = await fetch('/api/generate-all-courses', { method: 'POST' })
    const data = await resp.json()
    if (data.jobId) refreshGenerateAllCourses()
  } catch (err) {
    alert(`Failed to start: ${err.message}`)
  }
}

function renderGenerateAllCoursesCard() {
  const job = generateAllCoursesJob
  // Hide entirely when everything's packaged — no pending steps across any
  // active course. Maintainer flips it back on by deleting cache files.
  if (!job && coverageState === 'loaded' && coverageTotalPending() === 0) return ''
  if (!job) {
    const pendingTotal = coverageTotalPending()
    const pendingHint = coverageState === 'loaded' && pendingTotal > 0
      ? `<small class="rail-meta">${pendingTotal} step${pendingTotal === 1 ? '' : 's'} pending across all courses.</small>`
      : ''
    return `
      <section class="genall-card genall-all-card" data-genall-master-card>
        <div class="genall-head">
          <div>
            <p class="eyebrow">Generate</p>
            <h3>All content for all courses</h3>
            <small class="rail-meta">One run that fills every gap across every active course — chapter self-tests, mock question banks, flashcards, parsed past papers, content TOCs. Anything already cached is skipped. Sequential, so Codex stays single-flight.</small>
            ${pendingHint}
          </div>
          <button type="button" class="kb-link kb-link-mock" data-genall-all-start>Generate all</button>
        </div>
      </section>
    `
  }
  const isLive = job.status === 'running' || job.status === 'queued'
  const isError = job.status === 'error'
  const totalCourses = (job.courseIds || []).length
  const doneCourses = Object.values(job.subJobs || {}).filter((s) => s && s.status === 'done').length
  return `
    <section class="genall-card genall-all-card ${isLive ? 'live' : (isError ? 'failed' : 'finished')}" data-genall-master-card>
      <div class="genall-head">
        <div>
          <p class="eyebrow">Generate all · all courses</p>
          <h3>${isLive ? `Running — ${doneCourses}/${totalCourses} courses done` : isError ? `Stopped — ${job.error || 'error'}` : `All ${totalCourses} courses complete`}</h3>
          ${job.currentCourseId ? `<small class="rail-meta">Now: <strong>${escapeHtml(job.currentCourseId)}</strong></small>` : ''}
        </div>
        ${isLive ? `<small class="rail-meta">${doneCourses}/${totalCourses}</small>` : `<button type="button" class="kb-link kb-link-mock" data-genall-all-start>Re-run</button>`}
      </div>
      <ul class="genall-master-list">
        ${(job.courseIds || []).map((cid) => {
          const sub = job.subJobs?.[cid]
          if (!sub) {
            return `<li class="genall-master-row genall-master-pending"><span class="genall-master-status">·</span><span class="genall-master-course">${escapeHtml(cid)}</span><small>pending</small></li>`
          }
          const done = sub.steps.filter((s) => s.status === 'done').length
          const skipped = sub.steps.filter((s) => s.status === 'skipped').length
          const errors = sub.steps.filter((s) => s.status === 'error').length
          const running = sub.steps.find((s) => s.status === 'running')
          const pct = sub.steps.length ? Math.round(((done + skipped) / sub.steps.length) * 100) : 0
          const cls = sub.status === 'done' ? 'genall-master-done' : sub.status === 'error' ? 'genall-master-error' : sub.status === 'running' ? 'genall-master-running' : 'genall-master-pending'
          const icon = sub.status === 'done' ? '✓' : sub.status === 'error' ? '!' : sub.status === 'running' ? '…' : '·'
          return `
            <li class="genall-master-row ${cls}">
              <span class="genall-master-status">${icon}</span>
              <span class="genall-master-course">${escapeHtml(cid)}</span>
              <span class="genall-master-progress">
                <span class="genall-master-bar"><span class="genall-master-bar-fill" style="width:${pct}%"></span></span>
                <small>${done}/${sub.steps.length}${skipped ? ` · ${skipped} skipped` : ''}${errors ? ` · ${errors} failed` : ''}</small>
              </span>
              ${running ? `<small class="genall-master-running-label">${escapeHtml(running.label)}</small>` : ''}
            </li>
          `
        }).join('')}
      </ul>
    </section>
  `
}

// index/total are the position within the active list; for archived cards index = -1.
function renderCourseCard(course, index = 0, total = 0) {
  const progress = courseProgress(course)
  const isArchived = !!course.archived
  const inner = `
    <div class="course-card-top"><span>${course.code} <em>${course.shortName || ''}</em></span><strong>${progress.masteryPct}%</strong></div>
    <h2>${course.name}</h2>
    <p>${escapeHtml(course.exam || '')}</p>
    <div class="bar"><span style="width:${progress.masteryPct}%"></span></div>
    <small>${progress.done}/${progress.total} chapters read · ${progress.masteryPct}% mastery</small>
  `
  if (!dashboardManageMode) {
    return `
      <a class="course-card ${isArchived ? 'is-archived' : ''}" href="#/course/${course.id}" style="--accent:${course.accent}" data-mastery="${progress.masteryPct}%">
        ${inner}
      </a>
    `
  }
  // Manage mode — card is not a link; show archive + reorder controls.
  return `
    <article class="course-card is-managing ${isArchived ? 'is-archived' : ''}" style="--accent:${course.accent}" data-mastery="${progress.masteryPct}%">
      ${inner}
      <div class="course-card-manage">
        ${isArchived ? `
          <button type="button" class="tb-btn" data-course-archive="${course.id}" data-archived="false">↩ Unarchive</button>
        ` : `
          <button type="button" class="tb-btn course-move" data-course-move="${course.id}" data-dir="up" ${index <= 0 ? 'disabled' : ''} title="Move up">↑</button>
          <button type="button" class="tb-btn course-move" data-course-move="${course.id}" data-dir="down" ${index >= total - 1 ? 'disabled' : ''} title="Move down">↓</button>
          <button type="button" class="tb-btn" data-course-archive="${course.id}" data-archived="true">⌦ Archive</button>
        `}
        <a class="tb-btn course-open" href="#/course/${course.id}">Open →</a>
      </div>
    </article>
  `
}

function renderDailyBlock(block) {
  const progress = blockProgress(block)
  const items = block.itemIds.map(itemById).filter(Boolean)
  const itemRows = items.length ? items.map(renderCompactItem).join('') : '<p class="empty">No tracked study items here.</p>'
  return `
    <article class="day-block">
      <div class="block-meta"><strong>${block.day}</strong><span>${block.block}</span></div>
      <div class="block-body">
        <div class="block-title"><h3>${block.label}</h3><span class="pill">${progress.done}/${progress.total} · ${progress.masteryPct}%</span></div>
        <p>${block.focus.join(' · ')}</p>
        <div class="mini-bar"><span style="width:${progress.masteryPct}%"></span></div>
        <div class="compact-list">${itemRows}</div>
      </div>
    </article>
  `
}

function renderCompactItem(item) {
  return `
    <div class="compact-item ${isDone(item) ? 'done' : ''}">
      ${renderMasteryPicker(item, 'compact')}
      <a class="compact-link" href="#/course/${item.course.id}/item/${item.id}" data-jump="${item.id}">
        <strong>${item.title}</strong>
        <small>${item.course.code} ${item.course.shortName ? `· ${item.course.shortName}` : ''} · ${categoryLabels[item.category]} · <code>${item.id}</code></small>
      </a>
    </div>
  `
}

function renderMasteryPicker(item, variant = 'full') {
  const buttons = [0, 1, 2, 3, 4].map((level) => `
    <button type="button" class="mastery-btn lvl-${level} ${item.mastery === level ? 'active' : ''}" data-set-mastery="${item.id}" data-level="${level}" title="${masteryLabels[level]}">${level}</button>
  `).join('')
  return `<div class="mastery-picker ${variant}">${buttons}</div>`
}

// Per-course filter for the in-page topic navigator (live string).
const courseFilterQuery = new Map() // courseId -> string

function getCourseFilter(cid) { return (courseFilterQuery.get(cid) || '').toLowerCase().trim() }
function setCourseFilter(cid, q) { courseFilterQuery.set(cid, q || '') }

function ensureCourseToc(courseId) {
  if (courseTocCache.has(courseId)) return
  courseTocCache.set(courseId, { loading: true })
  fetchJson(`/api/course-toc/${encodeURIComponent(courseId)}`)
    .then((data) => {
      courseTocCache.set(courseId, { data })
      render()
    })
    .catch((err) => {
      courseTocCache.set(courseId, { error: err.message })
      render()
    })
}

function courseTocFor(courseId, chapterId) {
  const entry = courseTocCache.get(courseId)
  return entry?.data?.chapters?.find((ch) => ch.id === chapterId)?.headings || []
}

function matchesCourseFilter(course, chapter, q) {
  const headings = courseTocFor(course.id, chapter.id)
  if (!q) return { chapter: true, topics: headings }
  const inChapter = (`${chapter.id} ${chapter.name}`).toLowerCase().includes(q)
  const matchedHeadings = headings.filter((h) => h.text.toLowerCase().includes(q))
  return {
    chapter: inChapter || matchedHeadings.length > 0,
    topics: inChapter ? headings : matchedHeadings
  }
}

function isSupportChapter(chapter) {
  return /exam skills|cram sheets|self tests|worked drills|cipher workthroughs|cipher walkthroughs/i.test(chapter.name || '')
}

/**
 * Unified topbar tab strip shared by course landing, chapter pages, and the mock-exam page.
 * Course-level navigation only (Overview + practice surfaces). Chapter-local sub-tabs
 * (Content / Self-Test) render separately via renderChapterSubTabs() so they're visually
 * a distinct layer, not bolted onto the course nav.
 *
 * @param course   The course object
 * @param opts.active   'overview' | 'mock-questions' | 'flashcards' | 'practice' | 'pdf' | 'solutions' | null
 * @param opts.surface  'overview' | 'chapter' | 'mock-exam' — determines click behaviour
 * @param opts.chapter  { id } — chapter page only; enables chapter-filtered jumps
 */
function renderSurfaceTabs(course, opts = {}) {
  const { active, surface, chapter } = opts
  const hasExams = getMockExams(course).length > 0
  const hasTutorials = getTutorials(course).length > 0

  // Click attribute differs by surface:
  // - mock-exam: switch tab in place (preserves scroll)
  // - else:      plain jump to the course-level practice surface
  // Chapter-scoped practice lives inside the chapter page's own sub-tabs
  // (e.g. "Exam Style Questions"), so the topbar always means course-wide.
  const jumpAttr = (target) => {
    if (surface === 'mock-exam') return `data-mock-tab="${target}"`
    return `data-course-jump="${target}" data-jump-course="${course.id}"`
  }
  const cls = (k) => `surface-tab${active === k ? ' active' : ''}`
  const current = (k) => active === k ? ' aria-current="page"' : ''
  const pressed = (k) => ` aria-pressed="${active === k}"`

  return `
    <nav class="surface-tabs" aria-label="Course sections">
      <a class="${cls('overview')}" href="#/course/${course.id}"${current('overview')}>Overview</a>
      <span class="surface-tabs-divider" aria-hidden="true"></span>
      <button type="button" class="${cls('mock-questions')}"${pressed('mock-questions')} ${jumpAttr('mock-questions')}>Practice</button>
      ${hasExams ? `<button type="button" class="${cls('exams')}"${pressed('exams')} ${jumpAttr('exams')}>Mock Exams</button>` : ''}
      ${hasTutorials ? `<button type="button" class="${cls('tutorials')}"${pressed('tutorials')} ${jumpAttr('tutorials')}>Tutorials</button>` : ''}
    </nav>
  `
}

/**
 * Find the previous and next core chapters relative to a given chapter id.
 * Skips support pages (Cram Sheets, Worked Drills, etc.) so navigation stays
 * within the lecture spine.
 */
function findAdjacentChapters(course, chapterId) {
  const chapters = (course.chapters || []).filter((ch) => !isSupportChapter(ch))
  const idx = chapters.findIndex((ch) => ch.id === chapterId)
  if (idx < 0) return { prev: null, next: null }
  return {
    prev: idx > 0 ? chapters[idx - 1] : null,
    next: idx < chapters.length - 1 ? chapters[idx + 1] : null
  }
}

/**
 * Prev/next chapter navigation. Two variants:
 *   header — small stacked pair in the chapter header's top-right corner
 *   footer — larger cards at the bottom of the article
 * Boundary chapters render the missing side as a disabled placeholder so the
 * layout stays balanced.
 */
function renderChapterPrevNext(course, prev, next, variant) {
  const cls = `chapter-nav chapter-nav-${variant}`
  const side = (ch, dir, label) => ch
    ? `<a class="chapter-nav-link ${dir}" href="#/course/${course.id}/chapter/${ch.id}">
        <span class="chapter-nav-dir">${label}</span>
        <span class="chapter-nav-label">Ch ${escapeHtml(ch.id)} — ${escapeHtml(ch.name)}</span>
      </a>`
    : `<span class="chapter-nav-link ${dir} disabled" aria-hidden="true">
        <span class="chapter-nav-dir">${label}</span>
        <span class="chapter-nav-label">${dir === 'prev' ? 'Start of course' : 'End of course'}</span>
      </span>`
  return `
    <nav class="${cls}" aria-label="Chapter navigation">
      ${side(prev, 'prev', 'Previous')}
      ${side(next, 'next', 'Next')}
    </nav>
  `
}

/**
 * Chapter-local sub-tab strip. Sits below the hero on chapter pages so the chapter's
 * Content / Self-Test toggle is visually a distinct layer from the course-level nav.
 */
function renderChapterSubTabs(course, chapter, activeTab) {
  return `
    <nav class="chapter-subtabs" role="tablist" aria-label="Chapter view">
      <button type="button" role="tab" aria-selected="${activeTab === 'content'}" tabindex="${activeTab === 'content' ? '0' : '-1'}" class="chapter-subtab${activeTab === 'content' ? ' active' : ''}" data-chapter-tab="content" data-tab-course="${course.id}" data-tab-chapter="${chapter.id}">Read</button>
      <button type="button" role="tab" aria-selected="${activeTab === 'selftest'}" tabindex="${activeTab === 'selftest' ? '0' : '-1'}" class="chapter-subtab${activeTab === 'selftest' ? ' active' : ''}" data-chapter-tab="selftest" data-tab-course="${course.id}" data-tab-chapter="${chapter.id}">Practice</button>
      <button type="button" role="tab" aria-selected="${activeTab === 'esq'}" tabindex="${activeTab === 'esq' ? '0' : '-1'}" class="chapter-subtab${activeTab === 'esq' ? ' active' : ''}" data-chapter-tab="esq" data-tab-course="${course.id}" data-tab-chapter="${chapter.id}">Exam questions</button>
    </nav>
  `
}

function renderStudyDrawerScrim() {
  if (!mobileStudyPanel) return ''
  return `<button type="button" class="study-drawer-scrim" data-mobile-study-panel="${mobileStudyPanel}" aria-label="Close study panel"></button>`
}

function renderChapterOutlineDrawer(course, chapter, tab, toc, hasExamples) {
  const coreChapters = (course.chapters || []).filter((candidate) => !isSupportChapter(candidate))
  const pageOutline = tab === 'content'
    ? `
      <section class="study-drawer-section">
        <h3>On this page</h3>
        ${toc.length
          ? `<ol class="study-outline-list">${toc.map((item) => `<li class="lvl-${item.level}"><a href="javascript:void(0)" data-toc-target="${item.id}">${escapeHtml(item.text)}</a></li>`).join('')}</ol>`
          : '<p class="study-drawer-empty">This chapter has no section headings.</p>'}
        ${hasExamples ? '<a class="study-drawer-jump" href="javascript:void(0)" data-toc-target="chapter-examples">Worked examples</a>' : ''}
      </section>
    `
    : `
      <section class="study-drawer-section">
        <h3>${tab === 'esq' ? 'Exam questions' : 'Practice'}</h3>
        <p class="study-drawer-empty">This session is scoped to Ch ${escapeHtml(chapter.id)}. Switch back to Read for the chapter outline.</p>
        <button type="button" class="study-drawer-jump" data-chapter-tab="content" data-tab-course="${course.id}" data-tab-chapter="${chapter.id}">Open chapter notes</button>
      </section>
    `

  return `
    <aside class="study-drawer study-drawer-left ${mobileStudyPanel === 'outline' ? 'is-open' : ''}" aria-hidden="${mobileStudyPanel !== 'outline'}" aria-label="Chapter outline">
      <header class="study-drawer-header">
        <div><small>${escapeHtml(course.code)}</small><h2>Outline</h2></div>
        <button type="button" class="icon-btn" data-mobile-study-panel="outline" aria-label="Close outline">${uiIcon('close')}</button>
      </header>
      <div class="study-drawer-scroll">
        ${pageOutline}
        <section class="study-drawer-section">
          <h3>Course chapters</h3>
          <ol class="study-chapter-list">
            ${coreChapters.map((candidate, index) => `
              <li class="${candidate.id === chapter.id ? 'is-current' : ''}">
                <a href="#/course/${course.id}/chapter/${candidate.id}">
                  <span>${String(index + 1).padStart(2, '0')}</span>
                  <strong>${escapeHtml(candidate.name)}</strong>
                </a>
              </li>
            `).join('')}
          </ol>
        </section>
      </div>
    </aside>
  `
}

function renderChapterToolsDrawer(course, chapter) {
  const isTutor = studyToolsTab === 'tutor'
  return `
    <aside class="study-drawer study-drawer-right study-tools-drawer ${mobileStudyPanel === 'tools' ? 'is-open' : ''}" aria-hidden="${mobileStudyPanel !== 'tools'}" aria-label="Chapter study tools">
      <header class="study-drawer-header">
        <div><small>Ch ${escapeHtml(chapter.id)}</small><h2>Study tools</h2></div>
        <button type="button" class="icon-btn" data-mobile-study-panel="tools" aria-label="Close study tools">${uiIcon('close')}</button>
      </header>
      <nav class="study-tools-tabs" role="tablist" aria-label="Study tools">
        <button type="button" role="tab" aria-selected="${!isTutor}" tabindex="${!isTutor ? '0' : '-1'}" class="${!isTutor ? 'is-active' : ''}" data-study-tools-tab="progress">Progress</button>
        <button type="button" role="tab" aria-selected="${isTutor}" tabindex="${isTutor ? '0' : '-1'}" class="${isTutor ? 'is-active' : ''}" data-study-tools-tab="tutor">Tutor</button>
      </nav>
      <div class="study-tools-panel ${isTutor ? 'is-tutor' : 'is-progress'}" role="tabpanel">
        ${isTutor ? renderChatPanel(course, chapter, { workspace: true }) : `
          ${renderChapterProgressCard(course, chapter, { showReadAction: false })}
          <section class="study-drawer-section study-drawer-reset">
            <h3>Chapter data</h3>
            <p>Clear reading status, answers, review history, and mistakes for this chapter.</p>
            <button type="button" class="clear-link" data-clear-scope="chapter" data-clear-course="${course.id}" data-clear-chapter="${chapter.id}" data-clear-course-name="${escapeHtml(course.name)}">Reset chapter progress</button>
          </section>
        `}
      </div>
    </aside>
  `
}

// ----- Coverage cache (drives whether to show Generate-all CTAs) -----
// Maintainers ship pre-generated content via the cache files. When everything
// is cached, end users don't need (or want) to see "Generate all" buttons.
// The /api/coverage and /api/courses/:cid/coverage endpoints return how many
// steps would be 'pending' if a job were planned right now.
const courseCoverage = new Map() // cid -> { total, pending }
let coverageState = 'idle' // 'idle' | 'loading' | 'loaded'
let coverageFetchedAt = 0
const COVERAGE_TTL_MS = 30 * 1000  // any revisit after 30s triggers a quiet refresh

async function ensureCoverage({ force = false } = {}) {
  if (coverageState === 'loading') return
  const age = Date.now() - coverageFetchedAt
  if (!force && coverageState === 'loaded' && age < COVERAGE_TTL_MS) return
  coverageState = 'loading'
  try {
    const r = await fetch('/api/coverage')
    if (!r.ok) { coverageState = age > 0 ? 'loaded' : 'idle'; return }
    const data = await r.json()
    // Replace, not merge — courses can transition from N→0 pending, and a
    // stale 'pending: 5' entry would still hide the chip for a course that's
    // actually done.
    courseCoverage.clear()
    for (const [cid, summary] of Object.entries(data.courses || {})) {
      courseCoverage.set(cid, summary)
    }
    coverageState = 'loaded'
    coverageFetchedAt = Date.now()
    render()
  } catch {
    if (coverageFetchedAt === 0) coverageState = 'idle'
    else coverageState = 'loaded' // keep last-known-good
  }
}

function coverageTotalPending() {
  let n = 0
  for (const c of courseCoverage.values()) n += (c.pending || 0)
  return n
}

// ----- Generate-all jobs (course-wide content generation) -----
// One cache entry per course tracks its currently-known job. The card on the
// course landing page reads from here and polls the server every 4s while a
// job is running.
const generateAllJobs = new Map() // courseId -> { job, polling }

function refreshGenerateJob(courseId) {
  const entry = generateAllJobs.get(courseId) || {}
  if (entry.polling) return // already polling
  entry.polling = true
  generateAllJobs.set(courseId, entry)
  const tick = async () => {
    try {
      const resp = await fetch(`/api/courses/${encodeURIComponent(courseId)}/generate-all`)
      if (resp.status === 404) {
        const e = generateAllJobs.get(courseId) || {}
        e.polling = false
        generateAllJobs.set(courseId, e)
        return
      }
      const job = await resp.json()
      const e = generateAllJobs.get(courseId) || {}
      e.job = job
      generateAllJobs.set(courseId, e)
      const stillRunning = job.status === 'running' || job.status === 'queued'
      if (stillRunning) {
        setTimeout(tick, 4000)
      } else {
        e.polling = false
        generateAllJobs.set(courseId, e)
        if (typeof mockQuestionsCache !== 'undefined') mockQuestionsCache.delete(courseId)
        if (typeof questionsSummaryCache !== 'undefined') questionsSummaryCache.delete(courseId)
        // Job just finished — refresh coverage so the chip appears, not the
        // CTA. Triggers its own render() once done.
        ensureCoverage({ force: true })
      }
      if (!refreshCourseCardInPlace(courseId) || !stillRunning) {
        if (!stillRunning) render()
      }
    } catch {
      // network blip — try again later
      setTimeout(tick, 8000)
    }
  }
  tick()
}

async function startGenerateAll(courseId, { force = false } = {}) {
  try {
    const url = `/api/courses/${encodeURIComponent(courseId)}/generate-all${force ? '?force=1' : ''}`
    const resp = await fetch(url, { method: 'POST' })
    const data = await resp.json()
    if (data.jobId) refreshGenerateJob(courseId)
  } catch (err) {
    alert(`Failed to start generation: ${err.message}`)
  }
}

async function confirmAndRerunCourse(courseId, courseName) {
  const ok = await showConfirm({
    title: 'Re-run generation for this course?',
    message: `Every piece of cached content for ${courseName} (chapter self-tests, mock question bank, parsed past papers, content TOCs) will be regenerated from scratch.\n\nThis costs ~10–20 Codex calls and 5–15 minutes per course.\n\nFlashcards are NOT regenerated (would lose your spaced-repetition progress) — add new ones manually if needed.`,
    okLabel: 'Yes, regenerate',
    cancelLabel: 'Cancel',
    danger: true
  })
  if (!ok) return
  // Invalidate the local cov so the UI re-fetches once the job kicks off
  courseCoverage.delete(courseId)
  coverageState = 'idle'
  ensureCoverage()
  await startGenerateAll(courseId, { force: true })
}

/** Small status chip in the course hero — only when everything's populated. */
function renderCoursePopulatedChip(course) {
  const cov = courseCoverage.get(course.id)
  if (!cov || cov.pending !== 0) return ''
  const job = generateAllJobs.get(course.id)?.job
  if (job && (job.status === 'running' || job.status === 'queued')) return '' // mid-run, show the card instead
  return `
    <div class="course-populated-chip" title="Every chapter self-test, mock question, parsed exam, and content TOC for this course is already generated and cached.">
      <span class="course-populated-dot" aria-hidden="true">●</span>
      <span class="course-populated-label">Contents populated</span>
      <button type="button" class="course-populated-rerun" data-course-rerun="${course.id}" data-course-rerun-name="${escapeHtml(course.name)}">Re-run</button>
    </div>
  `
}

/**
 * Swap a single card's DOM in place — preserves scroll, open <details>,
 * focus, mid-edits in the rest of the page. Used by the polling ticks so a
 * 4-second progress refresh doesn't blow away whatever the user is doing.
 *
 * If the target card isn't in the current document (user navigated away),
 * returns false so the caller can fall back to a full render.
 */
function replaceCardInPlace(selector, newHtml) {
  const oldNode = document.querySelector(selector)
  if (!oldNode) return false
  if (!newHtml || !newHtml.trim()) {
    // Card should be hidden — remove cleanly
    oldNode.remove()
    return true
  }
  const tmp = document.createElement('div')
  tmp.innerHTML = newHtml.trim()
  const newNode = tmp.firstElementChild
  if (!newNode) {
    oldNode.remove()
    return true
  }
  oldNode.replaceWith(newNode)
  // Re-bind any handlers that live within the new subtree. Buttons on the
  // genall cards are the only handlers that matter here.
  newNode.querySelectorAll('[data-genall-start]').forEach((btn) => {
    btn.addEventListener('click', (event) => startGenerateAll(event.currentTarget.dataset.genallStart))
  })
  newNode.querySelectorAll('[data-genall-all-start]').forEach((btn) => {
    btn.addEventListener('click', () => startGenerateAllCourses())
  })
  return true
}

function refreshCourseCardInPlace(courseId) {
  const course = state.courses?.find((c) => c.id === courseId)
  if (!course) return false
  return replaceCardInPlace(`[data-genall-course-card="${CSS.escape(courseId)}"]`, renderGenerateAllCard(course))
}

function refreshMasterCardInPlace() {
  return replaceCardInPlace('[data-genall-master-card]', renderGenerateAllCoursesCard())
}

function renderGenerateAllCard(course) {
  const entry = generateAllJobs.get(course.id) || {}
  const job = entry.job
  // Hide entirely when nothing's pending — i.e. the course has been packaged
  // editorially and end users don't need the CTA. The hero shows a "Contents
  // populated" chip instead. We also hide when a recent job finished cleanly
  // with everything cached, so the big "Done — N generated" card doesn't
  // linger after a no-op run.
  const cov = courseCoverage.get(course.id)
  if (cov && cov.pending === 0 && (!job || job.status === 'done')) return ''
  if (!job) {
    return `
      <section class="genall-card" data-genall-course-card="${course.id}">
        <div class="genall-head">
          <div>
            <p class="eyebrow">Generate</p>
            <h3>All course content</h3>
            <small class="rail-meta">Builds every missing chapter self-test, the course-wide mock question bank, and parses each past paper into a graded practice exam. Skips anything already cached. Runs in the background.</small>
          </div>
          <button type="button" class="kb-link kb-link-mock" data-genall-start="${course.id}">Generate all</button>
        </div>
      </section>
    `
  }
  // Have a job — render progress
  const total = job.steps.length
  const done = job.steps.filter((s) => s.status === 'done').length
  const skipped = job.steps.filter((s) => s.status === 'skipped').length
  const running = job.steps.find((s) => s.status === 'running')
  const errors = job.steps.filter((s) => s.status === 'error')
  const pendingCount = job.steps.filter((s) => s.status === 'pending').length

  const isLive = job.status === 'running' || job.status === 'queued'
  const pct = total ? Math.round(((done + skipped) / total) * 100) : 0

  return `
    <section class="genall-card ${isLive ? 'live' : (job.status === 'error' ? 'failed' : 'finished')}" data-genall-course-card="${course.id}">
      <div class="genall-head">
        <div>
          <p class="eyebrow">Generate all</p>
          <h3>${isLive ? `Running — ${done + skipped}/${total} steps complete` : job.status === 'done' ? `Done — ${done} generated, ${skipped} skipped${errors.length ? `, ${errors.length} failed` : ''}` : `Stopped — ${job.error || 'error'}`}</h3>
          ${running ? `<small class="rail-meta">Now: ${escapeHtml(running.label)}</small>` : isLive ? `<small class="rail-meta">${pendingCount} pending</small>` : ''}
        </div>
        ${isLive
          ? `<small class="rail-meta">${pct}%</small>`
          : `<button type="button" class="kb-link kb-link-mock" data-genall-start="${course.id}">Re-run</button>`}
      </div>
      <div class="genall-bar"><div class="genall-bar-fill" style="width:${pct}%"></div></div>
      <details class="genall-steps">
        <summary>${total} steps</summary>
        <ul>
          ${job.steps.map((s) => `
            <li class="genall-step genall-step-${s.status}">
              <span class="genall-step-status">${s.status === 'done' ? '✓' : s.status === 'skipped' ? '·' : s.status === 'running' ? '…' : s.status === 'error' ? '!' : ' '}</span>
              <span class="genall-step-label">${escapeHtml(s.label)}</span>
              ${s.error ? `<small class="genall-step-error">${escapeHtml(s.error)}</small>` : ''}
            </li>
          `).join('')}
        </ul>
      </details>
    </section>
  `
}

function renderCourse(courseId) {
  const course = state.courses.find((c) => c.id === courseId) || state.courses[0]
  // Ensure mock + flashcard caches are loaded so per-chapter rollups have data.
  if (typeof mockQuestionsCache !== 'undefined' && !mockQuestionsCache.has(course.id)) ensureMockQuestions(course.id)
  if (typeof flashcardsCache !== 'undefined' && !flashcardsCache.has(course.id)) ensureFlashcards(course.id)
  if (typeof questionsSummaryCache !== 'undefined' && !questionsSummaryCache.has(course.id)) ensureQuestionsSummary(course.id)
  ensureCourseToc(course.id)
  ensureCoverage()
  if (!academicsData && !academicsLoading && !academicsError) queueMicrotask(() => loadAcademics())
  const progress = courseProgress(course)
  const chapters = course.chapters || []
  const coreChapters = chapters.filter((ch) => !isSupportChapter(ch))
  const supportChapters = chapters.filter(isSupportChapter)
  const q = getCourseFilter(course.id)
  const matches = coreChapters.map((ch) => ({ ch, ...matchesCourseFilter(course, ch, q) }))
  const supportMatches = supportChapters.map((ch) => ({ ch, ...matchesCourseFilter(course, ch, q) }))
  const visibleChapters = q ? matches.filter((m) => m.chapter) : matches

  return `
    ${chapters.length ? `
      <article class="course-overview" style="--accent:${course.accent}">
          <header class="course-overview-header">
            <div class="course-overview-title">
              <p class="eyebrow">${course.code} ${course.shortName ? `· ${course.shortName}` : ''}</p>
              <h1>${course.name}</h1>
              <p class="course-overview-meta">${course.exam} <span aria-hidden="true">/</span> ${course.role}</p>
            </div>
            <div class="course-overview-record" aria-label="Course progress">
              <span class="course-overview-number">${progress.masteryPct}<sup>%</sup></span>
              <p>${progress.done} of ${progress.total} chapters read</p>
            </div>
            ${coreChapters[0] ? `<a class="course-mobile-continue" href="#/course/${course.id}/chapter/${coreChapters.find((candidate) => !isChapterRead(course.id, candidate.id))?.id || coreChapters[0].id}"><span><small>${progress.done ? 'Continue studying' : 'Start this course'}</small><strong>${escapeHtml((coreChapters.find((candidate) => !isChapterRead(course.id, candidate.id)) || coreChapters[0]).name)}</strong></span>${uiIcon('chevronRight')}</a>` : ''}
            <div class="course-overview-nav">
              ${renderSurfaceTabs(course, { active: 'overview', surface: 'overview' })}
              <button type="button" class="clear-link" data-clear-scope="course" data-clear-course="${course.id}" data-clear-course-name="${escapeHtml(course.name)}" title="Reset every trace of your progress on this course">Reset progress</button>
            </div>
          </header>

          ${renderCoursePlanningContext(course)}

          <section class="course-spine-section course-overview-section">
            <div class="panel-head spine-head">
              <div><p class="eyebrow">At a glance</p><h2>Chapter heatmap</h2></div>
              <div class="spine-summary" title="Course-wide progress">
                <span class="spine-summary-pct">${progress.masteryPct}%</span>
                <small>overall · ${progress.done}/${progress.total} chapters read</small>
              </div>
            </div>
            <div class="spine-legend" aria-label="Signal legend">
              <span class="spine-legend-item"><span class="spine-legend-pip" style="--c:#3b6f5b"></span>Read</span>
              <span class="spine-legend-item"><span class="spine-legend-pip" style="--c:#5b8aa3"></span>Practice</span>
              <span class="spine-legend-item"><span class="spine-legend-pip" style="--c:#c08a3e"></span>Mock</span>
              <span class="spine-legend-item"><span class="spine-legend-pip" style="--c:#9a6fa0"></span>Flashcards</span>
              <small class="spine-legend-note">Tile tint = overall mastery</small>
            </div>
            ${renderCourseSpine(course, coreChapters)}
          </section>

          ${supportChapters.length ? renderCourseToolkit(course, supportChapters) : ''}

        <section class="chapter-progress-grid course-main-col" id="course-core-chapters">
          <div class="panel-head course-progress-head">
            <div><p class="eyebrow">Core chapters</p><h2>Progress detail</h2></div>
            <label class="course-inline-search"><span aria-hidden="true">${uiIcon('search')}</span><input type="search" placeholder="Find a chapter or topic" value="${escapeHtml(q)}" data-course-filter="${course.id}" autocomplete="off" spellcheck="false" /></label>
          </div>
          ${visibleChapters.length
            ? visibleChapters.map((m) => renderChapterProgressRow(course, m.ch, m.topics)).join('')
            : '<p class="empty">No chapters or topics match this filter.</p>'}
        </section>
      </article>
    ` : '<p class="empty">No chapters configured.</p>'}
  `
}

// ----- Small SVG donut: 0..1 fill, scaled to size px -----
function progressRing(pct, { size = 36, stroke = 4, color = 'var(--accent)', label = '' } = {}) {
  const r = (size / 2) - (stroke / 2)
  const c = 2 * Math.PI * r
  const fill = Math.max(0, Math.min(1, pct)) * c
  const empty = c - fill
  return `
    <span class="ring" style="width:${size}px;height:${size}px" title="${escapeHtml(label)}">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}" />
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
          stroke-dasharray="${fill.toFixed(2)} ${empty.toFixed(2)}"
          stroke-linecap="butt"
          transform="rotate(-90 ${size/2} ${size/2})" />
      </svg>
      <span class="ring-text">${Math.round(pct * 100)}</span>
    </span>
  `
}

// Spine: one tile per chapter, colored by masteryPct (0..100). Click → open chapter.
function renderCourseSpine(course, chapters = course.chapters || []) {
  if (!chapters.length) return ''
  return `
    <div class="course-spine" aria-label="Chapter progress at a glance">
      ${chapters.map((ch) => {
        const p = chapterProgress(course, ch)
        const bucket = p.masteryPct >= 75 ? 'great' : p.masteryPct >= 50 ? 'good' : p.masteryPct >= 25 ? 'mid' : p.masteryPct > 0 ? 'low' : 'none'
        // Signal fills (0–100). Read is binary; practice/mock are avg score scaled to 10;
        // flashcards is mature/total. Missing signals render as empty bars.
        const readPct = p.read ? 100 : 0
        const practicePct = p.practice.total ? Math.round((p.practice.avg / 10) * 100) : 0
        const mockPct     = p.mock.total     ? Math.round((p.mock.avg     / 10) * 100) : 0
        const fcPct       = p.flashcards.total ? Math.round((p.flashcards.mature / p.flashcards.total) * 100) : 0
        const title = `Ch ${escapeHtml(ch.id)} — ${escapeHtml(ch.name)}\nOverall: ${p.masteryPct}%\nRead: ${readPct}%\nPractice: ${p.practice.done}/${p.practice.total || 0}${p.practice.total ? ` (avg ${p.practice.avg.toFixed(1)}/10)` : ''}\nMock: ${p.mock.done}/${p.mock.total || 0}${p.mock.total ? ` (avg ${p.mock.avg.toFixed(1)}/10)` : ''}\nFlashcards: ${p.flashcards.mature}/${p.flashcards.total || 0} mature`
        return `
          <div class="spine-tile spine-${bucket}" title="${escapeHtml(title)}">
            <button type="button" class="spine-tile-clear" data-clear-scope="chapter" data-clear-course="${course.id}" data-clear-chapter="${ch.id}" data-clear-course-name="${escapeHtml(course.name)}" title="Reset progress for Ch ${escapeHtml(ch.id)}">${uiIcon('close')}</button>
            <a class="spine-tile-link" href="#/course/${course.id}/chapter/${ch.id}">
            <div class="spine-tile-head">
              <span class="spine-num">${escapeHtml(ch.id)}</span>
              <span class="spine-pct">${p.masteryPct}%</span>
            </div>
            <div class="spine-name">${escapeHtml(ch.name)}</div>
            <div class="spine-bars">
              <span class="spine-bar spine-bar-read" style="--fill:${readPct}%"></span>
              <span class="spine-bar spine-bar-practice" style="--fill:${practicePct}%"></span>
              <span class="spine-bar spine-bar-mock" style="--fill:${mockPct}%"></span>
              <span class="spine-bar spine-bar-fc" style="--fill:${fcPct}%"></span>
            </div>
            </a>
          </div>
        `
      }).join('')}
    </div>
  `
}

function renderCourseToolkit(course, supportChapters) {
  return `
    <section class="course-toolkit-panel">
      <div class="panel-head">
        <div><p class="eyebrow">Exam toolkit</p><h2>Support pages</h2></div>
        <small>Exam skills, cram sheets, self-tests, and drills.</small>
      </div>
      <div class="toolkit-tabs">
        ${supportChapters.map((ch) => {
          const p = chapterProgress(course, ch)
          return `
            <a class="toolkit-tab" href="#/course/${course.id}/chapter/${ch.id}">
              <span>Ch ${escapeHtml(ch.id)}</span>
              <strong>${escapeHtml(ch.name)}</strong>
              <em>${p.masteryPct}%</em>
            </a>
          `
        }).join('')}
      </div>
    </section>
  `
}

const chapterRowExpanded = new Map() // 'cid/chid' -> true

function masteryDots(level = 0) {
  const filled = '●'.repeat(level)
  const empty = '○'.repeat(4 - level)
  return `<span class="topic-dots topic-dots-${level}" aria-label="Mastery ${level} of 4">${filled}${empty}</span>`
}

function renderTopicChips(course, chapter, items) {
  const list = items || chapterItems(course, chapter.id)
  if (!list.length) {
    return '<p class="topic-empty">No chapter headings found yet.</p>'
  }
  if (list[0]?.text) {
    const rows = []
    let current = null
    for (const h of list) {
      if ((h.level || 2) <= 2 || !current) {
        current = { heading: h, children: [] }
        rows.push(current)
      } else {
        current.children.push(h)
      }
    }
    return `
      <div class="chapter-heading-outline">
        ${rows.map((row) => `
          <div class="chapter-heading-group">
            <a
              class="chapter-heading-main"
              href="#/course/${course.id}/chapter/${chapter.id}"
              data-course-nav-heading="${course.id}/${chapter.id}/${row.heading.id}"
              title="${escapeHtml(row.heading.text)}"
            >
              ${escapeHtml(row.heading.text)}
            </a>
            ${row.children.length ? `
              <div class="chapter-heading-subgrid">
                ${row.children.map((h) => `
                  <a
                    class="chapter-heading-sub"
                    href="#/course/${course.id}/chapter/${chapter.id}"
                    data-course-nav-heading="${course.id}/${chapter.id}/${h.id}"
                    title="${escapeHtml(h.text)}"
                  >${escapeHtml(h.text)}</a>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `
  }
  return `
    <div class="topic-chips">
      ${list.map((it) => `
        <button type="button" class="topic-chip lvl-${it.mastery || 0}" data-topic-cycle="${it.id}" title="${escapeHtml(it.deliverable || it.title)} — click to advance mastery">
          <span class="topic-chip-title">${escapeHtml(it.title)}</span>
          ${masteryDots(it.mastery || 0)}
        </button>
      `).join('')}
    </div>
  `
}

function renderChapterProgressRow(course, chapter, visibleTopics) {
  const p = chapterProgress(course, chapter)
  const key = `${course.id}/${chapter.id}`
  const q = getCourseFilter(course.id)
  // Auto-expand a chapter when the filter is active and it has matching topics.
  const expanded = chapterRowExpanded.get(key) === true || (!!q && (visibleTopics || []).length > 0)
  const accent = course.accent || 'var(--accent)'
  const readPct = p.read ? 1 : 0
  const practicePct = p.practice.total ? (p.practice.done / p.practice.total) * (p.practice.avg / 10) : 0
  const mockPct = p.mock.total ? (p.mock.done / p.mock.total) * (p.mock.avg / 10) : 0
  const flashcardsPct = p.flashcards.total ? (p.flashcards.mature / p.flashcards.total) : 0

  const ringSpec = (val, color, label) => progressRing(val, { size: 26, stroke: 3, color, label })
  const ringCell = (val, color, label, count) => `
    <div class="ch-card-metric" title="${escapeHtml(label)}">
      ${ringSpec(val, color, label)}
      <span class="ch-card-metric-text">
        <small>${escapeHtml(label)}</small>
        <em>${count}</em>
      </span>
    </div>
  `

  return `
    <article id="chapter-card-${course.id}-${chapter.id}" class="ch-card ${p.read ? 'is-read' : ''}" data-chapter-card-key="${key}" style="--accent:${accent}">
      <div class="ch-card-row">
        <a class="ch-card-title" href="#/course/${course.id}/chapter/${chapter.id}">
          <span class="ch-card-num">${escapeHtml(chapter.id)}</span>
          <h3>${escapeHtml(chapter.name)}</h3>
          ${p.read ? '<span class="ch-card-badge">✓</span>' : ''}
        </a>
        <div class="ch-card-metrics">
          ${ringCell(readPct, p.read ? accent : 'var(--muted)', 'Read', p.read ? '✓' : '—')}
          ${ringCell(practicePct, '#365f8f', 'Practice', p.practice.total ? `${p.practice.done}/${p.practice.total}${p.practice.done ? ` · ${p.practice.avg.toFixed(1)}` : ''}` : '—')}
          ${ringCell(mockPct, '#a84f3d', 'Mock', p.mock.total ? `${p.mock.done}/${p.mock.total}${p.mock.done ? ` · ${p.mock.avg.toFixed(1)}` : ''}` : '—')}
          ${ringCell(flashcardsPct, '#755a9b', 'Flashcards', p.flashcards.total ? `${p.flashcards.mature}/${p.flashcards.total}` : '—')}
        </div>
        <div class="ch-card-overall">
          <strong>${p.masteryPct}%</strong>
        </div>
        <button type="button" class="ch-card-expand" data-chapter-row-toggle="${key}" aria-expanded="${expanded}" title="${expanded ? 'Hide topics' : 'Show topics'}">${uiIcon(expanded ? 'chevronDown' : 'chevronRight')}</button>
      </div>

      ${expanded ? `
        <div class="ch-card-topics">
          ${renderTopicChips(course, chapter, visibleTopics)}
        </div>
      ` : ''}
    </article>
  `
}

function renderTracker(course, category) {
  const progress = categoryProgress(course, category)
  return `
    <article class="tracker ${progress.total ? '' : 'muted'}">
      <span>${categoryLabels[category]}</span>
      <strong>${progress.masteryPct}%</strong>
      <div class="mini-bar"><span style="width:${progress.masteryPct}%"></span></div>
      <small>${progress.done}/${progress.total} · avg ${progress.avg.toFixed(2)}/4</small>
    </article>
  `
}

function renderCoverage(course) {
  if (!course.chapters?.length) return ''
  const rows = course.chapters.map((chapter) => {
    const items = chapterItems(course, chapter.id)
    const progress = progressOf(items)
    const uncovered = !items.length
    return `
      <tr class="${uncovered ? 'uncovered' : ''} clickable" data-open-chapter="${course.id}/${chapter.id}">
        <td><strong>${chapter.id}</strong> ${chapter.name}</td>
        <td>${items.length}</td>
        <td>${uncovered ? '—' : `${progress.avg.toFixed(2)}/4`}</td>
        <td><div class="mini-bar"><span style="width:${progress.masteryPct}%"></span></div></td>
        <td class="item-pills">${items.map((item) => `<a href="#/course/${course.id}/item/${item.id}" class="item-pill ${isDone(item) ? 'done' : ''}" onclick="event.stopPropagation()">${item.title}</a>`).join('')}</td>
      </tr>
    `
  }).join('')
  return `
    <section class="panel coverage">
      <div class="panel-head"><div><p class="eyebrow">Chapter coverage</p><h2>Knowledge map</h2></div><small>Click a row to open the chapter note. Uncovered rows are gaps.</small></div>
      <table class="coverage-table">
        <thead><tr><th>Chapter</th><th>Items</th><th>Avg mastery</th><th>Bar</th><th>Tracked items</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `
}

function renderItemToolbar() {
  const sortOptions = Object.entries(SORTS).map(([k, { label }]) => `<option value="${k}" ${filterState.sort === k ? 'selected' : ''}>${label}</option>`).join('')
  return `
    <section class="item-toolbar">
      <input type="search" class="item-search" placeholder="Search title or detail..." value="${escapeHtml(filterState.search)}" data-toolbar="search" />
      <select data-toolbar="category">
        <option value="all" ${filterState.category === 'all' ? 'selected' : ''}>All categories</option>
        ${categoryOrder.map((c) => `<option value="${c}" ${filterState.category === c ? 'selected' : ''}>${categoryLabels[c]}</option>`).join('')}
      </select>
      <select data-toolbar="mastery">
        <option value="all" ${filterState.mastery === 'all' ? 'selected' : ''}>All mastery</option>
        <option value="untouched" ${filterState.mastery === 'untouched' ? 'selected' : ''}>Untouched (0)</option>
        <option value="started" ${filterState.mastery === 'started' ? 'selected' : ''}>Started (1–2)</option>
        <option value="done" ${filterState.mastery === 'done' ? 'selected' : ''}>Done (≥3)</option>
        <option value="ready" ${filterState.mastery === 'ready' ? 'selected' : ''}>Exam-ready (4)</option>
      </select>
      <select data-toolbar="sort">${sortOptions}</select>
      <button type="button" class="clear-btn" data-toolbar="clear">Reset</button>
    </section>
  `
}

function applyFilters(items) {
  let out = items.slice()
  if (filterState.category !== 'all') out = out.filter((i) => i.category === filterState.category)
  if (filterState.mastery !== 'all') {
    out = out.filter((i) => {
      const m = i.mastery ?? 0
      if (filterState.mastery === 'untouched') return m === 0
      if (filterState.mastery === 'started') return m >= 1 && m <= 2
      if (filterState.mastery === 'done') return m >= 3
      if (filterState.mastery === 'ready') return m === 4
      return true
    })
  }
  if (filterState.search.trim()) {
    const q = filterState.search.trim().toLowerCase()
    out = out.filter((i) => [i.title, i.deliverable, ...(i.details || []), i.id, i.type].join(' ').toLowerCase().includes(q))
  }
  out.sort((SORTS[filterState.sort] || SORTS.priority).cmp)
  return out
}

function renderFilteredItems(course) {
  const filtered = applyFilters(course.items)
  if (!filtered.length) return '<p class="empty">No items match the current filters.</p>'
  if (filterState.category === 'all' && filterState.search === '' && filterState.mastery === 'all' && filterState.sort === 'priority') {
    const grouped = categoryOrder.map((c) => [c, filtered.filter((i) => i.category === c)]).filter(([, items]) => items.length)
    return grouped.map(([category, items]) => `
      <div class="category-section">
        <div class="section-heading"><h2>${categoryLabels[category]}</h2><span>${items.filter(isDone).length}/${items.length} · avg ${avgMastery(items).toFixed(2)}/4</span></div>
        <div class="item-list">${items.map((item) => renderFullItem(course, item)).join('')}</div>
      </div>
    `).join('')
  }
  return `
    <div class="category-section">
      <div class="section-heading"><h2>${filtered.length} items match</h2><span>${filtered.filter(isDone).length}/${filtered.length} done · avg ${avgMastery(filtered).toFixed(2)}/4</span></div>
      <div class="item-list">${filtered.map((item) => renderFullItem(course, item)).join('')}</div>
    </div>
  `
}

function renderFullItem(course, item) {
  const blockLabels = item.blocks.map((id) => {
    const b = state.dailyBlocks.find((b) => b.id === id)
    return b ? `${b.day} ${b.block}` : id
  })
  const chapterRefs = (item.chapterIds || []).map((cid) => {
    const ch = course.chapters?.find((c) => c.id === cid)
    return ch ? { label: `Ch ${ch.id} · ${ch.name}`, href: `#/course/${course.id}/chapter/${ch.id}` } : { label: `Ch ${cid}`, href: '#' }
  })
  const lastReviewed = item.masteryUpdatedAt ? `Last touched ${relativeTime(item.masteryUpdatedAt)}` : 'Never touched'
  const reviewLog = item.reviewLog || []

  return `
    <article id="item-${item.id}" class="todo-card ${isDone(item) ? 'done' : ''}" style="--accent:${course.accent}">
      <div class="todo-main">
        <div class="todo-mastery">
          ${renderMasteryPicker(item, 'full')}
          <small class="mastery-label">${masteryLabels[item.mastery ?? 0]} (${item.mastery ?? 0}/4)</small>
          <small class="mastery-when">${lastReviewed}</small>
        </div>
        <div>
          <div class="todo-title-row"><h3>${item.title}</h3><button class="copy-id" data-copy="${item.id}" type="button">Copy id</button></div>
          <p class="todo-meta"><code>${item.id}</code> · ${item.type} · Priority ${item.priority}</p>
          <p class="deliverable"><strong>Done means:</strong> ${item.deliverable}</p>
          <div class="tag-row">
            ${chapterRefs.map((r) => `<a class="chapter-pill" href="${r.href}">${r.label}</a>`).join('')}
            ${blockLabels.map((label) => `<span>${label}</span>`).join('')}
          </div>
        </div>
      </div>
      <div class="todo-grid">
        <div><h4>Specific coverage</h4><ul>${item.details.map((d) => `<li>${d}</li>`).join('')}</ul></div>
        <div><h4>Sources</h4><ul>${chapterRefs.map((r) => `<li><a href="${r.href}">${r.label}</a></li>`).join('')}${(item.extraSources || []).map((s) => `<li class="extra">${s}</li>`).join('')}</ul></div>
        <div><h4>Assistant prompt</h4><p>${item.assistantPrompt}</p></div>
        <div><h4>Notes</h4><textarea data-notes="${item.id}" placeholder="Study notes, weak spots, result...">${item.notes || ''}</textarea></div>
      </div>
      <details class="review-log">
        <summary>Review log<span class="log-count">${reviewLog.length}</span>
          <button type="button" class="log-btn" data-log-quiz="${item.id}" onclick="event.preventDefault(); event.stopPropagation();">+ Log quiz score</button>
          <button type="button" class="log-btn" data-log-review="${item.id}" onclick="event.preventDefault(); event.stopPropagation();">+ Log review</button>
        </summary>
        ${reviewLog.length ? `<ul class="review-events">${reviewLog.slice().reverse().map((ev) => `
          <li><span class="when">${relativeTime(ev.at)}</span><span class="kind">${ev.kind || 'review'}</span>${ev.kind === 'mastery-change' ? `<span class="delta">${ev.prevMastery ?? 0} → ${ev.mastery}</span>` : ''}${ev.score != null ? `<span class="score">${ev.score}</span>` : ''}${ev.note ? `<span class="note">${ev.note}</span>` : ''}</li>
        `).join('')}</ul>` : '<p class="empty-log">No history yet.</p>'}
      </details>
    </article>
  `
}

function renderChapterPage() {
  const course = state.courses.find((c) => c.id === route.courseId)
  if (!course) return '<p class="empty">Unknown course.</p>'
  const chapter = course.chapters?.find((c) => c.id === route.chapterId)
  if (!chapter) return '<p class="empty">Unknown chapter.</p>'
  const cacheKey = `${course.id}/${chapter.id}/${route.relPath || ''}`
  const cached = chapterCache.get(cacheKey)

  if (!cached) {
    loadChapter(course.id, chapter.id, route.relPath || '')
    return renderLoadingSurface({
      className: 'chapter-loading chapter-loading-state',
      title: 'Opening chapter',
      detail: 'Loading the maintained chapter material and study tools.',
      phase: 'Connecting to your workspace…',
      step: 1
    })
  }
  if (cached.loading) {
    return renderLoadingSurface({
      className: 'chapter-loading chapter-loading-state',
      title: 'Opening chapter',
      detail: 'Loading the maintained chapter material and study tools.',
      phase: cached.phase,
      step: cached.step
    })
  }
  if (cached.error) {
    return `<div class="chapter-loading error chapter-load-error"><strong>Chapter did not load</strong><p>${escapeHtml(cached.error)}</p><div class="empty-actions"><button type="button" class="btn btn-primary" data-chapter-retry="${escapeHtml(cacheKey)}">Try again</button><a class="btn btn-ghost" href="#/course/${course.id}">Back to course</a></div></div>`
  }

  const data = cached.data

  if (data.kind === 'directory') {
    return `
      <div class="chapter-page chapter-directory-page" style="--accent:${course.accent}">
        <article class="chapter-main">
          <header class="chapter-page-header">
            <div class="chapter-page-context"><a class="chapter-course-back" href="#/course/${course.id}">${ICONS.back}<span>${escapeHtml(course.code)} ${escapeHtml(course.shortName || '')}</span></a><span>Chapter files</span></div>
            <div class="chapter-page-title-row"><div class="chapter-page-title"><span class="chapter-number">${escapeHtml(chapter.id)}</span><div><h1>${escapeHtml(chapter.name)}</h1><p>${escapeHtml(course.name)}</p></div></div></div>
          </header>
          <div class="chapter-stage">
            <section class="chapter-listing">
              <h2>Choose a chapter file</h2>
              <p>This chapter contains more than one maintained note.</p>
              <ul class="chapter-files">
                ${data.files.map((file) => `<li><a href="#/course/${course.id}/chapter/${chapter.id}/${encodeURIComponent(file)}">${escapeHtml(file.replace(/\.md$/i, ''))}</a></li>`).join('')}
              </ul>
              ${data.subdirs.length ? `<h3>Folders</h3><ul class="chapter-files">${data.subdirs.map((directory) => `<li><a href="#/course/${course.id}/chapter/${chapter.id}/${encodeURIComponent(directory)}">${escapeHtml(directory)}</a></li>`).join('')}</ul>` : ''}
            </section>
          </div>
        </article>
      </div>
    `
  }

  const tab = getChapterTab(course.id, chapter.id)
  const questionsKey = `${course.id}/${chapter.id}`
  if (tab === 'selftest' && !questionsCache.has(questionsKey)) {
    questionsCache.set(questionsKey, { loading: true, auto: true })
    setTimeout(() => loadQuestions(course.id, chapter.id, { auto: true }), 0)
  }
  if (tab === 'esq') {
    // Scope the shared mock-questions state to this chapter so the embedded view
    // shows only this chapter's bank. Reset position whenever we land here on a
    // different course/chapter than the view was last pointed at.
    if (mockQuestionsView.courseId !== course.id || mockQuestionsView.chapterId !== chapter.id) {
      mockQuestionsView.courseId = course.id
      mockQuestionsView.chapterId = chapter.id
      mockQuestionsView.topics = []
      mockQuestionsView.types = []
      mockQuestionsView.openDd = null
      mockQuestionsView.currentIndex = 0
    }
    ensureMockQuestions(course.id)
  }
  const contentHtml = tab === 'content' ? renderMarkdown(data.content, course.id, chapter.id) : ''
  const examplesHtml = tab === 'content' && data.examples ? renderMarkdown(data.examples, course.id, chapter.id) : ''
  const toc = tab === 'content' ? extractToc(contentHtml) : []
  const coreChapters = (course.chapters || []).filter((candidate) => !isSupportChapter(candidate))
  const chapterIndex = Math.max(0, coreChapters.findIndex((candidate) => candidate.id === chapter.id))
  const chapterStatus = chapterProgress(course, chapter)
  const { prev, next } = findAdjacentChapters(course, chapter.id)

  return `
    <div class="chapter-page" style="--accent:${course.accent}">
      <article class="chapter-main">
        <header class="chapter-page-header">
          <div class="chapter-page-context">
            <a class="chapter-course-back" href="#/course/${course.id}">${ICONS.back}<span>${escapeHtml(course.code)} ${escapeHtml(course.shortName || '')}</span></a>
            <span>Chapter ${chapterIndex + 1} of ${coreChapters.length}</span>
          </div>
          <div class="chapter-page-title-row">
            <div class="chapter-page-title">
              <span class="chapter-number">${String(chapterIndex + 1).padStart(2, '0')}</span>
              <div><h1>${escapeHtml(chapter.name)}</h1><p>${escapeHtml(course.name)}</p></div>
            </div>
            <div class="chapter-page-actions">
              <button type="button" class="chapter-action" data-mobile-study-panel="outline" aria-pressed="${mobileStudyPanel === 'outline'}">${uiIcon('list')}<span>Outline</span></button>
              <button type="button" class="chapter-action chapter-progress-action" data-mobile-study-panel="tools" aria-pressed="${mobileStudyPanel === 'tools'}"><strong>${chapterStatus.masteryPct}%</strong><span>Study tools</span></button>
              <button type="button" class="chapter-read-action ${chapterStatus.read ? 'is-read' : ''}" data-chapter-read-toggle="${course.id}/${chapter.id}">${chapterStatus.read ? 'Read' : 'Mark as read'}</button>
            </div>
          </div>
          <div class="chapter-page-navigation">
            ${renderChapterSubTabs(course, chapter, tab)}
            ${renderChapterPrevNext(course, prev, next, 'header')}
          </div>
        </header>

        <div class="chapter-stage chapter-stage-${tab}">
          ${tab === 'content' ? `
            <div class="chapter-reading">
              <div class="markdown-body topical">${wrapTopicSections(contentHtml)}</div>
              ${data.examples ? `
                <section id="chapter-examples" class="examples-panel">
                  <div class="panel-head"><div><h2>More worked examples</h2></div></div>
                  <div class="markdown-body">${examplesHtml}</div>
                </section>
              ` : ''}
              <div class="chapter-read-footer">
                ${chapterStatus.read
                  ? `<button type="button" class="cp-read-toggle is-read" data-chapter-read-toggle="${course.id}/${chapter.id}">Read · click to undo</button>`
                  : `<button type="button" class="cp-read-toggle" data-chapter-read-toggle="${course.id}/${chapter.id}">Mark chapter as read</button>`}
                <small class="rail-meta">Reading progress is saved automatically.</small>
              </div>
            </div>
          ` : tab === 'esq' ? `
            <div class="chapter-practice-surface mq-panel">${renderMockQuestionsView(course)}</div>
          ` : `
            <section id="chapter-questions" class="chapter-practice-surface questions-panel">
              ${renderQuestionsPanel(course, chapter)}
            </section>
          `}
          <div class="chapter-stage-footer">${renderChapterPrevNext(course, prev, next, 'footer')}</div>
        </div>
      </article>
      ${renderStudyDrawerScrim()}
      ${renderChapterOutlineDrawer(course, chapter, tab, toc, Boolean(data.examples))}
      ${renderChapterToolsDrawer(course, chapter)}
    </div>
  `
}

function chatKey(courseId, chapterId) {
  return `${courseId}/${chapterId}`
}

function getChat(courseId, chapterId) {
  const key = chatKey(courseId, chapterId)
  if (!chatState.has(key)) {
    let messages = []
    try {
      const stored = localStorage.getItem(`chat:${key}`)
      if (stored) messages = JSON.parse(stored).messages || []
    } catch {}
    chatState.set(key, { messages, sending: false, draft: '' })
  }
  return chatState.get(key)
}

function persistChat(courseId, chapterId) {
  const key = chatKey(courseId, chapterId)
  const c = chatState.get(key)
  if (!c) return
  try { localStorage.setItem(`chat:${key}`, JSON.stringify({ messages: c.messages })) } catch {}
}

function renderChapterProgressCard(course, chapter, { showReadAction = true } = {}) {
  // Ensure caches are loaded so the rollup shows real data.
  if (typeof mockQuestionsCache !== 'undefined' && !mockQuestionsCache.has(course.id)) ensureMockQuestions(course.id)
  if (typeof flashcardsCache !== 'undefined' && !flashcardsCache.has(course.id)) ensureFlashcards(course.id)
  const p = chapterProgress(course, chapter)
  const row = (label, value, sub = '') => `
    <div class="cp-row">
      <span class="cp-row-label">${label}</span>
      <span class="cp-row-value">${value}</span>
      ${sub ? `<small class="cp-row-sub">${sub}</small>` : ''}
    </div>
  `
  const practiceLine = p.practice.total
    ? `${p.practice.done}/${p.practice.total}${p.practice.done ? ` · ${p.practice.avg.toFixed(1)}/10` : ''}`
    : `—`
  const mockLine = p.mock.total
    ? `${p.mock.done}/${p.mock.total}${p.mock.done ? ` · ${p.mock.avg.toFixed(1)}/10` : ''}`
    : `—`
  const fcLine = p.flashcards.total
    ? `${p.flashcards.mature}/${p.flashcards.total} mature`
    : `—`
  return `
    <section class="rail-card chapter-progress-card">
      <h4>Progress</h4>
      <div class="cp-dial">
        <strong>${p.masteryPct}%</strong>
        <div class="mini-bar"><span style="width:${p.masteryPct}%"></span></div>
        <small>${p.read ? 'Marked as read' : 'Not yet read'}</small>
      </div>
      <div class="cp-rows">
        ${row('Practice', practiceLine, p.practice.total ? '' : 'Load on the Self-Test tab')}
        ${row('Mock questions', mockLine, p.mock.total ? '' : 'Not published yet')}
        ${row('Flashcards', fcLine, p.flashcards.total ? '' : 'Add on the Flashcards tab')}
      </div>
      ${showReadAction ? `<button type="button" class="cp-read-toggle ${p.read ? 'is-read' : ''}" data-chapter-read-toggle="${course.id}/${chapter.id}">
        ${p.read ? '✓ Marked as read · click to undo' : 'Mark chapter as read'}
      </button>` : ''}
    </section>
  `
}

function renderChatPanel(course, chapter, { workspace = false } = {}) {
  const chat = getChat(course.id, chapter.id)
  const messagesHtml = chat.messages.length
    ? chat.messages.map((m) => `
        <div class="chat-msg chat-${m.role}">
          <span class="chat-role">${m.role === 'user' ? 'You' : 'Tutor'}</span>
          <div class="chat-body">${m.role === 'user' ? escapeHtml(m.content).replace(/\n/g, '<br>') : renderMarkdown(m.content)}</div>
        </div>
      `).join('')
    : `<p class="chat-empty">Ask a question about <strong>${escapeHtml(chapter.name)}</strong>. The tutor has the full course materials and this chapter's content in scope.</p>`

  return `
    <section class="rail-card chat-panel${workspace ? ' chat-panel-workspace' : ''}" data-chat-key="${course.id}/${chapter.id}">
      <header class="chat-panel-context">
        <div><h4>Tutor</h4><small class="rail-meta">Grounded in ${course.code} course material · focused on Ch ${chapter.id}</small></div>
        <small class="ai-allowance">${aiAllowance('chat')}</small>
      </header>
      <div class="chat-messages">${messagesHtml}</div>
      ${chat.sending ? '<div class="chat-thinking">Checking the course material…</div>' : ''}
      <form class="chat-form" data-chat-form="${course.id}/${chapter.id}">
        <textarea class="chat-input" data-chat-input="${course.id}/${chapter.id}" placeholder="Ask: 'Why does Dijkstra fail with negative edges?'" rows="2" ${chat.sending ? 'disabled' : ''}>${escapeHtml(chat.draft || '')}</textarea>
        <div class="chat-actions">
          <button type="submit" class="chat-send" ${chat.sending ? 'disabled' : ''}>${chat.sending ? 'Sending…' : 'Send'}</button>
          ${chat.messages.length ? `<button type="button" class="chat-clear" data-chat-clear="${course.id}/${chapter.id}">Clear history</button>` : ''}
        </div>
      </form>
    </section>
  `
}

async function sendChat(courseId, chapterId) {
  const key = chatKey(courseId, chapterId)
  const chat = getChat(courseId, chapterId)
  const text = (chat.draft || '').trim()
  if (!text || chat.sending) return

  const prevMessages = chat.messages.slice()
  chat.messages.push({ role: 'user', content: text })
  chat.draft = ''
  chat.sending = true
  chatState.set(key, chat)
  persistChat(courseId, chapterId)
  render()

  try {
    const data = await fetchJson('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, chapterId, messages: prevMessages, userMessage: text })
    })
    chat.messages.push({ role: 'assistant', content: data.reply })
    aiUsage = data.usage || aiUsage
  } catch (err) {
    if (err.usage) aiUsage = err.usage
    chat.messages.push({ role: 'assistant', content: `_Chat failed: ${err.message}_` })
  }
  chat.sending = false
  chatState.set(key, chat)
  persistChat(courseId, chapterId)
  render()
  // scroll messages to bottom
  setTimeout(() => {
    const m = document.querySelector('.chat-messages')
    if (m) m.scrollTop = m.scrollHeight
  }, 80)
}

function clearChat(courseId, chapterId) {
  if (!confirm('Clear tutor chat history for this chapter?')) return
  const key = chatKey(courseId, chapterId)
  chatState.set(key, { messages: [], sending: false, draft: '' })
  try { localStorage.removeItem(`chat:${key}`) } catch {}
  render()
}

function renderRailItem(course, item) {
  return `
    <li class="rail-item ${isDone(item) ? 'done' : ''}">
      <a href="#/course/${course.id}/item/${item.id}" class="rail-item-link">
        <strong>${item.title}</strong>
        <small>${item.type} · Priority ${item.priority}</small>
      </a>
      ${renderMasteryPicker(item, 'compact')}
    </li>
  `
}

function getQuestionNav(courseId, chapterId) {
  const key = `${courseId}/${chapterId}`
  if (!questionNav.has(key)) questionNav.set(key, { index: 0 })
  return questionNav.get(key)
}

function typeCounts(questions) {
  const counts = { written: 0, calc: 0, tf: 0, mc: 0, multi: 0, pseudocode: 0 }
  for (const q of questions) {
    const type = normalizeQuestionType(q?.type)
    if (counts[type] != null) counts[type]++
  }
  return counts
}

function normalizeQuestionType(type) {
  return QUESTION_TYPE_LABELS[type] ? type : 'written'
}

function normalizeDifficulty(difficulty) {
  return ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium'
}

function renderQuestionsPanel(course, chapter) {
  const key = `${course.id}/${chapter.id}`
  const cstate = questionsCache.get(key)
  if (cstate === undefined) {
    return `
      <div class="panel-head"><div><h2>Practice questions</h2></div></div>
      <p>Published self-tests and worked drills for this chapter, with optional personal extra exercises.</p>
      <div class="loader">Loading the published question bank…</div>
    `
  }
  if (cstate.loading) {
    return `
      <div class="panel-head"><div><h2>Practice questions</h2></div></div>
      <div class="loader">Loading the published question bank…</div>
    `
  }
  if (cstate.error) {
    return `
      <div class="panel-head"><div><h2>Practice questions</h2></div></div>
      <div class="loader error">${escapeHtml(cstate.error)}</div>
      <div class="empty-actions">
        <button type="button" class="load-q-btn" data-extend-open="${course.id}/${chapter.id}">Request extra exercises</button>
        <button type="button" class="tb-btn" data-load-questions="${course.id}/${chapter.id}">Retry published bank</button>
      </div>
    `
  }

  const questions = cstate.questions || []
  if (!questions.length) {
    return `
      <div class="panel-head"><div><h2>Practice questions</h2></div></div>
      <div class="empty-state compact"><strong>No published exercises yet</strong><p>You can still request a small personal set based on this chapter.</p></div>
      <button type="button" class="load-q-btn" data-extend-open="${course.id}/${chapter.id}">Request extra exercises</button>
    `
  }
  const filtered = questions.filter((q) => {
    if (questionFilter.types.length && !questionFilter.types.includes(q.type)) return false
    if (questionFilter.sources.length) {
      const sourceTag = q.id.startsWith('extra-') ? 'extra' : 'kb'
      if (!questionFilter.sources.includes(sourceTag)) return false
    }
    return true
  })

  const nav = getQuestionNav(course.id, chapter.id)
  if (nav.index >= filtered.length) nav.index = 0
  const current = filtered[nav.index]
  const counts = typeCounts(questions)

  // Original index of the current question in the unfiltered list — Q numbers
  // stay STABLE regardless of filter selection.
  const currentOrigIndex = current ? questions.indexOf(current) : -1

  const typeStrip = Object.entries(QUESTION_TYPE_LABELS).map(([k, label]) => {
    const count = counts[k] ?? 0
    return `
    <span class="type-pip type-${k} ${count === 0 ? 'zero' : ''}" title="${label}: ${count} question${count === 1 ? '' : 's'}">${label.charAt(0)}<small>${count}</small></span>
  `
  }).join('')

  // Custom multi-select dropdowns for Type + Source filters
  const typeOptionsList = Object.keys(QUESTION_TYPE_LABELS).map((t) => ({ value: t, label: QUESTION_TYPE_LABELS[t] }))
  const sourceOptionsList = [{ value: 'kb', label: 'Published' }, { value: 'extra', label: 'My extras' }]

  return `
    <div class="panel-head q-panel-head">
      <div>
        <h2>Practice questions <small>(${filtered.length} of ${questions.length})</small></h2>
        <div class="type-strip">${typeStrip}</div>
      </div>
      <div class="q-toolbar">
        ${renderMultiSelect('types', 'All types', typeOptionsList)}
        ${renderMultiSelect('sources', 'All sources', sourceOptionsList)}
        <button type="button" class="tb-btn tb-btn-primary" data-extend-open="${course.id}/${chapter.id}" title="Request personal exercises based on this chapter">${uiIcon('plus')} Extra exercises</button>
        <button type="button" class="tb-btn clear-link" data-clear-scope="self-test" data-clear-course="${course.id}" data-clear-chapter="${chapter.id}" data-clear-course-name="${escapeHtml(course.name)}" title="Clear all your self-test answers, grades, and revealed answers for this chapter">Clear answers</button>
        ${renderToolbarMore(course, chapter)}
      </div>
    </div>

    ${filtered.length ? `
      ${renderProgressTracker(filtered, nav, course, chapter, questions)}
      <div class="q-pager">
        <button type="button" class="q-nav-btn" data-q-nav="prev" ${nav.index === 0 ? 'disabled' : ''}>← Previous</button>
        <span class="q-pager-pos">Question <strong>Q${currentOrigIndex + 1}</strong> of ${questions.length}</span>
        <button type="button" class="q-nav-btn" data-q-nav="random">${uiIcon('shuffle')} Random</button>
        <button type="button" class="q-nav-btn primary" data-q-nav="next" ${nav.index >= filtered.length - 1 ? 'disabled' : ''}>Next →</button>
      </div>
      <div class="single-question">
        ${renderQuestionCard(current, currentOrigIndex, course, chapter)}
      </div>
    ` : '<p class="empty">No questions match the current filters.</p>'}
  `
}

// ----- Progress tracker (one color-coded cell per question) -----
// Class buckets:
//   unanswered  — no attempt
//   low         — score < 5/10
//   mid         — 5 ≤ score < 7
//   good        — 7 ≤ score < 9
//   great       — score ≥ 9
function renderProgressTracker(filtered, nav, course, chapter, allQuestions) {
  const stats = filtered.map((q, i) => {
    const origIndex = allQuestions.indexOf(q)
    const key = `${course.id}/${chapter.id}/${q.id}`
    const att = attemptState.get(key) || {}
    const score = typeof att.score === 'number' ? att.score : null
    let bucket = 'unanswered'
    if (score != null) {
      if (score < 5) bucket = 'low'
      else if (score < 7) bucket = 'mid'
      else if (score < 9) bucket = 'good'
      else bucket = 'great'
    }
    return { i, origIndex, q, score, bucket }
  })
  const answered = stats.filter((s) => s.score != null)
  const avg = answered.length ? answered.reduce((a, s) => a + s.score, 0) / answered.length : null
  return `
    <div class="q-progress">
      <div class="q-progress-meta">
        <p class="eyebrow">Progress</p>
        <p class="q-progress-line">
          <strong>${answered.length}</strong> of <strong>${filtered.length}</strong> answered
          ${avg != null ? ` · avg <strong>${avg.toFixed(1)}</strong>/10` : ''}
        </p>
      </div>
      <div class="q-progress-bar" role="navigation" aria-label="Question progress">
        ${stats.map((s) => {
          const label = s.origIndex + 1
          const tip = s.score == null ? `Q${label}: not answered` : `Q${label}: ${s.score}/10`
          const isCurrent = s.i === nav.index
          return `<button type="button" class="q-progress-cell q-progress-${s.bucket} ${isCurrent ? 'is-current' : ''}" data-q-progress-jump="${s.i}" title="${tip}">${label}</button>`
        }).join('')}
      </div>
      <div class="q-progress-legend">
        <span class="q-legend-item"><span class="q-legend-swatch q-progress-unanswered"></span>Not yet</span>
        <span class="q-legend-item"><span class="q-legend-swatch q-progress-low"></span>&lt;5</span>
        <span class="q-legend-item"><span class="q-legend-swatch q-progress-mid"></span>5-7</span>
        <span class="q-legend-item"><span class="q-legend-swatch q-progress-good"></span>7-9</span>
        <span class="q-legend-item"><span class="q-legend-swatch q-progress-great"></span>9-10</span>
      </div>
    </div>
  `
}

function renderQuestionCard(q, index, course, chapter) {
  q = { ...q, type: normalizeQuestionType(q.type), difficulty: normalizeDifficulty(q.difficulty) }
  const attemptKey = `${course.id}/${chapter.id}/${q.id}`
  const att = attemptState.get(attemptKey) || {}
  const grade = att.correction || ''
  const grading = att.grading
  const showAnswer = att.showAnswer

  let input = ''
  if (q.type === 'tf') {
    input = `
      <div class="q-options">
        ${['True', 'False'].map((v) => `<label><input type="radio" name="att-${q.id}" value="${v}" ${att.value === v ? 'checked' : ''} data-attempt="${attemptKey}"> ${v}</label>`).join('')}
      </div>
      <textarea class="q-input" placeholder="(Optional) explain your reasoning" data-attempt="${attemptKey}-note">${escapeHtml(att.note || '')}</textarea>
    `
  } else if (q.type === 'mc' && q.options?.length) {
    input = `
      <div class="q-options">
        ${q.options.map((opt, i) => `<label><input type="radio" name="att-${q.id}" value="${escapeHtml(opt)}" ${att.value === opt ? 'checked' : ''} data-attempt="${attemptKey}"> ${renderInlineMarkdown(opt)}</label>`).join('')}
      </div>
    `
  } else if (q.type === 'multi' && q.options?.length) {
    const selected = String(att.value || '').split('\n').map((x) => x.trim()).filter(Boolean)
    input = `
      <div class="q-options">
        ${q.options.map((opt) => `<label><input type="checkbox" value="${escapeHtml(opt)}" ${selected.includes(opt) ? 'checked' : ''} data-attempt="${attemptKey}"> ${renderInlineMarkdown(opt)}</label>`).join('')}
      </div>
    `
  } else if (q.type === 'pseudocode') {
    const lang = att.codeLang || 'pseudocode'
    input = `
      <div class="attempt-drop code-attempt" data-attempt-drop="${attemptKey}">
        <div class="code-editor-toolbar">
          <label class="code-lang-label">Language
            <select class="code-lang-select" data-code-lang-select="${attemptKey}">
              <option value="pseudocode"${lang === 'pseudocode' ? ' selected' : ''}>Pseudocode</option>
              <option value="c"${lang === 'c' ? ' selected' : ''}>C / C++</option>
              <option value="asm"${lang === 'asm' ? ' selected' : ''}>Assembly (ARM / GAS)</option>
            </select>
          </label>
        </div>
        <textarea class="q-input code cm-target" placeholder="Write your answer…" data-attempt="${attemptKey}" data-code-lang="${lang}">${escapeHtml(att.value || '')}</textarea>
      </div>
    `
  } else {
    input = `
      <div class="attempt-drop" data-attempt-drop="${attemptKey}">
        <textarea class="q-input" placeholder="Write your answer…" data-attempt="${attemptKey}">${escapeHtml(att.value || '')}</textarea>
      </div>
    `
  }

  return `
    <li class="question-card" id="q-${q.id}">
      <div class="q-head">
        <div class="q-head-left">
          <span class="q-num">Q${index + 1}</span>
          <span class="q-type">${QUESTION_TYPE_LABELS[q.type] || q.type}</span>
          <span class="q-diff diff-${q.difficulty}">${q.difficulty}</span>
          <span class="q-source">${escapeHtml(q.source || 'Practice')}</span>
        </div>
        ${q.id.startsWith('extra-') ? `<button type="button" class="q-delete" data-q-delete="${course.id}/${chapter.id}/${q.id}" title="Remove this personal extra exercise" aria-label="Remove exercise">${uiIcon('close')}</button>` : ''}
      </div>
      <div class="q-body">${renderInlineMarkdown(q.question)}</div>
      ${input}
      <div class="q-actions">
        <button type="button" class="btn btn-primary" data-grade="${attemptKey}" ${grading ? 'disabled' : ''}>${grading ? 'Checking…' : 'Check answer'}</button>
        <button type="button" class="btn btn-ghost" data-reveal="${attemptKey}">${showAnswer ? 'Hide answer' : 'Reveal answer'}</button>
        ${srButtonHtml(q.id)}
        <button type="button" class="btn btn-ghost clear-link" data-clear-scope="question" data-clear-course="${course.id}" data-clear-chapter="${chapter.id}" data-clear-question="${q.id}" title="Clear your answer and grade for this question">Clear answer</button>
      </div>
      ${grade ? `<div class="q-grade">${renderCorrectionMarkdown(grade, att.score, 10)}</div>` : ''}
      ${showAnswer && q.expected ? `<div class="q-expected"><strong>Reference answer:</strong>${renderMarkdown(q.expected)}</div>` : ''}
    </li>
  `
}

function renderMistakesPage() {
  if (!mistakeCache) loadMistakes().then(() => render())
  const items = mistakeCache?.items || []
  if (mistakeCache?.loading) return '<section class="page-wrap"><div class="loader">Loading mistakes…</div></section>'
  const grouped = {}
  for (const m of items) {
    const key = `${m.courseId}/${m.chapterId || 'misc'}`
    grouped[key] = grouped[key] || []
    grouped[key].push(m)
  }
  return `
    <section class="page-wrap">
      <header class="page-hero">
        <p class="eyebrow">Practice</p>
        <h1>Mistake bank</h1>
        <p class="hero-copy">Every graded attempt that scored below 7/10. Review them; retry; mark resolved once you've internalised the correction. ${items.length} open.</p>
      </header>
      ${items.length === 0 ? '<p class="empty">No open mistakes. Incorrect attempts will appear here after you grade them.</p>' : ''}
      ${Object.entries(grouped).map(([key, list]) => {
        const [courseId, chapterId] = key.split('/')
        const course = state.courses.find((c) => c.id === courseId)
        const chapter = course?.chapters?.find((c) => c.id === chapterId)
        return `
          <section class="mistake-group">
            <h2>${course?.code || courseId} ${course?.shortName ? '· ' + course.shortName : ''}${chapter ? ' / Ch ' + chapter.id + ' · ' + chapter.name : ''} <small>(${list.length})</small></h2>
            ${list.map(renderMistakeCard).join('')}
          </section>
        `
      }).join('')}
    </section>
  `
}

function renderMistakeCard(m) {
  return `
    <article class="mistake-card">
      <div class="mistake-head">
        <span class="q-type">${QUESTION_TYPE_LABELS[m.type] || m.type}</span>
        ${m.difficulty ? `<span class="q-diff diff-${m.difficulty}">${m.difficulty}</span>` : ''}
        <span class="mistake-score">Score ${m.score}/10</span>
        <span class="mistake-source">${escapeHtml(m.source || 'Practice')}</span>
        <span class="mistake-when">${relativeTime(m.createdAt)}</span>
      </div>
      <div class="mistake-question">${renderInlineMarkdown(m.question)}</div>
      <details>
        <summary>Your attempt</summary>
        <pre class="mistake-attempt">${escapeHtml(m.attempt || '')}</pre>
      </details>
      <details open>
        <summary>Correction</summary>
        <div class="q-grade">${renderCorrectionMarkdown(m.correction || '', m.score, 10)}</div>
      </details>
      ${m.expected ? `<details><summary>Reference</summary><div class="q-expected">${renderMarkdown(m.expected)}</div></details>` : ''}
      <div class="mistake-actions">
        ${srButtonHtml(m.questionId)}
        <button type="button" class="mistake-resolve" data-resolve-mistake="${m.id}">Mark resolved</button>
        <button type="button" class="mistake-delete" data-delete-mistake="${m.id}">Delete</button>
      </div>
    </article>
  `
}

const srSession = { current: null, queue: [], totalDue: 0, totalCards: 0, reveal: false }

async function refreshSr() {
  const data = await loadSrDue(true)
  srSession.queue = data.due || []
  srSession.totalDue = data.dueCount || 0
  srSession.totalCards = data.totalCards || 0
  srSession.current = srSession.queue.shift() || null
  srSession.reveal = false
  render()
}

function interleavePracticeQuestions(questions) {
  const groups = new Map()
  for (const question of questions) {
    if (!groups.has(question.courseId)) groups.set(question.courseId, [])
    groups.get(question.courseId).push(question)
  }
  const queues = [...groups.values()]
  const mixed = []
  let remaining = true
  while (remaining) {
    remaining = false
    for (const queue of queues) {
      if (!queue.length) continue
      mixed.push(queue.shift())
      remaining = true
    }
  }
  return mixed
}

let loadingRequestId = 0
const LOAD_STEP_COUNT = 3

function renderLoadingSurface({ className, title, detail, phase, step = 1 }) {
  const safeStep = Math.max(1, Math.min(LOAD_STEP_COUNT, Number(step) || 1))
  const progress = Math.round((safeStep / LOAD_STEP_COUNT) * 100)
  return `<div class="${className}" role="status" aria-live="polite">
    <span class="load-spinner" aria-hidden="true"></span>
    <strong>${escapeHtml(title)}</strong>
    <small>${escapeHtml(phase || detail)}</small>
    <div class="load-progress" role="progressbar" aria-label="${escapeHtml(title)}" aria-valuemin="1" aria-valuemax="${LOAD_STEP_COUNT}" aria-valuenow="${safeStep}"><i style="width:${progress}%"></i></div>
    <p>${escapeHtml(detail)}</p>
  </div>`
}

function practiceLoadingMarkup() {
  const loading = practiceCache?.loading ? practiceCache : { phase: 'Connecting to your workspace…', step: 1 }
  return `<section class="page-wrap practice-hub">${renderLoadingSurface({
    className: 'practice-page-loading',
    title: 'Opening Practice',
    detail: 'Published questions only—nothing is generated when this page opens.',
    phase: loading.phase,
    step: loading.step
  })}</section>`
}

async function loadPractice({ force = false } = {}) {
  if (practiceCache?.loading && !force) return
  const requestId = ++loadingRequestId
  practiceCache = { loading: true, requestId, phase: 'Connecting to your workspace…', step: 1 }
  render()
  const phaseTimers = [
    setTimeout(() => {
      if (!practiceCache?.loading || practiceCache.requestId !== requestId) return
      practiceCache = { ...practiceCache, phase: 'Downloading published question banks…', step: 2 }
      render()
    }, 900),
    setTimeout(() => {
      if (!practiceCache?.loading || practiceCache.requestId !== requestId) return
      practiceCache = { ...practiceCache, phase: 'Preparing the first exercise…', step: 3 }
      render()
    }, 3500)
  ]
  try {
    const data = await fetchJson('/api/practice', { timeoutMs: 12000 })
    const questions = interleavePracticeQuestions(data.questions || [])
    practiceCache = { ...data, questions }

    // Reuse the existing attempt and grading pipeline. Practice is only a new
    // way to traverse the same published banks, not a duplicate answer store.
    const grouped = new Map()
    for (const question of questions) {
      const key = `${question.courseId}/${question.chapterId}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push(question)
    }
    for (const [key, bank] of grouped) {
      if (!questionsCache.has(key)) questionsCache.set(key, { questions: bank })
    }
  } catch (error) {
    practiceCache = { error: error.message, questions: [], courses: [] }
  } finally {
    phaseTimers.forEach(clearTimeout)
  }
  render()
}

function renderPracticePage() {
  if (!practiceCache) {
    setTimeout(() => loadPractice(), 0)
    return practiceLoadingMarkup()
  }
  if (practiceCache.loading) {
    return practiceLoadingMarkup()
  }
  if (practiceCache.error) {
    return `<section class="page-wrap practice-hub"><div class="practice-page-error"><strong>Practice could not be loaded</strong><p>${escapeHtml(practiceCache.error)}</p><button type="button" class="btn btn-primary" data-practice-retry>Try again</button></div></section>`
  }

  const allQuestions = practiceCache.questions || []
  const visible = practiceView.courseId === 'all'
    ? allQuestions
    : allQuestions.filter((question) => question.courseId === practiceView.courseId)
  if (practiceView.index >= visible.length) practiceView.index = 0
  const current = visible[practiceView.index]
  const answered = visible.filter((question) => {
    const attempt = attemptState.get(`${question.courseId}/${question.chapterId}/${question.id}`)
    return typeof attempt?.score === 'number'
  }).length
  const currentCourse = current ? state.courses.find((course) => course.id === current.courseId) : null
  const currentChapter = currentCourse?.chapters?.find((chapter) => chapter.id === current.chapterId)

  return `
    <section class="page-wrap practice-hub">
      <header class="practice-hub-header">
        <div>
          <p class="eyebrow">Practice</p>
          <h1>One queue. Every active course.</h1>
          <p>Work through existing published exercises in a balanced mix. Nothing is generated when you open or continue this queue.</p>
        </div>
        <div class="practice-hub-stat" aria-label="Practice progress"><strong>${answered}</strong><span>answered in this view</span><small>${visible.length} available</small></div>
      </header>

      <nav class="practice-mode-nav" aria-label="Practice modes">
        <a class="active" href="#/practice" aria-current="page">Questions</a>
        <a href="#/mistakes">Mistakes</a>
        <a href="#/mocks">Timed mocks</a>
        <a href="#/sr">Flashcards <small>${srDueCache?.dueCount ? `${srDueCache.dueCount} due` : ''}</small></a>
      </nav>

      <div class="practice-course-filter" role="group" aria-label="Choose courses">
        <button type="button" class="${practiceView.courseId === 'all' ? 'active' : ''}" data-practice-course="all">All courses <span>${allQuestions.length}</span></button>
        ${(practiceCache.courses || []).map((course) => `<button type="button" class="${practiceView.courseId === course.id ? 'active' : ''}" data-practice-course="${course.id}" style="--course-accent:${course.accent || 'var(--color-brand)'}">${escapeHtml(course.code)} <span>${course.questionCount}</span></button>`).join('')}
      </div>

      ${current && currentCourse && currentChapter ? `
        <section class="practice-queue" style="--accent:${currentCourse.accent || 'var(--color-brand)'}">
          <div class="practice-queue-context">
            <div><span>${escapeHtml(currentCourse.code)} · Ch ${escapeHtml(currentChapter.id)}</span><strong>${escapeHtml(currentChapter.name)}</strong></div>
            <a href="#/course/${currentCourse.id}/chapter/${currentChapter.id}">Open chapter</a>
          </div>
          <div class="practice-queue-pager">
            <button type="button" data-practice-queue-nav="prev" ${practiceView.index === 0 ? 'disabled' : ''}>${ICONS.back}<span>Previous</span></button>
            <p><strong>${practiceView.index + 1}</strong> / ${visible.length}</p>
            <button type="button" data-practice-queue-nav="random">${uiIcon('shuffle')}<span>Shuffle</span></button>
            <button type="button" class="primary" data-practice-queue-nav="next" ${practiceView.index >= visible.length - 1 ? 'disabled' : ''}><span>Next</span>${uiIcon('chevronRight')}</button>
          </div>
          <div class="practice-queue-question">${renderQuestionCard(current, current.chapterQuestionIndex ?? practiceView.index, currentCourse, currentChapter)}</div>
        </section>
      ` : `
        <div class="empty-state practice-empty"><strong>No published questions in this selection</strong><p>Choose another active course, or open a chapter to request personal extra exercises.</p></div>
      `}
    </section>
  `
}

function renderSrPage() {
  if (!srSession.totalCards && !srSession.current && srDueCache == null) {
    refreshSr()
    return '<section class="page-wrap"><div class="loader">Loading flashcards…</div></section>'
  }
  if (srDueCache && !srSession.current && srSession.queue.length === 0) {
    // initialize once after first load
    if (!srSession._init) {
      srSession._init = true
      refreshSr()
      return '<section class="page-wrap"><div class="loader">Loading flashcards…</div></section>'
    }
  }
  const c = srSession.current
  return `
    <section class="page-wrap sr-page">
      <header class="page-hero">
        <p class="eyebrow">Spaced repetition · SM-2</p>
        <h1>Flashcards</h1>
        <p class="hero-copy">${srSession.totalDue} due · ${srSession.totalCards} total in deck. Reveal the answer, then rate how well you recalled it from 0 (blackout) to 5 (perfect).</p>
      </header>
      ${!c ? `
        <div class="sr-empty">
          <h2>${srSession.totalCards === 0 ? 'Your deck is empty.' : 'Nothing due right now.'}</h2>
          <p>${srSession.totalCards === 0 ? 'Open any chapter, load practice questions, and click "+ Add to flashcards" on the ones you want to drill.' : 'Come back later, or add more cards from your practice questions.'}</p>
          <a class="btn btn-primary" href="#/courses">Browse courses</a>
        </div>
      ` : `
        <article class="sr-card-view">
          <div class="sr-meta">
            <span class="sr-course">${c.courseId} · Ch ${c.chapterId}</span>
            <span class="q-type">${QUESTION_TYPE_LABELS[c.question.type] || c.question.type}</span>
            ${c.question.difficulty ? `<span class="q-diff diff-${c.question.difficulty}">${c.question.difficulty}</span>` : ''}
            <span class="sr-stats">Reps ${c.card.repetitions} · Ease ${c.card.ease.toFixed(2)} · Interval ${c.card.interval}d</span>
            <button type="button" class="sr-remove-btn" data-sr-remove="${c.id}" title="Remove this card from your flashcard deck. The source question is not affected.">✕ Remove from deck</button>
          </div>
          <div class="sr-question">${renderInlineMarkdown(c.question.question)}</div>
          ${c.question.options?.filter((o) => String(o || '').trim()).length ? `<ul class="sr-options">${c.question.options.filter((o) => String(o || '').trim()).map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ul>` : ''}
          ${srSession.reveal ? `
            <div class="sr-answer">
              <h4>Answer</h4>
              ${renderMarkdown(c.question.expected || '')}
            </div>
            <div class="sr-rate">
              <p>How well did you recall?</p>
              <div class="sr-rate-buttons">
                ${[0,1,2,3,4,5].map((q) => `<button type="button" class="sr-q-btn sr-q-${q}" data-sr-rate="${q}">${q}<small>${['blackout','wrong','almost','difficult','hesitant','perfect'][q]}</small></button>`).join('')}
              </div>
            </div>
          ` : `
            <div class="sr-actions">
              <button type="button" class="load-q-btn" data-sr-reveal>Show answer</button>
              <button type="button" class="q-reveal" data-sr-skip>Skip for now</button>
            </div>
          `}
        </article>
      `}
    </section>
  `
}

async function rateSr(quality) {
  if (!srSession.current) return
  const c = srSession.current
  try {
    await fetchJson('/api/sr/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: c.id, quality })
    })
  } catch (e) { console.error('SR review failed', e) }
  // pop next; refresh due count
  srSession.current = srSession.queue.shift() || null
  srSession.reveal = false
  if (!srSession.current) await refreshSr()
  else render()
}

function renderMocksPage() {
  if (!window.__mockListCache) {
    window.__mockListCache = { loading: true }
    fetchJson('/api/mocks').then((sessions) => { window.__mockListCache = { sessions }; render() }).catch((e) => { window.__mockListCache = { error: e.message, sessions: [] }; render() })
  }
  if (route.sessionId) return renderMockResult(route.sessionId)
  const cache = window.__mockListCache
  const sessions = cache?.sessions || []
  return `
    <section class="page-wrap">
      <header class="page-hero">
        <p class="eyebrow">Practice</p>
        <h1>Mini-mock sessions</h1>
        <p class="hero-copy">Timed practice on a chapter's question set with batch grading. Start a new mock from any chapter's questions panel.</p>
      </header>
      ${cache?.loading ? '<div class="loader">Loading…</div>' : sessions.length === 0 ? `
        <div class="mocks-empty">
          <h3>No sessions yet</h3>
          <p>Pick a chapter to drill — click the chapter, scroll to <strong>Practice questions</strong>, then hit <strong>▶ Start mini-mock</strong>.</p>
          <div class="mocks-empty-grid">
            ${state.courses.map((course) => `
              <div class="mocks-empty-course">
                <strong>${course.code} ${course.shortName ? '· ' + course.shortName : ''}</strong>
                <ul>
                  ${(course.chapters || []).filter((c) => c.file.endsWith('.md')).slice(0, 8).map((ch) => `
                    <li><a href="#/course/${course.id}/chapter/${ch.id}">Ch ${ch.id} · ${ch.name}</a></li>
                  `).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <table class="mocks-table">
          <thead><tr><th>Date</th><th>Course / Chapter</th><th>Questions</th><th>Score</th><th>Duration</th><th></th></tr></thead>
          <tbody>${sessions.map((s) => {
            const course = state.courses.find((c) => c.id === s.courseId)
            const chapter = course?.chapters?.find((c) => c.id === s.chapterId)
            return `
              <tr>
                <td>${new Date(s.submittedAt).toLocaleString()}</td>
                <td>${course?.code || s.courseId}${chapter ? ' · Ch ' + chapter.id + ' ' + chapter.name : ''}</td>
                <td>${s.count}</td>
                <td><strong>${s.totalScore?.toFixed(1) ?? '—'}/${s.totalMax}</strong></td>
                <td>${Math.round((s.duration || 0) / 60)} min</td>
                <td><a href="#/practice/mocks/${s.id}">Review →</a></td>
              </tr>
            `
          }).join('')}</tbody>
        </table>
      `}
    </section>
  `
}

const _mockResultCache = new Map()

function renderMockResult(sessionId) {
  if (!_mockResultCache.has(sessionId)) {
    _mockResultCache.set(sessionId, { loading: true })
    fetchJson(`/api/mocks/${encodeURIComponent(sessionId)}`).then((s) => { _mockResultCache.set(sessionId, { session: s }); render() }).catch((e) => { _mockResultCache.set(sessionId, { error: e.message }); render() })
  }
  const c = _mockResultCache.get(sessionId)
  if (c?.loading) return '<section class="page-wrap"><div class="loader">Loading session…</div></section>'
  if (c?.error) return `<section class="page-wrap"><div class="loader error">${escapeHtml(c.error)}</div></section>`
  const s = c.session
  const course = state.courses.find((c) => c.id === s.courseId)
  const chapter = course?.chapters?.find((c) => c.id === s.chapterId)
  return `
    <section class="page-wrap">
      <header class="page-hero">
        <p class="eyebrow"><a href="#/mocks">← All sessions</a></p>
        <h1>Mini-mock · ${course?.code || s.courseId}${chapter ? ' · Ch ' + chapter.id : ''}</h1>
        <p class="hero-copy">${new Date(s.submittedAt).toLocaleString()} · ${s.questions.length} questions · ${Math.round((s.duration || 0)/60)} min · <strong>${s.totalScore?.toFixed(1) ?? '—'}/${s.totalMax}</strong></p>
      </header>
      <ol class="question-list">
        ${s.questions.map((q, i) => `
          <li class="question-card">
            <div class="q-head">
              <span class="q-num">Q${i+1}</span>
              <span class="q-type">${QUESTION_TYPE_LABELS[q.type] || q.type}</span>
              <span class="mistake-score">${q.score?.toFixed(1) ?? '—'}/10</span>
            </div>
            <div class="q-body">${renderInlineMarkdown(q.question)}</div>
            <details>
              <summary>Your answer</summary>
              <pre class="mistake-attempt">${escapeHtml(q.attempt || '')}</pre>
            </details>
            <details open>
              <summary>Correction</summary>
              <div class="q-grade">${renderCorrectionMarkdown(q.correction || '', q.score, 10)}</div>
            </details>
          </li>
        `).join('')}
      </ol>
    </section>
  `
}

// ----- Mini-mock active session -----

function startMiniMock(courseId, chapterId, opts = {}) {
  const key = `${courseId}/${chapterId}`
  const cstate = questionsCache.get(key)
  if (!cstate?.questions || cstate.questions.length === 0) {
    alert('Load practice questions first.')
    return
  }
  const n = Math.min(opts.n || 5, cstate.questions.length)
  const minutes = opts.minutes || 15
  // sample without replacement, preferring type diversity
  const pool = cstate.questions.slice()
  const sample = []
  while (sample.length < n && pool.length) {
    const idx = Math.floor(Math.random() * pool.length)
    sample.push(pool.splice(idx, 1)[0])
  }
  mockSession.active = {
    courseId, chapterId,
    questions: sample,
    answers: {},
    attemptImages: {},
    startedAt: Date.now(),
    durationMs: minutes * 60_000,
    phase: 'taking',
    results: null,
    currentIndex: 0
  }
  if (mockTimerInterval) clearInterval(mockTimerInterval)
  mockTimerInterval = setInterval(() => {
    if (!mockSession.active || mockSession.active.phase !== 'taking') return
    if (Date.now() - mockSession.active.startedAt >= mockSession.active.durationMs) {
      clearInterval(mockTimerInterval); mockTimerInterval = null
      submitMiniMock()
    } else {
      // re-render timer
      const el = document.querySelector('.mock-timer-readout')
      if (el) el.textContent = mockTimeRemainingLabel()
    }
  }, 1000)
  render()
}

let mockTimerInterval = null

function mockTimeRemainingLabel() {
  if (!mockSession.active) return ''
  const ms = Math.max(0, mockSession.active.durationMs - (Date.now() - mockSession.active.startedAt))
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60), ss = (s % 60).toString().padStart(2, '0')
  return `${m}:${ss}`
}

async function submitMiniMock() {
  if (!mockSession.active) return
  const m = mockSession.active
  m.phase = 'grading'
  render()
  const course = state.courses.find((c) => c.id === m.courseId)
  const chapter = course?.chapters?.find((c) => c.id === m.chapterId)
  const graded = []
  for (const q of m.questions) {
    const att = m.answers[q.id] || ''
    const imgs = (m.attemptImages && m.attemptImages[q.id]) || []
    if (!att.trim() && imgs.length === 0) { graded.push({ ...q, attempt: '', correction: '_No answer provided._', score: 0 }); continue }
    try {
      const data = await fetchJson('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseCode: course.code, chapterName: chapter?.name || 'mock', question: q, attempt: att, attemptImages: imgs, _meta: { courseId: m.courseId, chapterId: m.chapterId } })
      })
      graded.push({ ...q, attempt: att, attemptImages: imgs, correction: data.correction, score: data.score ?? 0 })
    } catch (e) {
      graded.push({ ...q, attempt: att, attemptImages: imgs, correction: `_Grading failed: ${e.message}_`, score: 0 })
    }
  }
  const totalScore = graded.reduce((s, q) => s + (q.score || 0), 0)
  const session = {
    id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    courseId: m.courseId,
    chapterId: m.chapterId,
    startedAt: new Date(m.startedAt).toISOString(),
    submittedAt: new Date().toISOString(),
    duration: Math.round((Date.now() - m.startedAt) / 1000),
    questions: graded,
    totalScore,
    totalMax: graded.length * 10
  }
  await fetchJson('/api/mocks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session) })
  window.__mockListCache = null
  mistakeCache = null
  m.phase = 'done'
  m.results = session
  render()
}

function cancelMiniMock() {
  if (mockTimerInterval) { clearInterval(mockTimerInterval); mockTimerInterval = null }
  mockSession.active = null
  render()
}

function renderExtendModal() {
  if (!extendModal.open) return ''
  const [cid, chid] = extendModal.open.split('/')
  const course = state.courses.find((c) => c.id === cid)
  const chapter = course?.chapters?.find((c) => c.id === chid)
  const allTypes = ['written', 'calc', 'tf', 'mc', 'pseudocode']

  return `
    <div class="mock-overlay" data-extend-overlay>
      <div class="mock-panel" role="dialog" aria-modal="true" aria-labelledby="extend-dialog-title" style="max-width:560px">
        <h2 id="extend-dialog-title">Request extra exercises</h2>
        <p class="rail-meta">${course?.code || cid} ${course?.shortName ? '· ' + course.shortName : ''}${chapter ? ' / Ch ' + chapter.id + ' · ' + chapter.name : ''}</p>
        <p class="ai-allowance">${aiAllowance('exercises')}</p>

        ${extendModal.generating ? `
          <div class="loader">Preparing ${extendModal.count} personal exercises from this chapter…</div>
        ` : `
          ${extendModal.error ? `<div class="loader error">${escapeHtml(extendModal.error)}</div>` : ''}

          <fieldset class="extend-field">
            <legend>Question types</legend>
            <div class="extend-types">
              ${allTypes.map((t) => `
                <label class="extend-type-chk">
                  <input type="checkbox" data-extend-type="${t}" ${extendModal.types.includes(t) ? 'checked' : ''}>
                  <span>${QUESTION_TYPE_LABELS[t]}</span>
                </label>
              `).join('')}
            </div>
            <small class="rail-meta">Leave all unchecked = mix all five.</small>
          </fieldset>

          <fieldset class="extend-field">
            <legend>How many</legend>
            <div class="extend-counts">
              ${[3, 5, 8, 12, 16, 24].map((n) => `
                <label class="extend-count-radio">
                  <input type="radio" name="extend-count" data-extend-count="${n}" ${extendModal.count === n ? 'checked' : ''}>
                  <span>${n}</span>
                </label>
              `).join('')}
            </div>
          </fieldset>

          <fieldset class="extend-field">
            <legend>Custom guidance (optional)</legend>
            <textarea
              class="extend-custom-prompt"
              data-extend-prompt
              rows="4"
              placeholder="e.g. 'Focus on the contingency planning section, especially BIA. Skip easy MC. Include at least one question on RTO/RPO.' — added on top of the default prompt."
            >${escapeHtml(extendModal.customPrompt || '')}</textarea>
            <small class="rail-meta">Choose a topic, difficulty, or style. Leave blank for a balanced set.</small>
          </fieldset>

          <div class="extend-actions">
            <button type="button" class="load-q-btn" data-extend-submit>Request ${extendModal.count}</button>
            <button type="button" class="chat-clear" data-extend-close>Cancel</button>
          </div>
        `}
      </div>
    </div>
  `
}

async function submitExtend() {
  if (!extendModal.open) return
  const [cid, chid] = extendModal.open.split('/')
  extendModal.generating = true
  extendModal.error = null
  render()
  try {
    const data = await fetchJson(`/api/questions/${encodeURIComponent(cid)}/${encodeURIComponent(chid)}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        types: extendModal.types,
        count: extendModal.count,
        customPrompt: (extendModal.customPrompt || '').trim()
      })
    })
    // refresh local cache
    questionsCache.set(`${cid}/${chid}`, { questions: data.payload.questions })
    aiUsage = data.usage || aiUsage
    extendModal.open = null
    extendModal.generating = false
    extendModal.error = null
    extendModal.customPrompt = ''
    render()
  } catch (err) {
    if (err.usage) aiUsage = err.usage
    extendModal.generating = false
    extendModal.error = err.message
    render()
  }
}

// ----- Regenerate modal -----
function renderRegenModal() {
  if (!regenModal.open) return ''
  const [cid, chid] = regenModal.open.split('/')
  const course = state.courses.find((c) => c.id === cid)
  const chapter = course?.chapters?.find((c) => c.id === chid)
  const allTypes = ['written', 'calc', 'tf', 'mc', 'pseudocode']

  return `
    <div class="mock-overlay" data-regen-overlay>
      <div class="mock-panel" role="dialog" aria-modal="true" aria-labelledby="regen-dialog-title" style="max-width:560px">
        <h2 id="regen-dialog-title">Regenerate questions</h2>
        <p class="rail-meta">${course?.code || cid} ${course?.shortName ? '· ' + course.shortName : ''}${chapter ? ' / Ch ' + chapter.id + ' · ' + chapter.name : ''}</p>
        <div class="regen-warning"><strong>Warning:</strong> this replaces the cached question set for this chapter. Your existing questions for this chapter will be deleted.</div>

        ${regenModal.generating ? `
          <div class="loader">Regenerating ${regenModal.count} questions via Codex (60–180s)…</div>
        ` : `
          ${regenModal.error ? `<div class="loader error">${escapeHtml(regenModal.error)}</div>` : ''}

          <fieldset class="extend-field">
            <legend>Question types</legend>
            <div class="extend-types">
              ${allTypes.map((t) => `
                <label class="extend-type-chk">
                  <input type="checkbox" data-regen-type="${t}" ${regenModal.types.includes(t) ? 'checked' : ''}>
                  <span>${QUESTION_TYPE_LABELS[t]}</span>
                </label>
              `).join('')}
            </div>
            <small class="rail-meta">Leave all unchecked = mix all five types (default).</small>
          </fieldset>

          <fieldset class="extend-field">
            <legend>How many</legend>
            <div class="extend-counts">
              ${[8, 12, 16, 20, 24].map((n) => `
                <label class="extend-count-radio">
                  <input type="radio" name="regen-count" data-regen-count="${n}" ${regenModal.count === n ? 'checked' : ''}>
                  <span>${n}</span>
                </label>
              `).join('')}
            </div>
          </fieldset>

          <fieldset class="extend-field">
            <legend>Custom guidance (optional)</legend>
            <textarea
              class="extend-custom-prompt"
              data-regen-prompt
              rows="4"
              placeholder="e.g. 'Focus exclusively on the section about contingency planning. Make MC questions harder — distractors must be plausible course-relevant misconceptions, not obvious wrong answers.' — added on top of the default prompt."
            >${escapeHtml(regenModal.customPrompt || '')}</textarea>
            <small class="rail-meta">Steer the generator toward specific topics, difficulty, style, or coverage. Leave blank for default behaviour.</small>
          </fieldset>

          <div class="extend-actions">
            <button type="button" class="load-q-btn regen-submit-btn" data-regen-submit>${uiIcon('refresh')} Regenerate ${regenModal.count}</button>
            <button type="button" class="chat-clear" data-regen-close>Cancel</button>
          </div>
        `}
      </div>
    </div>
  `
}

function renderToolbarMore(course, chapter) {
  const key = `${course.id}/${chapter.id}`
  const isOpen = toolbarMoreOpen === key
  return `
    <div class="tb-more ${isOpen ? 'is-open' : ''}" data-tb-more>
      <button type="button" class="tb-btn tb-btn-icon" data-tb-more-toggle="${key}" aria-expanded="${isOpen}" aria-haspopup="menu" aria-label="More actions" title="More actions">
        <span class="tb-more-glyph" aria-hidden="true"></span>
      </button>
      ${isOpen ? `
        <div class="tb-more-menu" role="menu">
          <button type="button" class="tb-more-item" data-bulk-sr="${key}" data-tb-more-action>
          <span class="tb-more-icon">${uiIcon('plus')}</span>
            <span>
              <strong>Add all to flashcards</strong>
              <small>Bulk-load every question in the bank into your SR deck</small>
            </span>
          </button>
          <button type="button" class="tb-more-item" data-start-mock="${key}" data-tb-more-action>
          <span class="tb-more-icon">${uiIcon('play')}</span>
            <span>
              <strong>Start mini-mock</strong>
              <small>Timed practice on this chapter's question set</small>
            </span>
          </button>
        </div>
      ` : ''}
    </div>
  `
}

function renderConfirmModal() {
  if (!confirmModal) return ''
  const { title, message, okLabel, cancelLabel, danger } = confirmModal
  return `
    <div class="confirm-overlay" data-confirm-overlay>
      <div class="confirm-panel" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <h3 id="confirm-title" class="confirm-title">${escapeHtml(title)}</h3>
        ${message ? `<p class="confirm-message">${escapeHtml(message)}</p>` : ''}
        <div class="confirm-actions">
          <button type="button" class="btn btn-secondary" data-confirm-cancel>${escapeHtml(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm-ok>${escapeHtml(okLabel)}</button>
        </div>
      </div>
    </div>
  `
}

async function submitRegen() {
  if (!regenModal.open) return
  const [cid, chid] = regenModal.open.split('/')
  if (hasRunningBgJob((j) => j.kind === 'question-regen' && j.courseId === cid && j.chapterId === chid)) {
    regenModal.error = 'A regeneration for this chapter is already running.'
    render()
    return
  }
  const course = state.courses.find((c) => c.id === cid)
  const chapter = course?.chapters?.find((c) => c.id === chid)
  const chapterLabel = chapter ? `Ch ${chapter.id} — ${chapter.name}` : `Ch ${chid}`
  const types = regenModal.types.slice()
  const count = regenModal.count
  const customPrompt = (regenModal.customPrompt || '').trim()
  const jobId = startBgJob({
    kind: 'question-regen',
    label: `Regenerating questions for ${chapterLabel}…`,
    courseId: cid,
    chapterId: chid
  })
  regenModal.open = null
  regenModal.generating = false
  regenModal.error = null
  regenModal.customPrompt = ''
  render()

  fetchJson(`/api/questions/${encodeURIComponent(cid)}/${encodeURIComponent(chid)}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        types,
        count,
        customPrompt
      })
    })
    .then((data) => {
      const questions = data.payload?.questions || []
      questionsCache.set(`${cid}/${chid}`, { questions })
      questionsSummaryCache.delete(cid)
      clearChapterQuestionAttempts(cid, chid)
      const nav = getQuestionNav(cid, chid)
      nav.index = 0
      completeBgJob(jobId, { summary: `Regenerated ${questions.length} questions for ${chapterLabel}` })
    })
    .catch((err) => completeBgJob(jobId, { error: err.message }))
}

function clearChapterQuestionAttempts(courseId, chapterId) {
  const prefix = `${courseId}/${chapterId}/`
  let changed = false
  for (const key of Array.from(attemptState.keys())) {
    if (key.startsWith(prefix)) {
      attemptState.delete(key)
      changed = true
    }
  }
  if (changed) saveAttemptState()
}

function renderMiniMockOverlay() {
  if (!mockSession.active) return ''
  const m = mockSession.active
  if (m.phase === 'grading') {
    return `<div class="mock-overlay"><div class="mock-panel"><h2>Checking your mock…</h2><p>Comparing ${m.questions.length} answers with the published references.</p><div class="loader">Checking…</div></div></div>`
  }
  if (m.phase === 'done') {
    const s = m.results
    return `
      <div class="mock-overlay">
        <div class="mock-panel results">
          <h2>Mock complete · ${s.totalScore.toFixed(1)}/${s.totalMax}</h2>
          <p>Saved as session. <a href="#/practice/mocks/${s.id}">Open full review →</a></p>
          <ol class="mock-results-list">
            ${s.questions.map((q, i) => `<li><strong>Q${i+1}</strong> · ${QUESTION_TYPE_LABELS[q.type] || q.type} · <strong>${q.score?.toFixed(1) ?? '—'}/10</strong></li>`).join('')}
          </ol>
          <button type="button" class="load-q-btn" data-mock-close>Close</button>
        </div>
      </div>
    `
  }
  // taking
  const q = m.questions[m.currentIndex]
  const answeredCount = Object.values(m.answers).filter((v) => v && v.trim()).length
  return `
    <div class="mock-overlay">
      <div class="mock-panel taking">
        <header class="mock-head">
          <strong>Mini-mock</strong>
          <span>Question ${m.currentIndex + 1} of ${m.questions.length} · ${answeredCount} answered</span>
          <span class="mock-timer">${uiIcon('timer')} <span class="mock-timer-readout">${mockTimeRemainingLabel()}</span></span>
          <button type="button" class="chat-clear" data-mock-cancel>Abandon</button>
        </header>
        <article class="mock-question">
          <div class="q-head">
            <span class="q-type">${QUESTION_TYPE_LABELS[q.type] || q.type}</span>
            ${q.difficulty ? `<span class="q-diff diff-${q.difficulty}">${q.difficulty}</span>` : ''}
          </div>
          <div class="q-body">${renderInlineMarkdown(q.question)}</div>
          ${q.type === 'mc' && q.options?.length ? `
            <div class="q-options">${q.options.map((opt) => `<label><input type="radio" name="mock-${q.id}" value="${escapeHtml(opt)}" ${m.answers[q.id] === opt ? 'checked' : ''} data-mock-answer="${q.id}"> ${renderInlineMarkdown(opt)}</label>`).join('')}</div>
          ` : q.type === 'tf' ? `
            <div class="q-options">${['True','False'].map((v) => `<label><input type="radio" name="mock-${q.id}" value="${v}" ${m.answers[q.id] === v ? 'checked' : ''} data-mock-answer="${q.id}"> ${v}</label>`).join('')}</div>
          ` : `
            <textarea class="q-input ${q.type === 'pseudocode' ? 'code' : ''}" data-mock-answer="${q.id}" placeholder="Your answer...">${escapeHtml(m.answers[q.id] || '')}</textarea>
            <div class="attempt-drop" data-mock-drop="${q.id}">
              ${renderImageThumbs(m.attemptImages?.[q.id], `mock-remove-image="${q.id}"`)}
              <label class="attempt-drop-hint">📎 Drop, paste, or <input type="file" accept="image/*" multiple class="attempt-file-input" data-mock-file="${q.id}"> upload image of your work</label>
            </div>
          `}
        </article>
        <footer class="mock-foot">
          <button type="button" class="q-nav-btn" data-mock-nav="prev" ${m.currentIndex === 0 ? 'disabled' : ''}>← Previous</button>
          <button type="button" class="q-nav-btn primary" data-mock-nav="next" ${m.currentIndex >= m.questions.length - 1 ? 'disabled' : ''}>Next →</button>
          <button type="button" class="load-q-btn" data-mock-submit>Submit all (${answeredCount}/${m.questions.length})</button>
        </footer>
      </div>
    </div>
  `
}

const pdfOutlineCache = new Map() // courseId -> { loading, items, totalPages, status: 'native'|'codex'|'pages'|'building'|'error', error? }

// ----- Practice exam state -----
const practiceExamCache = new Map() // courseId -> { status: 'idle'|'extracting'|'parsing'|'ready'|'error', questions, error }

// Mock questions (course-wide self-test) — independent of practice-exam cache
const mockQuestionsCache = new Map() // courseId -> { status: 'idle'|'loading'|'generating'|'ready'|'error', questions, examTypeMix, error }
const mockQuestionsView = { courseId: null, chapterId: 'all', topics: [], types: [], openDd: null, currentIndex: 0 }

// Per-course flashcards (deck of cards keyed by chapter)
const flashcardsCache = new Map() // courseId -> { loading, error, byChapter: { [chid]: [card, ...] } }

// ----- Background jobs (long-running fetches the UI shouldn't block on) -----
const bgJobs = new Map() // id -> { kind, label, courseId, chapterId?, status, startedAt, completedAt, error, summary }
let _bgJobsTimer = null

function ensureBgJobsTimer() {
  if (_bgJobsTimer) return
  _bgJobsTimer = setInterval(() => {
    const anyRunning = [...bgJobs.values()].some((j) => j.status === 'running')
    if (!anyRunning) {
      clearInterval(_bgJobsTimer)
      _bgJobsTimer = null
      return
    }
    // Re-render only the banner so we don't thrash the whole page every second
    const el = document.querySelector('.bg-jobs')
    if (el) el.innerHTML = renderBgJobsInner()
  }, 1000)
}

function startBgJob({ kind, label, ...payload }) {
  const id = `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  bgJobs.set(id, { ...payload, id, kind, label, status: 'running', startedAt: Date.now() })
  ensureBgJobsTimer()
  return id
}

function completeBgJob(id, { error, summary } = {}) {
  const job = bgJobs.get(id)
  if (!job) return
  job.status = error ? 'error' : 'done'
  job.completedAt = Date.now()
  if (error) job.error = error
  if (summary) job.summary = summary
  if (!error) {
    setTimeout(() => {
      bgJobs.delete(id)
      render()
    }, 10000)
  }
  render()
}

function dismissBgJob(id) {
  bgJobs.delete(id)
  render()
}

function hasRunningBgJob(predicate) {
  for (const job of bgJobs.values()) {
    if (job.status === 'running' && predicate(job)) return true
  }
  return false
}

function fmtElapsed(ms) {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}

function renderBgJobsInner() {
  if (!bgJobs.size) return ''
  const jobs = [...bgJobs.values()].sort((a, b) => b.startedAt - a.startedAt)
  return jobs.map((j) => {
    const elapsed = j.completedAt
      ? fmtElapsed(j.completedAt - j.startedAt)
      : fmtElapsed(Date.now() - j.startedAt)
    let title = j.label
    let detail = ''
    if (j.status === 'running') {
      detail = `Running ${elapsed}…`
    } else if (j.status === 'done') {
      title = j.summary || `Done · ${j.label.replace(/…$/, '')}`
      detail = `Took ${elapsed}`
    } else {
      title = `Failed · ${j.label.replace(/…$/, '')}`
      detail = j.error || 'Unknown error'
    }
    return `
      <div class="bg-job bg-job-${j.status}">
        <div class="bg-job-icon">${j.status === 'running' ? '<span class="bg-job-spinner"></span>' : j.status === 'done' ? '✓' : '⚠'}</div>
        <div class="bg-job-body">
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(detail)}</small>
        </div>
        <button type="button" class="bg-job-dismiss" data-bg-dismiss="${j.id}" title="Dismiss">${uiIcon('close')}</button>
      </div>
    `
  }).join('')
}

function renderBgJobsBanner() {
  if (!bgJobs.size) return ''
  return `<div class="bg-jobs">${renderBgJobsInner()}</div>`
}
const flashcardsView = {
  courseId: null,
  expanded: {}, // chapterId -> bool
  flipped: {}, // cardId -> bool
  newCard: null, // { chapterId, front, back }
  editingCard: null, // { cardId, chapterId, front, back }
  generateModal: null, // { chapterId, count, customPrompt, busy, error }
  studyModal: null // { chapterId, cardIds, index, showBack }
}

async function ensureFlashcards(courseId) {
  if (flashcardsCache.has(courseId)) return
  flashcardsCache.set(courseId, { loading: true })
  try {
    const data = await fetchJson(`/api/flashcards/${encodeURIComponent(courseId)}`)
    flashcardsCache.set(courseId, { byChapter: data.byChapter || {} })
  } catch (err) {
    flashcardsCache.set(courseId, { error: err.message, byChapter: {} })
  }
  render()
}

function invalidateFlashcards(courseId) {
  flashcardsCache.delete(courseId)
}

async function createFlashcard(courseId, chapterId, front, back) {
  const card = await fetchJson(`/api/flashcards/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ front, back })
  })
  invalidateFlashcards(courseId)
  await ensureFlashcards(courseId)
  return card
}

async function editFlashcard(courseId, chapterId, cardId, front, back) {
  await fetchJson(`/api/flashcards/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}/${encodeURIComponent(cardId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ front, back })
  })
  invalidateFlashcards(courseId)
  await ensureFlashcards(courseId)
}

async function deleteFlashcard(courseId, chapterId, cardId) {
  await fetchJson(`/api/flashcards/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}/${encodeURIComponent(cardId)}`, {
    method: 'DELETE'
  })
  invalidateFlashcards(courseId)
  await ensureFlashcards(courseId)
}

async function generateAiFlashcards(courseId, chapterId, count, customPrompt) {
  const data = await fetchJson(`/api/flashcards/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count, customPrompt })
  })
  invalidateFlashcards(courseId)
  await ensureFlashcards(courseId)
  return data.cards || []
}

async function generateAllAiFlashcards(courseId, count, customPrompt) {
  const data = await fetchJson(`/api/flashcards/${encodeURIComponent(courseId)}/generate-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count, customPrompt })
  })
  invalidateFlashcards(courseId)
  await ensureFlashcards(courseId)
  return data.results || []
}

async function reviewFlashcard(courseId, chapterId, cardId, quality) {
  await fetchJson(`/api/flashcards/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}/${encodeURIComponent(cardId)}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quality })
  })
  invalidateFlashcards(courseId)
  // Caller may want to refresh sometime; we do not auto-render here to keep study UI snappy
}

async function gradeFlashcardRecall(courseId, chapterId, cardId, attempt) {
  return fetchJson(`/api/flashcards/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}/${encodeURIComponent(cardId)}/grade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attempt })
  })
}

function flashcardIsDue(card) {
  if (!card?.sr?.dueAt) return true
  return new Date(card.sr.dueAt).getTime() <= Date.now()
}

function renderFlashcardsView(course) {
  if (flashcardsView.courseId !== course.id) {
    flashcardsView.courseId = course.id
    flashcardsView.expanded = {}
    flashcardsView.flipped = {}
    flashcardsView.newCard = null
    flashcardsView.editingCard = null
  }
  const cache = flashcardsCache.get(course.id)
  if (!cache) { ensureFlashcards(course.id); return '<div class="practice-loader">Loading flashcards…</div>' }
  if (cache.loading) return '<div class="practice-loader">Loading flashcards…</div>'
  if (cache.error) return `<div class="practice-loader error">${escapeHtml(cache.error)}</div>`

  const byChapter = cache.byChapter || {}
  const totalCards = Object.values(byChapter).reduce((a, arr) => a + (arr?.length || 0), 0)
  const totalDue = Object.values(byChapter).reduce((a, arr) => a + (arr || []).filter(flashcardIsDue).length, 0)

  // Always show every chapter, even empty
  const chapters = (course.chapters || []).map((ch) => {
    const cards = byChapter[ch.id] || []
    return { ch, cards }
  })

  return `
    <div class="panel-head q-panel-head fc-head">
      <div>
        <p class="eyebrow">Course flashcards</p>
        <h2>Flashcards <small>(${totalCards} total · ${totalDue} due now)</small></h2>
        <p class="rail-meta fc-mix">Organized by chapter. Click any card to flip. Cards use SM-2 spaced repetition — practice from any chapter, or run all of them together.</p>
      </div>
      <div class="q-toolbar fc-global-actions">
        ${totalCards ? `<button type="button" class="tb-btn tb-btn-primary" data-fc-practice-all="${course.id}">${uiIcon('play')} Practice all (${totalDue || totalCards})</button>` : ''}
      </div>
    </div>
    ${chapters.map((g) => renderFlashcardsChapterSection(course, g.ch, g.cards)).join('')}
  `
}

function renderFlashcardsChapterSection(course, chapter, cards) {
  const isExpanded = flashcardsView.expanded[chapter.id] !== false // default expanded
  const dueCount = cards.filter(flashcardIsDue).length
  const adding = flashcardsView.newCard?.chapterId === chapter.id ? flashcardsView.newCard : null
  return `
    <section class="fc-chapter">
      <header class="fc-chapter-head">
        <button type="button" class="fc-chapter-toggle" data-fc-toggle-chapter="${chapter.id}">
          <span class="fc-caret">${uiIcon(isExpanded ? 'chevronDown' : 'chevronRight')}</span>
          <strong>Ch ${escapeHtml(chapter.id)} — ${escapeHtml(chapter.name)}</strong>
          <small>${cards.length} card${cards.length === 1 ? '' : 's'}${cards.length ? ` · ${dueCount} due` : ''}</small>
        </button>
        <div class="fc-chapter-actions">
          ${cards.length ? `<button type="button" class="tb-btn tb-btn-primary" data-fc-practice="${chapter.id}">Practice (${dueCount || cards.length})</button>` : ''}
          <button type="button" class="tb-btn" data-fc-add="${chapter.id}">Add card</button>
          <a class="tb-btn" href="#/course/${course.id}/chapter/${chapter.id}" title="Open chapter for revision">Open chapter</a>
        </div>
      </header>
      ${isExpanded ? `
        ${adding ? renderFlashcardForm('new', chapter.id, adding.front || '', adding.back || '') : ''}
        ${cards.length ? `
          <div class="fc-grid">
            ${cards.map((c) => renderFlashcardCard(course, chapter, c)).join('')}
          </div>
        ` : `<p class="empty fc-empty">No flashcards in this chapter yet. Add a card from your own notes or from a practice question.</p>`}
      ` : ''}
    </section>
  `
}

function renderFlashcardForm(mode, chapterId, front, back, cardId = null) {
  const isEdit = mode === 'edit'
  return `
    <form class="fc-form" data-fc-form="${isEdit ? 'edit' : 'new'}" data-chapter="${chapterId}" ${cardId ? `data-card="${cardId}"` : ''}>
      <label>
        <span class="fc-form-label">Front (prompt)</span>
        <textarea name="front" rows="2" required placeholder="What is X?">${escapeHtml(front)}</textarea>
      </label>
      <label>
        <span class="fc-form-label">Back (answer)</span>
        <textarea name="back" rows="3" required placeholder="X is …">${escapeHtml(back)}</textarea>
      </label>
      <div class="fc-form-actions">
        <button type="submit" class="tb-btn tb-btn-primary">${isEdit ? 'Save changes' : 'Add card'}</button>
        <button type="button" class="tb-btn" data-fc-form-cancel="${isEdit ? 'edit' : 'new'}">Cancel</button>
      </div>
    </form>
  `
}

function renderFlashcardCard(course, chapter, card) {
  const flipped = !!flashcardsView.flipped[card.id]
  const editing = flashcardsView.editingCard?.cardId === card.id ? flashcardsView.editingCard : null
  if (editing) {
    return `<div class="fc-card-edit">${renderFlashcardForm('edit', chapter.id, editing.front, editing.back, card.id)}</div>`
  }
  const isDue = flashcardIsDue(card)
  return `
    <div class="fc-card ${flipped ? 'is-flipped' : ''} ${card.source === 'ai' ? 'is-ai' : 'is-custom'} ${isDue ? 'is-due' : ''}" data-fc-card="${card.id}" data-chapter="${chapter.id}">
      <div class="fc-card-meta">
        <span class="fc-card-source">${card.source === 'ai' ? `${uiIcon('sparkle')} AI` : 'Custom'}</span>
        ${isDue ? '<span class="fc-card-due">Due</span>' : `<span class="fc-card-next">Next: ${new Date(card.sr?.dueAt || Date.now()).toLocaleDateString()}</span>`}
        <div class="fc-card-actions">
          <button type="button" class="fc-icon-btn" data-fc-edit="${card.id}" data-chapter="${chapter.id}" title="Edit">${uiIcon('edit')}</button>
          <button type="button" class="fc-icon-btn fc-icon-danger" data-fc-delete="${card.id}" data-chapter="${chapter.id}" title="Delete">${uiIcon('close')}</button>
        </div>
      </div>
      <button type="button" class="fc-card-body" data-fc-flip="${card.id}">
        <div class="fc-card-side fc-card-front">${renderInlineMarkdown(card.front)}</div>
        <div class="fc-card-side fc-card-back">${renderInlineMarkdown(card.back)}</div>
      </button>
    </div>
  `
}

function renderFlashcardGenerateModal() {
  if (!flashcardsView.generateModal) return ''
  const m = flashcardsView.generateModal
  const course = state.courses.find((c) => c.id === flashcardsView.courseId)
  const chapter = m.scope === 'chapter' ? course?.chapters?.find((c) => c.id === m.chapterId) : null
  const chapterCount = course?.chapters?.length || 0
  const isAll = m.scope === 'all'
  return `
    <div class="mock-overlay" data-fc-gen-overlay>
      <div class="mock-panel" style="max-width:600px">
        <h2>${isAll ? 'Generate flashcards for every chapter' : 'Generate flashcards with AI'}</h2>
        <p class="rail-meta">${escapeHtml(course?.code || '')}${isAll ? ` · ${chapterCount} chapters` : chapter ? ` · Ch ${chapter.id} — ${escapeHtml(chapter.name)}` : ''}</p>
        ${isAll ? `<p class="rail-meta" style="color:var(--muted);font-style:italic">Codex chooses how many cards each chapter needs (5–25 based on content depth) and runs once per chapter sequentially. Expect ~${chapterCount}–${chapterCount * 2} minutes total.</p>` : ''}
        ${m.busy ? `
          <div class="loader">${isAll ? `Codex is creating cards per chapter (auto count) across ${chapterCount} chapters…` : (m.count === 'auto' ? `Codex is picking a count and creating flashcards (30–90s)…` : `Codex is creating ${m.count} flashcards (30–90s)…`)}</div>
        ` : `
          ${m.error ? `<div class="loader error">${escapeHtml(m.error)}</div>` : ''}
          ${!isAll ? `
            <fieldset class="extend-field">
              <legend>How many cards</legend>
              <div class="extend-counts">
                <label class="extend-count-radio">
                  <input type="radio" name="fc-gen-count" data-fc-gen-count="auto" ${m.count === 'auto' ? 'checked' : ''}>
                  <span>Auto</span>
                </label>
                ${[5, 10, 15, 20, 25].map((n) => `
                  <label class="extend-count-radio">
                    <input type="radio" name="fc-gen-count" data-fc-gen-count="${n}" ${m.count === n ? 'checked' : ''}>
                    <span>${n}</span>
                  </label>
                `).join('')}
              </div>
              <small class="rail-meta">Auto = codex picks 5–25 based on this chapter's content depth (recommended).</small>
            </fieldset>
          ` : ''}
          <fieldset class="extend-field">
            <legend>Custom prompt (optional)</legend>
            <textarea class="fc-gen-prompt" data-fc-gen-prompt placeholder="e.g. Focus on definitions only. Or: Emphasise the exam Q2 pattern. Or: Skip code, only conceptual cards.">${escapeHtml(m.customPrompt || '')}</textarea>
            <small class="rail-meta">Optional extension to the base prompt — steers what kind of cards Codex emits.</small>
          </fieldset>
          <div class="extend-actions">
            <button type="button" class="tb-btn tb-btn-primary" data-fc-gen-submit>${isAll ? 'Generate for all chapters' : (m.count === 'auto' ? 'Generate (auto)' : `Generate ${m.count}`)}</button>
            <button type="button" class="tb-btn" data-fc-gen-cancel>Cancel</button>
          </div>
        `}
      </div>
    </div>
  `
}

function renderFlashcardStudyModal() {
  if (!flashcardsView.studyModal) return ''
  const s = flashcardsView.studyModal
  const cache = flashcardsCache.get(flashcardsView.courseId)
  const byChapter = cache?.byChapter || {}
  const allCards = Object.values(byChapter).flat()
  // Resolve card objects fresh each render so SR state appears updated as user reviews
  const cards = s.queue.map(({ cardId }) => allCards.find((c) => c.id === cardId)).filter(Boolean)
  const scopeLabel = s.scope === 'all' ? 'all chapters' : `Ch ${s.chapterId || ''}`
  if (!cards.length) {
    return `
      <div class="mock-overlay">
        <div class="mock-panel results">
          <h2>Nothing to practice</h2>
          <p>No flashcards in scope.</p>
          <button type="button" class="tb-btn" data-fc-study-close>Close</button>
        </div>
      </div>
    `
  }
  if (s.index >= cards.length) {
    return `
      <div class="mock-overlay">
        <div class="mock-panel results">
          <h2>Done — ${cards.length} reviewed</h2>
          <p>SR schedule updated for ${escapeHtml(scopeLabel)}.</p>
          <button type="button" class="tb-btn tb-btn-primary" data-fc-study-close>Close</button>
        </div>
      </div>
    `
  }
  const card = cards[s.index]
  const answerDraft = s.answers?.[card.id] || ''
  const grade = s.grades?.[card.id] || null
  const isGrading = s.gradingCardId === card.id
  const canRate = s.showBack || grade?.score != null
  return `
    <div class="mock-overlay">
      <div class="mock-panel fc-study">
        <header class="mock-head">
          <strong>Practicing flashcards · ${escapeHtml(scopeLabel)}</strong>
          <span>Card ${s.index + 1} of ${cards.length} · Ch ${escapeHtml(card.chapterId)}</span>
          <button type="button" class="chat-clear" data-fc-study-close>Abandon</button>
        </header>
        <article class="fc-study-card">
          <div class="fc-study-front">${renderInlineMarkdown(card.front)}</div>
          <div class="fc-recall-box">
            <label for="fc-recall-${escapeHtml(card.id)}">Your recall</label>
            <textarea
              id="fc-recall-${escapeHtml(card.id)}"
              class="fc-recall-input"
              data-fc-recall-input="${escapeHtml(card.id)}"
              placeholder="Type what you think is on the back of the card..."
              ${isGrading ? 'disabled' : ''}
            >${escapeHtml(answerDraft)}</textarea>
            <div class="fc-recall-actions">
              <button type="button" class="tb-btn tb-btn-primary" data-fc-recall-grade="${escapeHtml(card.id)}" ${isGrading || !answerDraft.trim() ? 'disabled' : ''}>${isGrading ? 'Checking...' : 'Check recall'}</button>
              <button type="button" class="tb-btn" data-fc-study-show>${s.showBack ? 'Hide answer' : 'Show answer'}</button>
            </div>
          </div>
          ${grade?.error ? `<div class="loader error fc-recall-result">${escapeHtml(grade.error)}</div>` : ''}
          ${grade?.correction ? `<div class="q-grade fc-recall-result">${renderCorrectionMarkdown(grade.correction, grade.score, 10)}</div>` : ''}
          ${s.showBack ? `<div class="fc-study-back">${renderInlineMarkdown(card.back)}</div>` : ''}
        </article>
        <footer class="fc-study-foot">
          ${canRate ? `
            <button type="button" class="tb-btn fc-rate fc-rate-again" data-fc-rate="0">Again</button>
            <button type="button" class="tb-btn fc-rate fc-rate-hard" data-fc-rate="2">Hard</button>
            <button type="button" class="tb-btn fc-rate fc-rate-good" data-fc-rate="4">Good</button>
            <button type="button" class="tb-btn fc-rate fc-rate-easy" data-fc-rate="5">Easy</button>
          ` : `<small class="rail-meta">Check your typed recall, or reveal the answer, then choose how strongly to schedule this card.</small>`}
        </footer>
      </div>
    </div>
  `
}

function renderMqMultiSelect(filterKey, allLabel, options) {
  const selected = mockQuestionsView[filterKey] || []
  const isOpen = mockQuestionsView.openDd === filterKey
  let summary
  if (selected.length === 0 || selected.length === options.length) {
    summary = allLabel
  } else if (selected.length === 1) {
    const opt = options.find((o) => o.value === selected[0])
    summary = opt ? opt.label : `${selected.length} selected`
  } else if (selected.length <= 2) {
    summary = selected.map((v) => {
      const o = options.find((x) => x.value === v)
      return o ? o.label : v
    }).join(', ')
  } else {
    summary = `${selected.length} selected`
  }
  return `
    <div class="multi-dd ${isOpen ? 'is-open' : ''}" data-mq-multi-dd="${filterKey}">
      <button type="button" class="multi-dd-toggle ${selected.length > 0 ? 'has-selection' : ''}" data-mq-multi-toggle="${filterKey}" aria-expanded="${isOpen}">
        <span class="multi-dd-label">${escapeHtml(summary)}</span>
        <span class="multi-dd-arrow">${uiIcon('chevronDown')}</span>
      </button>
      ${isOpen ? `
        <div class="multi-dd-panel" role="menu">
          <div class="multi-dd-actions">
            <button type="button" class="multi-dd-action" data-mq-multi-all="${filterKey}">All</button>
            <button type="button" class="multi-dd-action" data-mq-multi-clear="${filterKey}">Clear</button>
          </div>
          ${options.map((opt) => `
            <label class="multi-dd-option">
              <input type="checkbox" data-mq-multi-value="${filterKey}:${escapeHtml(opt.value)}" ${selected.includes(opt.value) ? 'checked' : ''}>
              <span>${escapeHtml(opt.label)}</span>
            </label>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `
}
/**
 * Practice surface view state.
 *
 *   tab          — Top-level surface: 'mock-questions' | 'flashcards' | 'exams' | 'tutorials'
 *                  ('exams' and 'tutorials' both show the chip-selector + per-paper sub-tabs;
 *                  they share renderMockExamsSurface and just point at different paper lists)
 *   examId       — Selected paper id when tab === 'exams'
 *   tutorialId   — Selected paper id when tab === 'tutorials' (remembered separately so
 *                  switching tabs preserves your spot in each list)
 *   examSubtab   — Sub-tab inside the selected paper: 'pdf' | 'solutions' | 'practice'
 *
 * Old 'pdf' / 'solutions' / 'practice' tab values are migrated transparently
 * into tab='exams' + the matching examSubtab on first read.
 */
const practiceExamView = {
  tab: 'mock-questions',
  examId: null,
  tutorialId: null,
  examSubtab: 'pdf',
  courseId: null,
  currentQid: null,
  showGuidance: {},
  showAnswer: {},
  attempts: {},
  attemptImages: {},
  grading: {},
  guidance: {},
  grades: {}
}

/** Course's list of mock-exam papers (new array schema, with legacy fallback). */
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

/** Selected exam for the current view (or first if none chosen). */
function getCurrentMockExam(course) {
  const exams = getMockExams(course)
  if (!exams.length) return null
  const id = practiceExamView.examId
  return exams.find((e) => e.id === id) || exams[0]
}

/** Course's tutorial papers (same shape as mockExams). */
function getTutorials(course) {
  return Array.isArray(course?.tutorials) ? course.tutorials : []
}

/**
 * Paper list / selected-id helpers for the chip-strip + sub-tabs surface.
 * The 'exams' and 'tutorials' top-level tabs share the exact same UI; these
 * helpers pick which collection (and which remembered id) to drive it with.
 */
function getActivePapers(course) {
  return practiceExamView.tab === 'tutorials' ? getTutorials(course) : getMockExams(course)
}
function getActivePaperId() {
  return practiceExamView.tab === 'tutorials' ? practiceExamView.tutorialId : practiceExamView.examId
}
function setActivePaperId(id) {
  if (practiceExamView.tab === 'tutorials') practiceExamView.tutorialId = id
  else practiceExamView.examId = id
}
function getCurrentPaper(course) {
  const papers = getActivePapers(course)
  if (!papers.length) return null
  const id = getActivePaperId()
  return papers.find((p) => p.id === id) || papers[0]
}

/** Compose the practice-exam cache key used both client-side and on the server. */
function practiceExamCacheKey(courseId, examId) {
  return `${courseId}__${examId || 'default'}`
}

function practiceExamKey(cid, qid) { return `practice/${cid}/${qid}` }

function practiceCanonicalKey(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const lower = raw.toLowerCase()

  const practical = lower.match(/practical\s+assignment\s+0*(\d+)\s*\(?\s*([a-z])\s*\)?/)
  if (practical) return `pa${Number(practical[1])}${practical[2]}`

  const theory = lower.match(/theory\s+question\s*\(?\s*([a-z])\s*\)?/)
  if (theory) return `theory${theory[1]}`

  const qPart = lower.match(/^q\s*0*(\d+)\s*\(?\s*([a-z])?\s*\)?$/)
  if (qPart) return `q${Number(qPart[1])}${qPart[2] || ''}`

  const compact = lower.replace(/[^a-z0-9]/g, '')
  const compactPractical = compact.match(/^practicalassignment0*(\d+)([a-z])$/)
  if (compactPractical) return `pa${Number(compactPractical[1])}${compactPractical[2]}`
  const compactTheory = compact.match(/^theoryquestion([a-z])$/)
  if (compactTheory) return `theory${compactTheory[1]}`
  return compact
}

function practiceGradeKeys(qOrKey) {
  if (!qOrKey) return []
  // Use ONLY `id` (not `label`) — some parses give repeated labels across
  // sections (e.g. tutorial 3 of sec has the label "Q1" for both the Part A
  // mc question and the Part B written one). Storing or looking up by
  // `label` causes one section's grade to leak into another's.
  const rawKeys = typeof qOrKey === 'object'
    ? [qOrKey.id]
    : [qOrKey]
  const out = []
  rawKeys.forEach((key) => {
    const raw = String(key || '').trim()
    if (!raw) return
    out.push(raw, raw.toLowerCase(), practiceCanonicalKey(raw))
  })
  return Array.from(new Set(out.filter(Boolean)))
}

function rememberPracticeGrade(question, grade, fallbackKey = '') {
  practiceGradeKeys(fallbackKey).forEach((key) => { practiceExamView.grades[key] = grade })
  practiceGradeKeys(question).forEach((key) => { practiceExamView.grades[key] = grade })
}

function practiceStorageKey(courseId, examId) {
  return `practice-${courseId}__${examId || 'default'}`
}

function restorePracticeAttempts(courseId, examId) {
  // _loadedPaperId tracks which (courseId, paperId) scope is currently in memory,
  // so a no-op re-entry doesn't blow away in-flight state. We do NOT write to
  // practiceExamView.examId here, because that field is the user's mock-exam
  // selection — when we're loading a tutorial's attempts, we must leave the
  // remembered mock-exam id alone (and vice versa).
  const sameScope = practiceExamView.courseId === courseId && practiceExamView._loadedPaperId === examId
  if (sameScope) return
  practiceExamView.courseId = courseId
  practiceExamView._loadedPaperId = examId
  practiceExamView.attempts = {}
  practiceExamView.attemptImages = {}
  practiceExamView.guidance = {}
  practiceExamView.grades = {}
  practiceExamView.showGuidance = {}
  practiceExamView.showAnswer = {}
  practiceExamView.currentQid = null
  practiceExamView.codeLang = {}
  try {
    const raw = localStorage.getItem(practiceStorageKey(courseId, examId))
    if (raw) {
      const data = JSON.parse(raw)
      practiceExamView.attempts = data.attempts || {}
      practiceExamView.attemptImages = data.attemptImages || {}
      practiceExamView.grades = data.grades || {}
      practiceExamView.currentQid = data.currentQid || null
      practiceExamView.codeLang = data.codeLang || {}
    }
  } catch {}
}

function persistPracticeAttempts(courseId, examId) {
  const key = practiceStorageKey(courseId, examId)
  try {
    localStorage.setItem(key, JSON.stringify({
      attempts: practiceExamView.attempts,
      attemptImages: practiceExamView.attemptImages,
      grades: practiceExamView.grades,
      currentQid: practiceExamView.currentQid,
      codeLang: practiceExamView.codeLang || {}
    }))
  } catch (e) {
    // Quota exceeded (likely from images) — try saving without images
    try {
      localStorage.setItem(key, JSON.stringify({
        attempts: practiceExamView.attempts,
        grades: practiceExamView.grades,
        currentQid: practiceExamView.currentQid,
        codeLang: practiceExamView.codeLang || {}
      }))
    } catch {}
  }
}

function resetPracticeExamState(courseId, examId) {
  // Mirrors restorePracticeAttempts: track the loaded scope in _loadedPaperId,
  // not in practiceExamView.examId (which is the mock-exam selection).
  practiceExamView.courseId = courseId
  practiceExamView._loadedPaperId = examId
  practiceExamView.currentQid = null
  practiceExamView.attempts = {}
  practiceExamView.attemptImages = {}
  practiceExamView.grading = {}
  practiceExamView.guidance = {}
  practiceExamView.grades = {}
  practiceExamView.showGuidance = {}
  practiceExamView.showAnswer = {}
  try { localStorage.removeItem(practiceStorageKey(courseId, examId)) } catch {}
}

// ----- Mistake bank state -----
let mistakeCache = null // {loading, items, error}
async function loadMistakes(force = false) {
  if (mistakeCache && !force) return mistakeCache.items
  mistakeCache = { loading: true }
  try {
    const items = await fetchJson('/api/mistakes?open=true')
    mistakeCache = { items }
  } catch (e) {
    mistakeCache = { error: e.message, items: [] }
  }
  return mistakeCache.items
}

// ----- SR state -----
let srDueCache = null // {loading, due, totalCards, dueCount, allIds}
async function loadSrDue(force = false) {
  if (srDueCache && !force) return srDueCache
  srDueCache = { loading: true }
  try {
    srDueCache = await fetchJson('/api/sr/due')
    setSrMembership(srDueCache?.allIds || [])
  } catch (e) {
    srDueCache = { error: e.message, due: [], totalCards: 0, dueCount: 0, allIds: [] }
  }
  return srDueCache
}

// ----- Extend-questions modal state -----
const extendModal = { open: null, types: ['mc', 'calc', 'pseudocode'], count: 8, customPrompt: '', generating: false, error: null }

// ----- Regenerate-questions modal state -----
// Like extend, but replaces the entire question set instead of appending.
const regenModal = { open: null, types: [], count: 16, customPrompt: '', generating: false, error: null }

// ----- Toolbar overflow menu (per-chapter "more actions") -----
// Holds "{courseId}/{chapterId}" of the chapter whose overflow menu is open,
// or null when nothing is open.
let toolbarMoreOpen = null

// ----- Custom confirm modal (replaces native confirm()) -----
let confirmModal = null
function showConfirm({ title = 'Confirm', message = '', okLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    confirmModal = { title, message, okLabel, cancelLabel, danger, onResolve: resolve }
    render()
  })
}
function resolveConfirm(result) {
  const r = confirmModal?.onResolve
  confirmModal = null
  render()
  if (r) r(result)
}

// ----- Mini-mock state -----
const mockSession = { active: null } // {courseId, chapterId, questions, startedAt, durationMs, answers: Map<qid, answer>, phase: 'taking'|'grading'|'done', results: []}

async function loadPdfOutline(courseId, examId) {
  const cacheKey = examId ? `${courseId}__${examId}` : courseId
  if (pdfOutlineCache.has(cacheKey)) return
  pdfOutlineCache.set(cacheKey, { loading: true, status: 'loading' })
  render()
  try {
    if (!window.__pdfjs) {
      pdfOutlineCache.set(cacheKey, { error: 'PDF.js not loaded — try refreshing.', status: 'error' })
      render()
      return
    }
    const url = examId ? `/api/pdf/${encodeURIComponent(courseId)}/${encodeURIComponent(examId)}` : `/api/pdf/${encodeURIComponent(courseId)}`
    const pdf = await window.__pdfjs.getDocument(url).promise
    const totalPages = pdf.numPages

    // 1) Try the PDF's native outline first.
    const outline = await pdf.getOutline()
    const native = []
    async function walk(nodes, depth) {
      if (!nodes) return
      for (const n of nodes) {
        let page = null
        try {
          let dest = n.dest
          if (typeof dest === 'string') dest = await pdf.getDestination(dest)
          if (Array.isArray(dest) && dest[0]) page = (await pdf.getPageIndex(dest[0])) + 1
        } catch {}
        native.push({ title: n.title, page: page || 1, depth, kind: 'section' })
        if (n.items?.length) await walk(n.items, depth + 1)
      }
    }
    await walk(outline, 0)

    if (native.length >= 3) {
      pdfOutlineCache.set(cacheKey, { items: native, totalPages, status: 'native' })
      render()
      return
    }

    // 2) Try the cached codex-generated content TOC.
    try {
      const tocUrl = examId
        ? `/api/mock-toc/${encodeURIComponent(courseId)}/${encodeURIComponent(examId)}`
        : `/api/mock-toc/${encodeURIComponent(courseId)}`
      const cached = await fetch(tocUrl).then((r) => r.ok ? r.json() : null)
      if (cached?.items?.length) {
        pdfOutlineCache.set(cacheKey, { items: cached.items, totalPages, status: 'codex' })
        render()
        return
      }
    } catch {}

    // 3) Fall back to per-page nav while we wait for the user to ask to build it.
    pdfOutlineCache.set(cacheKey, {
      items: Array.from({ length: totalPages }, (_, i) => ({ title: `Page ${i + 1}`, page: i + 1, depth: 0, kind: 'note' })),
      totalPages,
      status: 'pages',
      pdf
    })
    render()
  } catch (err) {
    pdfOutlineCache.set(cacheKey, { error: err.message || String(err), status: 'error' })
    render()
  }
}

async function ensurePracticeExam(courseId, examId) {
  const key = practiceExamCacheKey(courseId, examId)
  const cache = practiceExamCache.get(key)
  if (cache?.status === 'ready' || cache?.status === 'extracting' || cache?.status === 'parsing') return
  practiceExamCache.set(key, { status: 'extracting' })
  render()
  const examIdEnc = encodeURIComponent(examId || 'default')
  // Try the server-side cache first. Only the fetch is wrapped in try/catch —
  // not the render() that follows — so a render error doesn't silently fall
  // through to the PDF.js path and trigger an infinite re-parse loop.
  let cached = null
  try {
    cached = await fetch(`/api/practice-exam/${encodeURIComponent(courseId)}/${examIdEnc}`).then((r) => r.ok ? r.json() : null)
  } catch {}
  if (cached?.questions?.length) {
    practiceExamCache.set(key, { status: 'ready', questions: cached.questions })
    if (!practiceExamView.currentQid) practiceExamView.currentQid = cached.questions[0].id
    render()
    return
  }

  practiceExamCache.set(key, {
    status: 'error',
    error: 'This paper has not been prepared for interactive practice yet. You can still open the original PDF.'
  })
  render()
}

function pdfTextWithBoldMarkers(textContent) {
  return (textContent?.items || []).map((item) => {
    const raw = String(item.str || '').trim()
    if (!raw) return ''
    const style = textContent?.styles?.[item.fontName] || {}
    const font = `${item.fontName || ''} ${style.fontFamily || ''}`
    const isBold = /bold|black|heavy|semibold|demi/i.test(font)
    return isBold ? `**${raw}**` : raw
  }).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

async function ensureMockQuestions(courseId) {
  if (mockQuestionsCache.has(courseId)) return
  mockQuestionsCache.set(courseId, { status: 'loading' })
  try {
    const r = await fetch(`/api/mock-questions/${encodeURIComponent(courseId)}`)
    if (r.ok) {
      const data = await r.json()
      if (data?.questions?.length) {
        mockQuestionsCache.set(courseId, { status: 'ready', questions: data.questions, examTypeMix: data.examTypeMix, generatedAt: data.generatedAt, examPaperUsed: data.examPaperUsed })
        render()
        return
      }
    }
  } catch {}
  mockQuestionsCache.set(courseId, { status: 'idle' })
  render()
}

async function generateMockQuestionsAction(courseId) {
  mockQuestionsCache.set(courseId, { status: 'generating' })
  render()
  try {
    const data = await fetchJson(`/api/mock-questions/${encodeURIComponent(courseId)}`, { method: 'POST' })
    mockQuestionsCache.set(courseId, { status: 'ready', questions: data.questions, examTypeMix: data.examTypeMix, generatedAt: data.generatedAt, examPaperUsed: data.examPaperUsed })
    mockQuestionsView.currentIndex = 0
    render()
  } catch (err) {
    mockQuestionsCache.set(courseId, { status: 'error', error: err.message })
    render()
  }
}

function filterMockQuestions(questions) {
  return questions.filter((q) => {
    if (mockQuestionsView.chapterId !== 'all' && q.chapterId !== mockQuestionsView.chapterId) return false
    if (mockQuestionsView.topics.length && !mockQuestionsView.topics.includes(q.topic)) return false
    if (mockQuestionsView.types.length && !mockQuestionsView.types.includes(q.type)) return false
    return true
  })
}

function renderMockQuestionsView(course) {
  const cache = mockQuestionsCache.get(course.id)
  if (!cache || cache.status === 'loading') {
    return `<div class="practice-loader">Loading mock questions…</div>`
  }
  if (cache.status === 'generating') {
    return `<div class="practice-loader">Loading the published course-wide question bank…</div>`
  }
  if (cache.status === 'idle' || (cache.status === 'error' && !cache.questions)) {
    return `
      <div class="mq-intro">
        <h2>Mock questions</h2>
        <p>The course team has not published a course-wide mock bank yet. Chapter exercises and past papers remain available.</p>
        ${cache?.status === 'error' ? `<p class="error">${escapeHtml(cache.error)}</p>` : ''}
        <a class="load-q-btn" href="#/course/${course.id}">Return to course</a>
      </div>
    `
  }

  const questions = cache.questions || []
  const filtered = filterMockQuestions(questions)
  if (mockQuestionsView.currentIndex >= filtered.length) mockQuestionsView.currentIndex = 0
  const current = filtered[mockQuestionsView.currentIndex]
  const currentOrigIndex = current ? questions.indexOf(current) : -1

  const topicsInChapter = mockQuestionsView.chapterId === 'all'
    ? [...new Set(questions.map((q) => q.topic))].sort()
    : [...new Set(questions.filter((q) => q.chapterId === mockQuestionsView.chapterId).map((q) => q.topic))].sort()
  const typesPresent = [...new Set(questions.map((q) => q.type))]

  const topicOpts = topicsInChapter.map((t) => ({ value: t, label: t }))
  const typeOpts = typesPresent.map((t) => ({ value: t, label: QUESTION_TYPE_LABELS[t] || t }))

  const counts = typeCounts(questions)
  const typeStrip = Object.entries(QUESTION_TYPE_LABELS)
    .filter(([k]) => counts[k] > 0)
    .map(([k, label]) => `
      <span class="type-pip type-${k}" title="${label}: ${counts[k]} question${counts[k] === 1 ? '' : 's'}">${label.charAt(0)}<small>${counts[k]}</small></span>
    `).join('')

  return `
    <div class="panel-head q-panel-head mq-head">
      <div>
        <h2>Mock questions <small>(${filtered.length} of ${questions.length})</small></h2>
        ${typeStrip ? `<div class="type-strip">${typeStrip}</div>` : ''}
        ${cache.examTypeMix ? `<p class="rail-meta mq-mix">${escapeHtml(cache.examTypeMix)}</p>` : ''}
      </div>
      <div class="q-toolbar">
        ${renderMqMultiSelect('topics', 'All topics', topicOpts)}
        ${renderMqMultiSelect('types', 'All types', typeOpts)}
        ${mockQuestionsView.chapterId !== 'all'
          ? `<button type="button" class="tb-btn clear-link" data-clear-scope="esq" data-clear-course="${course.id}" data-clear-chapter="${mockQuestionsView.chapterId}" data-clear-course-name="${escapeHtml(course.name)}" title="Clear your answers + grades for the current chapter filter">Clear chapter answers</button>`
          : `<button type="button" class="tb-btn clear-link" data-clear-scope="mock-questions" data-clear-course="${course.id}" data-clear-course-name="${escapeHtml(course.name)}" title="Clear all your answers + grades across the entire mock-question bank">Clear all answers</button>`}
      </div>
    </div>

    ${filtered.length ? `
      ${renderMockProgressTracker(filtered, questions, course)}
      <div class="q-pager">
        <button type="button" class="q-nav-btn" data-mq-nav="prev" ${mockQuestionsView.currentIndex === 0 ? 'disabled' : ''}>← Previous</button>
        <span class="q-pager-pos">Question <strong>Q${currentOrigIndex + 1}</strong> of ${questions.length}</span>
        <button type="button" class="q-nav-btn" data-mq-nav="random">${uiIcon('shuffle')} Random</button>
        <button type="button" class="q-nav-btn primary" data-mq-nav="next" ${mockQuestionsView.currentIndex >= filtered.length - 1 ? 'disabled' : ''}>Next →</button>
      </div>
      <div class="single-question">
        ${renderMockQuestionCard(current, currentOrigIndex, course)}
      </div>
    ` : '<p class="empty">No questions match the current filters.</p>'}
  `
}

function renderMockProgressTracker(filtered, allQuestions, course) {
  const stats = filtered.map((q, i) => {
    const origIndex = allQuestions.indexOf(q)
    const key = `${course.id}/${q.chapterId}/${q.id}`
    const att = attemptState.get(key) || {}
    const score = typeof att.score === 'number' ? att.score : null
    let bucket = 'unanswered'
    if (score != null) {
      if (score < 5) bucket = 'low'
      else if (score < 7) bucket = 'mid'
      else if (score < 9) bucket = 'good'
      else bucket = 'great'
    }
    return { i, origIndex, q, score, bucket }
  })
  const answered = stats.filter((s) => s.score != null)
  const avg = answered.length ? answered.reduce((a, s) => a + s.score, 0) / answered.length : null
  const scopeLabel = mockQuestionsView.chapterId === 'all'
    && mockQuestionsView.topics.length === 0
    && mockQuestionsView.types.length === 0
    ? 'all chapters'
    : 'current filter'
  return `
    <div class="q-progress mq-progress">
      <div class="q-progress-meta">
        <p class="eyebrow">Progress · ${scopeLabel}</p>
        <p class="q-progress-line">
          <strong>${answered.length}</strong> of <strong>${filtered.length}</strong> answered
          ${avg != null ? ` · avg <strong>${avg.toFixed(1)}</strong>/10` : ''}
        </p>
      </div>
      <div class="q-progress-bar" role="navigation" aria-label="Question progress">
        ${stats.map((s) => {
          const label = s.origIndex + 1
          const tip = s.score == null ? `Q${label}: not answered` : `Q${label}: ${s.score}/10`
          const isCurrent = s.i === mockQuestionsView.currentIndex
          return `<button type="button" class="q-progress-cell q-progress-${s.bucket} ${isCurrent ? 'is-current' : ''}" data-mq-progress-jump="${s.i}" title="${escapeHtml(tip)}">${label}</button>`
        }).join('')}
      </div>
      <div class="q-progress-legend">
        <span class="q-legend-item"><span class="q-legend-swatch q-progress-unanswered"></span>Not yet</span>
        <span class="q-legend-item"><span class="q-legend-swatch q-progress-low"></span>&lt;5</span>
        <span class="q-legend-item"><span class="q-legend-swatch q-progress-mid"></span>5-7</span>
        <span class="q-legend-item"><span class="q-legend-swatch q-progress-good"></span>7-9</span>
        <span class="q-legend-item"><span class="q-legend-swatch q-progress-great"></span>9-10</span>
      </div>
    </div>
  `
}

function renderMockQuestionCard(q, index, course) {
  const attemptKey = `${course.id}/${q.chapterId}/${q.id}`
  const att = attemptState.get(attemptKey) || {}
  const grade = att.correction || ''
  const grading = att.grading
  const showAnswer = att.showAnswer

  let input = ''
  if (q.type === 'tf') {
    input = `
      <div class="q-options">
        ${['True', 'False'].map((v) => `<label><input type="radio" name="att-${q.id}" value="${v}" ${att.value === v ? 'checked' : ''} data-attempt="${attemptKey}"> ${v}</label>`).join('')}
      </div>
      <textarea class="q-input" placeholder="(Optional) explain your reasoning" data-attempt="${attemptKey}-note">${escapeHtml(att.note || '')}</textarea>
    `
  } else if (q.type === 'mc' && q.options?.length) {
    input = `
      <div class="q-options">
        ${q.options.map((opt) => `<label><input type="radio" name="att-${q.id}" value="${escapeHtml(opt)}" ${att.value === opt ? 'checked' : ''} data-attempt="${attemptKey}"> ${renderInlineMarkdown(opt)}</label>`).join('')}
      </div>
    `
  } else if (q.type === 'pseudocode') {
    const lang = att.codeLang || 'pseudocode'
    input = `
      <div class="attempt-drop code-attempt" data-attempt-drop="${attemptKey}">
        <div class="code-editor-toolbar">
          <label class="code-lang-label">Language
            <select class="code-lang-select" data-code-lang-select="${attemptKey}">
              <option value="pseudocode"${lang === 'pseudocode' ? ' selected' : ''}>Pseudocode</option>
              <option value="c"${lang === 'c' ? ' selected' : ''}>C / C++</option>
              <option value="asm"${lang === 'asm' ? ' selected' : ''}>Assembly (ARM / GAS)</option>
            </select>
          </label>
        </div>
        <textarea class="q-input code cm-target" placeholder="Write your answer (or drop a screenshot of your work)..." data-attempt="${attemptKey}" data-code-lang="${lang}">${escapeHtml(att.value || '')}</textarea>
        ${renderImageThumbs(att.images, `remove-image="${attemptKey}"`)}
        <label class="attempt-drop-hint">📎 Drop or <input type="file" accept="image/*" multiple class="attempt-file-input" data-attempt-file="${attemptKey}"> upload image</label>
      </div>
    `
  } else {
    input = `
      <div class="attempt-drop" data-attempt-drop="${attemptKey}">
        <textarea class="q-input" placeholder="Your answer (or drop a screenshot/photo)..." data-attempt="${attemptKey}">${escapeHtml(att.value || '')}</textarea>
        ${renderImageThumbs(att.images, `remove-image="${attemptKey}"`)}
        <label class="attempt-drop-hint">📎 Drop or <input type="file" accept="image/*" multiple class="attempt-file-input" data-attempt-file="${attemptKey}"> upload image</label>
      </div>
    `
  }

  return `
    <li class="question-card" id="q-${q.id}">
      <div class="q-head">
        <div class="q-head-left">
          <span class="q-num">Q${index + 1}</span>
          <span class="q-type">${QUESTION_TYPE_LABELS[q.type] || q.type}</span>
          ${q.difficulty ? `<span class="q-diff diff-${q.difficulty}">${q.difficulty}</span>` : ''}
          <a class="q-source q-source-link" href="#/course/${course.id}/chapter/${q.chapterId}" title="Open chapter for revision">Ch ${escapeHtml(q.chapterId)} · ${escapeHtml(q.topic)}</a>
        </div>
      </div>
      <div class="q-body">${renderInlineMarkdown(q.question)}</div>
      ${input}
      <div class="q-actions">
        <button type="button" class="btn btn-primary" data-grade="${attemptKey}" ${grading ? 'disabled' : ''}>${grading ? 'Checking…' : 'Check answer'}</button>
        <button type="button" class="btn btn-ghost" data-reveal="${attemptKey}">${showAnswer ? 'Hide answer' : 'Reveal answer'}</button>
        ${srButtonHtml(q.id)}
        <button type="button" class="btn btn-ghost clear-link" data-clear-scope="question" data-clear-course="${course.id}" data-clear-chapter="${q.chapterId}" data-clear-question="${q.id}" title="Clear your answer and grade for this question">Clear answer</button>
      </div>
      ${grade ? `<div class="q-grade">${renderCorrectionMarkdown(grade, att.score, 10)}</div>` : ''}
      ${showAnswer && q.expected ? `<div class="q-expected"><strong>Reference answer:</strong>${renderMarkdown(q.expected)}</div>` : ''}
    </li>
  `
}

async function requestGuidance(courseId, examId, qid) {
  if (practiceExamView.guidance[qid]) return
  practiceExamView.guidance[qid] = { loading: true }
  render()
  try {
    const examIdEnc = encodeURIComponent(examId || 'default')
    const data = await fetchJson(`/api/practice-exam/${encodeURIComponent(courseId)}/${examIdEnc}/guidance/${encodeURIComponent(qid)}`, { method: 'POST' })
    practiceExamView.guidance[qid] = { text: data.guidance }
  } catch (err) {
    practiceExamView.guidance[qid] = { error: err.message }
  }
  render()
}

async function gradePracticeQuestion(courseId, examId, qid) {
  const attempt = practiceExamView.attempts[qid] || ''
  const attemptImages = (practiceExamView.attemptImages[qid] || []).slice()
  if (!attempt.trim() && attemptImages.length === 0) { alert('Type an attempt or drop an image of your work first.'); return }
  practiceExamView.grading[qid] = true
  render()
  try {
    const cache = practiceExamCache.get(practiceExamCacheKey(courseId, examId))
    const question = cache?.questions?.find((q) => q.id === qid || q.label === qid)
    const examIdEnc = encodeURIComponent(examId || 'default')
    const data = await fetchJson(`/api/practice-exam/${encodeURIComponent(courseId)}/${examIdEnc}/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: qid, attempt, attemptImages })
    })
    const score = numericScore(data.score ?? scoreFromCorrection(data.correction))
    const grade = { correction: data.correction, score, at: new Date().toISOString() }
    rememberPracticeGrade(question, grade, qid)
    persistPracticeAttempts(courseId, examId)
  } catch (err) {
    const cache = practiceExamCache.get(practiceExamCacheKey(courseId, examId))
    const question = cache?.questions?.find((q) => q.id === qid || q.label === qid)
    rememberPracticeGrade(question, { error: err.message }, qid)
  }
  practiceExamView.grading[qid] = false
  render()
}

async function buildContentToc(courseId, { force = false, examId = null } = {}) {
  const cacheKey = examId ? `${courseId}__${examId}` : courseId
  const pdfPath = examId
    ? `/api/pdf/${encodeURIComponent(courseId)}/${encodeURIComponent(examId)}`
    : `/api/pdf/${encodeURIComponent(courseId)}`
  const cached = pdfOutlineCache.get(cacheKey) || {}
  if (!cached.pdf) {
    try {
      const pdf = await window.__pdfjs.getDocument(pdfPath).promise
      cached.pdf = pdf
    } catch (e) {
      pdfOutlineCache.set(cacheKey, { ...cached, error: e.message, status: 'error' })
      render()
      return
    }
  }
  pdfOutlineCache.set(cacheKey, { ...cached, status: 'building' })
  render()

  try {
    const tocUrl = examId
      ? `/api/mock-toc/${encodeURIComponent(courseId)}/${encodeURIComponent(examId)}`
      : `/api/mock-toc/${encodeURIComponent(courseId)}`
    if (force) {
      await fetch(tocUrl, { method: 'DELETE' })
    }
    const pdf = cached.pdf
    const pages = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const tc = await page.getTextContent()
      const text = tc.items.map((t) => t.str).join(' ').replace(/\s+/g, ' ').trim()
      pages.push({ page: i, text })
    }
    const resp = await fetch(tocUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages })
    })
    if (!resp.ok) {
      let msg = await resp.text()
      try { msg = JSON.parse(msg).error || msg } catch {}
      throw new Error(msg)
    }
    const data = await resp.json()
    pdfOutlineCache.set(cacheKey, { ...cached, items: data.items, status: 'codex' })
  } catch (e) {
    pdfOutlineCache.set(cacheKey, { ...cached, error: e.message, status: 'pages' })
  }
  render()
}

function jumpToPdfPage(courseId, page) {
  const iframe = document.getElementById('mock-pdf-iframe')
  if (!iframe) return
  const target = `#page=${page}&view=FitH`
  try {
    if (iframe.contentWindow && iframe.contentWindow.location) {
      iframe.contentWindow.location.hash = target
      return
    }
  } catch {}
  iframe.src = `/api/pdf/${encodeURIComponent(courseId)}${target}`
}

function renderMockExamPage() {
  const course = state.courses.find((c) => c.id === route.courseId)
  if (!course) return '<p class="empty">Unknown course.</p>'

  const exams = getMockExams(course)
  const tutorials = getTutorials(course)
  const hasExams = exams.length > 0
  const hasTutorials = tutorials.length > 0

  // Migrate legacy tab values from the old single-exam topbar (pdf/solutions/practice
  // were standalone tabs) into the new {tab:'exams', examSubtab} shape.
  if (['pdf', 'solutions', 'practice'].includes(practiceExamView.tab)) {
    practiceExamView.examSubtab = practiceExamView.tab
    practiceExamView.tab = 'exams'
  }
  if (!hasExams && practiceExamView.tab === 'exams') {
    practiceExamView.tab = hasTutorials ? 'tutorials' : 'mock-questions'
  }
  if (!hasTutorials && practiceExamView.tab === 'tutorials') {
    practiceExamView.tab = hasExams ? 'exams' : 'mock-questions'
  }

  // Make sure a selected paper exists in BOTH lists (default to first when none
  // chosen, or when the previously chosen one is no longer in this course's list).
  // We keep examId and tutorialId separately so switching tabs preserves each spot.
  if (hasExams) {
    if (!practiceExamView.examId || !exams.some((e) => e.id === practiceExamView.examId)) {
      practiceExamView.examId = exams[0].id
    }
  } else {
    practiceExamView.examId = null
  }
  if (hasTutorials) {
    if (!practiceExamView.tutorialId || !tutorials.some((t) => t.id === practiceExamView.tutorialId)) {
      practiceExamView.tutorialId = tutorials[0].id
    }
  } else {
    practiceExamView.tutorialId = null
  }

  const isPaperSurface = practiceExamView.tab === 'exams' || practiceExamView.tab === 'tutorials'
  const currentExam = getCurrentPaper(course)
  const examId = currentExam?.id || null
  const hasPaperPdf     = !!currentExam?.pdf
  const hasSolutionsPdf = !!currentExam?.solutionsPdf
  // A practice bank can exist even without a question PDF — e.g. an exam
  // reconstructed from photos where we shipped a pre-built parse cache and
  // marked the exam with practiceBank:true. In that case the Practice subtab
  // is available even though hasPaperPdf is false.
  const hasPracticeBank = hasPaperPdf || !!currentExam?.practiceBank

  // PDF sub-tab availability — bounce to whatever this paper actually has
  if (isPaperSurface) {
    if (practiceExamView.examSubtab === 'pdf' && !hasPaperPdf) practiceExamView.examSubtab = hasSolutionsPdf ? 'solutions' : 'practice'
    if (practiceExamView.examSubtab === 'solutions' && !hasSolutionsPdf) practiceExamView.examSubtab = hasPaperPdf ? 'pdf' : 'practice'
    if (practiceExamView.examSubtab === 'practice' && !hasPracticeBank) practiceExamView.examSubtab = hasPaperPdf ? 'pdf' : 'solutions'
  }

  if (practiceExamView.courseId !== course.id || practiceExamView._loadedPaperId !== examId) {
    restorePracticeAttempts(course.id, examId)
  }

  const examIdEnc = examId ? encodeURIComponent(examId) : ''
  const pdfUrl = hasPaperPdf ? `/api/pdf/${encodeURIComponent(course.id)}/${examIdEnc}` : ''
  const solutionsUrl = hasSolutionsPdf ? `/api/pdf/${encodeURIComponent(course.id)}/${examIdEnc}/solutions` : ''
  const outlineKey = examId ? `${course.id}__${examId}` : course.id
  const outline = (isPaperSurface && hasPaperPdf) ? pdfOutlineCache.get(outlineKey) : null
  if (isPaperSurface && hasPaperPdf && !outline) loadPdfOutline(course.id, examId)
  if (isPaperSurface && practiceExamView.examSubtab === 'practice' && hasPracticeBank) {
    ensurePracticeExam(course.id, examId)
  }
  if (practiceExamView.tab === 'mock-questions') {
    if (mockQuestionsView.courseId !== course.id) {
      mockQuestionsView.courseId = course.id
      mockQuestionsView.chapterId = 'all'
      mockQuestionsView.topics = []
      mockQuestionsView.types = []
      mockQuestionsView.openDd = null
      mockQuestionsView.currentIndex = 0
    }
    ensureMockQuestions(course.id)
  }

  let tocHeader = ''
  let tocBody = ''
  let tocTitle = 'Practice paper outline'

  if (practiceExamView.tab === 'mock-questions') {
    tocTitle = 'Chapters'
    const mqCache = mockQuestionsCache.get(course.id)
    if (mqCache?.status === 'ready' && mqCache.questions?.length) {
      const counts = new Map()
      for (const q of mqCache.questions) counts.set(q.chapterId, (counts.get(q.chapterId) || 0) + 1)
      const total = mqCache.questions.length
      const topicsByChapter = new Map()
      if (mockQuestionsView.chapterId !== 'all') {
        for (const q of mqCache.questions) {
          if (q.chapterId !== mockQuestionsView.chapterId) continue
          const list = topicsByChapter.get(q.chapterId) || new Map()
          list.set(q.topic, (list.get(q.topic) || 0) + 1)
          topicsByChapter.set(q.chapterId, list)
        }
      }
      tocBody = `
        <ol class="pdf-outline mq-toc">
          <li class="lvl-1 ${mockQuestionsView.chapterId === 'all' ? 'active' : ''}">
            <a href="javascript:void(0)" data-mq-toc-chapter="all">All chapters <small>(${total})</small></a>
          </li>
          ${course.chapters.map((ch) => {
            const c = counts.get(ch.id) || 0
            if (c === 0) return ''
            const active = mockQuestionsView.chapterId === ch.id
            const topicList = active && topicsByChapter.has(ch.id)
              ? [...topicsByChapter.get(ch.id).entries()].map(([t, n]) => `
                  <li class="lvl-2 ${mockQuestionsView.topics.includes(t) ? 'active' : ''}">
                    <a href="javascript:void(0)" data-mq-toc-topic="${escapeHtml(t)}">${escapeHtml(t)} <small>(${n})</small></a>
                  </li>
                `).join('')
              : ''
            return `
              <li class="lvl-1 ${active ? 'active' : ''} toc-chapter-row">
                <a href="javascript:void(0)" data-mq-toc-chapter="${ch.id}" class="toc-chapter-filter">Ch ${ch.id} — ${escapeHtml(ch.name)} <small>(${c})</small></a>
                <a href="#/course/${course.id}/chapter/${ch.id}" class="toc-open-chapter" title="Open chapter for revision">Open</a>
              </li>
              ${topicList}
            `
          }).join('')}
        </ol>
      `
    } else if (mqCache?.status === 'loading') {
      tocBody = '<p class="empty">Loading…</p>'
    } else if (mqCache?.status === 'generating') {
      tocBody = '<p class="empty">Generating questions via codex…</p>'
    } else {
      tocBody = '<p class="empty">No published mock questions yet.</p>'
    }
  } else if (practiceExamView.tab === 'flashcards') {
    // Flashcards panel groups itself by chapter
    tocTitle = 'Flashcards'
    tocBody = '<p class="empty">Flashcards are grouped by chapter in the main panel.</p>'
  } else if (isPaperSurface) {
    if (!hasPaperPdf) {
      tocTitle = currentExam ? `${currentExam.label}` : (practiceExamView.tab === 'tutorials' ? 'Tutorials' : 'Mock Exams')
      tocBody = '<p class="empty">No question PDF for this paper — use the Solutions or Practice sub-tabs.</p>'
    } else if (!outline || outline.status === 'loading') {
      tocBody = '<p class="empty">Reading PDF…</p>'
    } else if (outline.status === 'error') {
      tocBody = `<p class="empty error">${escapeHtml(outline.error || 'Failed to load PDF.')}</p>`
    } else if (outline.status === 'building') {
      tocBody = '<p class="empty">Preparing document outline…</p>'
    } else {
      const isNative = outline.status === 'native'
      tocHeader = `
        <div class="toc-actions">
          <small class="toc-source">${isNative ? 'Document outline' : 'Page outline'}</small>
        </div>
      `
      tocBody = (outline.items || []).length
        ? `<ol class="pdf-outline">${outline.items.map((it) => `
            <li class="lvl-${Math.min(it.depth, 3)} ${it.kind ? 'kind-' + it.kind : ''}">
              <a href="javascript:void(0)" data-pdf-page="${it.page || 1}" data-pdf-course="${course.id}">${escapeHtml(it.title)}${it.page ? ` <small>p.${it.page}</small>` : ''}</a>
            </li>
          `).join('')}</ol>`
        : '<p class="empty">No entries.</p>'
    }
  }

  return `
    <div class="study-surface-page" style="--accent:${course.accent}">
      <article class="study-surface-main chapter-main">
        <header class="study-surface-header">
          <div class="chapter-page-context">
            <a class="chapter-course-back" href="#/course/${course.id}">${ICONS.back}<span>${escapeHtml(course.code)} ${escapeHtml(course.shortName || '')}</span></a>
            <span>Course practice</span>
          </div>
          <div class="study-surface-title-row">
            <div><h1>Practice</h1><p>${escapeHtml(course.name)}</p></div>
            <div class="chapter-page-actions">
              <button type="button" class="chapter-action" data-mobile-study-panel="outline" aria-pressed="${mobileStudyPanel === 'outline'}">${uiIcon('list')}<span>${isPaperSurface ? 'Paper outline' : 'Chapters'}</span></button>
              <button type="button" class="chapter-action" data-mobile-study-panel="tools" aria-pressed="${mobileStudyPanel === 'tools'}">${uiIcon('sparkle')}<span>Course tutor</span></button>
            </div>
          </div>
          ${renderSurfaceTabs(course, { active: practiceExamView.tab, surface: 'mock-exam' })}
        </header>
        <div class="study-surface-stage">
          ${isPaperSurface ? renderMockExamsSurface(course, currentExam, getActivePapers(course), { pdfUrl, solutionsUrl, hasPaperPdf, hasSolutionsPdf })
            : practiceExamView.tab === 'flashcards' ? `
            <div class="fc-panel">${renderFlashcardsView(course)}</div>
          ` : `
            <div class="mq-panel">${renderMockQuestionsView(course)}</div>
          `}
        </div>
      </article>
      ${renderStudyDrawerScrim()}
      <aside class="study-drawer study-drawer-left ${mobileStudyPanel === 'outline' ? 'is-open' : ''}" aria-hidden="${mobileStudyPanel !== 'outline'}" aria-label="Practice outline">
        <header class="study-drawer-header">
          <div><small>${escapeHtml(course.code)}</small><h2>${escapeHtml(tocTitle)}</h2></div>
          <button type="button" class="icon-btn" data-mobile-study-panel="outline" aria-label="Close outline">${uiIcon('close')}</button>
        </header>
        <div class="study-drawer-scroll">
          <section class="study-drawer-section practice-drawer-outline">
            ${tocHeader}
            ${tocBody}
            ${(isPaperSurface) && outline?.totalPages ? `<small class="rail-meta">${outline.totalPages} pages</small>` : ''}
          </section>
        </div>
      </aside>
      <aside class="study-drawer study-drawer-right study-tools-drawer study-tutor-drawer ${mobileStudyPanel === 'tools' ? 'is-open' : ''}" aria-hidden="${mobileStudyPanel !== 'tools'}" aria-label="Course tutor">
        <header class="study-drawer-header">
          <div><small>${escapeHtml(course.code)}</small><h2>Course tutor</h2></div>
          <button type="button" class="icon-btn" data-mobile-study-panel="tools" aria-label="Close course tutor">${uiIcon('close')}</button>
        </header>
        <div class="study-tools-panel is-tutor" role="region" aria-label="Course tutor">${renderChatPanelCourse(course)}</div>
      </aside>
    </div>
  `
}

/**
 * Renders the Mock Exams surface: an exam selector chip row, sub-tabs (PDF /
 * Solutions / Practice) for the selected exam, and the matching content panel.
 */
function renderMockExamsSurface(course, currentExam, exams, opts) {
  const { pdfUrl, solutionsUrl, hasPaperPdf, hasSolutionsPdf } = opts
  const hasPracticeBank = hasPaperPdf || !!currentExam?.practiceBank
  const subtab = practiceExamView.examSubtab

  const selector = `
    <div class="exam-selector" role="tablist" aria-label="Select exam paper">
      ${exams.map((e) => {
        const active = e.id === currentExam?.id
        const flags = []
        if (e.pdf) flags.push('paper')
        if (e.solutionsPdf) flags.push('solutions')
        if (!e.pdf && e.practiceBank) flags.push('practice')
        const partial = flags.length === 1
        const tip = `${e.label} — ${flags.join(' + ') || 'no files'}`
        return `
          <button type="button"
            class="exam-chip${active ? ' active' : ''}${partial ? ' partial' : ''}"
            data-exam-pick="${escapeHtml(e.id)}"
            role="tab"
            aria-selected="${active}"
            title="${escapeHtml(tip)}">${escapeHtml(e.label)}</button>
        `
      }).join('')}
    </div>
  `

  const subtabs = `
    <nav class="exam-subtabs" role="tablist" aria-label="Exam view">
      <button type="button" role="tab" class="exam-subtab${subtab === 'pdf' ? ' active' : ''}${!hasPaperPdf ? ' disabled' : ''}" data-exam-subtab="pdf" ${hasPaperPdf ? '' : 'disabled'}>PDF</button>
      <button type="button" role="tab" class="exam-subtab${subtab === 'solutions' ? ' active' : ''}${!hasSolutionsPdf ? ' disabled' : ''}" data-exam-subtab="solutions" ${hasSolutionsPdf ? '' : 'disabled'}>Solutions PDF</button>
      <button type="button" role="tab" class="exam-subtab${subtab === 'practice' ? ' active' : ''}${!hasPracticeBank ? ' disabled' : ''}" data-exam-subtab="practice" ${hasPracticeBank ? '' : 'disabled'}>Practice</button>
    </nav>
  `

  let body = ''
  if (subtab === 'pdf' && hasPaperPdf) {
    body = `<div class="pdf-viewer"><iframe id="mock-pdf-iframe" src="${pdfUrl}#view=FitH" title="Mock exam PDF" allow="fullscreen"></iframe></div>`
  } else if (subtab === 'solutions' && hasSolutionsPdf) {
    body = `<div class="pdf-viewer"><iframe id="mock-solutions-iframe" src="${solutionsUrl}#view=FitH" title="Solutions PDF" allow="fullscreen"></iframe></div>`
  } else if (subtab === 'practice' && hasPracticeBank) {
    body = renderPracticeExam(course)
  } else {
    body = '<p class="empty">This view is unavailable for the selected exam.</p>'
  }

  return `
    ${selector}
    ${subtabs}
    ${body}
  `
}

function parentOf(label) {
  const m = label.match(/^(Q\d+)/i)
  return m ? m[1].toUpperCase() : label
}

function partLabel(label) {
  // strip leading "Q1" → "(a)", "(b)(ii)", or empty
  const stripped = label.replace(/^Q\d+\s*/i, '').trim()
  return stripped || '—'
}

function groupQuestions(questions) {
  return questions.map((q) => ({
    parent: q.label,
    parentLabel: parentOf(q.label),
    parts: [q]
  }))
}

function renderPracticeExam(course) {
  const examId = getActivePaperId()
  const cache = practiceExamCache.get(practiceExamCacheKey(course.id, examId))
  if (!cache || cache.status === 'extracting') {
    return `<div class="practice-preparing"><span class="practice-preparing-index">01</span><div><strong>Preparing the paper</strong><p>Loading the indexed text already extracted from the course corpus.</p></div></div>`
  }
  if (cache.status === 'parsing') {
    return `<div class="loader practice-loader">Loading the prepared exam structure…</div>`
  }
  if (cache.status === 'error') {
    return `
      <div class="loader error">Failed to load practice exam: ${escapeHtml(cache.error || 'unknown error')}</div>
      <button type="button" class="load-q-btn" data-practice-retry="${course.id}">Retry</button>
    `
  }
  const questions = cache.questions || []
  if (!questions.length) return `<p class="empty">No questions parsed yet.</p>`

  const groups = groupQuestions(questions)
  let currentQid = practiceExamView.currentQid
  // Find which group the currentQid belongs to
  let groupIdx = groups.findIndex((g) => g.parts.some((p) => practiceCanonicalKey(p.id || p.label) === practiceCanonicalKey(currentQid)))
  if (groupIdx < 0) {
    groupIdx = 0
    practiceExamView.currentQid = groups[0].parts[0].id
  }
  const group = groups[groupIdx]
  const totalMarks = group.parts.reduce((s, p) => s + (p.marks || 0), 0)

  return `
    <div class="practice-exam">
      <div class="practice-toolbar">
        <small class="rail-meta">${questions.length} questions · shared problem statements stay visible, one sub-question at a time</small>
        <button type="button" class="tb-btn clear-link" data-clear-scope="exam" data-clear-course="${course.id}" data-clear-exam="${getActivePaperId() || ''}" data-clear-exam-label="${escapeHtml(getCurrentPaper(course)?.label || 'this practice exam')}" title="Clear your answers and checks for this practice exam">Clear my work</button>
      </div>

      ${renderPracticeProgress(groups, groupIdx)}

      <div class="practice-pager">
        <button type="button" class="q-nav-btn" data-practice-nav="prev" ${groupIdx === 0 ? 'disabled' : ''}>← Previous</button>
        <span class="practice-pos">${group.parent} <small>· ${totalMarks} marks · ${groupIdx + 1} of ${groups.length}</small></span>
        <button type="button" class="q-nav-btn primary" data-practice-nav="next" ${groupIdx >= groups.length - 1 ? 'disabled' : ''}>Next →</button>
      </div>

      <div class="practice-group">
        <header class="practice-group-head">
          <p class="eyebrow">Question · ${totalMarks} marks</p>
          <h2>${group.parent}</h2>
        </header>

        ${renderSharedContext(group)}

        ${group.parts.map((q) => renderPracticePart(q, course)).join('')}
      </div>
    </div>
  `
}

// Per-question progress strip across the whole exam. Cells colored by attempt-state.
function renderPracticeProgress(groups, currentGroupIdx) {
  // Build a flat list of every leaf question with its parent group index.
  const cells = []
  groups.forEach((g, gIdx) => {
    g.parts.forEach((q) => {
      const grade = practiceGradeFor(q)
      const score = practiceGradeScore(grade)
      const marks = q.marks || 1
      let bucket = 'unanswered'
      if (score != null) {
        const pct = (score / marks) * 100
        if (pct < 40) bucket = 'low'
        else if (pct < 60) bucket = 'mid'
        else if (pct < 85) bucket = 'good'
        else bucket = 'great'
      }
      cells.push({ qid: q.id, gIdx, label: q.label, bucket, score, marks })
    })
  })
  const answered = cells.filter((c) => c.bucket !== 'unanswered').length
  return `
    <div class="q-progress practice-progress">
      <div class="q-progress-meta">
        <p class="eyebrow">Progress</p>
        <p class="q-progress-line">
          <strong>${answered}</strong> of <strong>${cells.length}</strong> graded
        </p>
      </div>
      <div class="q-progress-bar" role="navigation" aria-label="Practice exam progress">
        ${cells.map((c) => {
          const isCurrent = c.gIdx === currentGroupIdx
          const tip = c.bucket === 'unanswered'
            ? `${c.label}: not graded`
            : `${c.label}: ${c.score}/${c.marks}`
          return `<button type="button" class="q-progress-cell q-progress-${c.bucket} ${isCurrent ? 'is-current' : ''}" data-practice-jump-qid="${c.qid}" title="${escapeHtml(tip)}">${escapeHtml(c.label.replace(/^Q/, ''))}</button>`
        }).join('')}
      </div>
      <div class="q-progress-legend">
        <span class="q-legend-item"><span class="q-legend-swatch q-progress-unanswered"></span>Not graded</span>
        <span class="q-legend-item"><span class="q-legend-swatch q-progress-low"></span>&lt;40%</span>
        <span class="q-legend-item"><span class="q-legend-swatch q-progress-mid"></span>40–60%</span>
        <span class="q-legend-item"><span class="q-legend-swatch q-progress-good"></span>60–85%</span>
        <span class="q-legend-item"><span class="q-legend-swatch q-progress-great"></span>≥85%</span>
      </div>
    </div>
  `
}

function renderSharedContext(group) {
  // Find the first non-empty sharedContext among the parts. All parts of the same parent should
  // share the same context; we render it once at the top of the group.
  const sc = group.parts.map((p) => (p.sharedContext || '').trim()).find((s) => s.length > 0)
  if (!sc) return ''
  return `
    <section class="practice-shared-context">
      <h4>Problem statement</h4>
      <div class="markdown-body">${renderMarkdown(sc)}</div>
    </section>
  `
}

// Detect MC / TF question type from the parsed question text. Falls back to 'written'.
// Returns { type, options, cleanText } — cleanText has the option list stripped.
function detectPracticeQuestionType(q) {
	  // Honour structured fields if the parser already set them (post-regenerate).
	  if (q.type === 'mc' && Array.isArray(q.options) && q.options.length >= 2) {
	    return { type: 'mc', options: q.options, cleanText: q.text || '' }
	  }
	  if (q.type === 'multi' && Array.isArray(q.options) && q.options.length >= 2) {
	    return { type: 'multi', options: q.options, cleanText: q.text || '' }
	  }
  if (q.type === 'tf') {
    return { type: 'tf', options: ['True', 'False'], cleanText: q.text || '' }
  }
  if (q.type && q.type !== 'mc' && q.type !== 'tf') {
    return { type: q.type, options: q.options || [], cleanText: q.text || '' }
  }

  const text = q.text || ''
  const multiMarker = /\((?:MC|Multiple\s*Choice|Multi[-\s]*Select)\s*\)/i.test(text)
  const singleMarker = /\((?:SC|Single\s*Choice|Best\s*Option)\s*\)/i.test(text)
  const mcMarker = multiMarker || singleMarker
  const tfMarker = /\((?:T\/F|True\/False|TF)\)/i.test(text)

  // Find option markers like " a) ", " b) ", " c) " etc. anywhere in the text.
  const optRe = /(?:^|\s)([a-eA-E])\)\s+/g
  const positions = []
  let m
  while ((m = optRe.exec(text))) {
    // The start of the actual option text (after "a) "):
    const optStart = m.index + m[0].length
    positions.push({ letter: m[1].toLowerCase(), start: m.index + (m[0].startsWith(' ') ? 1 : 0), bodyStart: optStart })
  }
  // Require at least two consecutive letters (a, b minimum).
  const consecutive = positions.length >= 2 && positions.slice(1).every((p, i) =>
    p.letter.charCodeAt(0) === positions[i].letter.charCodeAt(0) + 1
  )
  if (consecutive && (mcMarker || positions.length >= 3)) {
    const options = positions.map((p, i) => {
      const end = i + 1 < positions.length ? positions[i + 1].start : text.length
      return text.slice(p.bodyStart, end).trim().replace(/^[•\-\s]+/, '').replace(/\s+/g, ' ')
    })
    const stem = text.slice(0, positions[0].start)
      .replace(/\((?:MC|Multiple\s*Choice|Multi[-\s]*Select|SC|Single\s*Choice|Best\s*Option)\s*\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
    const expected = String(q.modelAnswer || '')
    const expectedLetters = Array.from(expected.matchAll(/(?:^|\s)([a-eA-E])\)/g)).map((x) => x[1].toLowerCase())
    const expectedOptionHits = options.filter((opt) => expected.includes(opt)).length
    const isMulti = multiMarker && !singleMarker && (expectedLetters.length > 1 || expectedOptionHits > 1)
    return { type: isMulti ? 'multi' : 'mc', options, cleanText: stem }
  }
  if (tfMarker) {
    const cleanText = text.replace(/\((?:T\/F|True\/False|TF)\)/gi, '').replace(/\s+/g, ' ').trim()
    return { type: 'tf', options: ['True', 'False'], cleanText }
  }
  return { type: 'written', options: [], cleanText: text }
}

// Figures attached to a practice question (charts / diagrams / headlines
// cropped from the source paper). Stored as image files under the exam's
// asset dir and referenced by q.figures = ["fig1.png", ...]. Inline SVG /
// markdown figures live in the question text itself and are handled by
// renderMarkdown, so this only deals with the image-file case.
function renderPracticeFigures(q, course) {
  const figs = Array.isArray(q.figures) ? q.figures.filter(Boolean) : []
  if (!figs.length) return ''
  const examId = getActivePaperId()
  const base = `/api/practice-exam-asset/${encodeURIComponent(course.id)}/${encodeURIComponent(examId || 'default')}`
  return `
    <div class="practice-figures">
      ${figs.map((f) => `<img class="practice-figure" src="${base}/${encodeURIComponent(f)}" alt="Figure for ${escapeHtml(q.label)}">`).join('')}
    </div>
  `
}

function renderPracticePart(q, course) {
  const qid = q.id
  const attempt = practiceExamView.attempts[qid] || ''
  const guidance = practiceExamView.guidance[qid]
  const grading = practiceExamView.grading[qid]
  const grade = practiceGradeFor(q)
  const visibleScore = practiceGradeScore(grade)
  const showGuidance = practiceExamView.showGuidance[qid]
  const showAnswer = practiceExamView.showAnswer[qid]
  const { type, options, cleanText } = detectPracticeQuestionType(q)
  const typeLabel = QUESTION_TYPE_LABELS[type] || (type === 'mc' ? 'Best option' : type)

  let input = ''
  if (type === 'multi' && options.length) {
    const selected = String(attempt || '').split('\n').map((x) => x.trim()).filter(Boolean)
    input = `
      <div class="q-options">
        ${options.map((opt) => `
          <label>
            <input type="checkbox" value="${escapeHtml(opt)}" ${selected.includes(opt) ? 'checked' : ''} data-practice-attempt="${qid}">
            ${renderInlineMarkdown(opt)}
          </label>
        `).join('')}
      </div>
    `
  } else if (type === 'mc' && options.length) {
    input = `
      <div class="q-options">
        ${options.map((opt) => `
          <label>
            <input type="radio" name="practice-${qid}" value="${escapeHtml(opt)}" ${attempt === opt ? 'checked' : ''} data-practice-attempt="${qid}">
            ${renderInlineMarkdown(opt)}
          </label>
        `).join('')}
      </div>
    `
  } else if (type === 'tf') {
    input = `
      <div class="q-options">
        ${['True', 'False'].map((v) => `
          <label>
            <input type="radio" name="practice-${qid}" value="${v}" ${attempt === v ? 'checked' : ''} data-practice-attempt="${qid}">
            ${v}
          </label>
        `).join('')}
      </div>
    `
  } else if (type === 'pseudocode') {
    const lang = (practiceExamView.codeLang && practiceExamView.codeLang[qid]) || 'pseudocode'
    input = `
      <div class="attempt-drop code-attempt" data-practice-drop="${qid}">
        <div class="code-editor-toolbar">
          <label class="code-lang-label">Language
            <select class="code-lang-select" data-code-lang-select="${qid}">
              <option value="pseudocode"${lang === 'pseudocode' ? ' selected' : ''}>Pseudocode</option>
              <option value="c"${lang === 'c' ? ' selected' : ''}>C / C++</option>
              <option value="asm"${lang === 'asm' ? ' selected' : ''}>Assembly (ARM / GAS)</option>
            </select>
          </label>
        </div>
        <textarea class="q-input code cm-target" data-practice-attempt="${qid}" data-code-lang="${lang}" placeholder="Your answer for ${escapeHtml(q.label)}…">${escapeHtml(attempt)}</textarea>
      </div>
    `
  } else {
    input = `
      <div class="attempt-drop" data-practice-drop="${qid}">
        <textarea class="q-input" data-practice-attempt="${qid}" placeholder="Your answer for ${escapeHtml(q.label)}…">${escapeHtml(attempt)}</textarea>
      </div>
    `
  }

  return `
    <li class="question-card practice-part" id="part-${qid}">
      <div class="q-head">
        <div class="q-head-left">
          <span class="q-num">${escapeHtml(q.label)}</span>
          <span class="q-type">${escapeHtml(typeLabel)}</span>
          <span class="q-diff diff-medium">${q.marks} marks</span>
          ${visibleScore != null ? `<span class="q-source">${visibleScore}/${q.marks}</span>` : ''}
        </div>
      </div>
      <div class="q-body markdown-body">${renderMarkdown(cleanText)}</div>
      ${renderPracticeFigures(q, course)}
      ${input}
      <div class="q-actions">
        <button type="button" class="btn btn-primary" data-practice-grade="${qid}" ${grading ? 'disabled' : ''}>${grading ? 'Checking…' : 'Check answer'}</button>
        <button type="button" class="btn btn-ghost" data-toggle-answer="${qid}">${showAnswer ? 'Hide ideal answer' : 'Reveal ideal answer'}</button>
        <button type="button" class="btn btn-ghost clear-link" data-clear-scope="question" data-clear-course="${course.id}" data-clear-question="${qid}" title="Clear your answer and check for this question">Clear answer</button>
      </div>

      ${showAnswer ? `
        <div class="q-expected">
          <strong>Ideal answer (model):</strong>
          ${renderMarkdown(q.modelAnswer || '_(no model answer recorded)_')}
        </div>
      ` : ''}

      ${grade?.error ? `<div class="loader error">${escapeHtml(grade.error)}</div>` : ''}
      ${grade?.correction ? `<div class="q-grade">${renderCorrectionMarkdown(grade.correction, grade.score, q.marks)}</div>` : ''}
    </li>
  `
}

function practiceGradeFor(q) {
  if (!q) return null
  const keys = practiceGradeKeys(q)
  for (const key of keys) {
    if (practiceExamView.grades[key]) return practiceExamView.grades[key]
  }
  // Canonical fallback — ONLY by id, never label, for the same reason as in
  // practiceGradeKeys. If a tutorial has two questions both labelled "Q1"
  // because they belong to different sections, falling through to the label
  // here would silently match the other section's grade.
  const normalizedId = practiceCanonicalKey(q.id)
  if (normalizedId) {
    const entry = Object.entries(practiceExamView.grades).find(([key]) =>
      practiceCanonicalKey(key) === normalizedId
    )
    if (entry) {
      rememberPracticeGrade(q, entry[1], entry[0])
      return entry[1]
    }
  }
  return null
}

function practiceGradeScore(grade) {
  return numericScore(grade?.score ?? scoreFromCorrection(grade?.correction))
}

function renderChatPanelCourse(course) {
  const chapter = { id: 'mock', name: 'Mock exam' }
  const chat = getChat(course.id, 'mock')
  const messagesHtml = chat.messages.length
    ? chat.messages.map((m) => `
        <div class="chat-msg chat-${m.role}">
          <span class="chat-role">${m.role === 'user' ? 'You' : 'Tutor'}</span>
          <div class="chat-body">${m.role === 'user' ? escapeHtml(m.content).replace(/\n/g, '<br>') : renderMarkdown(m.content)}</div>
        </div>
      `).join('')
    : `<p class="chat-empty">Ask a question about the <strong>${course.code}</strong> mock exam. The tutor has the full course materials in scope.</p>`

  return `
    <section class="rail-card chat-panel chat-panel-workspace" data-chat-key="${course.id}/mock">
      <header class="chat-panel-context">
        <div><h4>Tutor</h4><small class="rail-meta">Grounded in ${course.code} course material · exam focus</small></div>
        <small class="ai-allowance">${aiAllowance('chat')}</small>
      </header>
      <div class="chat-messages">${messagesHtml}</div>
      ${chat.sending ? '<div class="chat-thinking">Checking the course material…</div>' : ''}
      <form class="chat-form" data-chat-form="${course.id}/mock">
        <textarea class="chat-input" data-chat-input="${course.id}/mock" placeholder="Ask: 'Q3 part b — what's the trick here?'" rows="2" ${chat.sending ? 'disabled' : ''}>${escapeHtml(chat.draft || '')}</textarea>
        <div class="chat-actions">
          <button type="submit" class="chat-send" ${chat.sending ? 'disabled' : ''}>${chat.sending ? 'Sending…' : 'Send'}</button>
          ${chat.messages.length ? `<button type="button" class="chat-clear" data-chat-clear="${course.id}/mock">Clear history</button>` : ''}
        </div>
      </form>
    </section>
  `
}

async function loadChapter(courseId, chapterId, relPath) {
  rememberRecentChapter(courseId, chapterId)
  const key = `${courseId}/${chapterId}/${relPath || ''}`
  if (chapterCache.get(key)?.loading) return
  const requestId = ++loadingRequestId
  chapterCache.set(key, { loading: true, requestId, startedAt: Date.now(), phase: 'Connecting to your workspace…', step: 1 })
  const updatePhase = (phase, step) => {
    const current = chapterCache.get(key)
    if (!current?.loading || current.requestId !== requestId) return
    chapterCache.set(key, { ...current, phase, step })
    render()
  }
  const phaseTimers = [
    setTimeout(() => updatePhase('Downloading maintained chapter material…', 2), 900),
    setTimeout(() => updatePhase('Preparing diagrams and study tools…', 3), 3500)
  ]
  try {
    const url = `/api/chapter/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}${relPath ? '/' + relPath.split('/').map(encodeURIComponent).join('/') : ''}`
    const data = await fetchJson(url, { timeoutMs: 15000 })
    chapterCache.set(key, { data })
  } catch (err) {
    chapterCache.set(key, { error: err.message })
  } finally {
    phaseTimers.forEach(clearTimeout)
  }
  render()
}

async function deleteQuestion(courseId, chapterId, questionId) {
  const ok = await showConfirm({
    title: 'Delete this question?',
    message: 'This removes it from the bank for this chapter. Your typed answer and grading for this question will also be discarded. The action cannot be undone.',
    okLabel: 'Delete question',
    cancelLabel: 'Keep it',
    danger: true,
  })
  if (!ok) return
  try {
    await fetchJson(`/api/questions/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}/${encodeURIComponent(questionId)}`, {
      method: 'DELETE'
    })
    // Drop from local cache + attempt state
    const cacheKey = `${courseId}/${chapterId}`
    const cstate = questionsCache.get(cacheKey)
    if (cstate?.questions) {
      cstate.questions = cstate.questions.filter((q) => q.id !== questionId)
      questionsCache.set(cacheKey, cstate)
    }
    const attKey = `${courseId}/${chapterId}/${questionId}`
    if (attemptState.has(attKey)) {
      attemptState.delete(attKey)
      saveAttemptState()
    }
    // Reset nav.index if it went past the end
    if (route.page === 'chapter') {
      const nav = getQuestionNav(route.courseId, route.chapterId)
      const total = cstate?.questions?.length || 0
      if (nav.index >= total) nav.index = Math.max(0, total - 1)
    }
    render()
  } catch (err) {
    alert('Delete failed: ' + err.message)
  }
}

async function loadQuestions(courseId, chapterId, { force = false, auto = false } = {}) {
  const key = `${courseId}/${chapterId}`
  questionsCache.set(key, { loading: true, auto })
  render()
  try {
    if (force) {
      await fetch(`/api/questions/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}`, { method: 'DELETE' })
    }
    const data = await fetchJson(`/api/questions/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}`)
    questionsCache.set(key, { questions: data.questions || [] })
  } catch (err) {
    questionsCache.set(key, { error: err.message })
  }
  render()
}

async function gradeAttempt(attemptKey) {
  const [courseId, chapterId, qid] = splitAttemptKey(attemptKey)
  let q = null
  const qState = questionsCache.get(`${courseId}/${chapterId}`)
  if (qState?.questions) q = qState.questions.find((x) => x.id === qid)
  if (!q) {
    const mqState = mockQuestionsCache.get(courseId)
    if (mqState?.questions) q = mqState.questions.find((x) => x.id === qid)
  }
  if (!q) return
  const att = attemptState.get(attemptKey) || {}
  const attempt = q.type === 'tf' ? `${att.value || ''}${att.note ? ' — ' + att.note : ''}` : (att.value || '')
  if (!attempt.trim()) {
    attemptState.set(attemptKey, { ...att, correction: '_Provide an attempt first._' })
    render()
    return
  }
  attemptState.set(attemptKey, { ...att, grading: true })
  render()

  const course = window.__platformState.courses.find((c) => c.id === courseId)
  const chapter = course.chapters.find((c) => c.id === chapterId)
  const attemptImages = (att.images || []).slice()
  try {
    const data = await fetchJson('/api/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseCode: course.code,
        chapterName: chapter.name,
        question: q,
        attempt,
        attemptImages,
        _meta: { courseId, chapterId }
      })
    })
    attemptState.set(attemptKey, { ...att, grading: false, correction: data.correction, score: data.score })
    if (data.savedAsMistake) mistakeCache = null // refresh on next load
  } catch (err) {
    attemptState.set(attemptKey, { ...att, grading: false, correction: `_Grading failed: ${err.message}_` })
  }
  render()
}

async function addToSr(questionId) {
  try {
    await fetchJson('/api/sr/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId })
    })
    srDueCache = null
    srMembership.add(questionId)
    const btn = document.querySelector(`[data-sr-add="${questionId}"]`)
    if (btn) { btn.textContent = '✓ In flashcards'; btn.disabled = true; btn.classList.add('btn-success'); btn.removeAttribute('data-sr-add') }
  } catch (e) { alert('SR add failed: ' + e.message) }
}

async function resolveMistake(id) {
  await fetchJson(`/api/mistakes/${encodeURIComponent(id)}/resolve`, { method: 'POST' })
  mistakeCache = null
  await loadMistakes(true)
  render()
}

async function deleteMistake(id) {
  if (!confirm('Delete this mistake from the bank?')) return
  await fetchJson(`/api/mistakes/${encodeURIComponent(id)}`, { method: 'DELETE' })
  mistakeCache = null
  await loadMistakes(true)
  render()
}

function splitAttemptKey(key) {
  const idx1 = key.indexOf('/')
  const idx2 = key.indexOf('/', idx1 + 1)
  return [key.slice(0, idx1), key.slice(idx1 + 1, idx2), key.slice(idx2 + 1)]
}

function renderInlineMarkdown(s) {
  if (typeof marked === 'undefined') return escapeHtml(s)
  const blocks = []
  const placeholder = (i) => `<span data-mathblock="${i}"></span>`
  let str = String(s || '')
  // 1) Extract existing $...$ math first.
  str = str.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => {
    blocks.push({ display: true, body: m })
    return placeholder(blocks.length - 1)
  })
  str = str.replace(/(^|[^\\])\$((?:\\\$|[^\n$])+?)\$/g, (_, lead, m) => {
    blocks.push({ display: false, body: m })
    return `${lead}${placeholder(blocks.length - 1)}`
  })
  // 2) Auto-wrap bare LaTeX in the remaining text.
  str = autoWrapBareLatex(str)
  // 3) Re-extract any new $...$ from the auto-wrap.
  str = str.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => {
    blocks.push({ display: true, body: m })
    return placeholder(blocks.length - 1)
  })
  str = str.replace(/(^|[^\\])\$((?:\\\$|[^\n$])+?)\$/g, (_, lead, m) => {
    blocks.push({ display: false, body: m })
    return `${lead}${placeholder(blocks.length - 1)}`
  })
  if (typeof marked === 'undefined') { ensureStudyDeps(); return escapeHtml(s) }
  try {
    let html = marked.parseInline(str, { gfm: true })
    // Protect currency/stray '$' from KaTeX auto-render — see renderMarkdown.
    // Real math is still in placeholders here; restore it to bare $…$ after.
    html = html.replace(/\$/g, '<span class="nomath">$</span>')
    html = html.replace(/<span data-mathblock="(\d+)"><\/span>/g, (_, idx) => {
      const b = blocks[+idx]
      if (!b) return ''
      return b.display ? `$$${b.body}$$` : `$${b.body}$`
    })
    return html
  } catch { return escapeHtml(s) }
}

// Defensive: codex sometimes outputs bare LaTeX inside parentheses (e.g. "(n^{\log_2 6})") or
// raw "\Theta(...)" / "\log_2 n" outside any $...$ delimiter. Wrap such fragments so KaTeX picks
// them up. Conservative: only triggers when the content contains LaTeX-command / sub/super-script
// syntax or operator-style math.
function autoWrapBareLatex(text) {
  if (!text || !text.includes('(')) return text
  const looksLikeMath = (s) =>
    /\\[a-zA-Z]+/.test(s) ||
    /\^\{|_\{/.test(s) ||
    /\^[A-Za-z0-9]\b/.test(s) ||
    /_[A-Za-z0-9]\b/.test(s)
  // Allow one level of nested parens — covers "(O(n^3))", "(T(n)=\Theta(n^{\log_2 6}))" etc.
  return text.replace(/\(((?:[^()]|\([^()]*\))+)\)/g, (m, inner) => {
    if (inner.length > 200) return m // too long; probably prose
    if (looksLikeMath(inner)) return `$${inner}$`
    return m
  })
}

function normalizeCorrectionMarkdown(md) {
  let s = String(md || '').trim()
  if (!s) return ''

  // Older cached grades used one compressed paragraph:
  // "**Right:** ... **Missing/Wrong:** ... **Tip:** ..."
  // Reflow those into readable study sections without changing the content.
  s = s.replace(/\*\*Right:\*\*/gi, '**What you got right**\n-')
  s = s.replace(/\*\*What'?s right:\*\*/gi, '**What you got right**\n-')
  s = s.replace(/\*\*Missing\s*\/\s*Wrong:\*\*/gi, '\n\n**Missing / wrong**\n-')
  s = s.replace(/\*\*Missing\/Wrong:\*\*/gi, '\n\n**Missing / wrong**\n-')
  s = s.replace(/\*\*Tip:\*\*/gi, '\n\n**How to improve**\n-')
  s = s.replace(/\*\*Tips for the real exam:\*\*/gi, '\n\n**How to improve**\n-')
  s = s.replace(/\*\*Model answer:\*\*/gi, '\n\n**Model answer**\n')
  s = s.replace(/\*\*Model answer\*\*\s*/gi, '\n\n**Model answer**\n')
  s = s.replace(/\*\*Score:\s*([^*]+)\*\*/gi, '**Score:** $1')

  // Some model responses come back as "**Model answer False. ...**", which
  // makes the entire answer bold. Split the label from the answer body.
  s = s.replace(/\*\*Model answer\s+([\s\S]*?)\*\*/gi, (_, body) => {
    return `\n\n**Model answer**\n${body.trim()}`
  })

  // If a legacy correction still has section labels in plain text, split them
  // onto their own lines. Keep this conservative so normal prose is untouched.
  s = s.replace(/(^|\s)(Right:)/g, '$1\n\n**What you got right**\n-')
  s = s.replace(/\s+(Missing\s*\/\s*Wrong:|Missing\/Wrong:)/g, '\n\n**Missing / wrong**\n-')
  s = s.replace(/\s+(Tip:)/g, '\n\n**How to improve**\n-')
  s = s.replace(/\s+(Model answer:)\s*/gi, '\n\n**Model answer**\n')

  return s.replace(/\n{3,}/g, '\n\n').trim()
}

function renderCorrectionMarkdown(md, score = null, maxScore = 10) {
  let normalized = normalizeCorrectionMarkdown(md)
  if (score != null && !/^\s*\*\*Score:\*\*/im.test(normalized)) {
    const shown = Number.isFinite(Number(score)) ? Number(score).toFixed(Number.isInteger(Number(score)) ? 0 : 1) : String(score)
    normalized = `**Score:** ${shown}/${maxScore}\n\n${normalized}`
  }
  normalized = normalized.replace(/^\s*\*\*Score:\*\*\s*([^\n]+)\n*/i, (_, value) => {
    return `<div class="q-score-line"><strong>Score</strong><span>${escapeHtml(value.trim())}</span></div>\n\n`
  })
  return renderMarkdown(normalized)
}

function scoreFromCorrection(correction) {
  // Mirror parseScore() in server.mjs: allow LaTeX/markdown delimiters between
  // "Score" and the numeric ratio, since the grader sometimes emits
  // "**Score:** $0/1$". Without this the heat-map cells stay grey on every
  // LLM-graded written question.
  const m = String(correction || '').match(/score[:\s*$()\\[\]_]*?(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/i)
  return m ? Number(m[1]) : null
}

function numericScore(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const direct = Number(value)
  if (Number.isFinite(direct)) return direct
  const ratio = String(value).match(/(\d+(?:\.\d+)?)\s*\/\s*\d+(?:\.\d+)?/)
  return ratio ? Number(ratio[1]) : null
}

async function ensureQuestionsSummary(courseId) {
  if (questionsSummaryCache.has(courseId)) return
  questionsSummaryCache.set(courseId, { loading: true })
  try {
    const data = await fetchJson(`/api/questions-summary/${encodeURIComponent(courseId)}`)
    questionsSummaryCache.set(courseId, data)
  } catch (err) {
    questionsSummaryCache.set(courseId, { error: err.message, byChapter: {} })
  }
  render()
}

function renderMarkdown(md, courseId, chapterId) {
  if (typeof marked === 'undefined') return `<pre>${escapeHtml(md)}</pre>`

  const blocks = []
  let s = String(md || '')
  const placeholder = (i) => `<span data-mathblock="${i}"></span>`

  // 1) Extract raw diagram/interactive HTML before math parsing. SVG text often
  // contains dollar-heavy examples (PHC strings, formulas) that otherwise get
  // mistaken for LaTeX and tear the raw HTML into visible code blocks.
  s = s.replace(/<section\b[^>]*class="[^"]*\bcipher-workthrough\b[^"]*"[^>]*>[\s\S]*?<\/section>/g, (match) => {
    blocks.push({ kind: 'html', body: match })
    return `\n\n${placeholder(blocks.length - 1)}\n\n`
  })
  s = s.replace(/<figure\b[\s\S]*?<\/figure>/g, (match) => {
    blocks.push({ kind: 'html', body: match })
    return `\n\n${placeholder(blocks.length - 1)}\n\n`
  })

  // 2) Extract code blocks first so we don't auto-wrap LaTeX-like content inside them.
  s = s.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match) => {
    blocks.push({ kind: 'code', body: match })
    return `\n\n${placeholder(blocks.length - 1)}\n\n`
  })
  // Inline code often contains dollar-separated formats ($algo$salt$hash).
  // Protect it before math extraction so placeholder spans never leak into code.
  s = s.replace(/`([^`\n]+)`/g, (_, code) => {
    blocks.push({ kind: 'inlineCode', body: code })
    return placeholder(blocks.length - 1)
  })
  // 3) Extract existing $$...$$ and $...$ math so autoWrap leaves them alone.
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => {
    blocks.push({ kind: 'math', display: true, body: m })
    return `\n\n${placeholder(blocks.length - 1)}\n\n`
  })
  s = s.replace(/(^|[^\\])\$((?:\\\$|[^\n$])+?)\$/g, (_, lead, m) => {
    blocks.push({ kind: 'math', display: false, body: m })
    return `${lead}${placeholder(blocks.length - 1)}`
  })
  // 4) Defensive auto-wrap of bare LaTeX in the remaining prose only.
  s = autoWrapBareLatex(s)
  // 5) Re-extract any $...$ that the auto-wrap introduced.
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => {
    blocks.push({ kind: 'math', display: true, body: m })
    return `\n\n${placeholder(blocks.length - 1)}\n\n`
  })
  s = s.replace(/(^|[^\\])\$((?:\\\$|[^\n$])+?)\$/g, (_, lead, m) => {
    blocks.push({ kind: 'math', display: false, body: m })
    return `${lead}${placeholder(blocks.length - 1)}`
  })

  s = s.replace(/^(>\s*\[!([a-zA-Z]+)\]([+-]?)\s*(.*?)$\n((?:^>\s?.*$\n?)*)?)/gm, (_, full, type, fold, title, body) => {
    const open = fold === '-' ? '' : 'open'
    const inner = (body || '').replace(/^>\s?/gm, '').trim()
    return `<details class="callout callout-${type.toLowerCase()}" ${open}>\n<summary>${escapeHtml(title || type)}</summary>\n\n${inner}\n\n</details>\n\n`
  })

  // Obsidian image-embed syntax: ![[file.png]] → <img> served from the
  // chapter folder. Must run BEFORE the [[…]] wikilink handler, else the
  // wikilink regex eats the inner [[…]] and the ! gets stranded outside a
  // text-only span. courseId+chapterId are passed into renderMarkdown so the
  // server's /api/chapter-asset route knows where to look.
  if (courseId && chapterId) {
    s = s.replace(/!\[\[([^\]\n]+\.(?:png|jpg|jpeg|gif|svg|webp))\]\]/gi, (_, file) => {
      const url = `/api/chapter-asset/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}/${encodeURIComponent(file.trim())}`
      return `<img class="md-embed-img" src="${url}" alt="${escapeHtml(file)}">`
    })
  }
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_, link) => {
    const [target, label] = link.split('|')
    return `<span class="wikilink" title="${escapeHtml(target)}">${escapeHtml(label || target)}</span>`
  })

  if (typeof marked === 'undefined') { ensureStudyDeps(); return `<p>${escapeHtml(s)}</p>` }
  let html = marked.parse(s, { gfm: true, breaks: false })

  // Protect currency / stray dollar signs. At this point every real math span
  // is still a <span data-mathblock> placeholder, so any literal '$' left in
  // the HTML is NON-math (e.g. "win $2 ... lose $2"). Wrap each in a span that
  // KaTeX auto-render is told to ignore, otherwise renderMathInElement would
  // pair the two dollars and turn the prose between them into math. The real
  // math placeholders are restored to bare $…$ AFTER this, so they're untouched.
  html = html.replace(/\$/g, '<span class="nomath">$</span>')

  const restoreBlock = (_, idx) => {
    const b = blocks[+idx]
    if (!b) return ''
    if (b.kind === 'html') return b.body
    if (b.kind === 'inlineCode') return `<code>${escapeHtml(b.body)}</code>`
    if (b.kind === 'code') {
      const m = b.body.match(/^```([a-zA-Z0-9_-]*)\n([\s\S]*?)```$/)
      const lang = m ? m[1] : ''
      const code = m ? m[2] : b.body
      if (lang === 'mermaid') {
        return `<div class="mermaid-block">${escapeHtml(code)}</div>`
      }
      if (lang && window.hljs && window.hljs.getLanguage(lang)) {
        try { return `<pre><code class="hljs language-${lang}">${window.hljs.highlight(code, { language: lang }).value}</code></pre>` } catch {}
      }
      return `<pre><code>${escapeHtml(code)}</code></pre>`
    }
    return b.display ? `$$${b.body}$$` : `$${b.body}$`
  }
  html = html.replace(/<span data-mathblock="(\d+)"><\/span>/g, restoreBlock)
  html = html.replace(/&lt;span data-mathblock=&quot;(\d+)&quot;&gt;&lt;\/span&gt;/g, restoreBlock)
  // Defensive fallback for legacy " BLOCKN " markers in case any old caches still contain them.
  html = html.replace(/ ?BLOCK(\d+) ?/g, (_, idx) => {
    const b = blocks[+idx]
    if (!b) return ''
    if (b.kind === 'html') return b.body
    if (b.kind === 'inlineCode') return `<code>${escapeHtml(b.body)}</code>`
    if (b.kind === 'code') {
      const m = b.body.match(/^```([a-zA-Z0-9_-]*)\n([\s\S]*?)```$/)
      const code = m ? m[2] : b.body
      return `<pre><code>${escapeHtml(code)}</code></pre>`
    }
    return b.display ? `$$${b.body}$$` : `$${b.body}$`
  })

  const tmp = document.createElement('div')
  tmp.innerHTML = html
  tmp.querySelectorAll('table').forEach((table) => {
    if (table.closest('.md-table-wrap')) return
    const wrap = document.createElement('div')
    const cols = table.querySelector('tr')?.children?.length || 0
    wrap.className = `md-table-wrap${cols >= 4 ? ' is-wide' : ''}`
    table.parentNode.insertBefore(wrap, table)
    wrap.appendChild(table)
  })
  return tmp.innerHTML
}

let mermaidIdCounter = 0
async function renderMermaid() {
  if (!window.__mermaid) return
  const blocks = document.querySelectorAll('.mermaid-block:not([data-rendered])')
  for (const block of blocks) {
    const src = block.textContent.trim()
    const id = `mermaid-${++mermaidIdCounter}`
    block.setAttribute('data-rendered', '1')
    try {
      const { svg } = await window.__mermaid.render(id, src)
      block.innerHTML = svg
    } catch (e) {
      block.innerHTML = `<pre class="mermaid-error">Mermaid error: ${escapeHtml(e.message || String(e))}\n\n${escapeHtml(src)}</pre>`
    }
  }
}

function bindSteppers() {
  document.querySelectorAll('[data-stepper]').forEach((stepper) => {
    if (stepper.dataset.stepperBound === '1') return
    stepper.dataset.stepperBound = '1'

    const stepEls = [...stepper.querySelectorAll('[data-step], [data-step-from]')]
    const descEls = [...stepper.querySelectorAll('.stepper-desc[data-step-desc]')]
    const declaredMax = Number(stepper.dataset.steps || 0)
    const inferredMax = Math.max(
      1,
      declaredMax,
      ...stepEls.map((el) => Number(el.dataset.stepTo || el.dataset.step || el.dataset.stepFrom || 1)),
      ...descEls.map((el) => Number(el.dataset.stepDesc || 1))
    )
    let current = Math.max(1, Math.min(inferredMax, Number(stepper.dataset.currentStep || 1)))

    const figcaption = stepper.querySelector('figcaption')
    const bar = document.createElement('div')
    bar.className = 'stepper-bar'
    bar.innerHTML = `
      <button type="button" data-step-prev aria-label="Previous step">Prev</button>
      <div class="stepper-dots" aria-label="Step navigation">
        ${Array.from({ length: inferredMax }, (_, i) => `<button type="button" data-step-goto="${i + 1}" aria-label="Step ${i + 1}">${i + 1}</button>`).join('')}
      </div>
      <button type="button" data-step-next aria-label="Next step">Next</button>
      <span class="stepper-pos"></span>
    `
    stepper.insertBefore(bar, figcaption ? figcaption.nextSibling : stepper.firstChild)

    const update = () => {
      stepper.dataset.currentStep = String(current)
      stepEls.forEach((el) => {
        const from = Number(el.dataset.stepFrom || el.dataset.step || 1)
        const to = Number(el.dataset.stepTo || inferredMax)
        const intro = Number(el.dataset.step || el.dataset.stepFrom || 1)
        const visible = current >= from && current <= to
        el.classList.toggle('is-revealed', visible)
        el.classList.toggle('is-active', visible && current === intro)
      })
      descEls.forEach((el) => {
        el.classList.toggle('is-current', Number(el.dataset.stepDesc) === current)
      })
      bar.querySelector('[data-step-prev]').disabled = current === 1
      bar.querySelector('[data-step-next]').disabled = current === inferredMax
      bar.querySelector('.stepper-pos').textContent = `${current}/${inferredMax}`
      bar.querySelectorAll('[data-step-goto]').forEach((btn) => {
        btn.classList.toggle('is-current', Number(btn.dataset.stepGoto) === current)
      })
    }

    bar.querySelector('[data-step-prev]').addEventListener('click', () => {
      current = Math.max(1, current - 1)
      update()
    })
    bar.querySelector('[data-step-next]').addEventListener('click', () => {
      current = Math.min(inferredMax, current + 1)
      update()
    })
    bar.querySelectorAll('[data-step-goto]').forEach((btn) => {
      btn.addEventListener('click', () => {
        current = Math.max(1, Math.min(inferredMax, Number(btn.dataset.stepGoto || 1)))
        update()
      })
    })
    update()
  })
}

function assignHeadingIds(root) {
  const seen = new Map()
  root.querySelectorAll('h2, h3, h4').forEach((h) => {
    const base = slugify(h.textContent || 'section') || 'section'
    const count = (seen.get(base) || 0) + 1
    seen.set(base, count)
    h.id = count === 1 ? base : `${base}-${count}`
  })
}

function wrapTopicSections(html) {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  assignHeadingIds(tmp)
  const nodes = Array.from(tmp.childNodes)
  const sections = []
  let buf = []
  let currentH = null
  for (const node of nodes) {
    if (node.nodeType === 1 && node.tagName === 'HR') {
      if (currentH || buf.some((n) => (n.textContent || '').trim() || n.nodeType === 1)) {
        sections.push({ heading: currentH, body: buf })
      }
      currentH = null
      buf = []
      continue
    }
    if (node.nodeType === 1 && node.tagName === 'H2') {
      if (currentH || buf.length) sections.push({ heading: currentH, body: buf })
      currentH = node
      buf = []
    } else {
      buf.push(node)
    }
  }
  if (currentH || buf.length) sections.push({ heading: currentH, body: buf })

  const out = document.createElement('div')
  for (const sec of sections) {
    if (!sec.heading) {
      const wrap = document.createElement('div')
      wrap.className = 'topic-pre'
      for (const n of sec.body) wrap.appendChild(n)
      out.appendChild(wrap)
      continue
    }
    const topic = document.createElement('section')
    topic.className = 'topic-card'
    topic.appendChild(sec.heading)
    const proseAside = decideTopicLayout(sec.body)
    if (proseAside) {
      const flex = document.createElement('div')
      flex.className = 'topic-flex'
      const prose = document.createElement('div')
      prose.className = 'topic-prose'
      for (const n of proseAside.prose) prose.appendChild(n)
      const aside = document.createElement('aside')
      aside.className = 'topic-aside'
      for (const n of proseAside.aside) aside.appendChild(n)
      flex.appendChild(prose)
      flex.appendChild(aside)
      topic.appendChild(flex)
    } else {
      for (const n of sec.body) topic.appendChild(n)
    }
    out.appendChild(topic)
  }
  return out.innerHTML
}

function nodeWeight(n) {
  if (n.nodeType !== 1) return 0
  const text = (n.textContent || '').trim().length
  if (n.tagName === 'TABLE') {
    // tables take more vertical space than prose per character — inflate
    const rows = n.querySelectorAll('tr').length || 1
    return Math.max(text * 1.6, rows * 70)
  }
  if (n.tagName === 'PRE') {
    const lines = (n.textContent || '').split('\n').length
    return Math.max(text, lines * 45)
  }
  return text
}

function decideTopicLayout(nodes) {
  const asideEligible = (n) => n.nodeType === 1 && (n.tagName === 'PRE' || n.tagName === 'TABLE')
  const hasSubheadings = nodes.some((n) => n.nodeType === 1 && /^H[3-6]$/.test(n.tagName))
  // when subheadings exist they anchor their own content — keep stacked
  if (hasSubheadings) return null
  const eligibles = nodes.filter(asideEligible)
  if (!eligibles.length) return null
  const prose = []
  const aside = []
  for (const n of nodes) {
    if (asideEligible(n) && aside.length < 3) aside.push(n)
    else prose.push(n)
  }
  if (!aside.length) return null
  if (!prose.some((n) => n.nodeType === 1 && /^(P|UL|OL|BLOCKQUOTE)$/.test(n.tagName))) return null

  // Only split when the prose has enough weight to balance the aside vertically.
  // Otherwise we end up with a tiny intro paragraph next to a giant table — dead space on the left.
  const proseW = prose.reduce((sum, n) => sum + nodeWeight(n), 0)
  const asideW = aside.reduce((sum, n) => sum + nodeWeight(n), 0)
  if (proseW < asideW * 0.55) return null
  return { prose, aside }
}

function extractToc(html) {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  assignHeadingIds(tmp)
  return Array.from(tmp.querySelectorAll('h2, h3')).map((h) => ({
    id: h.id,
    level: Number(h.tagName.slice(1)),
    text: h.textContent || ''
  }))
}

const RICH_CONTENT_SELECTOR = '.markdown-body, .q-body, .q-options, .q-grade, .q-expected, .sr-question, .mistake-question, .practice-q-body, .chat-body, .fc-card-side, .fc-study-front, .fc-study-back'
let richEnhancementGeneration = 0

function typesetMathElement(el) {
  if (typeof renderMathInElement === 'undefined') return
  try {
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false }
      ],
      // Currency / stray dollar signs are wrapped in <span class="nomath">$</span>
      // by renderMarkdown / renderInlineMarkdown so they don't get paired as math.
      ignoredClasses: ['nomath'],
      throwOnError: false
    })
  } catch (e) { console.error('KaTeX error', e) }
}

function shouldEnhanceRichContent() {
  if (['chapter', 'practice', 'mistakes', 'sr', 'mocks'].includes(route.page)) return true
  return route.page === 'mock-exam' && (
    practiceExamView.tab === 'mock-questions' ||
    practiceExamView.tab === 'flashcards' ||
    ((practiceExamView.tab === 'exams' || practiceExamView.tab === 'tutorials') && practiceExamView.examSubtab === 'practice')
  )
}

function scheduleRichContentEnhancements() {
  const generation = ++richEnhancementGeneration
  if (!shouldEnhanceRichContent()) return
  requestAnimationFrame(() => {
    setTimeout(async () => {
      if (generation !== richEnhancementGeneration) return
      // Let the loaded surface paint before optional KaTeX, Mermaid and editor
      // upgrades. Large chapters can contain hundreds of formula nodes; doing
      // this inside render() left the previous loading screen painted throughout.
      const elements = [...document.querySelectorAll(RICH_CONTENT_SELECTOR)]
      for (const element of elements) {
        if (generation !== richEnhancementGeneration || !element.isConnected) return
        typesetMathElement(element)
        await new Promise((resolveYield) => setTimeout(resolveYield, 0))
      }
      if (generation !== richEnhancementGeneration) return
      await renderMermaid()
      if (generation !== richEnhancementGeneration) return
      bindSteppers()
      mountCodeEditors()
    }, 0)
  })
}

// ─── CodeMirror mount for pseudocode/C/ASM attempt boxes ───────────────────
// Each render() replaces the DOM, so newly-rendered .cm-target textareas need
// CodeMirror re-mounted. mountCodeEditors() is idempotent — it skips anything
// already wearing data-cm-mounted. The CM instance proxies changes back to the
// underlying textarea and dispatches an 'input' event so the existing attempt
// listeners (data-attempt, data-practice-attempt) fire as before.
function codeLangToCmMode(lang) {
  switch (lang) {
    case 'c':         return 'text/x-csrc'
    case 'asm':       return 'gas'
    default:          return 'text/plain'   // 'pseudocode'
  }
}

function mountCodeEditors() {
  if (typeof CodeMirror === 'undefined') return
  document.querySelectorAll('textarea.cm-target:not([data-cm-mounted])').forEach((ta) => {
    const lang = ta.dataset.codeLang || 'pseudocode'
    let cm
    try {
      cm = CodeMirror.fromTextArea(ta, {
        mode: codeLangToCmMode(lang),
        theme: 'eclipse',
        lineNumbers: true,
        indentUnit: 2,
        tabSize: 2,
        smartIndent: true,
        lineWrapping: false,
        matchBrackets: true,
        autoCloseBrackets: true,
        viewportMargin: Infinity   // grow to content height
      })
    } catch (e) {
      console.warn('CodeMirror mount failed; falling back to textarea', e)
      return
    }
    cm.on('change', () => {
      ta.value = cm.getValue()
      ta.dispatchEvent(new Event('input', { bubbles: true }))
    })
    ta._cm = cm
    ta.dataset.cmMounted = 'true'
  })
}

// Language dropdown change handler — wired via event delegation so it works
// across re-renders without re-binding.
if (typeof window !== 'undefined' && !window.__codeLangDelegated) {
  window.__codeLangDelegated = true
  document.addEventListener('change', (event) => {
    const sel = event.target.closest('[data-code-lang-select]')
    if (!sel) return
    const attemptKey = sel.dataset.codeLangSelect
    // Find the matching textarea — covers both data-attempt and data-practice-attempt
    const ta = document.querySelector(
      `textarea.cm-target[data-attempt="${CSS.escape(attemptKey)}"], ` +
      `textarea.cm-target[data-practice-attempt="${CSS.escape(attemptKey)}"]`
    )
    if (!ta) return
    const lang = sel.value
    ta.dataset.codeLang = lang
    if (ta._cm) ta._cm.setOption('mode', codeLangToCmMode(lang))
    // Persist the preference on the attempt
    const isPractice = ta.hasAttribute('data-practice-attempt')
    if (isPractice) {
      // Practice exam: persist via existing practiceExamView state mechanism.
      // The codeLang lives alongside the attempt body in localStorage.
      const cur = practiceExamView.codeLang || (practiceExamView.codeLang = {})
      cur[attemptKey] = lang
      try { persistPracticeAttempts(practiceExamView.courseId, getActivePaperId()) } catch {}
    } else {
      const att = attemptState.get(attemptKey) || {}
      att.codeLang = lang
      attemptState.set(attemptKey, att)
    }
  })
}

function bindEvents() {
  window.__platformState = state
  window.__autoWrap = autoWrapBareLatex
  window.__renderMarkdown = renderMarkdown

  document.querySelectorAll('[data-editorial-programmes-retry]').forEach((button) => button.addEventListener('click', () => loadEditorialProgrammes({ force: true })))
  document.querySelectorAll('[data-planning-programme-use]').forEach((button) => button.addEventListener('click', () => {
    const reference = editorialProgrammeReference(button.dataset.planningProgrammeUse, button.dataset.planningProgrammeVersion)
    if (!reference) return
    planningIntake.programmeId = reference.programme.id
    planningIntake.programmeVersionId = reference.version.id
    planningIntake.programmeConfig = {
      academicYear: academicsData?.workspace?.profile?.academicYear || '',
      currentStudyYear: 'Year 1',
      pathwayId: '',
      selectedChoices: Object.fromEntries(reference.version.choiceGroups.map((group) => [group.id, []]))
    }
    planningIntake.error = null
    planningIntake.step = 'programme'
    render()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }))
  document.querySelectorAll('[data-programme-config]').forEach((input) => input.addEventListener('change', () => {
    if (planningIntake.programmeConfig) planningIntake.programmeConfig[input.dataset.programmeConfig] = input.value
  }))
  document.querySelectorAll('[data-programme-choice]').forEach((input) => input.addEventListener('change', () => {
    if (!input.checked || !planningIntake.programmeConfig) return
    planningIntake.programmeConfig.selectedChoices[input.dataset.programmeChoice] = input.value ? [input.value] : []
    render()
  }))
  document.querySelectorAll('[data-programme-choice-select]').forEach((select) => select.addEventListener('change', () => {
    if (!planningIntake.programmeConfig) return
    planningIntake.programmeConfig.selectedChoices[select.dataset.programmeChoiceSelect] = select.value ? [select.value] : []
    render()
  }))
  document.querySelectorAll('[data-programme-pathway]').forEach((input) => input.addEventListener('change', () => {
    if (!input.checked || !planningIntake.programmeConfig) return
    planningIntake.programmeConfig.pathwayId = input.value
    if (input.value !== 'course-based') planningIntake.programmeConfig.selectedChoices['year-3-electives'] = []
    render()
  }))
  document.querySelectorAll('[data-programme-pathway-select]').forEach((select) => select.addEventListener('change', () => {
    if (!planningIntake.programmeConfig) return
    planningIntake.programmeConfig.pathwayId = select.value
    if (select.value !== 'course-based') planningIntake.programmeConfig.selectedChoices['year-3-electives'] = []
    render()
  }))
  document.querySelectorAll('[data-planning-programme-save]').forEach((button) => button.addEventListener('click', async () => {
    if (!academicsData?.workspace || planningIntake.saving || !planningIntake.programmeConfig) return
    const reference = editorialProgrammeReference(planningIntake.programmeId, planningIntake.programmeVersionId)
    if (!reference) {
      planningIntake.error = 'The programme reference is unavailable. Return to setup and try again.'
      render()
      return
    }
    const workspace = applyEditorialProgramme(academicsData.workspace, reference.programme, reference.version, planningIntake.programmeConfig)
    planningIntake.saving = true
    planningIntake.error = null
    render()
    try {
      academicsData = await fetchJson('/api/academics', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace, expectedRevision: academicsData.workspace.revision })
      })
      academicsError = null
      planningIntake.saving = false
      planningIntake.step = 'connected'
      route = { page: 'planning', tab: 'overview' }
      if (window.location.hash !== '#/planning/overview') window.location.hash = '#/planning/overview'
    } catch (error) {
      planningIntake.error = error.message || 'The programme plan could not be created.'
      planningIntake.saving = false
    }
    render()
  }))

  document.querySelectorAll('[data-planning-files]').forEach((input) => input.addEventListener('change', () => addPlanningSources(input.files)))
  // ----- Documents tab -----
  document.querySelectorAll('[data-doc-files]').forEach((input) => input.addEventListener('change', (event) => { addDocumentSources(event.target.files); event.target.value = '' }))
  document.querySelectorAll('[data-doc-dropzone]').forEach((dropzone) => {
    ;['dragenter', 'dragover'].forEach((type) => dropzone.addEventListener(type, (event) => { event.preventDefault(); dropzone.classList.add('is-dragging') }))
    ;['dragleave', 'drop'].forEach((type) => dropzone.addEventListener(type, (event) => { event.preventDefault(); dropzone.classList.remove('is-dragging') }))
    dropzone.addEventListener('drop', (event) => { if (!planningDocuments.processing && !planningDocuments.analysing) addDocumentSources(event.dataTransfer?.files) })
  })
  document.querySelectorAll('[data-doc-remove]').forEach((button) => button.addEventListener('click', () => { planningDocuments.files.splice(Number(button.dataset.docRemove), 1); render() }))
  document.querySelectorAll('[data-doc-kind]').forEach((select) => select.addEventListener('change', () => { planningDocuments.kind = select.value }))
  document.querySelectorAll('[data-doc-description]').forEach((area) => area.addEventListener('input', () => { planningDocuments.description = area.value; document.querySelector('[data-doc-analyse]')?.toggleAttribute('disabled', !(planningDocuments.files.length || area.value.trim())) }))
  const showChangeSet = (result) => {
    planningDocuments.result = result
    planningDocuments.selected = new Set((result.changes || []).map((change) => change.id))
    planningDocuments.applied = null
    planningDocuments.error = null
  }
  document.querySelectorAll('[data-doc-analyse]').forEach((button) => button.addEventListener('click', async () => {
    if (planningDocuments.analysing) return
    planningDocuments.analysing = true
    planningDocuments.error = null
    render()
    try {
      let remainingImages = MAX_PLANNING_IMAGE_PAGES
      const icsFiles = planningDocuments.files.filter((file) => /\.ics$/i.test(file.name) && file.text)
      const documents = planningDocuments.files.filter((file) => !icsFiles.includes(file)).map(({ name, type, pageCount, text, images }) => { const selectedImages = (images || []).slice(0, remainingImages); remainingImages -= selectedImages.length; return { name, type, pageCount, text, images: selectedImages } })
      let result = null
      if (documents.length || planningDocuments.description.trim()) {
        result = await fetchJson('/api/academics/documents/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: planningDocuments.kind, description: planningDocuments.description, documents }) })
        aiUsage = result.usage || aiUsage
      }
      for (const file of icsFiles) {
        const preview = await fetchJson('/api/academics/calendars/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ics: file.text }) })
        result = result ? { ...result, changes: [...result.changes, ...preview.changes.filter((change) => !result.changes.some((item) => item.id === change.id))], sources: [...(result.sources || []), { name: file.name }] } : { ...preview, sources: [{ name: file.name }] }
      }
      if (!result) throw new Error('Add a file or a description first.')
      showChangeSet(result)
    } catch (error) {
      planningDocuments.error = error.message
    } finally {
      planningDocuments.analysing = false
      render()
    }
  }))
  document.querySelectorAll('[data-doc-toggle]').forEach((input) => input.addEventListener('change', () => { if (input.checked) planningDocuments.selected.add(input.dataset.docToggle); else planningDocuments.selected.delete(input.dataset.docToggle); render() }))
  document.querySelectorAll('[data-doc-select-all]').forEach((button) => button.addEventListener('click', () => { const all = planningDocuments.result?.changes || []; planningDocuments.selected = planningDocuments.selected.size === all.length ? new Set() : new Set(all.map((change) => change.id)); render() }))
  document.querySelectorAll('[data-doc-reset]').forEach((button) => button.addEventListener('click', () => { Object.assign(planningDocuments, { files: [], description: '', result: null, selected: new Set(), error: null, applied: null }); render() }))
  document.querySelectorAll('[data-doc-apply]').forEach((button) => button.addEventListener('click', async () => {
    const result = planningDocuments.result
    if (!result || planningDocuments.applying) return
    const changes = result.changes.filter((change) => planningDocuments.selected.has(change.id))
    if (!changes.length) return
    planningDocuments.applying = true
    planningDocuments.error = null
    render()
    try {
      const saved = await fetchJson('/api/academics/documents/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes, expectedRevision: academicsData.workspace.revision }) })
      academicsData = { ...academicsData, index: saved.index, workspace: saved.workspace, summary: saved.summary }
      Object.assign(planningDocuments, { files: [], description: '', result: null, selected: new Set(), applied: saved.applied?.length || changes.length })
    } catch (error) {
      planningDocuments.error = /another tab/.test(error.message) ? 'Your plan changed elsewhere. Reload the page and read the document again.' : error.message
    } finally {
      planningDocuments.applying = false
      render()
    }
  }))
  const calendarRequest = async (path, body) => {
    planningDocuments.calendarBusy = true
    planningDocuments.calendarError = null
    render()
    try {
      const response = await fetchJson(path, { method: body === undefined ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
      if (response.workspace) academicsData = { ...academicsData, index: response.index, workspace: response.workspace, summary: response.summary }
      const changeSet = response.changeSet || (response.changes ? response : null)
      if (changeSet) { showChangeSet({ ...changeSet, link: response.link || changeSet.link || { label: 'Calendar' } }); planningDocuments.calendarUrl = ''; planningDocuments.calendarLabel = '' }
    } catch (error) {
      planningDocuments.calendarError = error.message
    } finally {
      planningDocuments.calendarBusy = false
      render()
    }
  }
  document.querySelectorAll('[data-cal-form]').forEach((form) => {
    form.addEventListener('input', () => { planningDocuments.calendarUrl = form.elements.url.value; planningDocuments.calendarLabel = form.elements.label.value })
    form.addEventListener('submit', (event) => { event.preventDefault(); if (!form.elements.url.value.trim()) return; calendarRequest('/api/academics/calendars', { url: form.elements.url.value.trim(), label: form.elements.label.value.trim() }) })
  })
  document.querySelectorAll('[data-cal-preview]').forEach((button) => button.addEventListener('click', () => { const form = button.closest('form'); if (!form?.elements.url.value.trim()) { planningDocuments.calendarError = 'Enter a feed URL first.'; render(); return } calendarRequest('/api/academics/calendars/preview', { url: form.elements.url.value.trim(), label: form.elements.label.value.trim() }) }))
  document.querySelectorAll('[data-cal-sync]').forEach((button) => button.addEventListener('click', () => calendarRequest(`/api/academics/calendars/${encodeURIComponent(button.dataset.calSync)}/sync`, {})))
  document.querySelectorAll('[data-cal-remove]').forEach((button) => button.addEventListener('click', async () => {
    const link = academicsData?.workspace?.calendars?.find((item) => item.id === button.dataset.calRemove)
    if (!(await showConfirm({ title: `Remove “${link?.label || 'calendar'}”?`, message: 'Events already added to your plan stay; the link will no longer sync.', okLabel: 'Remove link', danger: true }))) return
    calendarRequest(`/api/academics/calendars/${encodeURIComponent(button.dataset.calRemove)}`)
  }))
  document.querySelectorAll('[data-institution-event-import]').forEach((button) => button.addEventListener('click', async () => {
    const event = (activeEditorialProgrammeReference()?.programme?.calendar || []).find((item) => item.id === button.dataset.institutionEventImport)
    if (!event) return
    const workspace = structuredClone(academicsData.workspace)
    workspace.events.push({ id: `event-${Date.now().toString(36)}`, title: event.title, date: event.date, endDate: event.endDate, type: event.type, notes: event.notes })
    await saveAcademics(workspace)
  }))

  document.querySelectorAll('[data-planning-dropzone]').forEach((dropzone) => {
    ;['dragenter', 'dragover'].forEach((type) => dropzone.addEventListener(type, (event) => {
      event.preventDefault()
      if (!planningIntake.processingFiles && !planningIntake.analysing) dropzone.classList.add('is-dragging')
    }))
    ;['dragleave', 'drop'].forEach((type) => dropzone.addEventListener(type, (event) => {
      event.preventDefault()
      dropzone.classList.remove('is-dragging')
    }))
    dropzone.addEventListener('drop', (event) => {
      if (!planningIntake.processingFiles && !planningIntake.analysing) addPlanningSources(event.dataTransfer?.files)
    })
  })
  document.querySelectorAll('[data-planning-source-remove]').forEach((button) => button.addEventListener('click', () => {
    planningIntake.files.splice(Number(button.dataset.planningSourceRemove), 1)
    planningIntake.error = null
    render()
  }))
  document.querySelectorAll('[data-planning-description]').forEach((textarea) => textarea.addEventListener('input', () => {
    planningIntake.description = textarea.value
    const analyse = document.querySelector('[data-planning-analyse]')
    if (analyse) analyse.disabled = !planningIntake.files.length && !planningIntake.description.trim()
  }))
  document.querySelectorAll('[data-planning-manual]').forEach((button) => button.addEventListener('click', () => {
    if (!academicsData?.workspace) return
    planningIntake.manual = true
    planningIntake.error = null
    planningIntake.draft = {
      profile: { ...academicsData.workspace.profile },
      courses: [emptyIntakeCourse()],
      events: [...(academicsData.workspace.events || [])],
      warnings: []
    }
    planningIntake.step = 'review'
    render()
  }))
  document.querySelectorAll('[data-planning-analyse]').forEach((button) => button.addEventListener('click', async () => {
    if (planningIntake.analysing || (!planningIntake.files.length && !planningIntake.description.trim())) return
    planningIntake.analysing = true
    planningIntake.error = null
    render()
    try {
      let remainingImages = MAX_PLANNING_IMAGE_PAGES
      const documents = planningIntake.files.map(({ name, type, pageCount, text, images }) => {
        const selectedImages = (images || []).slice(0, remainingImages)
        remainingImages -= selectedImages.length
        return { name, type, pageCount, text, images: selectedImages }
      })
      const response = await fetchJson('/api/academics/intake/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: planningIntake.description,
          documents
        })
      })
      const courses = (response.draft?.courses || []).map((course) => ({ ...course, _include: true }))
      const savedProfile = academicsData?.workspace?.profile || {}
      const extractedProfile = response.draft?.profile || {}
      planningIntake.draft = {
        ...response.draft,
        profile: {
          ...savedProfile,
          ...extractedProfile,
          university: extractedProfile.university || savedProfile.university || '',
          programme: extractedProfile.programme || savedProfile.programme || '',
          academicYear: extractedProfile.academicYear || savedProfile.academicYear || ''
        },
        events: [...(academicsData?.workspace?.events || []), ...(response.draft?.events || [])],
        courses: courses.length ? courses : [emptyIntakeCourse()]
      }
      planningIntake.manual = !response.usedAi
      planningIntake.step = 'review'
      aiUsage = response.usage || aiUsage
    } catch (error) {
      planningIntake.error = error.message || 'The plan could not be extracted. You can still enter it manually.'
    } finally {
      planningIntake.analysing = false
      render()
    }
  }))
  document.querySelectorAll('[data-planning-intake-back]').forEach((button) => button.addEventListener('click', () => {
    planningIntake.step = 'source'
    planningIntake.error = null
    render()
  }))
  document.querySelectorAll('[data-intake-profile-field]').forEach((input) => input.addEventListener('input', () => {
    if (planningIntake.draft?.profile) planningIntake.draft.profile[input.dataset.intakeProfileField] = input.value
  }))
  document.querySelectorAll('[data-intake-course-field]').forEach((input) => {
    input.addEventListener('input', () => {
      const course = planningIntake.draft?.courses?.[Number(input.dataset.intakeCourse)]
      if (!course) return
      const field = input.dataset.intakeCourseField
      course[field] = field === 'ects' ? Number(input.value) : input.value
    })
    if (input.dataset.intakeCourseField === 'code') input.addEventListener('change', () => render())
  })
  document.querySelectorAll('[data-intake-attempt-field]').forEach((input) => input.addEventListener('change', () => {
    const course = planningIntake.draft?.courses?.[Number(input.dataset.intakeCourse)]
    if (!course) return
    const attempt = course.attempts?.[0] || {
      academicYear: planningIntake.draft?.profile?.academicYear || '', type: 'first', examDate: null, grade: null, status: ''
    }
    const field = input.dataset.intakeAttemptField
    attempt[field] = field === 'grade' ? (input.value === '' ? null : Number(input.value)) : field === 'examDate' ? (input.value || null) : input.value
    course.attempts = [attempt]
  }))
  document.querySelectorAll('[data-intake-course-include]').forEach((input) => input.addEventListener('change', () => {
    const course = planningIntake.draft?.courses?.[Number(input.dataset.intakeCourseInclude)]
    if (course) course._include = input.checked
    render()
  }))
  document.querySelectorAll('[data-intake-course-remove]').forEach((button) => button.addEventListener('click', () => {
    planningIntake.draft?.courses?.splice(Number(button.dataset.intakeCourseRemove), 1)
    if (planningIntake.draft && !planningIntake.draft.courses.length) planningIntake.draft.courses.push(emptyIntakeCourse())
    render()
  }))
  document.querySelectorAll('[data-intake-course-add]').forEach((button) => button.addEventListener('click', () => {
    planningIntake.draft?.courses?.push(emptyIntakeCourse())
    render()
    document.querySelector('.planning-review-course:last-child input[data-intake-course-field="code"]')?.focus()
  }))
  document.querySelectorAll('[data-intake-event-field]').forEach((input) => input.addEventListener('input', () => {
    const item = planningIntake.draft?.events?.[Number(input.dataset.intakeEvent)]
    if (item) item[input.dataset.intakeEventField] = input.value
  }))
  document.querySelectorAll('[data-intake-event-remove]').forEach((button) => button.addEventListener('click', () => {
    planningIntake.draft?.events?.splice(Number(button.dataset.intakeEventRemove), 1)
    render()
  }))
  document.querySelectorAll('[data-planning-intake-save]').forEach((button) => button.addEventListener('click', async () => {
    if (!academicsData?.workspace || planningIntake.saving || !planningIntake.draft) return
    const draft = planningIntake.draft
    const selected = (draft.courses || []).filter((course) => course._include !== false && String(course.name || '').trim())
    if (!selected.length) {
      planningIntake.error = 'Add and include at least one named course before creating the plan.'
      render()
      return
    }
    const stamp = Date.now()
    const courses = selected.map((course, index) => {
      const id = `course-${stamp}-${index + 1}`
      const match = planningDraftConnection(course)
      const attempts = (course.attempts || []).filter((attempt) => attempt.status || attempt.examDate || attempt.grade !== null && attempt.grade !== undefined).map((attempt, attemptIndex) => ({
        id: `${id}-attempt-${attemptIndex + 1}`,
        academicYear: attempt.academicYear || draft.profile?.academicYear || '',
        type: attempt.type || 'first',
        examDate: attempt.examDate || null,
        grade: attempt.grade === '' || attempt.grade === undefined ? null : attempt.grade,
        status: attempt.status || 'upcoming'
      }))
      return {
        id,
        code: course.code || '',
        name: String(course.name).trim(),
        ects: Number(course.ects) || 0,
        yearLevel: course.yearLevel || '',
        period: course.period || '',
        passMark: Number(course.passMark) || 5.5,
        notes: course.notes || '',
        editorialCourseId: match?.id || null,
        attempts
      }
    })
    const events = (draft.events || []).filter((item) => item.title && item.date).map((item, index) => ({ ...item, id: `event-${stamp}-${index + 1}` }))
    const academicYear = draft.profile?.academicYear || ''
    const workspace = {
      ...academicsData.workspace,
      profile: { ...academicsData.workspace.profile, ...draft.profile, academicYear, currentYearKey: academicYear },
      courses,
      events
    }
    planningIntake.saving = true
    planningIntake.error = null
    render()
    try {
      academicsData = await fetchJson('/api/academics', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace, expectedRevision: academicsData.workspace.revision })
      })
      academicsError = null
      planningIntake.step = 'connected'
      planningIntake.files = []
      planningIntake.description = ''
      planningIntake.processingFiles = false
      planningIntake.analysing = false
      planningIntake.saving = false
      planningIntake.error = null
      planningIntake.draft = null
      route = { page: 'planning', tab: 'overview' }
      if (window.location.hash !== '#/planning/overview') window.location.hash = '#/planning/overview'
    } catch (error) {
      planningIntake.error = error.message || 'The plan could not be saved. Your reviewed draft is still here.'
      planningIntake.saving = false
    }
    render()
  }))
  document.querySelectorAll('[data-planning-intake-finish]').forEach((link) => link.addEventListener('click', () => {
    resetPlanningIntake()
    queueMicrotask(render)
  }))

  document.querySelectorAll('[data-academics-retry]').forEach((button) => button.addEventListener('click', () => loadAcademics({ force: true })))
  document.querySelectorAll('[data-programme-structure-pathway]').forEach((select) => select.addEventListener('change', () => {
    const electives = select.closest('[data-academic-programme-structure]')?.querySelector('[data-programme-electives]')
    if (!electives) return
    const enabled = select.value === 'course-based'
    electives.hidden = !enabled
    if (enabled && !compactPlanningMedia.matches) electives.open = true
    electives.querySelectorAll('input').forEach((input) => { input.disabled = !enabled })
  }))
  document.querySelectorAll('[data-programme-electives]').forEach((fieldset) => {
    const inputs = [...fieldset.querySelectorAll('input[type="checkbox"]')]
    const update = (changed) => {
      let selected = inputs.filter((input) => input.checked)
      if (selected.length > 6 && changed) {
        changed.checked = false
        selected = inputs.filter((input) => input.checked)
      }
      const count = fieldset.querySelector('[data-programme-elective-count]')
      if (count) count.textContent = selected.length
      inputs.forEach((input) => { input.disabled = fieldset.hidden || (selected.length >= 6 && !input.checked) })
    }
    inputs.forEach((input) => input.addEventListener('change', () => update(input)))
    update()
  })
  document.querySelectorAll('[data-academic-programme-structure]').forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const reference = activeEditorialProgrammeReference()
    if (!reference || !academicsData?.workspace) return
    const data = new FormData(form)
    const selectedChoices = Object.fromEntries(reference.version.choiceGroups.map((group) => [group.id, group.maxSelections === 1
      ? [String(data.get(`choice-${group.id}`) || '')].filter(Boolean)
      : data.getAll(`choice-${group.id}`).map(String)]))
    const config = {
      academicYear: academicsData.workspace.profile.academicYear,
      currentStudyYear: academicsData.workspace.programmeTemplate?.currentStudyYear || '',
      pathwayId: String(data.get('pathwayId') || ''),
      selectedChoices
    }
    await saveAcademics(applyEditorialProgramme(academicsData.workspace, reference.programme, reference.version, config))
  }))
  document.querySelectorAll('[data-planning-profile-toggle]').forEach((button) => button.addEventListener('click', () => {
    planningProfileEditing = !planningProfileEditing
    render()
  }))
  document.querySelectorAll('[data-planning-course-toggle]').forEach((button) => button.addEventListener('click', () => {
    planningCourseComposerOpen = !planningCourseComposerOpen
    render()
    if (planningCourseComposerOpen) document.querySelector('.pl-composer input[name="code"]')?.focus()
  }))
  document.querySelectorAll('[data-planning-event-toggle]').forEach((button) => button.addEventListener('click', () => { planningEventComposerOpen = !planningEventComposerOpen; render() }))
  document.querySelectorAll('[data-planning-gate-toggle]').forEach((button) => button.addEventListener('click', () => { planningGateComposerOpen = !planningGateComposerOpen; render() }))
  document.querySelectorAll('[data-planning-structure-toggle]').forEach((button) => button.addEventListener('click', () => { planningStructureOpen = !planningStructureOpen; render() }))
  const planningExpandHandler = (attr, apply) => (element) => {
    const activate = (event) => {
      if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return
      if (event.target !== element && event.target.closest('a, button, input, select, textarea, label, form')) return
      event.preventDefault()
      apply(element.dataset[attr])
      render()
      if (attr === 'planningExpand' && planningExpandedCourse) document.getElementById(`pl-editor-${planningExpandedCourse}`)?.scrollIntoView({ block: 'nearest' })
    }
    element.addEventListener('click', activate)
    if (element.tagName !== 'BUTTON') element.addEventListener('keydown', activate)
  }
  document.querySelectorAll('[data-planning-expand]').forEach(planningExpandHandler('planningExpand', (id) => { planningExpandedCourse = planningExpandedCourse === id ? null : id }))
  document.querySelectorAll('[data-planning-expand-event]').forEach(planningExpandHandler('planningExpandEvent', (id) => { planningExpandedEvent = planningExpandedEvent === id ? null : id }))
  document.querySelectorAll('[data-planning-expand-gate]').forEach(planningExpandHandler('planningExpandGate', (id) => { planningExpandedGate = planningExpandedGate === id ? null : id }))
  document.querySelectorAll('[data-planning-scenario-reset]').forEach((button) => button.addEventListener('click', () => saveAcademics({ ...academicsData.workspace, planning: { objectives: {} } })))
  document.querySelectorAll('[data-planning-gate-type]').forEach((select) => {
    const sync = () => {
      const form = select.closest('form')
      const level = form.querySelector('[name="level"]').closest('label')
      const target = form.querySelector('[name="target"]').closest('label')
      const course = form.querySelector('[name="courseId"]').closest('label')
      level.hidden = !['credit-level', 'all-level'].includes(select.value)
      target.hidden = !['total-credits', 'credit-level'].includes(select.value)
      course.hidden = select.value !== 'course'
    }
    select.addEventListener('change', sync); sync()
  })
  document.querySelectorAll('[data-academic-profile]').forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!academicsData) return
    const data = new FormData(event.currentTarget)
    const saved = await saveAcademics({ ...academicsData.workspace, profile: { ...academicsData.workspace.profile, university: data.get('university'), programme: data.get('programme'), academicYear: data.get('academicYear'), currentYearKey: data.get('academicYear') } })
    if (saved) { planningProfileEditing = false; render() }
  }))
  document.querySelectorAll('[data-academic-course]').forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!academicsData) return
    const data = new FormData(event.currentTarget)
    const examDate = data.get('examDate') || null
    const grade = data.get('grade') === '' ? null : Number(data.get('grade'))
    const id = `course-${Date.now()}`
    const attempts = [{ id: `${id}-attempt-1`, academicYear: academicsData.workspace.profile.academicYear, type: data.get('attemptType'), examDate, grade, status: data.get('attemptStatus') }]
    const code = data.get('code')
    const editorialCourse = state.courses.find((candidate) => normalizedCourseCode(candidate.code) === normalizedCourseCode(code))
    const course = { id, code, name: data.get('name'), ects: Number(data.get('ects')), yearLevel: data.get('yearLevel'), period: data.get('period'), passMark: 5.5, notes: '', editorialCourseId: editorialCourse?.id || null, attempts }
    const saved = await saveAcademics({ ...academicsData.workspace, courses: [...academicsData.workspace.courses, course] })
    if (saved) { planningCourseComposerOpen = false; render() }
  }))
  document.querySelectorAll('[data-academic-remove]').forEach((button) => button.addEventListener('click', () => {
    if (!academicsData) return
    const course = academicsData.workspace.courses.find((item) => item.id === button.dataset.academicRemove)
    if (!course || !confirm(`Remove ${course.name} and its attempt history from this programme?`)) return
    planningExpandedCourse = null
    saveAcademics({ ...academicsData.workspace, courses: academicsData.workspace.courses.filter((item) => item.id !== course.id) })
  }))
  document.querySelectorAll('[data-academic-course-edit]').forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault(); const data = new FormData(form); const id = form.dataset.academicCourseEdit
    const code = data.get('code')
    const editorialCourse = state.courses.find((candidate) => normalizedCourseCode(candidate.code) === normalizedCourseCode(code))
    const courses = academicsData.workspace.courses.map((course) => course.id === id ? { ...course, code, name: data.get('name'), ects: Number(data.get('ects')), yearLevel: data.get('yearLevel'), period: data.get('period'), passMark: Number(data.get('passMark')), notes: data.get('notes'), hiddenFromStats: data.get('hiddenFromStats') === 'on', editorialCourseId: editorialCourse?.id || null } : course)
    saveAcademics({ ...academicsData.workspace, courses })
  }))
  document.querySelectorAll('[data-academic-attempt-edit]').forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault()
    const [courseId, attemptId] = form.dataset.academicAttemptEdit.split('/')
    const data = new FormData(form)
    const courses = academicsData.workspace.courses.map((course) => course.id !== courseId ? course : { ...course, attempts: course.attempts.map((attempt) => attempt.id !== attemptId ? attempt : { ...attempt, academicYear: data.get('academicYear'), type: data.get('type'), examDate: data.get('examDate') || null, status: data.get('status'), grade: data.get('grade') === '' ? null : Number(data.get('grade')) }) })
    saveAcademics({ ...academicsData.workspace, courses })
  }))
  document.querySelectorAll('[data-academic-attempt-add]').forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault()
    const courseId = form.dataset.academicAttemptAdd
    const data = new FormData(form)
    const attempt = { id: `attempt-${Date.now()}`, academicYear: data.get('academicYear'), type: data.get('type'), examDate: data.get('examDate') || null, grade: null, status: 'upcoming' }
    saveAcademics({ ...academicsData.workspace, courses: academicsData.workspace.courses.map((course) => course.id === courseId ? { ...course, attempts: [...course.attempts, attempt] } : course) })
  }))
  document.querySelectorAll('[data-academic-attempt-remove]').forEach((button) => button.addEventListener('click', () => {
    const [courseId, attemptId] = button.dataset.academicAttemptRemove.split('/')
    saveAcademics({ ...academicsData.workspace, courses: academicsData.workspace.courses.map((course) => course.id === courseId ? { ...course, attempts: course.attempts.filter((attempt) => attempt.id !== attemptId) } : course) })
  }))
  document.querySelectorAll('[data-academic-event]').forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault(); const data = new FormData(form)
    const item = { id: `event-${Date.now()}`, title: data.get('title'), date: data.get('date'), endDate: data.get('endDate') || null, type: data.get('type'), notes: data.get('notes') }
    planningEventComposerOpen = false
    saveAcademics({ ...academicsData.workspace, events: [...academicsData.workspace.events, item] })
  }))
  document.querySelectorAll('[data-academic-event-remove]').forEach((button) => button.addEventListener('click', () => { planningExpandedEvent = null; return saveAcademics({ ...academicsData.workspace, events: academicsData.workspace.events.filter((item) => item.id !== button.dataset.academicEventRemove) }) }))
  document.querySelectorAll('[data-academic-event-edit]').forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault(); const data = new FormData(form); const id = form.dataset.academicEventEdit
    const events = academicsData.workspace.events.map((item) => item.id === id ? { ...item, title: data.get('title'), date: data.get('date') || null, endDate: data.get('endDate') || null, notes: data.get('notes') } : item)
    saveAcademics({ ...academicsData.workspace, events })
  }))
  document.querySelectorAll('[data-academic-gate]').forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault(); const data = new FormData(form)
    const gate = { id: `gate-${Date.now()}`, label: data.get('label'), section: data.get('section'), type: data.get('type'), level: data.get('level') || null, target: Number(data.get('target') || 0), courseId: data.get('courseId') || null }
    planningGateComposerOpen = false
    saveAcademics({ ...academicsData.workspace, gates: [...academicsData.workspace.gates, gate] })
  }))
  document.querySelectorAll('[data-academic-gate-remove]').forEach((button) => button.addEventListener('click', () => { planningExpandedGate = null; return saveAcademics({ ...academicsData.workspace, gates: academicsData.workspace.gates.filter((item) => item.id !== button.dataset.academicGateRemove) }) }))
  document.querySelectorAll('[data-academic-gate-edit]').forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault(); const data = new FormData(form); const id = form.dataset.academicGateEdit
    const gates = academicsData.workspace.gates.map((item) => item.id === id ? { ...item, label: data.get('label'), level: data.get('level') || null, target: Number(data.get('target') || 0) } : item)
    saveAcademics({ ...academicsData.workspace, gates })
  }))
  document.querySelectorAll('[data-academic-objective-mode], [data-academic-objective-outcome]').forEach((select) => select.addEventListener('change', () => {
    const id = select.dataset.academicObjectiveMode || select.dataset.academicObjectiveOutcome
    const current = academicsData.workspace.planning?.objectives?.[id] || { mode: 'current', outcome: 'actual' }
    const next = select.dataset.academicObjectiveMode ? { ...current, mode: select.value } : { ...current, outcome: select.value }
    const objectives = { ...(academicsData.workspace.planning?.objectives || {}), [id]: next }
    saveAcademics({ ...academicsData.workspace, planning: { objectives } })
  }))
  document.querySelectorAll('[data-academic-switch]').forEach((button) => button.addEventListener('click', async () => {
    academicsLoading = true; render()
    try { academicsData = await fetchJson('/api/academics/active', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: button.dataset.academicSwitch }) }); academicsError = null }
    catch (error) { academicsError = error.message }
    finally { academicsLoading = false; render() }
  }))
  document.querySelectorAll('[data-academic-programme-create]').forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault(); const data = new FormData(form); academicsLoading = true; render()
    try { academicsData = await fetchJson('/api/academics/programmes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: { programme: data.get('programme'), academicYear: data.get('academicYear'), currentYearKey: data.get('academicYear') } }) }); academicsError = null }
    catch (error) { academicsError = error.message }
    finally { academicsLoading = false; render() }
  }))
  document.querySelectorAll('[data-academic-programme-delete]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('Delete this programme and all of its academic records?')) return
    try { academicsData = await fetchJson(`/api/academics/programmes/${encodeURIComponent(academicsData.workspace.id)}`, { method: 'DELETE' }); academicsError = null }
    catch (error) { academicsError = error.message }
    render()
  }))
  document.querySelectorAll('[data-academic-failed-gpa]').forEach((input) => input.addEventListener('change', () => saveAcademics({ ...academicsData.workspace, profile: { ...academicsData.workspace.profile, gpaIncludesFailedCourses: input.checked } })))
  document.querySelectorAll('[data-academic-export]').forEach((button) => button.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ version: 1, data: academicsData.workspace }, null, 2)], { type: 'application/json' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `wicker-academics-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href)
  }))
  document.querySelectorAll('[data-academic-import]').forEach((input) => input.addEventListener('change', async () => {
    const file = input.files?.[0]; if (!file) return
    try {
      const parsed = JSON.parse(await file.text()); const candidate = parsed.data || parsed
      if (!candidate?.profile || !Array.isArray(candidate?.courses)) throw new Error('This file does not contain an academics programme export.')
      const editorialCodes = new Set((state.courses || []).map((course) => String(course.code || '').toUpperCase()))
      const matched = candidate.courses.filter((course) => editorialCodes.has(String(course.code || '').toUpperCase())).length
      const unmatched = candidate.courses.length - matched
      if (!confirm(`Import ${candidate.courses.length} courses into a new programme? ${matched} match study courses by code; ${unmatched} will remain planning-only.`)) return
      academicsData = await fetchJson('/api/academics/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) })
      const report = academicsData.importReport
      if (report) alert(`Import complete: ${report.matched.length} matched, ${report.unmatched.length} planning-only, ${report.rejected.length} rejected.`)
      academicsError = null; route = { page: 'planning', tab: 'overview' }; window.location.hash = '#/planning/overview'; render()
    }
    catch (error) { academicsError = `Import failed: ${error.message}`; render() }
  }))

  document.querySelectorAll('[data-chapter-retry]').forEach((button) => {
    button.addEventListener('click', () => {
      chapterCache.delete(button.dataset.chapterRetry)
      render()
    })
  })

  document.querySelectorAll('[data-practice-retry]').forEach((button) => {
    button.addEventListener('click', () => loadPractice({ force: true }))
  })

  document.querySelectorAll('[data-practice-course]').forEach((button) => {
    button.addEventListener('click', () => {
      practiceView.courseId = button.dataset.practiceCourse
      practiceView.index = 0
      render()
    })
  })

  document.querySelectorAll('[data-practice-queue-nav]').forEach((button) => {
    button.addEventListener('click', () => {
      const questions = practiceView.courseId === 'all'
        ? (practiceCache?.questions || [])
        : (practiceCache?.questions || []).filter((question) => question.courseId === practiceView.courseId)
      const action = button.dataset.practiceQueueNav
      if (action === 'prev') practiceView.index = Math.max(0, practiceView.index - 1)
      if (action === 'next') practiceView.index = Math.min(questions.length - 1, practiceView.index + 1)
      if (action === 'random' && questions.length > 1) {
        let next = practiceView.index
        while (next === practiceView.index) next = Math.floor(Math.random() * questions.length)
        practiceView.index = next
      }
      render()
      document.querySelector('.practice-queue-context')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  })

  document.querySelectorAll('[data-mobile-study-panel]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.mobileStudyPanel
      mobileStudyPanel = mobileStudyPanel === target ? null : target
      render()
    })
  })

  document.querySelectorAll('[data-study-tools-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      studyToolsTab = button.dataset.studyToolsTab === 'tutor' ? 'tutor' : 'progress'
      render()
      document.querySelector(`[data-study-tools-tab="${studyToolsTab}"]`)?.focus()
    })
  })

  document.querySelectorAll('.study-tools-tabs').forEach((tablist) => {
    tablist.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      const tabs = [...tablist.querySelectorAll('[role="tab"]')]
      const current = tabs.indexOf(document.activeElement)
      if (current < 0) return
      event.preventDefault()
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? tabs.length - 1
          : event.key === 'ArrowRight' ? (current + 1) % tabs.length
            : (current - 1 + tabs.length) % tabs.length
      tabs[next].click()
    })
  })

  document.querySelectorAll('.chapter-subtabs').forEach((tablist) => {
    tablist.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      const tabs = [...tablist.querySelectorAll('[role="tab"]')]
      const current = tabs.indexOf(document.activeElement)
      if (current < 0) return
      event.preventDefault()
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? tabs.length - 1
          : event.key === 'ArrowRight' ? (current + 1) % tabs.length
            : (current - 1 + tabs.length) % tabs.length
      tabs[next].focus()
      tabs[next].click()
    })
  })

  document.querySelectorAll('[data-sign-out]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true
      await window.__clerk?.signOut({ redirectUrl: window.location.origin })
    })
  })

  document.querySelectorAll('[data-refresh-usage]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true
      button.textContent = 'Refreshing…'
      await loadAiUsage()
      render()
    })
  })

  document.querySelectorAll('[data-export-data]').forEach((button) => {
    button.addEventListener('click', async () => {
      const original = button.innerHTML
      button.disabled = true
      button.textContent = 'Preparing export…'
      try {
        const response = await fetch('/api/account/export')
        if (!response.ok) throw new Error(await response.text() || 'Could not export your data')
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `wicker-study-data-${new Date().toISOString().slice(0, 10)}.json`
        document.body.append(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
        button.textContent = 'Downloaded'
        setTimeout(() => { if (button.isConnected) { button.disabled = false; button.innerHTML = original } }, 1800)
      } catch (error) {
        button.disabled = false
        button.innerHTML = original
        alert(`Could not export your data: ${error.message}`)
      }
    })
  })

  document.querySelectorAll('[data-account-delete-open]').forEach((button) => {
    button.addEventListener('click', () => {
      accountDeleteState.open = true
      accountDeleteState.confirmation = ''
      accountDeleteState.error = null
      render()
    })
  })
  document.querySelectorAll('[data-account-delete-close]').forEach((button) => {
    button.addEventListener('click', () => {
      if (accountDeleteState.deleting) return
      accountDeleteState.open = false
      accountDeleteState.confirmation = ''
      accountDeleteState.error = null
      render()
    })
  })
  document.querySelectorAll('[data-account-delete-overlay]').forEach((overlay) => {
    overlay.addEventListener('mousedown', (event) => {
      if (event.target === overlay && !accountDeleteState.deleting) {
        accountDeleteState.open = false
        accountDeleteState.confirmation = ''
        accountDeleteState.error = null
        render()
      }
    })
  })
  document.querySelectorAll('[data-account-delete-input]').forEach((input) => {
    input.addEventListener('input', (event) => {
      accountDeleteState.confirmation = event.currentTarget.value
      const confirmButton = document.querySelector('[data-account-delete-confirm]')
      if (confirmButton) confirmButton.disabled = accountDeleteState.confirmation !== 'DELETE'
    })
  })
  document.querySelectorAll('[data-account-delete-confirm]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (accountDeleteState.confirmation !== 'DELETE' || accountDeleteState.deleting) return
      accountDeleteState.deleting = true
      accountDeleteState.error = null
      render()
      try {
        await fetchJson('/api/account', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmation: 'DELETE' })
        })
        localStorage.clear()
        try { await window.__clerk?.signOut() } catch {}
        window.location.assign('/?account-deleted=1')
      } catch (error) {
        accountDeleteState.deleting = false
        accountDeleteState.error = `Deletion could not be completed. Your account remains accessible. ${error.message}`
        render()
      }
    })
  })

  document.querySelectorAll('[data-api-key-form]').forEach((form) => {
    form.addEventListener('input', () => {
      apiKeyForm.name = form.elements.name.value
      apiKeyForm.scopes = [...form.querySelectorAll('input[name="scope"]:checked')].map((input) => input.value)
    })
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      if (apiKeyForm.creating) return
      apiKeyForm.name = form.elements.name.value
      apiKeyForm.scopes = [...form.querySelectorAll('input[name="scope"]:checked')].map((input) => input.value)
      apiKeyForm.creating = true
      apiKeyForm.error = null
      render()
      try {
        apiKeyForm.created = await fetchJson('/api/account/api-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: apiKeyForm.name, scopes: apiKeyForm.scopes }) })
        apiKeyForm.name = ''
        apiKeyForm.scopes = ['read']
        await loadApiKeys(true)
      } catch (error) {
        apiKeyForm.error = error.message
      } finally {
        apiKeyForm.creating = false
        render()
      }
    })
  })
  document.querySelectorAll('[data-api-key-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const secret = document.querySelector('[data-api-key-secret]')?.textContent || ''
      try { await navigator.clipboard.writeText(secret); button.textContent = 'Copied' } catch { button.textContent = 'Select and copy' }
    })
  })
  document.querySelectorAll('[data-api-key-dismiss]').forEach((button) => button.addEventListener('click', () => { apiKeyForm.created = null; render() }))
  document.querySelectorAll('[data-api-key-revoke]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.apiKeyRevoke
      const key = apiKeysCache?.keys?.find((item) => item.id === id)
      if (!(await showConfirm({ title: `Revoke “${key?.name || 'this key'}”?`, message: 'Any agent using it will stop working immediately.', okLabel: 'Revoke key', danger: true }))) return
      try { await fetchJson(`/api/account/api-keys/${encodeURIComponent(id)}`, { method: 'DELETE' }); await loadApiKeys(true) }
      catch (error) { alert(`Could not revoke the key: ${error.message}`) }
      render()
    })
  })

  document.querySelectorAll('[data-open-profile]').forEach((button) => {
    button.addEventListener('click', () => { window.__clerk?.openUserProfile?.() })
  })
  document.querySelectorAll('[data-account-reset-open]').forEach((button) => {
    button.addEventListener('click', () => {
      Object.assign(accountResetState, { open: true, scope: button.dataset.accountResetOpen === 'everything' ? 'everything' : 'study', confirmation: '', error: null })
      render()
    })
  })
  const closeReset = () => {
    if (accountResetState.working) return
    Object.assign(accountResetState, { open: false, confirmation: '', error: null })
    render()
  }
  document.querySelectorAll('[data-account-reset-close]').forEach((button) => button.addEventListener('click', closeReset))
  document.querySelectorAll('[data-account-reset-overlay]').forEach((overlay) => {
    overlay.addEventListener('mousedown', (event) => { if (event.target === overlay) closeReset() })
  })
  document.querySelectorAll('[data-account-reset-input]').forEach((input) => {
    input.addEventListener('input', (event) => {
      accountResetState.confirmation = event.currentTarget.value
      const confirmButton = document.querySelector('[data-account-reset-confirm]')
      if (confirmButton) confirmButton.disabled = accountResetState.confirmation !== 'RESET'
    })
  })
  document.querySelectorAll('[data-account-reset-confirm]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (accountResetState.confirmation !== 'RESET' || accountResetState.working) return
      accountResetState.working = true
      accountResetState.error = null
      render()
      try {
        await fetchJson('/api/account/data', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmation: 'RESET', scope: accountResetState.scope })
        })
        for (const key of Object.keys(localStorage)) {
          if (/^(chapter-read:|chapter-tab|recent-chapter|attempt|practice|mock)/.test(key)) localStorage.removeItem(key)
        }
        window.location.assign('/app#/account/data')
        window.location.reload()
      } catch (error) {
        accountResetState.working = false
        accountResetState.error = `Reset could not be completed. Nothing was changed. ${error.message}`
        render()
      }
    })
  })

  // ----- Course search (popup) -----
  document.querySelectorAll('[data-search-open]').forEach((btn) => {
    btn.addEventListener('click', () => openSearchPopup())
  })
  document.querySelectorAll('[data-search-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      searchState.open = false
      render()
    })
  })
  document.querySelectorAll('[data-search-overlay]').forEach((bg) => {
    bg.addEventListener('mousedown', (event) => {
      if (event.target === event.currentTarget) {
        searchState.open = false
        render()
      }
    })
  })
  document.querySelectorAll('[data-search-course]').forEach((btn) => {
    btn.addEventListener('mousedown', (event) => event.preventDefault()) // don't steal focus
    btn.addEventListener('click', (event) => {
      const cid = event.currentTarget.dataset.searchCourse
      if (cid === searchState.courseId) return
      searchState.courseId = cid
      searchState.results = []
      searchState.selectedIdx = -1
      const q = searchState.query
      _searchPendingFocus = true
      render()
      if (q.trim().length >= 2) runSearch(cid, q)
    })
  })
  document.querySelectorAll('[data-search-input]').forEach((input) => {
    input.addEventListener('input', (event) => {
      const courseId = event.currentTarget.dataset.searchInput || searchState.courseId
      const v = event.currentTarget.value
      searchState.query = v
      clearTimeout(_searchDebounce)
      _searchDebounce = setTimeout(() => runSearch(courseId, v), 220)
    })
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        searchState.open = false
        render()
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (searchState.results.length) {
          searchState.selectedIdx = (searchState.selectedIdx + 1) % searchState.results.length
          render()
        }
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (searchState.results.length) {
          searchState.selectedIdx = (searchState.selectedIdx - 1 + searchState.results.length) % searchState.results.length
          render()
        }
      } else if (event.key === 'Enter') {
        event.preventDefault()
        const r = searchState.results[searchState.selectedIdx]
        if (r) openSearchResult(r)
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        // Cycle course pills only when caret is at the edge of the input (so typing isn't disrupted).
        const courses = state?.courses || []
        if (courses.length < 2) return
        const el = event.currentTarget
        const atStart = el.selectionStart === 0 && el.selectionEnd === 0
        const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length
        const goLeft = event.key === 'ArrowLeft' && atStart
        const goRight = event.key === 'ArrowRight' && atEnd
        if (!goLeft && !goRight) return
        event.preventDefault()
        const curIdx = courses.findIndex((c) => c.id === searchState.courseId)
        const nextIdx = goLeft
          ? (curIdx - 1 + courses.length) % courses.length
          : (curIdx + 1) % courses.length
        const next = courses[nextIdx]
        if (next.id === searchState.courseId) return
        searchState.courseId = next.id
        searchState.results = []
        searchState.selectedIdx = -1
        const q = searchState.query
        _searchPendingFocus = true
        render()
        if (q.trim().length >= 2) runSearch(next.id, q)
      }
    })
  })
  document.querySelectorAll('[data-search-result]').forEach((btn) => {
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault() // keep focus inside input until we navigate
    })
    btn.addEventListener('click', (event) => {
      const idx = parseInt(event.currentTarget.dataset.searchResult, 10)
      openSearchResult(searchState.results[idx])
    })
  })
  document.querySelectorAll('[data-search-clear]').forEach((btn) => {
    btn.addEventListener('mousedown', (event) => event.preventDefault())
    btn.addEventListener('click', () => {
      searchState.query = ''
      searchState.results = []
      searchState.selectedIdx = -1
      _searchPendingFocus = true
      render()
    })
  })

  // ----- Course chapters section toggle -----
  document.querySelectorAll('[data-course-chapters-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      courseChaptersCollapsed = !courseChaptersCollapsed
      try { localStorage.setItem('course-chapters-collapsed', String(courseChaptersCollapsed)) } catch {}
      render()
    })
  })

  // ----- Course management (archive / reorder / sidebar archived section) -----
  document.querySelectorAll('[data-toggle-manage]').forEach((btn) => {
    btn.addEventListener('click', () => { dashboardManageMode = !dashboardManageMode; render() })
  })
  document.querySelectorAll('[data-course-archive]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const id = event.currentTarget.dataset.courseArchive
      setCourseArchived(id, event.currentTarget.dataset.archived === 'true')
    })
  })
  document.querySelectorAll('[data-course-move]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      moveCourse(event.currentTarget.dataset.courseMove, event.currentTarget.dataset.dir)
    })
  })
  document.querySelectorAll('[data-sidebar-archived-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => { sidebarArchivedOpen = !sidebarArchivedOpen; render() })
  })

  document.querySelectorAll('[data-set-mastery]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      setMastery(event.currentTarget.dataset.setMastery, Number(event.currentTarget.dataset.level))
    })
  })

  document.querySelectorAll('[data-notes]').forEach((textarea) => {
    textarea.addEventListener('change', (event) => updateNotes(event.currentTarget.dataset.notes, event.currentTarget.value))
  })

  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      await navigator.clipboard.writeText(event.currentTarget.dataset.copy)
      event.currentTarget.textContent = 'Copied'
      setTimeout(() => { event.currentTarget.textContent = 'Copy id' }, 900)
    })
  })

  document.querySelectorAll('[data-log-quiz]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const id = event.currentTarget.dataset.logQuiz
      const score = window.prompt('Quiz score (e.g. 7/10 or just 7):')
      if (score === null) return
      const note = window.prompt('Quick note (optional):') || ''
      logReviewEvent(id, { kind: 'quiz', score, note })
    })
  })

  document.querySelectorAll('[data-log-review]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const id = event.currentTarget.dataset.logReview
      const note = window.prompt('Review note (what you covered, what was weak):') || ''
      if (!note) return
      logReviewEvent(id, { kind: 'review', note })
    })
  })

  document.querySelectorAll('[data-open-chapter]').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (event.target.closest('a')) return
      const [cid, chid] = event.currentTarget.dataset.openChapter.split('/')
      window.location.hash = `#/course/${cid}/chapter/${chid}`
    })
  })

  document.querySelectorAll('[data-toolbar]').forEach((control) => {
    const kind = control.dataset.toolbar
    if (kind === 'search') {
      control.addEventListener('input', (event) => { filterState.search = event.currentTarget.value; rerenderItemList() })
    } else if (kind === 'clear') {
      control.addEventListener('click', () => {
        filterState.category = 'all'; filterState.mastery = 'all'; filterState.sort = 'priority'; filterState.search = ''
        render()
      })
    } else {
      control.addEventListener('change', (event) => { filterState[kind] = event.currentTarget.value; rerenderItemList() })
    }
  })

  document.querySelectorAll('[data-load-questions]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const [cid, chid] = event.currentTarget.dataset.loadQuestions.split('/')
      loadQuestions(cid, chid)
    })
  })

  document.querySelectorAll('[data-regenerate]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      const [cid, chid] = event.currentTarget.dataset.regenerate.split('/')
      const ok = await showConfirm({
        title: 'Regenerate questions for this chapter?',
        message: 'The current cached question set will be replaced with a fresh one generated by Codex.',
        okLabel: 'Regenerate',
        cancelLabel: 'Cancel',
        danger: true,
      })
      if (ok) loadQuestions(cid, chid, { force: true })
    })
  })

  // Regenerate modal handlers
  document.querySelectorAll('[data-regen-open]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      regenModal.open = event.currentTarget.dataset.regenOpen
      regenModal.error = null
      render()
    })
  })
  document.querySelectorAll('[data-regen-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      regenModal.open = null
      regenModal.error = null
      render()
    })
  })
  document.querySelectorAll('[data-regen-overlay]').forEach((overlay) => {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay && !regenModal.generating) {
        regenModal.open = null
        regenModal.error = null
        render()
      }
    })
  })
  document.querySelectorAll('[data-regen-type]').forEach((box) => {
    box.addEventListener('change', (event) => {
      const t = event.currentTarget.dataset.regenType
      if (event.currentTarget.checked) {
        if (!regenModal.types.includes(t)) regenModal.types.push(t)
      } else {
        regenModal.types = regenModal.types.filter((x) => x !== t)
      }
    })
  })
  document.querySelectorAll('[data-regen-count]').forEach((radio) => {
    radio.addEventListener('change', (event) => {
      regenModal.count = Number(event.currentTarget.dataset.regenCount)
      const btn = document.querySelector('[data-regen-submit]')
      if (btn) btn.innerHTML = `${uiIcon('refresh')} Regenerate ${regenModal.count}`
    })
  })
  document.querySelectorAll('[data-regen-prompt]').forEach((ta) => {
    ta.addEventListener('input', (event) => {
      regenModal.customPrompt = event.currentTarget.value
    })
  })
  document.querySelectorAll('[data-regen-submit]').forEach((btn) => {
    btn.addEventListener('click', submitRegen)
  })

  // Custom multi-select dropdown handlers (replaces the old <select> for question filters)
  document.querySelectorAll('[data-multi-dd-toggle]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      const key = event.currentTarget.dataset.multiDdToggle
      questionFilter.openDd = questionFilter.openDd === key ? null : key
      render()
    })
  })
  document.querySelectorAll('[data-multi-dd-value]').forEach((cb) => {
    cb.addEventListener('change', (event) => {
      event.stopPropagation()
      const [key, value] = event.currentTarget.dataset.multiDdValue.split(':')
      const arr = questionFilter[key]
      if (event.currentTarget.checked) {
        if (!arr.includes(value)) arr.push(value)
      } else {
        questionFilter[key] = arr.filter((v) => v !== value)
      }
      if (route.page === 'chapter') {
        const nav = getQuestionNav(route.courseId, route.chapterId)
        nav.index = 0
      }
      render()
    })
  })
  document.querySelectorAll('[data-multi-dd-all]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      const key = event.currentTarget.dataset.multiDdAll
      if (key === 'types') {
        questionFilter.types = Object.keys(QUESTION_TYPE_LABELS).slice()
      } else if (key === 'sources') {
        questionFilter.sources = ['kb', 'gen']
      }
      render()
    })
  })
  document.querySelectorAll('[data-multi-dd-clear]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      const key = event.currentTarget.dataset.multiDdClear
      questionFilter[key] = []
      if (route.page === 'chapter') {
        const nav = getQuestionNav(route.courseId, route.chapterId)
        nav.index = 0
      }
      render()
    })
  })
  // Prevent clicks inside the open panel from bubbling up to the outside-click handler
  document.querySelectorAll('.multi-dd-panel').forEach((panel) => {
    panel.addEventListener('click', (event) => event.stopPropagation())
  })

  // Progress tracker: click a cell to jump to that question
  document.querySelectorAll('[data-q-progress-jump]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      if (route.page !== 'chapter') return
      const idx = Number(event.currentTarget.dataset.qProgressJump)
      const nav = getQuestionNav(route.courseId, route.chapterId)
      nav.index = idx
      render()
    })
  })

  // Delete a question from the bank
  document.querySelectorAll('[data-q-delete]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const [cid, chid, qid] = event.currentTarget.dataset.qDelete.split('/')
      deleteQuestion(cid, chid, qid)
    })
  })

  // Toolbar overflow menu (per chapter)
  document.querySelectorAll('[data-tb-more-toggle]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      const key = event.currentTarget.dataset.tbMoreToggle
      toolbarMoreOpen = toolbarMoreOpen === key ? null : key
      render()
    })
  })
  // Closing the menu when the user clicks a menu item — we let the click bubble
  // to the action handler first (data-bulk-sr / data-start-mock / data-regen-open),
  // then close on the next tick.
  document.querySelectorAll('[data-tb-more-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setTimeout(() => { toolbarMoreOpen = null; render() }, 0)
    })
  })

  // Custom confirm modal
  document.querySelectorAll('[data-confirm-ok]').forEach((btn) => {
    btn.addEventListener('click', () => resolveConfirm(true))
  })
  document.querySelectorAll('[data-confirm-cancel]').forEach((btn) => {
    btn.addEventListener('click', () => resolveConfirm(false))
  })
  document.querySelectorAll('[data-confirm-overlay]').forEach((overlay) => {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) resolveConfirm(false)
    })
  })

  document.querySelectorAll('[data-q-nav]').forEach((ctrl) => {
    const handle = (event) => {
      if (route.page !== 'chapter') return
      const cstate = questionsCache.get(`${route.courseId}/${route.chapterId}`)
      if (!cstate?.questions) return
      const filtered = cstate.questions.filter((q) => {
        if (questionFilter.types.length && !questionFilter.types.includes(q.type)) return false
        if (questionFilter.sources.length) {
          const sourceTag = q.id.startsWith('gen-') ? 'gen' : 'kb'
          if (!questionFilter.sources.includes(sourceTag)) return false
        }
        return true
      })
      const nav = getQuestionNav(route.courseId, route.chapterId)
      const action = event.currentTarget.dataset.qNav
      if (action === 'next' && nav.index < filtered.length - 1) nav.index++
      else if (action === 'prev' && nav.index > 0) nav.index--
      else if (action === 'random') nav.index = Math.floor(Math.random() * filtered.length)
      else if (action === 'jump') nav.index = Number(event.currentTarget.value)
      render()
    }
    const evt = ctrl.tagName === 'SELECT' ? 'change' : 'click'
    ctrl.addEventListener(evt, handle)
  })

	  document.querySelectorAll('[data-attempt]').forEach((input) => {
	    const handler = (event) => {
	      autosizeTextarea(event.currentTarget)
	      const key = event.currentTarget.dataset.attempt
	      const noteKey = key.endsWith('-note')
	      const base = noteKey ? key.slice(0, -5) : key
	      const att = attemptState.get(base) || {}
	      if (noteKey) att.note = event.currentTarget.value
	      else if (event.currentTarget.type === 'checkbox') {
	        const checked = Array.from(document.querySelectorAll(`[data-attempt="${CSS.escape(base)}"][type="checkbox"]:checked`))
	          .map((x) => x.value)
	        att.value = checked.join('\n')
	      } else att.value = event.currentTarget.value
	      attemptState.set(base, att)
	    }
    input.addEventListener('input', handler)
    input.addEventListener('change', handler)
  })

  document.querySelectorAll('[data-grade]').forEach((btn) => {
    btn.addEventListener('click', (event) => gradeAttempt(event.currentTarget.dataset.grade))
  })

  // Chapter practice questions: drag-drop and file-pick image attachment
  document.querySelectorAll('[data-attempt-drop]').forEach((zone) => {
    const key = zone.dataset.attemptDrop
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drop-hover') })
    zone.addEventListener('dragleave', () => { zone.classList.remove('drop-hover') })
    zone.addEventListener('drop', async (e) => {
      e.preventDefault()
      zone.classList.remove('drop-hover')
      const files = [...(e.dataTransfer?.files || [])]
      const urls = await pickedImages(files)
      if (!urls.length) return
      const att = attemptState.get(key) || {}
      att.images = [...(att.images || []), ...urls]
      attemptState.set(key, att)
      render()
    })
    zone.addEventListener('paste', async (e) => {
      const files = [...(e.clipboardData?.files || [])]
      if (!files.length) return
      const urls = await pickedImages(files)
      if (!urls.length) return
      e.preventDefault()
      const att = attemptState.get(key) || {}
      att.images = [...(att.images || []), ...urls]
      attemptState.set(key, att)
      render()
    })
  })
  document.querySelectorAll('[data-attempt-file]').forEach((input) => {
    input.addEventListener('change', async (event) => {
      const key = event.currentTarget.dataset.attemptFile
      const urls = await pickedImages([...(event.currentTarget.files || [])])
      if (!urls.length) return
      const att = attemptState.get(key) || {}
      att.images = [...(att.images || []), ...urls]
      attemptState.set(key, att)
      render()
    })
  })
  document.querySelectorAll('[data-remove-image]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const key = event.currentTarget.dataset.removeImage
      // dataset may also contain the index; we look up sibling thumb
      const wrapper = event.currentTarget.closest('.attempt-thumb')
      const all = [...event.currentTarget.closest('.attempt-thumbs').querySelectorAll('.attempt-thumb')]
      const idx = all.indexOf(wrapper)
      const att = attemptState.get(key) || {}
      att.images = (att.images || []).filter((_, i) => i !== idx)
      attemptState.set(key, att)
      render()
    })
  })

  // Practice exam parts: same flow keyed by qid
  document.querySelectorAll('[data-practice-drop]').forEach((zone) => {
    const qid = zone.dataset.practiceDrop
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drop-hover') })
    zone.addEventListener('dragleave', () => { zone.classList.remove('drop-hover') })
    zone.addEventListener('drop', async (e) => {
      e.preventDefault()
      zone.classList.remove('drop-hover')
      const urls = await pickedImages([...(e.dataTransfer?.files || [])])
      if (!urls.length) return
      practiceExamView.attemptImages[qid] = [...(practiceExamView.attemptImages[qid] || []), ...urls]
      persistPracticeAttempts(route.courseId)
      render()
    })
    zone.addEventListener('paste', async (e) => {
      const urls = await pickedImages([...(e.clipboardData?.files || [])])
      if (!urls.length) return
      e.preventDefault()
      practiceExamView.attemptImages[qid] = [...(practiceExamView.attemptImages[qid] || []), ...urls]
      persistPracticeAttempts(route.courseId)
      render()
    })
  })
  document.querySelectorAll('[data-practice-file]').forEach((input) => {
    input.addEventListener('change', async (event) => {
      const qid = event.currentTarget.dataset.practiceFile
      const urls = await pickedImages([...(event.currentTarget.files || [])])
      if (!urls.length) return
      practiceExamView.attemptImages[qid] = [...(practiceExamView.attemptImages[qid] || []), ...urls]
      persistPracticeAttempts(route.courseId)
      render()
    })
  })
  document.querySelectorAll('[data-practice-remove-image]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const qid = event.currentTarget.dataset.practiceRemoveImage
      const wrapper = event.currentTarget.closest('.attempt-thumb')
      const all = [...event.currentTarget.closest('.attempt-thumbs').querySelectorAll('.attempt-thumb')]
      const idx = all.indexOf(wrapper)
      practiceExamView.attemptImages[qid] = (practiceExamView.attemptImages[qid] || []).filter((_, i) => i !== idx)
      persistPracticeAttempts(route.courseId)
      render()
    })
  })

  document.querySelectorAll('[data-chat-input]').forEach((el) => {
    el.addEventListener('input', (event) => {
      const [cid, chid] = event.currentTarget.dataset.chatInput.split('/')
      const chat = getChat(cid, chid)
      chat.draft = event.currentTarget.value
    })
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        const [cid, chid] = event.currentTarget.dataset.chatInput.split('/')
        sendChat(cid, chid)
      }
    })
  })

  document.querySelectorAll('[data-chat-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const [cid, chid] = event.currentTarget.dataset.chatForm.split('/')
      sendChat(cid, chid)
    })
  })

  document.querySelectorAll('[data-chat-clear]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const [cid, chid] = event.currentTarget.dataset.chatClear.split('/')
      clearChat(cid, chid)
    })
  })

  document.querySelectorAll('[data-toc-target]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault()
      const id = event.currentTarget.dataset.tocTarget
      const target = document.getElementById(id)
      if (target) scrollWithin(getStudyScroller(), target)
    })
  })

  document.querySelectorAll('[data-chapter-tab]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const tab = event.currentTarget.dataset.chapterTab
      const cid = event.currentTarget.dataset.tabCourse
      const chid = event.currentTarget.dataset.tabChapter
      if (!tab || !cid || !chid) return
      if (getChapterTab(cid, chid) === tab) return
      setChapterTab(cid, chid, tab)
      const scroller = getStudyScroller()
      if (scroller) scroller.scrollTop = 0
      _suppressNextScrollRestore = true
      render()
    })
  })

  // Mark-as-read toggle (both rail card + footer button)
  document.querySelectorAll('[data-chapter-read-toggle]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const [cid, chid] = event.currentTarget.dataset.chapterReadToggle.split('/')
      const nowRead = !isChapterRead(cid, chid)
      setChapterRead(cid, chid, nowRead)
      if (nowRead) {
        const course = state.courses.find((c) => c.id === cid)
        const chapter = course?.chapters?.find((ch) => ch.id === chid)
        fetch('/api/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'read', courseId: cid, chapterId: chid, label: chapter?.name || '' }) })
          .then(() => invalidateActivity()).catch(() => {})
      }
      render()
    })
  })

  // Jump from anywhere to a specific tab inside the course's practice surface (course-wide)
  document.querySelectorAll('[data-course-jump]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const target = event.currentTarget.dataset.courseJump
      const cid = event.currentTarget.dataset.jumpCourse
      if (!cid) return
      practiceExamView.tab = target
      if (target === 'mock-questions') {
        mockQuestionsView.courseId = cid
        mockQuestionsView.chapterId = 'all'
        mockQuestionsView.topics = []
        mockQuestionsView.types = []
        mockQuestionsView.openDd = null
        mockQuestionsView.currentIndex = 0
      } else if (target === 'flashcards') {
        flashcardsView.courseId = cid
        flashcardsView.expanded = flashcardsView.expanded || {}
        // Collapse all chapters so the user sees the full grouped overview
        for (const k of Object.keys(flashcardsView.expanded)) flashcardsView.expanded[k] = false
      } else if (target === 'exams' || target === 'tutorials') {
        // Default sub-tab: PDF (page state will be re-validated inside renderMockExamPage)
        if (!practiceExamView.examSubtab) practiceExamView.examSubtab = 'pdf'
      }
      const targetHash = `#/course/${cid}/mock-exam`
      if (window.location.hash === targetHash) {
        render()
      } else {
        window.location.hash = targetHash
      }
    })
  })

  // Chapter card on course landing — expand/collapse to show topics
  document.querySelectorAll('[data-chapter-row-toggle]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const key = event.currentTarget.dataset.chapterRowToggle
      chapterRowExpanded.set(key, !chapterRowExpanded.get(key))
      render()
    })
  })

  // Course navigator: live filter input
  document.querySelectorAll('[data-course-filter]').forEach((input) => {
    input.addEventListener('input', (event) => {
      const cid = event.currentTarget.dataset.courseFilter
      setCourseFilter(cid, event.currentTarget.value)
      render()
    })
  })
  document.querySelectorAll('[data-course-filter-clear]').forEach((btn) => {
    btn.addEventListener('mousedown', (event) => event.preventDefault())
    btn.addEventListener('click', (event) => {
      const cid = event.currentTarget.dataset.courseFilterClear
      setCourseFilter(cid, '')
      render()
    })
  })

  // Course navigator: jump to chapter card without leaving the page (anchor scroll inside .content)
  document.querySelectorAll('[data-course-nav-jump]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault()
      const [cid, chid] = event.currentTarget.dataset.courseNavJump.split('/')
      const target = document.getElementById(`chapter-card-${cid}-${chid}`)
      if (target) scrollWithin(getStudyScroller(), target)
    })
  })
  document.querySelectorAll('[data-course-nav-topic-toggle]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const key = event.currentTarget.dataset.courseNavTopicToggle
      if (!key) return
      chapterRowExpanded.set(key, !chapterRowExpanded.get(key))
      render()
    })
  })
  document.querySelectorAll('[data-course-nav-heading]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault()
      const [courseId, chapterId, slug] = event.currentTarget.dataset.courseNavHeading.split('/')
      pendingHeadingScroll = { courseId, chapterId, slug }
      window.location.hash = `#/course/${courseId}/chapter/${chapterId}`
    })
  })

  // Topic chip click — cycle mastery 0 → 1 → 2 → 3 → 4 → 0
  document.querySelectorAll('[data-topic-cycle]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const itemId = event.currentTarget.dataset.topicCycle
      const it = itemById(itemId)
      if (!it) return
      const next = ((it.mastery || 0) + 1) % 5
      setMastery(itemId, next) // already updates state + persists; triggers render
    })
  })

  // Auto-mark a chapter as read when the user scrolls near the end of the content tab.
  if (route.page === 'chapter') {
    const scroller = getStudyScroller()
    const cid = route.courseId, chid = route.chapterId
    if (scroller && cid && chid && !isChapterRead(cid, chid) && getChapterTab(cid, chid) === 'content') {
      const onScroll = () => {
        const ratio = (scroller.scrollTop + scroller.clientHeight) / scroller.scrollHeight
        if (ratio >= 0.9) {
          setChapterRead(cid, chid, true)
          scroller.removeEventListener('scroll', onScroll)
          render() // scroll position is preserved by captureScrollState/restoreScrollState in render()
        }
      }
      scroller.addEventListener('scroll', onScroll, { passive: true })
    }
  }

  document.querySelectorAll('[data-back-to-course]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const courseId = event.currentTarget.dataset.backToCourse
      const scroller = getStudyScroller()
      if (scroller) scroller.scrollTop = 0
      window.location.hash = `#/course/${courseId}`
    })
  })

  document.querySelectorAll('[data-mock-tab]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const target = event.currentTarget.dataset.mockTab
      practiceExamView.tab = target
      if ((target === 'exams' || target === 'tutorials') && !practiceExamView.examSubtab) practiceExamView.examSubtab = 'pdf'
      _suppressNextScrollRestore = true
      render()
    })
  })

  document.querySelectorAll('[data-mq-generate]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      generateMockQuestionsAction(event.currentTarget.dataset.mqGenerate)
    })
  })
  document.querySelectorAll('[data-update-pull]').forEach((btn) => {
    btn.addEventListener('click', () => startUpdatePull())
  })
  document.querySelectorAll('[data-update-recheck]').forEach((btn) => {
    btn.addEventListener('click', () => checkForUpdates({ force: true }))
  })
  document.querySelectorAll('[data-update-restart]').forEach((btn) => {
    btn.addEventListener('click', () => triggerRestartAndReload())
  })
  document.querySelectorAll('[data-genall-start]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      startGenerateAll(event.currentTarget.dataset.genallStart)
    })
  })
  document.querySelectorAll('[data-course-rerun]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      confirmAndRerunCourse(event.currentTarget.dataset.courseRerun, event.currentTarget.dataset.courseRerunName)
    })
  })
  document.querySelectorAll('[data-genall-all-start]').forEach((btn) => {
    btn.addEventListener('click', () => startGenerateAllCourses())
  })
  // Single click handler for every "Clear progress" affordance in the app.
  // Buttons carry data-clear-scope plus the scope's required parameters as
  // data-clear-* attributes.
  document.querySelectorAll('[data-clear-scope]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const d = event.currentTarget.dataset
      clearProgress({
        scope: d.clearScope,
        courseId: d.clearCourse,
        chapterId: d.clearChapter,
        examId: d.clearExam,
        questionId: d.clearQuestion,
        courseName: d.clearCourseName,
        examLabel: d.clearExamLabel
      })
    })
  })
  document.querySelectorAll('[data-mq-regenerate]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      const cid = event.currentTarget.dataset.mqRegenerate
      const ok = await showConfirm({
        title: 'Regenerate mock questions?',
        message: 'This discards the current question bank for this course and runs codex again across every chapter (2–5 min). Old attempt history will still be in localStorage but won\'t be tied to the new questions.',
        okLabel: 'Regenerate',
        cancelLabel: 'Cancel',
      })
      if (!ok) return
      generateMockQuestionsAction(cid)
    })
  })
  document.querySelectorAll('[data-mq-multi-toggle]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      const key = event.currentTarget.dataset.mqMultiToggle
      mockQuestionsView.openDd = mockQuestionsView.openDd === key ? null : key
      render()
    })
  })
  document.querySelectorAll('[data-mq-multi-value]').forEach((cb) => {
    cb.addEventListener('change', (event) => {
      event.stopPropagation()
      const idx = event.currentTarget.dataset.mqMultiValue.indexOf(':')
      const key = event.currentTarget.dataset.mqMultiValue.slice(0, idx)
      const value = event.currentTarget.dataset.mqMultiValue.slice(idx + 1)
      const arr = mockQuestionsView[key]
      if (event.currentTarget.checked) {
        if (!arr.includes(value)) arr.push(value)
      } else {
        mockQuestionsView[key] = arr.filter((v) => v !== value)
      }
      mockQuestionsView.currentIndex = 0
      render()
    })
  })
  document.querySelectorAll('[data-mq-multi-all]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      const key = event.currentTarget.dataset.mqMultiAll
      const cache = mockQuestionsCache.get(mockQuestionsView.courseId)
      if (!cache?.questions) return
      if (key === 'topics') {
        const topics = mockQuestionsView.chapterId === 'all'
          ? [...new Set(cache.questions.map((q) => q.topic))]
          : [...new Set(cache.questions.filter((q) => q.chapterId === mockQuestionsView.chapterId).map((q) => q.topic))]
        mockQuestionsView.topics = topics
      } else if (key === 'types') {
        mockQuestionsView.types = [...new Set(cache.questions.map((q) => q.type))]
      }
      render()
    })
  })
  document.querySelectorAll('[data-mq-multi-clear]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      const key = event.currentTarget.dataset.mqMultiClear
      mockQuestionsView[key] = []
      mockQuestionsView.currentIndex = 0
      render()
    })
  })
  document.querySelectorAll('[data-mq-progress-jump]').forEach((cell) => {
    cell.addEventListener('click', (event) => {
      mockQuestionsView.currentIndex = parseInt(event.currentTarget.dataset.mqProgressJump, 10) || 0
      render()
    })
  })
  document.querySelectorAll('[data-mq-nav]').forEach((ctrl) => {
    const handler = (event) => {
      const dir = event.currentTarget.dataset.mqNav
      const cache = mockQuestionsCache.get(mockQuestionsView.courseId)
      const filtered = cache?.questions ? filterMockQuestions(cache.questions) : []
      if (!filtered.length) return
      if (dir === 'next' && mockQuestionsView.currentIndex < filtered.length - 1) mockQuestionsView.currentIndex++
      else if (dir === 'prev' && mockQuestionsView.currentIndex > 0) mockQuestionsView.currentIndex--
      else if (dir === 'random') mockQuestionsView.currentIndex = Math.floor(Math.random() * filtered.length)
      else if (dir === 'jump') mockQuestionsView.currentIndex = parseInt(event.currentTarget.value, 10) || 0
      render()
    }
    if (ctrl.tagName === 'SELECT') ctrl.addEventListener('change', handler)
    else ctrl.addEventListener('click', handler)
  })
  document.querySelectorAll('[data-mq-toc-chapter]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const cid = event.currentTarget.dataset.mqTocChapter
      mockQuestionsView.chapterId = cid
      mockQuestionsView.topics = []
      mockQuestionsView.currentIndex = 0
      render()
    })
  })
  document.querySelectorAll('[data-mq-toc-topic]').forEach((link) => {
    link.addEventListener('click', (event) => {
      mockQuestionsView.topics = [event.currentTarget.dataset.mqTocTopic]
      mockQuestionsView.currentIndex = 0
      render()
    })
  })

  // ----- Flashcards handlers -----
  document.querySelectorAll('[data-fc-toggle-chapter]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const chid = event.currentTarget.dataset.fcToggleChapter
      flashcardsView.expanded[chid] = flashcardsView.expanded[chid] === false ? true : false
      render()
    })
  })
  document.querySelectorAll('[data-fc-flip]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const cid = event.currentTarget.dataset.fcFlip
      flashcardsView.flipped[cid] = !flashcardsView.flipped[cid]
      render()
    })
  })
  document.querySelectorAll('[data-fc-add]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      flashcardsView.newCard = { chapterId: event.currentTarget.dataset.fcAdd, front: '', back: '' }
      flashcardsView.expanded[event.currentTarget.dataset.fcAdd] = true
      render()
    })
  })
  document.querySelectorAll('[data-fc-edit]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const cardId = event.currentTarget.dataset.fcEdit
      const chid = event.currentTarget.dataset.chapter
      const cache = flashcardsCache.get(flashcardsView.courseId)
      const card = (cache?.byChapter?.[chid] || []).find((c) => c.id === cardId)
      if (!card) return
      flashcardsView.editingCard = { cardId, chapterId: chid, front: card.front, back: card.back }
      render()
    })
  })
  document.querySelectorAll('[data-fc-delete]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      const cardId = event.currentTarget.dataset.fcDelete
      const chid = event.currentTarget.dataset.chapter
      const ok = await showConfirm({
        title: 'Delete this flashcard?',
        message: 'This permanently removes the card and its review history.',
        okLabel: 'Delete',
        cancelLabel: 'Keep',
        danger: true
      })
      if (!ok) return
      try {
        await deleteFlashcard(flashcardsView.courseId, chid, cardId)
        render()
      } catch (err) {
        alert('Delete failed: ' + err.message)
      }
    })
  })
  document.querySelectorAll('[data-fc-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const mode = event.currentTarget.dataset.fcForm
      const chid = event.currentTarget.dataset.chapter
      const cardId = event.currentTarget.dataset.card
      const front = event.currentTarget.querySelector('textarea[name="front"]').value.trim()
      const back = event.currentTarget.querySelector('textarea[name="back"]').value.trim()
      if (!front || !back) return
      try {
        if (mode === 'new') {
          await createFlashcard(flashcardsView.courseId, chid, front, back)
          flashcardsView.newCard = null
        } else {
          await editFlashcard(flashcardsView.courseId, chid, cardId, front, back)
          flashcardsView.editingCard = null
        }
        render()
      } catch (err) {
        alert('Save failed: ' + err.message)
      }
    })
  })
  document.querySelectorAll('[data-fc-form-cancel]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      if (event.currentTarget.dataset.fcFormCancel === 'edit') flashcardsView.editingCard = null
      else flashcardsView.newCard = null
      render()
    })
  })
  document.querySelectorAll('[data-fc-gen]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      flashcardsView.generateModal = {
        scope: 'chapter',
        chapterId: event.currentTarget.dataset.fcGen,
        count: 'auto',
        customPrompt: '',
        busy: false,
        error: null
      }
      render()
    })
  })
  document.querySelectorAll('[data-fc-gen-count]').forEach((input) => {
    input.addEventListener('change', (event) => {
      if (!flashcardsView.generateModal) return
      const raw = event.currentTarget.dataset.fcGenCount
      flashcardsView.generateModal.count = raw === 'auto' ? 'auto' : (parseInt(raw, 10) || 10)
      render()
    })
  })
  document.querySelectorAll('[data-fc-gen-prompt]').forEach((ta) => {
    ta.addEventListener('input', (event) => {
      if (!flashcardsView.generateModal) return
      flashcardsView.generateModal.customPrompt = event.currentTarget.value
    })
  })
  document.querySelectorAll('[data-fc-gen-submit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = flashcardsView.generateModal
      if (!m) return
      const courseId = flashcardsView.courseId
      const course = state.courses.find((c) => c.id === courseId)
      // Guard against double-start of the same scope
      if (m.scope === 'all' && hasRunningBgJob((j) => j.kind === 'fc-gen-all' && j.courseId === courseId)) {
        m.error = 'A "Generate all chapters" run is already in progress for this course.'
        render()
        return
      }
      if (m.scope === 'chapter' && hasRunningBgJob((j) => j.kind === 'fc-gen-chapter' && j.courseId === courseId && j.chapterId === m.chapterId)) {
        m.error = 'A generation for this chapter is already running.'
        render()
        return
      }
      if (m.scope === 'all') {
        const chapterCount = course?.chapters?.length || 0
        const jobId = startBgJob({
          kind: 'fc-gen-all',
          label: `Generating flashcards across ${chapterCount} chapter${chapterCount === 1 ? '' : 's'}…`,
          courseId
        })
        flashcardsView.generateModal = null
        render()
        generateAllAiFlashcards(courseId, m.count, m.customPrompt)
          .then((results) => {
            const total = results.reduce((a, r) => a + (r.count || 0), 0)
            const failures = results.filter((r) => r.error).length
            completeBgJob(jobId, {
              summary: failures
                ? `Generated ${total} cards · ${failures} chapter${failures === 1 ? '' : 's'} failed`
                : `Generated ${total} cards across ${results.length} chapter${results.length === 1 ? '' : 's'}`
            })
          })
          .catch((err) => completeBgJob(jobId, { error: err.message }))
      } else {
        const chapter = course?.chapters?.find((c) => c.id === m.chapterId)
        const chapterLabel = chapter ? `Ch ${chapter.id} — ${chapter.name}` : `Ch ${m.chapterId}`
        const jobId = startBgJob({
          kind: 'fc-gen-chapter',
          label: `Generating flashcards for ${chapterLabel}…`,
          courseId,
          chapterId: m.chapterId
        })
        flashcardsView.generateModal = null
        flashcardsView.expanded[m.chapterId] = true
        render()
        generateAiFlashcards(courseId, m.chapterId, m.count, m.customPrompt)
          .then((cards) => completeBgJob(jobId, { summary: `Generated ${cards.length} card${cards.length === 1 ? '' : 's'} for ${chapterLabel}` }))
          .catch((err) => completeBgJob(jobId, { error: err.message }))
      }
    })
  })
  document.querySelectorAll('[data-fc-gen-cancel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      flashcardsView.generateModal = null
      render()
    })
  })
  document.querySelectorAll('[data-fc-gen-overlay]').forEach((bg) => {
    bg.addEventListener('mousedown', (event) => {
      if (event.target === event.currentTarget && !flashcardsView.generateModal?.busy) {
        flashcardsView.generateModal = null
        render()
      }
    })
  })
  function startPracticeRun(scope, chapterId = null) {
    const cache = flashcardsCache.get(flashcardsView.courseId)
    const byChapter = cache?.byChapter || {}
    const pool = scope === 'all'
      ? Object.values(byChapter).flat()
      : (byChapter[chapterId] || [])
    if (!pool.length) return
    const due = pool.filter(flashcardIsDue)
    const source = due.length ? due : pool.slice()
    // Shuffle for variety
    const queue = source.map((c) => ({ cardId: c.id, chapterId: c.chapterId }))
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[queue[i], queue[j]] = [queue[j], queue[i]]
    }
    flashcardsView.studyModal = { scope, chapterId, queue, index: 0, showBack: false, answers: {}, grades: {}, gradingCardId: null }
    render()
  }
  document.querySelectorAll('[data-fc-practice]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      startPracticeRun('chapter', event.currentTarget.dataset.fcPractice)
    })
  })
  document.querySelectorAll('[data-fc-practice-all]').forEach((btn) => {
    btn.addEventListener('click', () => startPracticeRun('all'))
  })
  document.querySelectorAll('[data-fc-gen-all]').forEach((btn) => {
    btn.addEventListener('click', () => {
      flashcardsView.generateModal = {
        scope: 'all',
        chapterId: null,
        count: 'auto',
        customPrompt: '',
        busy: false,
        error: null
      }
      render()
    })
  })
  document.querySelectorAll('[data-fc-study-show]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!flashcardsView.studyModal) return
      flashcardsView.studyModal.showBack = !flashcardsView.studyModal.showBack
      render()
    })
  })
  document.querySelectorAll('[data-fc-recall-input]').forEach((ta) => {
    ta.addEventListener('input', (event) => {
      const s = flashcardsView.studyModal
      if (!s) return
      s.answers = s.answers || {}
      s.answers[event.currentTarget.dataset.fcRecallInput] = event.currentTarget.value
      autosizeTextarea(event.currentTarget)
      const btn = document.querySelector(`[data-fc-recall-grade="${CSS.escape(event.currentTarget.dataset.fcRecallInput)}"]`)
      if (btn) btn.disabled = !event.currentTarget.value.trim()
    })
  })
  document.querySelectorAll('[data-fc-recall-grade]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      const s = flashcardsView.studyModal
      if (!s) return
      const cardId = event.currentTarget.dataset.fcRecallGrade
      const entry = s.queue[s.index]
      const attempt = (s.answers?.[cardId] || '').trim()
      if (!entry || !attempt) return
      s.gradingCardId = cardId
      s.grades = s.grades || {}
      render()
      try {
        const result = await gradeFlashcardRecall(flashcardsView.courseId, entry.chapterId, cardId, attempt)
        s.grades[cardId] = { ...result, at: new Date().toISOString() }
        s.showBack = true
      } catch (err) {
        s.grades[cardId] = { error: err.message }
      } finally {
        s.gradingCardId = null
        render()
      }
    })
  })
  document.querySelectorAll('[data-fc-rate]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      const s = flashcardsView.studyModal
      if (!s) return
      const quality = parseInt(event.currentTarget.dataset.fcRate, 10)
      const entry = s.queue[s.index]
      if (entry) {
        try { await reviewFlashcard(flashcardsView.courseId, entry.chapterId, entry.cardId, quality) } catch {}
      }
      s.index += 1
      s.showBack = false
      s.gradingCardId = null
      // Refresh cache so subsequent renders show updated SR state
      await ensureFlashcards(flashcardsView.courseId)
    })
  })
  document.querySelectorAll('[data-fc-study-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      flashcardsView.studyModal = null
      render()
    })
  })
  document.querySelectorAll('[data-bg-dismiss]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      dismissBgJob(event.currentTarget.dataset.bgDismiss)
    })
  })

  // Paper-selector chips inside the Mock Exams / Tutorials surface.
  // Writes to the active list's id slot via setActivePaperId so each tab
  // remembers its own selection independently.
  document.querySelectorAll('[data-exam-pick]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const id = event.currentTarget.dataset.examPick
      if (getActivePaperId() === id) return
      setActivePaperId(id)
      practiceExamView.currentQid = null
      _suppressNextScrollRestore = true
      render()
    })
  })

  // Sub-tabs inside an exam (PDF / Solutions / Practice)
  document.querySelectorAll('[data-exam-subtab]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      if (event.currentTarget.disabled) return
      practiceExamView.examSubtab = event.currentTarget.dataset.examSubtab
      _suppressNextScrollRestore = true
      render()
    })
  })

  document.querySelectorAll('[data-practice-nav]').forEach((ctrl) => {
    const handler = (event) => {
      const examId = getActivePaperId()
      const cache = practiceExamCache.get(practiceExamCacheKey(route.courseId, examId))
      if (!cache?.questions) return
      const groups = groupQuestions(cache.questions)
      const currentGroupIdx = groups.findIndex((g) => g.parts.some((p) => practiceCanonicalKey(p.id || p.label) === practiceCanonicalKey(practiceExamView.currentQid)))
      const action = event.currentTarget.dataset.practiceNav
      let nextGroupIdx = currentGroupIdx
      if (action === 'prev' && currentGroupIdx > 0) nextGroupIdx = currentGroupIdx - 1
      else if (action === 'next' && currentGroupIdx < groups.length - 1) nextGroupIdx = currentGroupIdx + 1
      else if (action === 'jump') {
        practiceExamView.currentQid = event.currentTarget.value
        persistPracticeAttempts(route.courseId, examId)
        const scroller = getStudyScroller()
        if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' })
        render()
        return
      } else return
      practiceExamView.currentQid = groups[nextGroupIdx].parts[0].id
      persistPracticeAttempts(route.courseId, examId)
      const scroller = getStudyScroller()
      if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' })
      render()
    }
    const evt = ctrl.tagName === 'SELECT' ? 'change' : 'click'
    ctrl.addEventListener(evt, handler)
  })

  document.querySelectorAll('[data-practice-attempt]').forEach((el) => {
    const handler = (event) => {
      autosizeTextarea(event.currentTarget)
      const qid = event.currentTarget.dataset.practiceAttempt
      if (event.currentTarget.type === 'checkbox') {
        const checked = Array.from(document.querySelectorAll(`[data-practice-attempt="${CSS.escape(qid)}"][type="checkbox"]:checked`))
          .map((x) => x.value)
        practiceExamView.attempts[qid] = checked.join('\n')
      } else {
        practiceExamView.attempts[qid] = event.currentTarget.value
      }
      persistPracticeAttempts(route.courseId, getActivePaperId())
    }
    // textareas fire 'input'; radios fire 'change' — register both so all input types work.
    el.addEventListener('input', handler)
    el.addEventListener('change', handler)
  })

  // Progress heatmap cells — jump to the group that contains the clicked leaf
  document.querySelectorAll('[data-practice-jump-qid]').forEach((cell) => {
    cell.addEventListener('click', (event) => {
      const qid = event.currentTarget.dataset.practiceJumpQid
      practiceExamView.currentQid = qid
      persistPracticeAttempts(route.courseId, getActivePaperId())
      render()
      // Scroll to the specific part within the group
      setTimeout(() => {
        const target = document.getElementById(`part-${qid}`)
        if (target) scrollWithin(getStudyScroller(), target)
      }, 50)
    })
  })

  document.querySelectorAll('[data-toggle-guidance]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const qid = event.currentTarget.dataset.toggleGuidance
      practiceExamView.showGuidance[qid] = !practiceExamView.showGuidance[qid]
      if (practiceExamView.showGuidance[qid] && !practiceExamView.guidance[qid]) {
        requestGuidance(route.courseId, getActivePaperId(), qid)
      } else {
        render()
      }
    })
  })

  document.querySelectorAll('[data-toggle-answer]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const qid = event.currentTarget.dataset.toggleAnswer
      practiceExamView.showAnswer[qid] = !practiceExamView.showAnswer[qid]
      render()
    })
  })

  document.querySelectorAll('[data-practice-grade]').forEach((btn) => {
    btn.addEventListener('click', (event) => gradePracticeQuestion(route.courseId, getActivePaperId(), event.currentTarget.dataset.practiceGrade))
  })

  document.querySelectorAll('[data-practice-retry]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const examId = getActivePaperId()
      practiceExamCache.delete(practiceExamCacheKey(route.courseId, examId))
      ensurePracticeExam(route.courseId, examId)
    })
  })

  document.querySelectorAll('[data-practice-reparse]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Re-parse this exam? This resets the parsed exam, guidance, answers, images, and scores for this practice exam.')) return
      const examId = getActivePaperId()
      const examIdEnc = encodeURIComponent(examId || 'default')
      await fetch(`/api/practice-exam/${encodeURIComponent(route.courseId)}/${examIdEnc}`, { method: 'DELETE' })
      practiceExamCache.delete(practiceExamCacheKey(route.courseId, examId))
      resetPracticeExamState(route.courseId, examId)
      ensurePracticeExam(route.courseId, examId)
    })
  })

  document.querySelectorAll('[data-pdf-page]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault()
      const page = Number(event.currentTarget.dataset.pdfPage)
      const courseId = event.currentTarget.dataset.pdfCourse
      jumpToPdfPage(courseId, page)
    })
  })

  document.querySelectorAll('[data-reveal]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const key = event.currentTarget.dataset.reveal
      const att = attemptState.get(key) || {}
      att.showAnswer = !att.showAnswer
      attemptState.set(key, att)
      render()
    })
  })

  document.querySelectorAll('[data-sr-add]').forEach((btn) => {
    btn.addEventListener('click', (event) => addToSr(event.currentTarget.dataset.srAdd))
  })

  document.querySelectorAll('[data-resolve-mistake]').forEach((btn) => {
    btn.addEventListener('click', (event) => resolveMistake(event.currentTarget.dataset.resolveMistake))
  })
  document.querySelectorAll('[data-delete-mistake]').forEach((btn) => {
    btn.addEventListener('click', (event) => deleteMistake(event.currentTarget.dataset.deleteMistake))
  })

  document.querySelectorAll('[data-sr-reveal]').forEach((btn) => {
    btn.addEventListener('click', () => { srSession.reveal = true; render() })
  })
  document.querySelectorAll('[data-sr-skip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (srSession.current) srSession.queue.push(srSession.current)
      srSession.current = srSession.queue.shift() || null
      srSession.reveal = false
      render()
    })
  })
  document.querySelectorAll('[data-sr-rate]').forEach((btn) => {
    btn.addEventListener('click', (event) => rateSr(Number(event.currentTarget.dataset.srRate)))
  })
  document.querySelectorAll('[data-sr-remove]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      const questionId = event.currentTarget.dataset.srRemove
      const okRemove = await showConfirm({
        title: 'Remove from flashcards?',
        message: 'This removes the card from your spaced-repetition deck. The source question stays intact — you can re-add it later from the chapter\'s questions panel.',
        okLabel: 'Remove card',
        cancelLabel: 'Keep it',
        danger: true,
      })
      if (!okRemove) return
      try {
        await fetchJson('/api/sr/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId })
        })
        srMembership.delete(questionId)
        // Advance to next card; refresh deck stats
        srSession.current = srSession.queue.shift() || null
        srSession.reveal = false
        await refreshSr()
      } catch (e) {
        console.error('SR remove failed', e)
        alert('Failed to remove card: ' + e.message)
      }
    })
  })

  document.querySelectorAll('[data-extend-open]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      extendModal.open = event.currentTarget.dataset.extendOpen
      extendModal.error = null
      render()
    })
  })
  document.querySelectorAll('[data-extend-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      extendModal.open = null
      extendModal.error = null
      render()
    })
  })
  document.querySelectorAll('[data-extend-overlay]').forEach((overlay) => {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay && !extendModal.generating) {
        extendModal.open = null
        extendModal.error = null
        render()
      }
    })
  })
  document.querySelectorAll('[data-extend-type]').forEach((box) => {
    box.addEventListener('change', (event) => {
      const t = event.currentTarget.dataset.extendType
      if (event.currentTarget.checked) {
        if (!extendModal.types.includes(t)) extendModal.types.push(t)
      } else {
        extendModal.types = extendModal.types.filter((x) => x !== t)
      }
    })
  })
  document.querySelectorAll('[data-extend-count]').forEach((radio) => {
    radio.addEventListener('change', (event) => {
      extendModal.count = Number(event.currentTarget.dataset.extendCount)
      const btn = document.querySelector('[data-extend-submit]')
      if (btn) btn.textContent = `Request ${extendModal.count}`
    })
  })
  document.querySelectorAll('[data-extend-prompt]').forEach((ta) => {
    ta.addEventListener('input', (event) => {
      extendModal.customPrompt = event.currentTarget.value
    })
  })
  document.querySelectorAll('[data-extend-submit]').forEach((btn) => {
    btn.addEventListener('click', submitExtend)
  })

  document.querySelectorAll('[data-bulk-sr]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      const [cid, chid] = event.currentTarget.dataset.bulkSr.split('/')
      const cstate = questionsCache.get(`${cid}/${chid}`)
      if (!cstate?.questions?.length) { alert('Load practice questions first.'); return }
      const data = await fetchJson('/api/sr/bulk-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIds: cstate.questions.map((q) => q.id) })
      })
      srDueCache = null
      alert(`Added ${data.added} new card${data.added === 1 ? '' : 's'} to the flashcard deck (${data.total} total).`)
    })
  })

  document.querySelectorAll('[data-start-mock]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const [cid, chid] = event.currentTarget.dataset.startMock.split('/')
      const n = parseInt(window.prompt('How many questions? (default 5)', '5'), 10) || 5
      const minutes = parseInt(window.prompt('Time limit in minutes? (default 15)', '15'), 10) || 15
      startMiniMock(cid, chid, { n, minutes })
    })
  })

  document.querySelectorAll('[data-mock-answer]').forEach((el) => {
    const handler = (event) => {
      autosizeTextarea(event.currentTarget)
      if (!mockSession.active) return
      const qid = event.currentTarget.dataset.mockAnswer
      mockSession.active.answers[qid] = event.currentTarget.value
    }
    el.addEventListener('input', handler)
    el.addEventListener('change', handler)
  })

  document.querySelectorAll('[data-mock-nav]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      if (!mockSession.active) return
      const dir = event.currentTarget.dataset.mockNav
      if (dir === 'next' && mockSession.active.currentIndex < mockSession.active.questions.length - 1) mockSession.active.currentIndex++
      if (dir === 'prev' && mockSession.active.currentIndex > 0) mockSession.active.currentIndex--
      render()
    })
  })

  document.querySelectorAll('[data-mock-submit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (mockSession.active && confirm('Submit your mock for grading?')) submitMiniMock()
    })
  })
  document.querySelectorAll('[data-mock-cancel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (confirm('Abandon this mock? Answers will be lost.')) cancelMiniMock()
    })
  })
  document.querySelectorAll('[data-mock-close]').forEach((btn) => {
    btn.addEventListener('click', () => { mockSession.active = null; render() })
  })

  // Mini-mock: image attachment per question
  document.querySelectorAll('[data-mock-drop]').forEach((zone) => {
    const qid = zone.dataset.mockDrop
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drop-hover') })
    zone.addEventListener('dragleave', () => { zone.classList.remove('drop-hover') })
    zone.addEventListener('drop', async (e) => {
      e.preventDefault()
      zone.classList.remove('drop-hover')
      if (!mockSession.active) return
      const urls = await pickedImages([...(e.dataTransfer?.files || [])])
      if (!urls.length) return
      mockSession.active.attemptImages = mockSession.active.attemptImages || {}
      mockSession.active.attemptImages[qid] = [...(mockSession.active.attemptImages[qid] || []), ...urls]
      render()
    })
    zone.addEventListener('paste', async (e) => {
      if (!mockSession.active) return
      const urls = await pickedImages([...(e.clipboardData?.files || [])])
      if (!urls.length) return
      e.preventDefault()
      mockSession.active.attemptImages = mockSession.active.attemptImages || {}
      mockSession.active.attemptImages[qid] = [...(mockSession.active.attemptImages[qid] || []), ...urls]
      render()
    })
  })
  document.querySelectorAll('[data-mock-file]').forEach((input) => {
    input.addEventListener('change', async (event) => {
      if (!mockSession.active) return
      const qid = event.currentTarget.dataset.mockFile
      const urls = await pickedImages([...(event.currentTarget.files || [])])
      if (!urls.length) return
      mockSession.active.attemptImages = mockSession.active.attemptImages || {}
      mockSession.active.attemptImages[qid] = [...(mockSession.active.attemptImages[qid] || []), ...urls]
      render()
    })
  })
  document.querySelectorAll('[data-mock-remove-image]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      if (!mockSession.active) return
      const qid = event.currentTarget.dataset.mockRemoveImage
      const wrapper = event.currentTarget.closest('.attempt-thumb')
      const all = [...event.currentTarget.closest('.attempt-thumbs').querySelectorAll('.attempt-thumb')]
      const idx = all.indexOf(wrapper)
      mockSession.active.attemptImages = mockSession.active.attemptImages || {}
      mockSession.active.attemptImages[qid] = (mockSession.active.attemptImages[qid] || []).filter((_, i) => i !== idx)
      render()
    })
  })
}

function rerenderItemList() {
  const course = state.courses.find((c) => c.id === route.id)
  if (!course) return render()
  const detail = document.querySelector('.course-detail')
  if (!detail) return render()
  detail.innerHTML = renderFilteredItems(course)
  bindEvents()
}
