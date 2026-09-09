// These narrow checks prevent known retrieval omissions. They are not a factual
// verifier: interpreting requirements still needs the original course evidence.
export function tutorResearchRequirements(message, history = []) {
  const text = String(message || '')
  const recentUserText = history.filter(item => item.role === 'user').slice(-3).map(item => item.content).join('\n')
  const subject = `${text}\n${recentUserText}`
  const requirements = []
  if (/\b(due|deadline|hand.?in|submit|submission)\b/i.test(text) && /\b(assignment|review|paper|project|group|quiz|hand.?in|submit|submission)\b/i.test(subject)) {
    requirements.push({ anyOf: ['get_canvas_assignments', 'get_canvas_assignment_detail'], reason: 'Check Canvas assignments for the actual dueAt, unlockAt and lockAt before answering this assignment deadline question.' })
  }
  if (/\b(class|session|meeting|representative|reps|teammates)\b/i.test(subject) && /\b(prepare|preparation|bring|advance|need to|what.*doing|check again)\b/i.test(text)) {
    requirements.push({ anyOf: ['get_announcements'], reason: 'Read the relevant full course announcement to identify this session and any stated preparation; a generic project-meeting rule is insufficient.' })
    requirements.push({ anyOf: ['get_schedule'], reason: 'Check the session time in the schedule, but use course-team instructions to interpret the activity and attendance requirements.' })
  }
  return requirements
}

export function isTutorSourceEvidence(item) {
  return Boolean(item?.id) && item.sourceType !== 'Past conversation' && !String(item.id).startsWith('chat:')
}

export function selectTutorEvidence(items, requestedIds = []) {
  const available = new Map(items.filter(isTutorSourceEvidence).map(item => [item.id, item]))
  return [...new Set(requestedIds)].map(id => available.get(id)).filter(Boolean).slice(0, 10)
}

export function createTutorGrounding({ message, history = [] } = {}) {
  const requirements = tutorResearchRequirements(message, history)
  const preparation = requirements.some(rule => rule.anyOf.includes('get_announcements'))
  const focused = preparation && !/\b(make|create|save|track|give me)\b.{0,40}\b(plan|tasks|checklist)\b/i.test(String(message || ''))
  const attempted = new Set()
  const evidence = new Map()
  let linkedAssignment = false
  const requireTool = (name, reason) => {
    if (!requirements.some(rule => rule.anyOf.includes(name))) requirements.push({anyOf:[name],reason})
  }
  return {
    requiredTools() {
      return requirements.filter(rule => !rule.anyOf.some(name => attempted.has(name))).map(rule => rule.anyOf[0])
    },
    record(name, result, sources = []) {
      attempted.add(name)
      for (const item of sources.filter(isTutorSourceEvidence)) evidence.set(item.id, item)
      if (preparation && name === 'get_announcements' && (result?.announcements || []).some(item => /assignment\s+(description|brief|instructions)/i.test(`${item.text || ''} ${item.excerpt || ''}`))) {
        linkedAssignment = true
        requireTool('get_canvas_assignments', 'The announcement points to an assignment brief. Find that assignment before stating what preparation is required.')
      }
      if (linkedAssignment && name === 'get_canvas_assignments' && result?.assignments?.length) {
        requireTool('get_canvas_assignment_detail', 'Read the relevant full assignment brief before stating what preparation is required.')
      }
    },
    responseFormat(base) {
      const format = structuredClone(base)
      // Constrain citations while generating, rather than regenerate a whole
      // answer because the model mistyped a long source ID. Bound the schema
      // separately from the complete registry used by the server-side check.
      const ids = []
      let characters = 0
      for (const id of [...evidence.keys()].reverse()) {
        if (ids.length >= 200 || characters + id.length > 50_000) break
        ids.push(id)
        characters += id.length
      }
      format.json_schema.schema.properties.evidenceIds = {
        type: 'array', maxItems: ids.length ? 10 : 0,
        items: { type: 'string', ...(ids.length ? { enum: ids } : {}) },
        description: 'Select only the exact IDs of sources supporting this answer. Use an empty array when no source was retrieved.'
      }
      if (focused) {
        // A preparation question is not a request for a plan. Enforce the
        // presentation contract before generating expensive, unwanted widgets.
        for (const [key, schema] of Object.entries(format.json_schema.schema.properties)) {
          if (schema.type === 'array' && key !== 'evidenceIds') schema.maxItems = 0
        }
        format.json_schema.schema.properties.summary.description = 'Answer this preparation question directly and briefly. State only preparation established by the actual instructions; if unspecified, say so. Do not infer required preparation from a deadline or invent a checklist.'
      }
      return format
    },
    review(content) {
      const missing = requirements.filter(rule => !rule.anyOf.some(name => attempted.has(name)))
      if (missing.length) return `${missing.map(rule => `${rule.reason} Call ${rule.anyOf.join(' or ')}.`).join('\n')} If a source fails or is disconnected, report that specific gap; do not infer a requirement or deadline. Do not repeat the rejected answer.`
      let answer
      try { answer = JSON.parse(content) } catch { return 'Return valid tutor_answer JSON.' }
      if (!Array.isArray(answer.evidenceIds) || answer.evidenceIds.length > 10 || answer.evidenceIds.some(id => !evidence.has(id))) {
        return 'Set evidenceIds to at most 10 exact source IDs returned by this turn’s tools. Cite only sources used for this answer. Past conversation and invented IDs are not evidence; use [] when no source supports an answer and explain the gap.'
      }
      return null
    }
  }
}

export const TUTOR_GROUNDING_INSTRUCTIONS = `Resolve the specific activity before applying a rule. "Project", "project meeting", "skill class", "paper review", and "project-plan review" are not interchangeable. Match course, academic year, date, audience and task. Course-team syllabuses, full announcements and lesson instructions determine session meaning and required preparation; timetable labels supply time/location and can be mismatched. Do not transfer an all-member meeting rule to a two-representative skill class.
For assignment dates, use get_canvas_assignments FIRST and get_canvas_assignment_detail for the full brief/rubric. Do not send the student to Canvas for information these tools can read. Read referenced source documents when the brief points to them. An empty or failed lookup is a coverage gap, not proof that an assignment or requirement is absent.
Keep dueAt (hand-in deadline), unlockAt (access opens), and lockAt (submission closes) separate. Do not claim submissions close at dueAt, invent a late penalty, or say permission is needed without a stated policy. A deadline after a class proves neither that preparation is required before class nor that none is required: read the instructions. Anchor relative dates to the current Europe/Amsterdam clock; never reuse "tomorrow" from an earlier reply.
Separate documented requirements, the student’s reports, and optional advice. Do not invent a draft, template, completed review, one-page status, customer/supervisor meeting or debrief duration as required preparation. If instructions do not establish preparation, say what you checked and what remains unspecified. You may offer one brief suggestion clearly labelled optional. Do not turn it into a tracked task unless the student asks for a plan or to save it.
When corrected, re-read the relevant primary source and revise the conclusion. Do not simply agree with the student or preserve unsupported details from your earlier answer. Earlier tutor replies are fallible conversation context, never independent evidence.
Before finalizing, check every factual statement in summary AND widgets against the sources. Include only directly relevant evidenceIds returned in this turn; omit unrelated courses, old tutor answers and generic rules that do not establish the claim. For a date confirmation or narrow preparation question, answer directly with unnecessary widget arrays empty.`
