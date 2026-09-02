const enc = (value) => encodeURIComponent(decodeURIComponent(String(value || '')))

/** Translate historical hash routes to their React replacements. Unknown
 * hashes return null so the /app cutover can fall back safely to /app. */
export function legacyHashTarget(hash = '') {
  const clean = String(hash).replace(/^#/, '')
  if (!clean || clean === '/') return '/app'
  let parts
  try {
    parts = clean.split('?')[0].split('/').filter(Boolean).map(decodeURIComponent)
  } catch {
    return null
  }
  if (parts[0] === 'courses') return '/app/courses'
  if (parts[0] === 'course' && parts[1] && parts[2] === 'chapter' && parts[3]) {
    const relPath = parts.slice(4).map(enc).join('/')
    return `/app/courses/${enc(parts[1])}/${enc(parts[3])}${relPath ? `/${relPath}` : ''}`
  }
  if (parts[0] === 'course' && parts[1] && parts[2] === 'mock-exam') return `/app/courses/${enc(parts[1])}/mock-exam`
  if (parts[0] === 'course' && parts[1] && parts[2] === 'item' && parts[3]) return `/app/courses/${enc(parts[1])}/item/${enc(parts[3])}`
  if (parts[0] === 'course' && parts[1] && parts.length === 2) return `/app/courses/${enc(parts[1])}`
  if (parts[0] === 'calendar') return `/app/calendar${parts[1] ? `?view=${enc(parts[1])}` : ''}`
  if (parts[0] === 'planning' && parts[1] === 'calendar') return '/app/calendar'
  if (parts[0] === 'tutor') return `/app/tutor${parts[1] ? `?conversation=${enc(parts[1])}` : ''}`
  if (parts[0] === 'setup') return clean.includes('checklist=1') ? '/app/setup?checklist=1' : '/app/setup'
  if (parts[0] === 'updates') return `/app/updates?tab=${['announcements', 'assignments', 'materials', 'courses'].includes(parts[1]) ? parts[1] : 'announcements'}`
  if (parts[0] === 'settings' || parts[0] === 'account') {
    if (parts[1] === 'admin') return '/app/admin'
    const tab = ['connections', 'usage', 'data', 'api'].includes(parts[1]) ? parts[1] : 'profile'
    return `/app/account?tab=${tab}`
  }
  if (parts[0] === 'mistakes') return '/app/practice?tab=mistakes'
  if (parts[0] === 'sr') return '/app/practice?tab=flashcards'
  if (parts[0] === 'mocks') return `/app/practice?tab=mocks${parts[1] ? `&session=${enc(parts[1])}` : ''}`
  if (parts[0] === 'practice') {
    const tab = ['questions', 'flashcards', 'mistakes', 'mocks'].includes(parts[1]) ? parts[1] : 'questions'
    return `/app/practice?tab=${tab}${tab === 'mocks' && parts[2] ? `&session=${enc(parts[2])}` : ''}`
  }
  if (parts[0] === 'planning') {
    const aliases = { curriculum: 'courses', credits: 'progress', requirements: 'progress' }
    const requested = aliases[parts[1]] || parts[1] || 'overview'
    const tab = ['overview', 'courses', 'documents', 'progress', 'planner', 'settings'].includes(requested) ? requested : 'overview'
    return `/app/planning?tab=${tab}${parts[2] ? `&focus=${enc(parts[2])}` : ''}`
  }
  if (parts[0] === 'course-request' && parts[1]) return `/app/course-request/${enc(parts[1])}`
  if (parts[0] === 'admin') {
    if (parts[1] === 'programme' && parts[2]) return `/app/admin?tab=catalogue&programme=${enc(parts[2])}`
    if (parts[1] === 'course' && parts[2]) return `/app/admin?tab=production&course=${enc(parts[2])}`
    const tab = parts[1] === 'intake' ? 'intake' : parts[1] === 'calendar' || parts[1] === 'programmes' ? 'catalogue' : ['coverage', 'production'].includes(parts[1]) ? parts[1] : 'overview'
    return `/app/admin?tab=${tab}`
  }
  return null
}

export function mergeBrowserState(local = {}, remote = {}) {
  return Object.keys(remote).length ? { ...local, ...remote } : { ...local }
}

export function browserStateSnapshot(storage) {
  const result = {}
  if (!storage) return result
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key != null) result[key] = storage.getItem(key)
  }
  return result
}
