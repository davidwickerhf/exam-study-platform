const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const stop = new Set('a an the to your my our for of with and or email message draft course if needed only official help'.split(' '))
const tokens = value => new Set(normalized(value).split(' ').filter(word => word && !stop.has(word)))
const overlap = (a, b) => {
  const left = tokens(a), right = tokens(b)
  return left.size && right.size ? [...left].filter(word => right.has(word)).length / Math.min(left.size, right.size) : 0
}

// Legacy replies did not have identities. Match conservatively by audience,
// course and purpose; never merge merely because two drafts go to a coordinator.
function sameDraft(a, b) {
  if (a.key && b.key) return a.key === b.key
  const courses = item => [...new Set(`${item.subject} ${item.body}`.match(/\b[A-Z]{2,5}\d{3,5}\b/g) || [])].sort().join(',')
  return courses(a) === courses(b) && normalized(a.recipient) === normalized(b.recipient)
    && (normalized(a.subject) === normalized(b.subject) || (overlap(a.subject, b.subject) >= .75 && overlap(a.title, b.title) >= .75))
}

export function tutorDocket(messages = []) {
  const drafts = [], proposals = new Map()
  for (const message of messages) {
    for (const proposal of message.proposals || []) proposals.set(proposal.id, proposal)
    for (const draft of message.presentation?.drafts || []) {
      const index = drafts.findIndex(previous => sameDraft(previous, draft))
      if (index < 0) drafts.push(draft)
      else drafts[index] = draft
    }
  }
  return { drafts, proposals: [...proposals.values()] }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  return value
}
export function reusableTutorProposal(existing, proposal) {
  // Executable changes require exact effect equality, not fuzzy title matching.
  const effect = item => {
    const payload = structuredClone(item.payload)
    if (item.type === 'study-work' && !payload.expectedItemRevision && payload.item) { delete payload.item.id; delete payload.item.revision }
    if (item.type === 'study-project' && Array.isArray(payload.items)) {
      const ids = new Map(payload.items.map((entry, index) => [entry.id, `new-${index}`]))
      payload.items = payload.items.map(entry => { const value = { ...entry, id: ids.get(entry.id), parentId: ids.get(entry.parentId) || entry.parentId }; delete value.revision; return value })
    }
    return JSON.stringify(canonical({ type: item.type, payload }))
  }
  return proposal.payload ? existing.find(item => effect(item) === effect(proposal)) : null
}
