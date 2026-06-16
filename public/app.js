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

let state = null
let route = parseRoute()
let chapterCache = new Map()
let questionsCache = new Map()
let questionsSummaryCache = new Map()
let courseTocCache = new Map()
const attemptState = new Map()

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
  return `<button type="button" class="btn btn-ghost" data-sr-add="${questionId}">＋ Add to flashcards</button>`
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
    <button type="button" class="sidebar-search-trigger" data-search-open title="Search course (⌘⇧F)">
      <span class="nav-icon search-icon" aria-hidden="true">🔎</span>
      <span class="nav-label sidebar-search-label">Search<small>⌘⇧F</small></span>
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
      <div class="search-popup" role="dialog" aria-label="Course search">
        <div class="search-popup-bar">
          <span class="search-popup-icon" aria-hidden="true">🔎</span>
          <input
            type="search"
            class="search-popup-input"
            placeholder="${course ? `Search ${escapeHtml(course.code)} — ${escapeHtml(course.name)}…` : 'Search course…'}"
            value="${escapeHtml(searchState.query)}"
            data-search-input="${cid || ''}"
            autocomplete="off"
            spellcheck="false"
          />
          ${searchState.query ? '<button type="button" class="search-popup-clear" data-search-clear title="Clear">×</button>' : ''}
          <button type="button" class="search-popup-close" data-search-close title="Close (Esc)">×</button>
        </div>
        ${state?.courses?.length > 1 ? `
          <div class="search-popup-courses" role="tablist">
            ${state.courses.map((c) => `
              <button type="button" class="search-popup-course-pill ${c.id === cid ? 'is-active' : ''}" data-search-course="${c.id}" style="--accent:${c.accent}">
                <span class="dot" style="background:${c.accent}"></span>
                ${escapeHtml(c.code)}${c.shortName ? ` <em>${escapeHtml(c.shortName)}</em>` : ''}
              </button>
            `).join('')}
          </div>
        ` : ''}
        <div class="search-popup-results" role="listbox">
          ${searchState.loading ? '<div class="search-popup-status">Searching…</div>' : ''}
          ${searchState.error ? `<div class="search-popup-status error">${escapeHtml(searchState.error)}</div>` : ''}
          ${!searchState.loading && !searchState.error && searchState.query.trim().length < 2 ? `<div class="search-popup-status empty">Type at least 2 characters.</div>` : ''}
          ${!searchState.loading && !searchState.error && searchState.query.trim().length >= 2 && searchState.results.length === 0 ? `<div class="search-popup-status empty">No matches for “${escapeHtml(searchState.query)}”.</div>` : ''}
          ${searchState.results.map((r, i) => `
            <button type="button" class="search-popup-result ${i === searchState.selectedIdx ? 'is-selected' : ''}" data-search-result="${i}" role="option">
              <span class="search-popup-result-head">
                <strong>Ch ${escapeHtml(r.chapterId)}</strong> — ${escapeHtml(r.chapterName)}
                ${r.headingText && r.headingText !== r.chapterName ? `<span class="search-popup-result-heading"> › ${escapeHtml(r.headingText)}</span>` : ''}
              </span>
              <span class="search-popup-result-snippet">${escapeHtml(r.snippet)}</span>
            </button>
          `).join('')}
        </div>
        <div class="search-popup-foot">
          <span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span>
          <span><kbd>⏎</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
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
        <span class="course-chapters-caret">${collapsed ? '▸' : '▾'}</span>
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
        <span class="multi-dd-arrow">▾</span>
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
          <button type="button" class="attempt-thumb-remove" data-${removeAttr}="${i}" title="Remove">×</button>
        </div>
      `).join('')}
    </div>
  `
}
const chatState = new Map() // key: courseId/chapterId -> { messages: [{role, content}], sending: bool, draft: string }
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

// ----- Layout state (resizable columns, sidebar collapse) -----
const DEFAULT_WIDTHS = { sidebar: 290, toc: 300, rail: 380 }
const MIN_WIDTHS = { sidebar: 220, toc: 220, rail: 280 }
const MAX_WIDTHS = { sidebar: 480, toc: 560, rail: 620 }
const COLLAPSED_SIDEBAR = 64
const COLLAPSED_TOC = 36
const COLLAPSED_RAIL = 36

let layoutState = {
  sidebarCollapsed: false,
  tocCollapsed: false,
  railCollapsed: false,
  widths: { ...DEFAULT_WIDTHS }
}
try {
  const saved = JSON.parse(localStorage.getItem('layout-state') || '{}')
  if (saved.sidebarCollapsed) layoutState.sidebarCollapsed = true
  if (saved.tocCollapsed) layoutState.tocCollapsed = true
  if (saved.railCollapsed) layoutState.railCollapsed = true
  if (saved.widths) layoutState.widths = { ...DEFAULT_WIDTHS, ...saved.widths }
} catch {}

function applyLayoutWidths() {
  const root = document.documentElement
  root.style.setProperty('--sidebar-width', layoutState.sidebarCollapsed ? `${COLLAPSED_SIDEBAR}px` : `${layoutState.widths.sidebar}px`)
  root.style.setProperty('--toc-width', layoutState.tocCollapsed ? `${COLLAPSED_TOC}px` : `${layoutState.widths.toc}px`)
  root.style.setProperty('--rail-width', layoutState.railCollapsed ? `${COLLAPSED_RAIL}px` : `${layoutState.widths.rail}px`)
  root.dataset.sidebarCollapsed = layoutState.sidebarCollapsed ? 'true' : 'false'
  root.dataset.tocCollapsed = layoutState.tocCollapsed ? 'true' : 'false'
  root.dataset.railCollapsed = layoutState.railCollapsed ? 'true' : 'false'
}

function saveLayout() {
  try { localStorage.setItem('layout-state', JSON.stringify(layoutState)) } catch {}
}

function toggleSidebar() {
  layoutState.sidebarCollapsed = !layoutState.sidebarCollapsed
  applyLayoutWidths()
  saveLayout()
  render()
}

function toggleToc() {
  layoutState.tocCollapsed = !layoutState.tocCollapsed
  applyLayoutWidths()
  saveLayout()
  render()
}

function toggleRail() {
  layoutState.railCollapsed = !layoutState.railCollapsed
  applyLayoutWidths()
  saveLayout()
  render()
}

function attachResizeHandlers() {
  document.querySelectorAll('[data-resize]').forEach((handle) => {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      handle.setPointerCapture?.(e.pointerId)
      const target = handle.dataset.resize
      const startX = e.clientX
      const startWidth = layoutState.widths[target] || DEFAULT_WIDTHS[target]
      // If sidebar is collapsed, dragging should also expand it
      if (target === 'sidebar' && layoutState.sidebarCollapsed) {
        layoutState.sidebarCollapsed = false
      }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      const onMove = (ev) => {
        const delta = ev.clientX - startX
        let next = target === 'rail' ? startWidth - delta : startWidth + delta
        next = Math.max(MIN_WIDTHS[target], Math.min(MAX_WIDTHS[target], next))
        layoutState.widths[target] = Math.round(next)
        applyLayoutWidths()
      }
      const onUp = () => {
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        saveLayout()
      }
      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
    })
    handle.addEventListener('dblclick', (e) => {
      const target = e.currentTarget.dataset.resize
      layoutState.widths[target] = DEFAULT_WIDTHS[target]
      if (target === 'sidebar') layoutState.sidebarCollapsed = false
      applyLayoutWidths()
      saveLayout()
    })
  })
}
const filterState = { category: 'all', mastery: 'all', sort: 'priority', search: '' }
// questionFilter: checkbox-style multi-select.
// types: array of question type ids selected ('written','calc','tf','mc','pseudocode'). Empty = show ALL.
// sources: array of source ids selected ('kb','gen'). Empty = show ALL.
// openDd: which dropdown is currently expanded ('types' | 'sources' | null).
const questionFilter = { types: [], sources: [], openDd: null }

window.addEventListener('hashchange', () => {
  route = parseRoute()
  render()
})

init()

async function init() {
  state = await fetchJson('/api/state')
  applyLayoutWidths()
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

async function fetchJson(url, options) {
  const response = await fetch(url, options)
  if (!response.ok) {
    let msg = await response.text()
    try { msg = JSON.parse(msg).error || msg } catch {}
    throw new Error(msg)
  }
  return response.json()
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
  if (parts[0] === 'mistakes') return { page: 'mistakes' }
  if (parts[0] === 'sr') return { page: 'sr' }
  if (parts[0] === 'mocks') return { page: 'mocks', sessionId: parts[1] ? decodeURIComponent(parts[1]) : null }
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
  course:           (o) => `Reset every trace of progress on ${o.courseName || 'this course'}.\n\n• Chapter read flags (every chapter)\n• Self-test attempts, grades, and revealed answers (every chapter)\n• Mock-question attempts and grades (entire course-wide bank)\n• Practice-exam attempts, grades, guidance, and uploaded images (every mock exam)\n• Flashcards' spaced-repetition state (every card resets to fresh)\n• Per-chapter mistake bank entries\n• Mini-mock session history\n\nThis is IRREVERSIBLE.`,
  chapter:          (o) => `Reset every trace of progress on Ch ${o.chapterId} of ${o.courseName || 'this course'}.\n\n• Chapter read flag\n• Self-test attempts + grades for this chapter\n• Mock-question attempts + grades for this chapter\n• Flashcards' spaced-repetition state for cards in this chapter\n• This chapter's mistake bank entries\n\nThis is IRREVERSIBLE.`,
  'self-test':      (o) => `Clear all self-test attempts, grades, and revealed answers for Ch ${o.chapterId}.\n\nReading status, mock questions, and flashcards are kept.\n\nThis is IRREVERSIBLE.`,
  'esq':            (o) => `Clear all exam-style-question attempts and grades for Ch ${o.chapterId}.\n\nThe questions themselves stay; only your answers, grades, and revealed-answer toggles are cleared.\n\nThis is IRREVERSIBLE.`,
  'mock-questions': (o) => `Clear all course-wide mock-question attempts and grades for ${o.courseName || 'this course'}.\n\nThe question bank itself stays; only your answers, grades, and revealed answers are cleared.\n\nThis is IRREVERSIBLE.`,
  exam:             (o) => `Clear all attempts, grades, guidance hints, and uploaded images for ${o.examLabel || 'this practice exam'}.\n\nThe parsed paper itself stays.\n\nThis is IRREVERSIBLE.`,
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
  const suffix = ' · Exam Study Platform'
  if (!state) return 'Exam Study Platform'
  if (route.page === 'dashboard') return 'Dashboard' + suffix
  if (route.page === 'mistakes') return 'Mistake bank' + suffix
  if (route.page === 'sr') return 'Flashcards' + suffix
  if (route.page === 'mocks') return (route.sessionId ? 'Mock session' : 'Mock sessions') + suffix
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
  return 'Exam Study Platform'
}

let _suppressNextScrollRestore = false

function captureScrollState() {
  const snap = {}
  document.querySelectorAll('.chapter-main, .chapter-toc .rail-collapsible, .chapter-rail .rail-collapsible, .chat-messages').forEach((el) => {
    let sel = el.className.split(' ').filter(Boolean).map((c) => '.' + c).join('')
    if (el.closest('.chapter-toc')) sel = '.chapter-toc .rail-collapsible'
    else if (el.closest('.chapter-rail')) sel = '.chapter-rail .rail-collapsible'
    snap[sel] = el.scrollTop
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

function render() {
  if (!state) return
  document.title = computeTitle()
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
    <div class="shell ${isChapter || isMock || isCourse ? 'chapter-shell' : ''}">
      ${renderSidebar()}
      <div class="resize-handle vertical-handle" data-resize="sidebar" title="Drag to resize · double-click to reset"></div>
      <main class="content ${isChapter || isMock || isCourse ? 'chapter-content' : ''}">
        ${routeView()}
      </main>
    </div>
    ${renderMiniMockOverlay()}
    ${renderExtendModal()}
    ${renderRegenModal()}
    ${renderConfirmModal()}
    ${renderSearchPopup()}
    ${renderFlashcardGenerateModal()}
    ${renderFlashcardStudyModal()}
    ${renderBgJobsBanner()}
  `
  bindEvents()
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
      if (target) scrollWithin(document.querySelector('.chapter-main') || document.querySelector('.content'), target)
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
          scrollWithin(document.querySelector('.chapter-main'), target)
          target.classList.add('search-flash')
          setTimeout(() => target.classList.remove('search-flash'), 1800)
        }
      }, 220) // give markdown a moment to mount + assignHeadingIds to run
    }
  }
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
  if (route.page === 'mistakes') return renderMistakesPage()
  if (route.page === 'sr') return renderSrPage()
  if (route.page === 'mocks') return renderMocksPage()
  if (route.page === 'course') return renderCourse(route.id)
  return renderDashboard()
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

function renderSidebar() {
  const navCourse = (course) => {
    const progress = courseProgress(course)
    const active = (route.page === 'course' && route.id === course.id) || (route.page === 'chapter' && route.courseId === course.id)
    return `
      <a class="nav-course ${active ? 'active' : ''}" href="#/course/${course.id}" title="${course.code} ${course.shortName || ''}">
        <span class="nav-icon course-icon" style="color:${course.accent}">${ICONS[courseIconKey(course)]}</span>
        <span class="nav-text nav-label">
          <strong>${course.code} <em>${course.shortName || ''}</em></strong>
          <small>${progress.done}/${progress.total} done · ${progress.masteryPct}% mastery</small>
        </span>
      </a>
    `
  }
  const courseLinks = activeCourses().map(navCourse).join('')
  const archived = archivedCourses()
  const archivedBlock = archived.length ? `
    <button type="button" class="nav-archived-toggle" data-sidebar-archived-toggle>
      <span class="nav-icon"></span>
      <span class="nav-label">${sidebarArchivedOpen ? '▾' : '▸'} Archived (${archived.length})</span>
    </button>
    ${sidebarArchivedOpen ? `<div class="nav-archived-list">${archived.map(navCourse).join('')}</div>` : ''}
  ` : ''

  return `
    <aside class="sidebar">
      <div class="sidebar-head">
        <a class="brand" href="#/">
          <span class="brand-mark">EX</span>
          <span class="brand-text"><strong>Exam Platform</strong><small>May 2026 pass path</small></span>
        </a>
        <button class="sidebar-toggle" type="button" data-sidebar-toggle title="${layoutState.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}">${layoutState.sidebarCollapsed ? '›' : '‹'}</button>
      </div>
      <nav>
        ${renderSearchTrigger()}
        <a class="nav-dashboard ${route.page === 'dashboard' ? 'active' : ''}" href="#/" title="Dashboard"><span class="nav-icon tool-icon">${ICONS.dashboard}</span><span class="nav-label">Dashboard</span></a>
        ${courseLinks}
        ${archivedBlock}
        <div class="nav-divider"><span class="nav-icon"></span><span class="nav-label">Practice</span></div>
        <a class="nav-tool ${route.page === 'mistakes' ? 'active' : ''}" href="#/mistakes" title="Mistake bank"><span class="nav-icon tool-icon mistakes-icon">${ICONS.mistakes}</span><span class="nav-label">Mistake bank</span></a>
        <a class="nav-tool ${route.page === 'mocks' ? 'active' : ''}" href="#/mocks" title="Mock sessions"><span class="nav-icon tool-icon mocks-icon">${ICONS.mocks}</span><span class="nav-label">Mock sessions</span></a>
      </nav>
      <section class="state-card">
        <small>JSON state</small>
        <code>exam-study-platform/data/study-state.json</code>
        <small class="legend">Mastery 0–4: 0 Untouched · 1 Seen · 2 Understood · 3 Fluent · 4 Exam-ready</small>
      </section>
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
        <a href="#/">Dashboard</a>
        ${state.courses.map((c) => `<a class="${c.id === route.courseId ? 'active' : ''}" href="#/course/${c.id}">${c.shortName || c.code}</a>`).join('')}
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

function renderDashboard() {
  const items = allItems()
  const progress = progressOf(items)
  // kick async refresh (cache holds results across renders)
  if (!mistakeCache) loadMistakes().then(() => render())
  if (!srDueCache) loadSrDue().then(() => render())
  ensureCoverage()
  // Hydrate master generate-all-courses job once on dashboard mount
  if (generateAllCoursesJob === null && !generateAllCoursesPolling) {
    fetch('/api/generate-all-courses').then((r) => r.ok ? r.json() : null).then((job) => {
      if (!job) { generateAllCoursesJob = undefined; return }
      generateAllCoursesJob = job
      if (job.status === 'running' || job.status === 'queued') refreshGenerateAllCourses()
      else render()
    }).catch(() => {})
  }
  const mistakeCount = mistakeCache?.items?.length ?? null
  const srDue = srDueCache?.dueCount ?? null
  const srTotal = srDueCache?.totalCards ?? null

  return `
    ${renderUpdateBanner()}
    <section class="hero">
      <div>
        <p class="eyebrow">Dashboard</p>
        <h1>Daily work, course readiness, exact checkoffs.</h1>
        <p class="hero-copy">Click any task to open it on its course page. Open a chapter from the knowledge map to study with TOC, action checklist, and graded practice questions.</p>
      </div>
      <div class="hero-meter">
        <span>${progress.masteryPct}%</span>
        <small>${progress.done}/${progress.total} items at mastery ≥ ${doneThreshold()} · avg ${progress.avg.toFixed(2)}/4</small>
      </div>
    </section>

    <section class="practice-strip">
      <a class="practice-card sr-card" href="#/sr">
        <p class="eyebrow">Spaced repetition</p>
        <strong>${srDue == null ? '—' : srDue}</strong>
        <small>${srDue == null ? 'Loading…' : `due ${srDue === 1 ? 'card' : 'cards'} · ${srTotal} total`}</small>
      </a>
      <a class="practice-card mistakes-card" href="#/mistakes">
        <p class="eyebrow">Mistake bank</p>
        <strong>${mistakeCount == null ? '—' : mistakeCount}</strong>
        <small>${mistakeCount == null ? 'Loading…' : `open ${mistakeCount === 1 ? 'mistake' : 'mistakes'} to review`}</small>
      </a>
      <a class="practice-card mocks-card" href="#/mocks">
        <p class="eyebrow">Mini-mocks</p>
        <strong>↗</strong>
        <small>Start a timed exam in any chapter, or revisit past sessions</small>
      </a>
    </section>

    <div class="course-section-head">
      <h2>Courses</h2>
      <button type="button" class="tb-btn ${dashboardManageMode ? 'tb-btn-primary' : ''}" data-toggle-manage>${dashboardManageMode ? '✓ Done' : '⚙ Manage courses'}</button>
    </div>
    <section class="course-grid">
      ${activeCourses().map((c, i, arr) => renderCourseCard(c, i, arr.length)).join('') || '<p class="empty">No active courses.</p>'}
    </section>
    ${archivedCourses().length ? `
      <div class="course-section-head archived-head">
        <h3>Archived <small>${archivedCourses().length}</small></h3>
      </div>
      <section class="course-grid course-grid-archived">
        ${archivedCourses().map((c) => renderCourseCard(c, -1, 0)).join('')}
      </section>
    ` : ''}

    ${renderGenerateAllCoursesCard()}
  `
}

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
      <a class="course-card ${isArchived ? 'is-archived' : ''}" href="#/course/${course.id}" style="--accent:${course.accent}">
        ${inner}
      </a>
    `
  }
  // Manage mode — card is not a link; show archive + reorder controls.
  return `
    <article class="course-card is-managing ${isArchived ? 'is-archived' : ''}" style="--accent:${course.accent}">
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

  return `
    <nav class="surface-tabs" role="tablist">
      <a class="${cls('overview')}" href="#/course/${course.id}">Overview</a>
      <span class="surface-tabs-divider" aria-hidden="true"></span>
      <button type="button" class="${cls('mock-questions')}" ${jumpAttr('mock-questions')}>Mock questions</button>
      <button type="button" class="${cls('flashcards')}" ${jumpAttr('flashcards')}>Flashcards</button>
      ${hasExams ? `<button type="button" class="${cls('exams')}" ${jumpAttr('exams')}>Mock Exams</button>` : ''}
      ${hasTutorials ? `<button type="button" class="${cls('tutorials')}" ${jumpAttr('tutorials')}>Tutorials</button>` : ''}
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
      <button type="button" role="tab" class="chapter-subtab${activeTab === 'content' ? ' active' : ''}" data-chapter-tab="content" data-tab-course="${course.id}" data-tab-chapter="${chapter.id}">Content</button>
      <button type="button" role="tab" class="chapter-subtab${activeTab === 'selftest' ? ' active' : ''}" data-chapter-tab="selftest" data-tab-course="${course.id}" data-tab-chapter="${chapter.id}">Self-Test</button>
      <button type="button" role="tab" class="chapter-subtab${activeTab === 'esq' ? ' active' : ''}" data-chapter-tab="esq" data-tab-course="${course.id}" data-tab-chapter="${chapter.id}">Exam Style Questions</button>
    </nav>
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
  // Hydrate any running generate-all job for this course on FIRST render only.
  // Once hydrated, the polling flag (or absence of one for a finished job) keeps
  // future renders from re-firing the fetch — otherwise a finished job triggers
  // render() → renders re-fire the fetch → response calls render() → infinite
  // loop that wedges the browser.
  {
    const entry = generateAllJobs.get(course.id)
    if (!entry?.hydrated && !entry?.polling) {
      const e = entry || {}
      e.hydrated = true
      generateAllJobs.set(course.id, e)
      fetch(`/api/courses/${encodeURIComponent(course.id)}/generate-all`).then((r) => r.ok ? r.json() : null).then((job) => {
        if (!job) return
        const e2 = generateAllJobs.get(course.id) || {}
        e2.job = job
        generateAllJobs.set(course.id, e2)
        if (job.status === 'running' || job.status === 'queued') refreshGenerateJob(course.id)
        else render()
      }).catch(() => {})
    }
  }
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
      <div class="chapter-grid course-home-grid" style="--accent:${course.accent}">
        ${renderCourseNavigator(course, matches, supportMatches, q)}
        <div class="resize-handle vertical-handle" data-resize="toc" title="Drag to resize · double-click to reset"></div>
        <article class="chapter-main course-home-main">
          <section class="course-hero surface-hero surface-hero-slim" style="--accent:${course.accent}">
            <div class="surface-hero-text">
              <p class="eyebrow">${course.code} ${course.shortName ? `· ${course.shortName}` : ''} · Overview</p>
              <h1>${course.name}</h1>
              <p>${course.exam} · ${course.role}</p>
              ${renderCoursePopulatedChip(course)}
              <div class="hero-actions-row">
                <button type="button" class="clear-link" data-clear-scope="course" data-clear-course="${course.id}" data-clear-course-name="${escapeHtml(course.name)}" title="Reset every trace of your progress on this course">Reset course progress</button>
              </div>
            </div>
            ${renderSurfaceTabs(course, { active: 'overview', surface: 'overview' })}
          </section>

          ${renderGenerateAllCard(course)}

          <section class="course-spine-section">
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
          <div class="panel-head"><div><p class="eyebrow">Core chapters</p><h2>Progress detail</h2></div><small>Read, practice, mock and flashcards — click ▸ to see topics.</small></div>
          ${visibleChapters.length
            ? visibleChapters.map((m) => renderChapterProgressRow(course, m.ch, m.topics)).join('')
            : '<p class="empty">No chapters or topics match this filter.</p>'}
        </section>
        </article>
      </div>
    ` : '<p class="empty">No chapters configured.</p>'}
  `
}

function renderCourseNavigator(course, matches, supportMatches, q) {
  const visible = matches.filter((m) => !q || m.chapter)
  const visibleSupport = supportMatches.filter((m) => !q || m.chapter)
  const total = matches.length
  return `
    <aside class="chapter-toc course-toc">
      <button class="rail-collapse-btn" type="button" data-toc-toggle title="${layoutState.tocCollapsed ? 'Expand TOC' : 'Collapse TOC'}">${layoutState.tocCollapsed ? '›' : '‹'}</button>
      <div class="rail-collapsible">
        <h4>Filter</h4>
        <div class="course-nav-search">
          <span class="course-nav-icon" aria-hidden="true">🔎</span>
          <input
            type="search"
            class="course-nav-input"
            placeholder="Chapters & topics…"
            value="${escapeHtml(q)}"
            data-course-filter="${course.id}"
            autocomplete="off"
            spellcheck="false"
          />
          ${q ? `<button type="button" class="course-nav-clear" data-course-filter-clear="${course.id}" title="Clear">×</button>` : ''}
        </div>

        <div class="course-nav-scroll">
        <div class="course-chapters-section">
          <div class="course-chapters-toggle as-heading">
            <span>Core chapters</span>
            <small>${q ? `${visible.length}/${total}` : total}</small>
          </div>
          <ol class="course-chapters-list course-nav-chapters">
            ${visible.map((m) => {
              const p = chapterProgress(course, m.ch)
              const topics = m.topics
              const expanded = !!q || chapterRowExpanded.get(`${course.id}/${m.ch.id}`)
              return `
                <li class="${p.read ? 'is-read' : ''}">
                  <div class="course-nav-chapter-row">
                    <button type="button" class="course-nav-chapter-btn" data-course-nav-topic-toggle="${course.id}/${m.ch.id}" aria-expanded="${expanded}">
                      <span class="course-chapter-num">${escapeHtml(m.ch.id)}</span>
                      <span class="course-chapter-name">${escapeHtml(m.ch.name)}</span>
                    </button>
                  </div>
                  ${topics.length && expanded ? `
                    <ul class="course-nav-topics">
                      ${topics.map((t) => `
                        <li class="course-nav-topic lvl-${t.level || 2}">
                          <a
                            class="course-nav-topic-link"
                            href="#/course/${course.id}/chapter/${m.ch.id}"
                            data-course-nav-heading="${course.id}/${m.ch.id}/${t.id}"
                            title="${escapeHtml(t.text)}"
                          >
                            <span>${escapeHtml(t.text)}</span>
                          </a>
                        </li>
                      `).join('')}
                    </ul>
                  ` : ''}
                </li>
              `
            }).join('')}
          </ol>
        </div>
        ${visibleSupport.length ? `
          <div class="course-chapters-section course-toolkit-nav">
            <div class="course-chapters-toggle as-heading">
              <span>Exam toolkit</span>
              <small>${visibleSupport.length}</small>
            </div>
            <ol class="course-chapters-list course-nav-chapters">
              ${visibleSupport.map((m) => `
                <li>
                  <div class="course-nav-chapter-row">
                    <a href="#/course/${course.id}/chapter/${m.ch.id}">
                      <span class="course-chapter-num">${escapeHtml(m.ch.id)}</span>
                      <span class="course-chapter-name">${escapeHtml(m.ch.name)}</span>
                    </a>
                  </div>
                </li>
              `).join('')}
            </ol>
          </div>
        ` : ''}
        </div>
      </div>
    </aside>
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
          <a class="spine-tile spine-${bucket}" href="#/course/${course.id}/chapter/${ch.id}" title="${escapeHtml(title)}">
            <button type="button" class="spine-tile-clear" data-clear-scope="chapter" data-clear-course="${course.id}" data-clear-chapter="${ch.id}" data-clear-course-name="${escapeHtml(course.name)}" title="Reset progress for Ch ${escapeHtml(ch.id)}">×</button>
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
        <small>Grouped here so the course spine stays honest.</small>
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
        <button type="button" class="ch-card-expand" data-chapter-row-toggle="${key}" aria-expanded="${expanded}" title="${expanded ? 'Hide topics' : 'Show topics'}">${expanded ? '▾' : '▸'}</button>
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
    loadChapter(course.id, chapter.id, route.relPath || '').then(() => render())
    return `<div class="chapter-loading">Loading chapter from knowledge base...</div>`
  }
  if (cached.error) {
    return `<div class="chapter-loading error">Could not load: ${escapeHtml(cached.error)}</div>`
  }

  const data = cached.data

  if (data.kind === 'directory') {
    return `
      <div class="chapter-listing-wrap">
        <header class="chapter-hero" style="--accent:${course.accent}">
          <h1>Ch ${chapter.id} · ${chapter.name}</h1>
          <p class="chapter-path"><code>${data.path}</code></p>
        </header>
        <div class="chapter-listing">
          <p>This chapter is a folder. Pick a file:</p>
          <ul class="chapter-files">
            ${data.files.map((f) => `<li><a href="#/course/${course.id}/chapter/${chapter.id}/${encodeURIComponent(f)}">${f}</a></li>`).join('')}
          </ul>
          ${data.subdirs.length ? `<h3>Subfolders</h3><ul class="chapter-files">${data.subdirs.map((d) => `<li><a href="#/course/${course.id}/chapter/${chapter.id}/${encodeURIComponent(d)}">${d}/</a></li>`).join('')}</ul>` : ''}
        </div>
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

  return `
    <div class="chapter-grid" style="--accent:${course.accent}">
      <aside class="chapter-toc">
        <button class="rail-collapse-btn" type="button" data-toc-toggle title="${layoutState.tocCollapsed ? 'Expand TOC' : 'Collapse TOC'}">${layoutState.tocCollapsed ? '›' : '‹'}</button>
        <div class="rail-collapsible">
          <button class="toc-back" type="button" data-back-to-course="${course.id}" title="Back to ${course.code} ${course.shortName || ''}">${ICONS.back}<span>${course.code} <em>${course.shortName || ''}</em></span></button>
          ${renderCourseChaptersSection(course, chapter.id)}
          ${tab === 'content' ? `
            <h4>On this page</h4>
            ${toc.length ? `<ol>${toc.map((t) => `<li class="lvl-${t.level}"><a href="javascript:void(0)" data-toc-target="${t.id}">${escapeHtml(t.text)}</a></li>`).join('')}</ol>` : '<p class="empty">No sections.</p>'}
            ${data.examples ? '<a class="toc-jump" href="javascript:void(0)" data-toc-target="chapter-examples">More worked examples</a>' : ''}
            <a class="toc-jump" href="javascript:void(0)" data-chapter-tab="selftest" data-tab-course="${course.id}" data-tab-chapter="${chapter.id}">Practice questions</a>
            <a class="toc-jump" href="javascript:void(0)" data-chapter-tab="esq" data-tab-course="${course.id}" data-tab-chapter="${chapter.id}">Exam style questions</a>
          ` : tab === 'esq' ? `
            <h4>Exam Style Questions</h4>
            <p class="rail-meta">Scoped to this chapter. Use the filter dropdowns above the question card to narrow further.</p>
            <a class="toc-jump" href="javascript:void(0)" data-chapter-tab="content" data-tab-course="${course.id}" data-tab-chapter="${chapter.id}">Back to content</a>
          ` : `
            <h4>Self-Test</h4>
            <a class="toc-jump" href="javascript:void(0)" data-chapter-tab="content" data-tab-course="${course.id}" data-tab-chapter="${chapter.id}">Back to content</a>
          `}
        </div>
      </aside>
      <div class="resize-handle vertical-handle" data-resize="toc" title="Drag to resize · double-click to reset"></div>

      <article class="chapter-main">
        <header class="chapter-hero surface-hero" style="--accent:${course.accent}">
          <div class="surface-hero-text">
            <p class="eyebrow">${course.code} ${course.shortName || ''} · Chapter</p>
            <h1>Ch ${chapter.id} · ${chapter.name}</h1>
            <p class="chapter-path"><code>${data.path}</code></p>
            <div class="hero-actions-row">
              <button type="button" class="clear-link" data-clear-scope="chapter" data-clear-course="${course.id}" data-clear-chapter="${chapter.id}" data-clear-course-name="${escapeHtml(course.name)}" title="Reset reading status, self-test, ESQ, flashcards SR, and mistakes for this chapter">Reset chapter progress</button>
            </div>
          </div>
          <div class="chapter-hero-bar">
            ${renderSurfaceTabs(course, { active: null, surface: 'chapter', chapter })}
            ${(() => { const { prev, next } = findAdjacentChapters(course, chapter.id); return renderChapterPrevNext(course, prev, next, 'header') })()}
          </div>
        </header>
        ${renderChapterSubTabs(course, chapter, tab)}

        ${tab === 'content' ? `
          <div class="markdown-body topical">${wrapTopicSections(contentHtml)}</div>

          ${data.examples ? `
            <section id="chapter-examples" class="examples-panel">
              <div class="panel-head"><div><p class="eyebrow">Sidecar</p><h2>More worked examples</h2></div><small><code>examples.md</code></small></div>
              <div class="markdown-body">${examplesHtml}</div>
            </section>
          ` : ''}

          <div class="chapter-read-footer">
            ${isChapterRead(course.id, chapter.id)
              ? `<button type="button" class="cp-read-toggle is-read" data-chapter-read-toggle="${course.id}/${chapter.id}">✓ You've read this chapter · click to undo</button>`
              : `<button type="button" class="cp-read-toggle" data-chapter-read-toggle="${course.id}/${chapter.id}">Mark chapter as read</button>`}
            <small class="rail-meta">Auto-marks when you scroll near the end.</small>
          </div>
        ` : tab === 'esq' ? `
          <div class="mq-panel">${renderMockQuestionsView(course)}</div>
        ` : `
          <section id="chapter-questions" class="questions-panel">
            ${renderQuestionsPanel(course, chapter)}
          </section>
        `}
        ${(() => { const { prev, next } = findAdjacentChapters(course, chapter.id); return renderChapterPrevNext(course, prev, next, 'footer') })()}
      </article>

      <div class="resize-handle vertical-handle" data-resize="rail" title="Drag to resize · double-click to reset"></div>
      <aside class="chapter-rail">
        <button class="rail-collapse-btn rail-side" type="button" data-rail-toggle title="${layoutState.railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}">${layoutState.railCollapsed ? '‹' : '›'}</button>
        <div class="rail-collapsible">
          ${renderChapterProgressCard(course, chapter)}

          ${(state.meta.vaultRoot || '').startsWith('/') ? `
          <section class="rail-card">
            <h4>Open in vault</h4>
            <a class="rail-kb-link" href="file:///${state.meta.vaultRoot}/${data.path}">${data.path.split('/').slice(-2).join('/')}</a>
          </section>
          ` : ''}

          ${renderChatPanel(course, chapter)}
        </div>
      </aside>
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

function renderChapterProgressCard(course, chapter) {
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
        ${row('Mock questions', mockLine, p.mock.total ? '' : 'Generate on the Mock-exam page')}
        ${row('Flashcards', fcLine, p.flashcards.total ? '' : 'Add on the Flashcards tab')}
      </div>
      <button type="button" class="cp-read-toggle ${p.read ? 'is-read' : ''}" data-chapter-read-toggle="${course.id}/${chapter.id}">
        ${p.read ? '✓ Marked as read · click to undo' : 'Mark chapter as read'}
      </button>
    </section>
  `
}

function renderChatPanel(course, chapter) {
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
    <section class="rail-card chat-panel" data-chat-key="${course.id}/${chapter.id}">
      <h4>Tutor chat</h4>
      <small class="rail-meta">Course context: all of ${course.code}. Focused on Ch ${chapter.id}.</small>
      <div class="chat-messages">${messagesHtml}</div>
      ${chat.sending ? '<div class="chat-thinking">Tutor thinking (codex)...</div>' : ''}
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
  } catch (err) {
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
      <div class="panel-head"><div><p class="eyebrow">Self-check</p><h2>Practice questions</h2></div></div>
      <p>Pulls from Self Tests / Worked Drills in the KB, plus 8–16 additional exam-style questions generated via Codex (all five types: written, calc, true/false, best-option, pseudocode).</p>
      <div class="loader">Loading or generating practice questions. If this chapter has no cache yet, Codex is generating them now and this can take 60-120s...</div>
    `
  }
  if (cstate.loading) {
    return `
      <div class="panel-head"><div><p class="eyebrow">Self-check</p><h2>Practice questions</h2></div></div>
      <div class="loader">${cstate.auto ? 'Loading or generating practice questions. First generation can take 60-120s...' : 'Generating questions via Codex (first time may take 60-120s)...'}</div>
    `
  }
  if (cstate.error) {
    return `
      <div class="panel-head"><div><p class="eyebrow">Self-check</p><h2>Practice questions</h2></div></div>
      <div class="loader error">Failed: ${escapeHtml(cstate.error)}</div>
      <button type="button" class="load-q-btn" data-load-questions="${course.id}/${chapter.id}">Retry</button>
    `
  }

  const questions = cstate.questions || []
  if (!questions.length) {
    return `
      <div class="panel-head"><div><p class="eyebrow">Self-check</p><h2>Practice questions</h2></div></div>
      <div class="loader error">No questions cached. ${cstate.generationError ? `Last error: ${escapeHtml(cstate.generationError)}` : ''}</div>
      <button type="button" class="load-q-btn" data-load-questions="${course.id}/${chapter.id}">Generate questions</button>
    `
  }
  const filtered = questions.filter((q) => {
    if (questionFilter.types.length && !questionFilter.types.includes(q.type)) return false
    if (questionFilter.sources.length) {
      const sourceTag = q.id.startsWith('gen-') ? 'gen' : 'kb'
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
  const sourceOptionsList = [{ value: 'kb', label: 'From KB' }, { value: 'gen', label: 'Generated' }]

  return `
    <div class="panel-head q-panel-head">
      <div>
        <p class="eyebrow">Self-check</p>
        <h2>Practice questions <small>(${filtered.length} of ${questions.length})</small></h2>
        <div class="type-strip">${typeStrip}</div>
      </div>
      <div class="q-toolbar">
        ${renderMultiSelect('types', 'All types', typeOptionsList)}
        ${renderMultiSelect('sources', 'All sources', sourceOptionsList)}
        <button type="button" class="tb-btn tb-btn-primary" data-extend-open="${course.id}/${chapter.id}" title="Generate more questions to add to the bank">＋ Generate more</button>
        <button type="button" class="tb-btn clear-link" data-clear-scope="self-test" data-clear-course="${course.id}" data-clear-chapter="${chapter.id}" data-clear-course-name="${escapeHtml(course.name)}" title="Clear all your self-test answers, grades, and revealed answers for this chapter">Clear answers</button>
        ${renderToolbarMore(course, chapter)}
      </div>
    </div>

    ${filtered.length ? `
      ${renderProgressTracker(filtered, nav, course, chapter, questions)}
      <div class="q-pager">
        <button type="button" class="q-nav-btn" data-q-nav="prev" ${nav.index === 0 ? 'disabled' : ''}>← Previous</button>
        <span class="q-pager-pos">Question <strong>Q${currentOrigIndex + 1}</strong> of ${questions.length}</span>
        <button type="button" class="q-nav-btn" data-q-nav="random">🎲 Random</button>
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
          <span class="q-diff diff-${q.difficulty}">${q.difficulty}</span>
          <span class="q-source">${escapeHtml(q.source || 'Practice')}</span>
        </div>
        <button type="button" class="q-delete" data-q-delete="${course.id}/${chapter.id}/${q.id}" title="Delete this question from the bank (cannot be undone)" aria-label="Delete question">×</button>
      </div>
      <div class="q-body">${renderInlineMarkdown(q.question)}</div>
      ${input}
      <div class="q-actions">
        <button type="button" class="btn btn-primary" data-grade="${attemptKey}" ${grading ? 'disabled' : ''}>${grading ? 'Grading…' : 'Check my answer'}</button>
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
      ${items.length === 0 ? '<p class="empty">No open mistakes. Keep grinding — they\'ll show up here as you grade attempts.</p>' : ''}
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
          <a class="load-q-btn" href="#/">Back to dashboard</a>
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
          ${c.question.options?.length ? `<ul class="sr-options">${c.question.options.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ul>` : ''}
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
                <td><a href="#/mocks/${s.id}">Review →</a></td>
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
      <div class="mock-panel" style="max-width:560px">
        <h2>Generate more questions</h2>
        <p class="rail-meta">${course?.code || cid} ${course?.shortName ? '· ' + course.shortName : ''}${chapter ? ' / Ch ' + chapter.id + ' · ' + chapter.name : ''}</p>

        ${extendModal.generating ? `
          <div class="loader">Generating ${extendModal.count} new questions via Codex (60–120s)…</div>
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
            <small class="rail-meta">Steer the generator toward specific topics, difficulty, style, or coverage. Leave blank for default behaviour.</small>
          </fieldset>

          <div class="extend-actions">
            <button type="button" class="load-q-btn" data-extend-submit>Generate ${extendModal.count}</button>
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
    extendModal.open = null
    extendModal.generating = false
    extendModal.error = null
    extendModal.customPrompt = ''
    render()
  } catch (err) {
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
      <div class="mock-panel" style="max-width:560px">
        <h2>Regenerate questions</h2>
        <p class="rail-meta">${course?.code || cid} ${course?.shortName ? '· ' + course.shortName : ''}${chapter ? ' / Ch ' + chapter.id + ' · ' + chapter.name : ''}</p>
        <div class="regen-warning">⚠ This <strong>replaces</strong> the cached question set for this chapter. Your existing questions for this chapter will be deleted.</div>

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
            <button type="button" class="load-q-btn regen-submit-btn" data-regen-submit>↻ Regenerate ${regenModal.count}</button>
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
            <span class="tb-more-icon">＋</span>
            <span>
              <strong>Add all to flashcards</strong>
              <small>Bulk-load every question in the bank into your SR deck</small>
            </span>
          </button>
          <button type="button" class="tb-more-item" data-start-mock="${key}" data-tb-more-action>
            <span class="tb-more-icon">▶</span>
            <span>
              <strong>Start mini-mock</strong>
              <small>Timed practice on this chapter's question set</small>
            </span>
          </button>
          <div class="tb-more-divider" aria-hidden="true"></div>
          <button type="button" class="tb-more-item tb-more-danger" data-regen-open="${key}" data-tb-more-action>
            <span class="tb-more-icon">↻</span>
            <span>
              <strong>Regenerate entire bank</strong>
              <small>Replace all questions with a fresh set</small>
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
    return `<div class="mock-overlay"><div class="mock-panel"><h2>Grading your mock…</h2><p>Codex is reviewing ${m.questions.length} answers. This usually takes 60-180s.</p><div class="loader">…</div></div></div>`
  }
  if (m.phase === 'done') {
    const s = m.results
    return `
      <div class="mock-overlay">
        <div class="mock-panel results">
          <h2>Mock complete · ${s.totalScore.toFixed(1)}/${s.totalMax}</h2>
          <p>Saved as session. <a href="#/mocks/${s.id}">Open full review →</a></p>
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
          <span class="mock-timer">⏱ <span class="mock-timer-readout">${mockTimeRemainingLabel()}</span></span>
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
        <button type="button" class="bg-job-dismiss" data-bg-dismiss="${j.id}" title="Dismiss">×</button>
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
        ${totalCards ? `<button type="button" class="tb-btn tb-btn-primary" data-fc-practice-all="${course.id}">▶ Practice all (${totalDue || totalCards})</button>` : ''}
        <button type="button" class="tb-btn" data-fc-gen-all="${course.id}">✨ Generate all chapters</button>
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
          <span class="fc-caret">${isExpanded ? '▾' : '▸'}</span>
          <strong>Ch ${escapeHtml(chapter.id)} — ${escapeHtml(chapter.name)}</strong>
          <small>${cards.length} card${cards.length === 1 ? '' : 's'}${cards.length ? ` · ${dueCount} due` : ''}</small>
        </button>
        <div class="fc-chapter-actions">
          ${cards.length ? `<button type="button" class="tb-btn tb-btn-primary" data-fc-practice="${chapter.id}">Practice (${dueCount || cards.length})</button>` : ''}
          <button type="button" class="tb-btn" data-fc-add="${chapter.id}">Add card</button>
          <button type="button" class="tb-btn" data-fc-gen="${chapter.id}">Generate with AI</button>
          <a class="tb-btn" href="#/course/${course.id}/chapter/${chapter.id}" title="Open chapter for revision">Open chapter</a>
        </div>
      </header>
      ${isExpanded ? `
        ${adding ? renderFlashcardForm('new', chapter.id, adding.front || '', adding.back || '') : ''}
        ${cards.length ? `
          <div class="fc-grid">
            ${cards.map((c) => renderFlashcardCard(course, chapter, c)).join('')}
          </div>
        ` : `<p class="empty fc-empty">No flashcards in this chapter yet. Add one manually or generate with AI.</p>`}
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
        <span class="fc-card-source">${card.source === 'ai' ? '✨ AI' : 'Custom'}</span>
        ${isDue ? '<span class="fc-card-due">Due</span>' : `<span class="fc-card-next">Next: ${new Date(card.sr?.dueAt || Date.now()).toLocaleDateString()}</span>`}
        <div class="fc-card-actions">
          <button type="button" class="fc-icon-btn" data-fc-edit="${card.id}" data-chapter="${chapter.id}" title="Edit">✎</button>
          <button type="button" class="fc-icon-btn fc-icon-danger" data-fc-delete="${card.id}" data-chapter="${chapter.id}" title="Delete">×</button>
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
        <span class="multi-dd-arrow">▾</span>
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
  const rawKeys = typeof qOrKey === 'object'
    ? [qOrKey.id, qOrKey.label]
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

  // Need to extract via PDF.js and POST to parse
  try {
    if (!window.__pdfjs) throw new Error('PDF.js not loaded yet — try again in a moment.')
    const questionPdfUrl = `/api/pdf/${encodeURIComponent(courseId)}/${examIdEnc}`
    const solutionsPdfUrl = `/api/pdf/${encodeURIComponent(courseId)}/${examIdEnc}/solutions`
    const qPdf = await window.__pdfjs.getDocument(questionPdfUrl).promise
    const questionPages = []
    for (let i = 1; i <= qPdf.numPages; i++) {
      const page = await qPdf.getPage(i)
      const tc = await page.getTextContent()
      questionPages.push({ page: i, text: pdfTextWithBoldMarkers(tc) })
    }
    let solutionsPages = []
    try {
      const sPdf = await window.__pdfjs.getDocument(solutionsPdfUrl).promise
      for (let i = 1; i <= sPdf.numPages; i++) {
        const page = await sPdf.getPage(i)
        const tc = await page.getTextContent()
        solutionsPages.push({ page: i, text: pdfTextWithBoldMarkers(tc) })
      }
    } catch {}

    practiceExamCache.set(key, { status: 'parsing' })
    render()
    const payload = await fetchJson(`/api/practice-exam/${encodeURIComponent(courseId)}/${examIdEnc}/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionPages, solutionsPages })
    })
    practiceExamCache.set(key, { status: 'ready', questions: payload.questions })
    if (!practiceExamView.currentQid) practiceExamView.currentQid = payload.questions[0].id
    render()
  } catch (err) {
    practiceExamCache.set(key, { status: 'error', error: err.message })
    render()
  }
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
    return `<div class="practice-loader">Generating course-wide questions via Codex (2–5 min — analyses every chapter + exam paper)…</div>`
  }
  if (cache.status === 'idle' || (cache.status === 'error' && !cache.questions)) {
    return `
      <div class="mq-intro">
        <h2>Mock questions</h2>
        <p>Course-wide self-test. Codex reads every chapter plus the mock exam paper${cache?.examPaperUsed === false ? '' : ' and solutions'} to generate a bank of questions, indexed by chapter and topic, with multiple questions per topic. Question types are chosen to match the exam style.</p>
        ${cache?.status === 'error' ? `<p class="error">Last error: ${escapeHtml(cache.error)}</p>` : ''}
        <button type="button" class="load-q-btn" data-mq-generate="${course.id}">Generate questions</button>
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
        <p class="eyebrow">Course-wide self-test</p>
        <h2>Mock questions <small>(${filtered.length} of ${questions.length})</small></h2>
        ${typeStrip ? `<div class="type-strip">${typeStrip}</div>` : ''}
        ${cache.examTypeMix ? `<p class="rail-meta mq-mix">${escapeHtml(cache.examTypeMix)}</p>` : ''}
      </div>
      <div class="q-toolbar">
        ${renderMqMultiSelect('topics', 'All topics', topicOpts)}
        ${renderMqMultiSelect('types', 'All types', typeOpts)}
        <button type="button" class="tb-btn" data-mq-regenerate="${course.id}" title="Regenerate the whole bank">↻ Regenerate</button>
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
        <button type="button" class="q-nav-btn" data-mq-nav="random">🎲 Random</button>
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
        <button type="button" class="btn btn-primary" data-grade="${attemptKey}" ${grading ? 'disabled' : ''}>${grading ? 'Grading…' : 'Check my answer'}</button>
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

  // PDF sub-tab availability — bounce to whatever this paper actually has
  if (isPaperSurface) {
    if (practiceExamView.examSubtab === 'pdf' && !hasPaperPdf) practiceExamView.examSubtab = hasSolutionsPdf ? 'solutions' : 'practice'
    if (practiceExamView.examSubtab === 'solutions' && !hasSolutionsPdf) practiceExamView.examSubtab = hasPaperPdf ? 'pdf' : 'practice'
    if (practiceExamView.examSubtab === 'practice' && !hasPaperPdf) practiceExamView.examSubtab = hasSolutionsPdf ? 'solutions' : 'pdf'
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
  if (isPaperSurface && practiceExamView.examSubtab === 'practice' && hasPaperPdf) {
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
      tocBody = '<p class="empty">No questions yet. Generate them in the main panel.</p>'
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
      tocBody = '<p class="empty">Building content TOC via codex (30-90s)…</p>'
    } else {
      const isCodex = outline.status === 'codex'
      const isNative = outline.status === 'native'
      const isPagesFallback = outline.status === 'pages'
      tocHeader = `
        <div class="toc-actions">
          <small class="toc-source">${isNative ? 'PDF bookmarks' : isCodex ? 'Generated content TOC' : 'Per-page fallback'}</small>
          <button type="button" class="toc-build-btn" data-build-toc="${course.id}" data-build-exam="${examId || ''}">${isCodex ? '↻ Rebuild' : isPagesFallback ? '✨ Build content TOC' : '↻ Rebuild content TOC'}</button>
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
    <div class="chapter-grid" style="--accent:${course.accent}">
      <aside class="chapter-toc">
        <button class="rail-collapse-btn" type="button" data-toc-toggle title="${layoutState.tocCollapsed ? 'Expand TOC' : 'Collapse TOC'}">${layoutState.tocCollapsed ? '›' : '‹'}</button>
        <div class="rail-collapsible">
          <button class="toc-back" type="button" data-back-to-course="${course.id}" title="Back to ${course.code} ${course.shortName || ''}">${ICONS.back}<span>${course.code} <em>${course.shortName || ''}</em></span></button>
          ${renderCourseChaptersSection(course, null)}
          <h4>${tocTitle}</h4>
          ${tocHeader}
          ${tocBody}
          ${(isPaperSurface) && outline?.totalPages ? `<small class="rail-meta" style="margin-top:10px;display:block">${outline.totalPages} pages</small>` : ''}
        </div>
      </aside>
      <div class="resize-handle vertical-handle" data-resize="toc" title="Drag to resize · double-click to reset"></div>

      <article class="chapter-main mock-main">
        <header class="chapter-hero mock-hero surface-hero" style="--accent:${course.accent}">
          <div class="surface-hero-text">
            <p class="eyebrow">${course.code} ${course.shortName || ''} · Practice</p>
            <h1>Practice</h1>
          </div>
          ${renderSurfaceTabs(course, { active: practiceExamView.tab, surface: 'mock-exam' })}
        </header>
        ${isPaperSurface ? renderMockExamsSurface(course, currentExam, getActivePapers(course), { pdfUrl, solutionsUrl, hasPaperPdf, hasSolutionsPdf })
          : practiceExamView.tab === 'flashcards' ? `
          <div class="fc-panel">${renderFlashcardsView(course)}</div>
        ` : `
          <div class="mq-panel">${renderMockQuestionsView(course)}</div>
        `}
      </article>

      <div class="resize-handle vertical-handle" data-resize="rail" title="Drag to resize · double-click to reset"></div>
      <aside class="chapter-rail">
        <button class="rail-collapse-btn rail-side" type="button" data-rail-toggle title="${layoutState.railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}">${layoutState.railCollapsed ? '‹' : '›'}</button>
        <div class="rail-collapsible">
          <section class="rail-card">
            <h4>${isPaperSurface ? 'About this paper' : 'Practice & flashcards'}</h4>
            <p class="rail-meta">${isPaperSurface
              ? (practiceExamView.tab === 'tutorials'
                  ? 'Pick a tutorial in the selector above, then jump between PDF, Solutions, and Practice. The tutor on the right has the full course context — ask for hints on a question rather than the answer.'
                  : 'Pick an exam in the selector above, then jump between PDF, Solutions, and Practice. The tutor on the right has the full course context — ask for hints on a question rather than the answer.')
              : 'Mock questions and flashcards are generated from the chapter notes — use the tabs above. The tutor on the right has full course context.'}</p>
          </section>
          ${isPaperSurface && currentExam?.pdf && (state.meta.vaultRoot || '').startsWith('/') ? `
            <section class="rail-card">
              <h4>Open original</h4>
              <a class="rail-kb-link" href="file:///${state.meta.vaultRoot}/${course.knowledgeBase}/${currentExam.pdf}">${currentExam.pdf.split('/').slice(-2).join('/')}</a>
            </section>
          ` : ''}
          ${renderChatPanelCourse(course)}
        </div>
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
  const subtab = practiceExamView.examSubtab

  const selector = `
    <div class="exam-selector" role="tablist" aria-label="Select exam paper">
      ${exams.map((e) => {
        const active = e.id === currentExam?.id
        const flags = []
        if (e.pdf) flags.push('paper')
        if (e.solutionsPdf) flags.push('solutions')
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
      <button type="button" role="tab" class="exam-subtab${subtab === 'practice' ? ' active' : ''}${!hasPaperPdf ? ' disabled' : ''}" data-exam-subtab="practice" ${hasPaperPdf ? '' : 'disabled'}>Practice</button>
    </nav>
  `

  let body = ''
  if (subtab === 'pdf' && hasPaperPdf) {
    body = `<div class="pdf-viewer"><iframe id="mock-pdf-iframe" src="${pdfUrl}#view=FitH" title="Mock exam PDF" allow="fullscreen"></iframe></div>`
  } else if (subtab === 'solutions' && hasSolutionsPdf) {
    body = `<div class="pdf-viewer"><iframe id="mock-solutions-iframe" src="${solutionsUrl}#view=FitH" title="Solutions PDF" allow="fullscreen"></iframe></div>`
  } else if (subtab === 'practice' && hasPaperPdf) {
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
    return `<div class="loader practice-loader">Extracting question paper text via PDF.js…</div>`
  }
  if (cache.status === 'parsing') {
    return `<div class="loader practice-loader">Parsing exam structure via Codex (60–120s). This builds the full Q&A bank with model answers.</div>`
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
        <button type="button" class="tb-btn clear-link" data-clear-scope="exam" data-clear-course="${course.id}" data-clear-exam="${getActivePaperId() || ''}" data-clear-exam-label="${escapeHtml(getCurrentPaper(course)?.label || 'this practice exam')}" title="Clear all your answers, grades, guidance hints, and uploaded images for this practice exam">Clear my work</button>
        <button type="button" class="regen-btn" data-practice-reparse="${course.id}">↻ Regenerate exam</button>
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
        <textarea class="q-input code cm-target" data-practice-attempt="${qid}" data-code-lang="${lang}" placeholder="Your answer for ${escapeHtml(q.label)} (or drop a screenshot/photo)…">${escapeHtml(attempt)}</textarea>
        ${renderImageThumbs(practiceExamView.attemptImages[qid], `practice-remove-image="${qid}"`)}
        <label class="attempt-drop-hint">📎 Drop or <input type="file" accept="image/*" multiple class="attempt-file-input" data-practice-file="${qid}"> upload image</label>
      </div>
    `
  } else {
    input = `
      <div class="attempt-drop" data-practice-drop="${qid}">
        <textarea class="q-input" data-practice-attempt="${qid}" placeholder="Your answer for ${escapeHtml(q.label)} (or drop a screenshot/photo)…">${escapeHtml(attempt)}</textarea>
        ${renderImageThumbs(practiceExamView.attemptImages[qid], `practice-remove-image="${qid}"`)}
        <label class="attempt-drop-hint">📎 Drop or <input type="file" accept="image/*" multiple class="attempt-file-input" data-practice-file="${qid}"> upload image</label>
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
      ${input}
      <div class="q-actions">
        <button type="button" class="btn btn-primary" data-practice-grade="${qid}" ${grading ? 'disabled' : ''}>${grading ? 'Grading…' : 'Check my answer'}</button>
        <button type="button" class="btn btn-ghost" data-toggle-answer="${qid}">${showAnswer ? 'Hide ideal answer' : 'Reveal ideal answer'}</button>
        <button type="button" class="btn btn-ghost" data-toggle-guidance="${qid}">${showGuidance ? 'Hide guidance' : 'Show guidance'}</button>
        <button type="button" class="btn btn-ghost clear-link" data-clear-scope="question" data-clear-course="${course.id}" data-clear-question="${qid}" title="Clear your answer, grade, and guidance for this question">Clear answer</button>
      </div>

      ${showGuidance ? `
        <div class="q-grade">
          <strong>Guidance</strong>
          ${!guidance ? `<div class="loader">Generating tutor guidance…</div>` : guidance.loading ? `<div class="loader">Generating…</div>` : guidance.error ? `<div class="loader error">${escapeHtml(guidance.error)}</div>` : `<div class="markdown-body">${renderMarkdown(guidance.text)}</div>`}
        </div>
      ` : ''}

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
  const normalizedId = practiceCanonicalKey(q.id || q.label)
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
    <section class="rail-card chat-panel" data-chat-key="${course.id}/mock">
      <h4>Tutor chat</h4>
      <small class="rail-meta">Course context: all of ${course.code}. Focused on mock exam.</small>
      <div class="chat-messages">${messagesHtml}</div>
      ${chat.sending ? '<div class="chat-thinking">Tutor thinking (codex)...</div>' : ''}
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
  const key = `${courseId}/${chapterId}/${relPath || ''}`
  try {
    const url = `/api/chapter/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}${relPath ? '/' + relPath.split('/').map(encodeURIComponent).join('/') : ''}`
    const data = await fetchJson(url)
    chapterCache.set(key, { data })
  } catch (err) {
    chapterCache.set(key, { error: err.message })
  }
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
  str = str.replace(/(^|[^\\])\$([^\n$]+?)\$/g, (_, lead, m) => {
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
  str = str.replace(/(^|[^\\])\$([^\n$]+?)\$/g, (_, lead, m) => {
    blocks.push({ display: false, body: m })
    return `${lead}${placeholder(blocks.length - 1)}`
  })
  try {
    let html = marked.parseInline(str, { gfm: true })
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
  const m = String(correction || '').match(/score[:\s*]*?(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/i)
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
  s = s.replace(/(^|[^\\])\$([^\n$]+?)\$/g, (_, lead, m) => {
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
  s = s.replace(/(^|[^\\])\$([^\n$]+?)\$/g, (_, lead, m) => {
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

  let html = marked.parse(s, { gfm: true, breaks: false })

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

function typesetMath() {
  if (typeof renderMathInElement === 'undefined') return
  // .q-options must be in this list — mc/multi/tf option labels are rendered
  // via renderInlineMarkdown (which preserves $…$ for KaTeX to pick up later)
  // but they sit OUTSIDE .q-body, so without an explicit selector they were
  // never typeset and the dollar-delimited LaTeX leaked into the visible text.
  document.querySelectorAll('.markdown-body, .q-body, .q-options, .q-grade, .q-expected, .sr-question, .mistake-question, .practice-q-body, .chat-body, .fc-card-side, .fc-study-front, .fc-study-back').forEach((el) => {
    try {
      renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      })
    } catch (e) { console.error('KaTeX error', e) }
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

  document.querySelectorAll('[data-sidebar-toggle]').forEach((btn) => {
    btn.addEventListener('click', toggleSidebar)
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

  document.querySelectorAll('[data-toc-toggle]').forEach((btn) => {
    btn.addEventListener('click', toggleToc)
  })
  document.querySelectorAll('[data-rail-toggle]').forEach((btn) => {
    btn.addEventListener('click', toggleRail)
  })
  attachResizeHandlers()

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
      if (btn) btn.textContent = `↻ Regenerate ${regenModal.count}`
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
      if (target) scrollWithin(document.querySelector('.chapter-main'), target)
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
      const scroller = document.querySelector('.chapter-main')
      if (scroller) scroller.scrollTop = 0
      _suppressNextScrollRestore = true
      render()
    })
  })

  // Mark-as-read toggle (both rail card + footer button)
  document.querySelectorAll('[data-chapter-read-toggle]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const [cid, chid] = event.currentTarget.dataset.chapterReadToggle.split('/')
      setChapterRead(cid, chid, !isChapterRead(cid, chid))
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
      if (target) scrollWithin(document.querySelector('.chapter-main'), target)
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
    const scroller = document.querySelector('.chapter-main')
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
      const scroller = document.querySelector('.chapter-main') || document.querySelector('.content')
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
        const scroller = document.querySelector('.chapter-main') || document.querySelector('.content')
        if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' })
        render()
        return
      } else return
      practiceExamView.currentQid = groups[nextGroupIdx].parts[0].id
      persistPracticeAttempts(route.courseId, examId)
      const scroller = document.querySelector('.chapter-main') || document.querySelector('.content')
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
        if (target) scrollWithin(document.querySelector('.chapter-main') || document.querySelector('.content'), target)
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

  document.querySelectorAll('[data-build-toc]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const courseId = event.currentTarget.dataset.buildToc
      const examId = event.currentTarget.dataset.buildExam || getActivePaperId()
      const cacheKey = examId ? `${courseId}__${examId}` : courseId
      const cached = pdfOutlineCache.get(cacheKey)
      const force = cached?.status === 'codex'
      buildContentToc(courseId, { force, examId })
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

  if (route.page === 'chapter') {
    typesetMath()
    renderMermaid()
    bindSteppers()
    mountCodeEditors()
  }
  if (route.page === 'mistakes' || route.page === 'sr' || route.page === 'mocks') {
    typesetMath()
    renderMermaid()
    bindSteppers()
    mountCodeEditors()
  }
  if (route.page === 'mock-exam' && (
    practiceExamView.tab === 'mock-questions' ||
    practiceExamView.tab === 'flashcards' ||
    ((practiceExamView.tab === 'exams' || practiceExamView.tab === 'tutorials') && practiceExamView.examSubtab === 'practice')
  )) {
    typesetMath()
    renderMermaid()
    bindSteppers()
    mountCodeEditors()
  }

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
      if (btn) btn.textContent = `Generate ${extendModal.count}`
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
