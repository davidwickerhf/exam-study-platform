import { renderingPreflight } from './study-preflight.mjs'
import { objectiveCoverageFindings } from './study-pedagogy.mjs'
import { studyVisualIssues } from './study-visuals.mjs'
// Deterministic checks complement the separate evidence reviewer. These do not
// claim to establish semantic truth for arbitrary academic content.
export function arithmeticValue(raw) {
  const tokens = raw.replace(/\s/g, '').match(/\d+(?:\.\d+)?|[()+\-*/^]/g) || []
  if (tokens.join('') !== raw.replace(/\s/g, '') || tokens.length > 50)
    return null
  let i = 0
  function atom() {
    if (tokens[i] === '(') {
      i++
      const n = add()
      if (tokens[i++] !== ')') throw new Error()
      return n
    }
    if (!/^\d/.test(tokens[i] || '')) throw new Error()
    return Number(tokens[i++])
  }
  function power() {
    let n = atom()
    if (tokens[i] === '^') {
      i++
      const exponent = unary()
      if (Math.abs(exponent) > 12) throw new Error()
      n = n ** exponent
    }
    return n
  }
  function unary() {
    if (tokens[i] === '-') {
      i++
      return -unary()
    }
    if (tokens[i] === '+') {
      i++
      return unary()
    }
    return power()
  }
  function multiply() {
    let n = unary()
    while (['*', '/'].includes(tokens[i])) {
      const op = tokens[i++],
        right = unary()
      n = op === '*' ? n * right : n / right
    }
    return n
  }
  function add() {
    let n = multiply()
    while (['+', '-'].includes(tokens[i])) {
      const op = tokens[i++],
        right = multiply()
      n = op === '+' ? n + right : n - right
    }
    return n
  }
  try {
    const result = add()
    return i === tokens.length && Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}
// A narrow numeric check, not a general probability solver. Inspect a single
// explicitly stated pair of marginals and a claimed complete intersection range.
export function intersectionRangeIssues(question) {
  const number = String.raw`(?:0?\.\d+|\d+(?:\.\d+)?)(?:\s*/\s*\d+(?:\.\d+)?)?`
  const values = symbol => [...question.question.matchAll(new RegExp(String.raw`P\(\s*${symbol}\s*\)\s*=\s*(${number})`, 'g'))].map(m=>arithmeticValue(m[1]))
  const a = [...new Set(values('A'))], b = [...new Set(values('B'))]
  if(a.length!==1 || b.length!==1 || [...a,...b].some(n=>n===null || n<0 || n>1))return []
  const ranges = [...question.answer.matchAll(new RegExp(String.raw`(?:allowable\s+(?:intersection\s+)?range|intersection\s+range)\s*(?:is|:)?\s*\[\s*(${number})\s*,\s*(${number})\s*\]`, 'gi'))]
  const low = Math.max(0,a[0]+b[0]-1), high = Math.min(a[0],b[0])
  return ranges.some(m=>Math.abs(arithmeticValue(m[1])-low)>1e-8 || Math.abs(arithmeticValue(m[2])-high)>1e-8)
    ? ['The complete intersection range must use both bounds: max(0, P(A)+P(B)-1) and min(P(A), P(B)); check that the union cannot exceed 1.'] : []
}

// A rendering-preflight path names its own item: chapter.questions[3] is that
// question, chapter.sections[1] that section.
function preflightItemKey(chapter, detail) {
  const match = /^chapter\.(questions|sections)\[(\d+)\]/.exec(detail)
  if (!match) return null
  const item = chapter[match[1]]?.[Number(match[2])]
  return match[1] === 'questions' ? (item?.key ? `question:${item.key}` : null) : (item?.id ? `section:${item.id}` : null)
}
// Chapter-level practice invariants with the chapter's current value and
// margin, so a correction can be told how close to a threshold it is.
export const PRACTICE_MIX_MINIMUMS = Object.freeze({ questions: 8, nonRecall: 4, challenge: 2, skills: 3 })
export function practiceMix(chapter) {
  const questions = chapter.questions || []
  const now = { questions: questions.length, nonRecall: questions.filter(q => q.kind !== 'recall').length, challenge: questions.filter(q => q.difficulty === 'challenge').length, skills: new Set(questions.map(q => q.skill)).size }
  return Object.fromEntries(Object.entries(PRACTICE_MIX_MINIMUMS).map(([key, minimum]) => [key, { now: now[key], minimum, margin: now[key] - minimum }]))
}
// Every deterministic lesson rule as a structured finding: a stable rule id,
// the historical detail text (byte for byte), and the owning item when there
// is one. studyLessonQuality below is the unchanged string view of this list.
export function lessonQualityFindings(chapter, evidence = []) {
  const findings = renderingPreflight(chapter).map(detail => {
    const itemKey = preflightItemKey(chapter, detail)
    return { rule: 'render.preflight', detail, ...(itemKey ? { itemKey } : {}) }
  })
  const push = (rule, detail, itemKey = null, extra = {}) => findings.push({ rule, detail, ...(itemKey ? { itemKey } : {}), ...extra })
  const texts = []
  function visit(value) {
    if (!value || typeof value !== 'object') return
    for (const [key, v] of Object.entries(value)) {
      if (
        ['text', 'detail', 'takeaway', 'caption', 'description', 'question', 'answer', 'front', 'back', 'hint', 'mistake', 'explanation', 'goal', 'demonstration', 'teachingApproach'].includes(key) &&
        typeof v === 'string'
      )
        texts.push(v)
      else if (Array.isArray(v)) v.forEach(item => typeof item === 'string' && ['hints', 'gaps', 'exclusions'].includes(key) ? texts.push(item) : visit(item))
      else if (v && typeof v === 'object') visit(v)
    }
  }
  visit(chapter)
  const NULL_CHARACTER = String.fromCharCode(0)
  const hasNullPadding=value=>typeof value==='string' ? value.includes(NULL_CHARACTER) : Array.isArray(value) ? value.some(hasNullPadding) : value && typeof value==='object' ? Object.entries(value).some(([key,item])=>!['factualAudit','evidenceReview','pedagogyAudit','pedagogicalReview','reviewBaseline','reviewFocus'].includes(key) && hasNullPadding(item)) : false
  if(hasNullPadding(chapter))push('text.null-padding', 'The lesson contains null-character corruption. Reconstruct affected text and formulas from the evidence; deleting invisible characters alone may leave missing operators or terms.')
  for (const q of chapter.questions || []) {
    const at = q.key ? `question:${q.key}` : null
    for (const detail of intersectionRangeIssues(q)) push('question.intersection-range', detail, at)
    const choice = ['mc', 'multi', 'tf'].includes(q.type)
    const options = q.options || [], correct = q.correctOptions || []
    if (choice && (options.length < 2 || options.some(o => !o.trim() || /^string\d*$/i.test(o)) || new Set(options).size !== options.length || !correct.length || new Set(correct).size !== correct.length || correct.some(i => !Number.isInteger(i) || i < 0 || i >= options.length) || (q.type !== 'multi' && correct.length !== 1))) push('question.choice-validity', 'Choice questions need distinct usable options and a valid answer key matching their question type.', at)
    if (q.type === 'tf' && JSON.stringify(options) !== '["True","False"]') push('question.tf-options', 'True/false questions must use the options True and False in that order.', at)
    if (!choice && (options.length || correct.length)) push('question.placeholder-choices', 'Written, calculation and pseudocode problems must not carry placeholder choices.', at)
  }
  if ([2, 3].includes(chapter.formatVersion)) {
    const words = value => String(value || '').trim().split(/\s+/).filter(Boolean).length
    for (const section of chapter.sections.filter(s => !s.takeaway)) push('section.takeaway', 'Give each explanation a clear takeaway.', section.id ? `section:${section.id}` : null)
    findings.push(...objectiveCoverageFindings(chapter))
    const visuals = chapter.sections.map(s => s.visual).filter(Boolean)
    if (!visuals.length) push('chapter.visual', 'The chapter needs a useful visual explanation, not only prose.')
    for (const section of chapter.sections) if (section.visual) for (const detail of studyVisualIssues(section.visual)) push('section.visual', detail, section.id ? `section:${section.id}` : null)
    if (chapter.summary.length < 5 || chapter.summary.some(s => words(s.text) < 8 || /this (?:chapter|section) (?:covers|discusses)|revise (?:these|the) topics/i.test(s.text))) push('chapter.summary', 'The summary must explain the core concepts, relationships and conditions.', 'summary')
    const mix = practiceMix(chapter)
    if (Object.values(mix).some(entry => entry.margin < 0)) push('chapter.practice-mix', 'Practice needs varied skills, progressive challenge, useful hints and reasoned solutions covering the learning goals.', null, { mix })
    // A missing hint, objective or reasoned solution belongs to one question:
    // name it, so the finding patches that question instead of forcing a
    // whole-chapter rewrite as an unlocatable chapter-level finding.
    for (const q of chapter.questions) if (!q.hint || !q.objective || (chapter.formatVersion !== 3 && words(q.answer) < 20)) push('question.hint-objective', `${q.key}: Practice needs a useful first hint, a stated objective and a reasoned solution.`, q.key ? `question:${q.key}` : null)
    // Name the offending question or flashcard group. An item-level finding that
    // arrives unscoped cannot be patched and forces a whole-chapter rewrite.
    const offending = (rule, matches, message) => {
      const keys = chapter.questions.filter(q => matches(q.question)).map(q => q.key)
      const cards = [...new Set(chapter.flashcards.map((c, i) => matches(c.front) ? `cards:${Math.floor(i / 4)}` : null).filter(Boolean))]
      for (const key of keys) push(rule, `${key}: ${message}`, `question:${key}`)
      for (const key of cards) push(rule, `${key}: ${message}`, key)
    }
    const administrative = /exam rules?|exam duration|current exam is|how many ects|(?:lecturer|professor).{0,20}name/i
    offending('practice.administrative', text => administrative.test(text), 'Practice and flashcards must test academic concepts, not course administration or exam-policy trivia.')
    const sourceRecall = /\b(?:the|these|this) (?:slides?|lecture)\b|\b(?:what|which|how many)\b[^?]{0,160}\b(?:slides?|lecture|chapter)\b[^?]{0,45}\b(?:say|state|list|mention|name|ask|provide|present)|\b(?:stated|listed|mentioned|named|presented|summari[sz](?:es|ed))\b[^?]{0,100}\b(?:slides?|lecture|chapter)\b|\baccording to (?:the )?(?:slides?|lecture|chapter)\b/i
    offending('practice.source-recall', text => sourceRecall.test(text), 'Ask about the academic concept directly, not what a slide, lecture or chapter says, lists or mentions. Replace source-wording recall with understanding, application or a useful definition.')
    if (chapter.flashcards.length < 10 || new Set(chapter.flashcards.map(f => f.kind)).size < 3
      || new Set(chapter.flashcards.map(f => f.front.trim().toLowerCase())).size !== chapter.flashcards.length) push('chapter.flashcards', 'Flashcards need distinct prompts spanning definitions, contrasts, applications and misconceptions.')
  }
  if (
    chapter.formatVersion !== 3 && (chapter.sections || []).reduce(
      (n, s) => n + `${s.text} ${s.detail || ''} ${(s.callouts || []).map(c => c.text).join(' ')}`.trim().split(/\s+/).length,
      0
    ) < 300
  )
    push('chapter.thin', 'The lesson needs more substantive teaching, including reasoning and a worked example.')
  if (new Set((chapter.questions || []).map((q) => q.question.trim().toLowerCase())).size !== (chapter.questions || []).length)
    push('chapter.repeated-question', 'The exercise set repeats a question.')
  if (!(chapter.questions || []).some((q) => q.kind === 'application' || q.kind === 'exam-style'))
    push('chapter.application', 'The exercise set needs an application question.')
  if (chapter.formatVersion !== 3 && (chapter.questions || []).some((q) => q.answer.trim().split(/\s+/).length < 8))
    push('chapter.reasoned-solutions', 'Each exercise needs a reasoned solution, not just a final answer.')
  const flattened = texts.join('\n')
  if (/<\/?(?:script|iframe|object|embed|style|img|svg|html|body)\b|!\[[^\]]*\]\(/i.test(flattened))
    push('text.unsafe-markup', 'Generated lessons must use safe text and structured components.')
  // Only complete constant equations in inline/display math are evaluated.
  // Variable expressions, units, approximations and scientific notation are
  // left to the evidence reviewer to avoid pretending to be a CAS.
  for (const match of flattened.matchAll(/\$+([^$\n]+)\$+/g)) {
    const equation = match[1].trim().split('=')
    if (equation.length !== 2) continue
    const left = arithmeticValue(equation[0]),
      right = arithmeticValue(equation[1])
    if (left !== null && right !== null && Math.abs(left - right) > 1e-8 * Math.max(1, Math.abs(left), Math.abs(right)))
      push('text.arithmetic', `Check the arithmetic: ${match[1].slice(0, 120)}`)
  }
  // Long verbatim copies defeat the teaching derivative and sharing contract.
  const normalize = (value) =>
    String(value)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean)
  const sourceWindows = new Set()
  for (const source of evidence) {
    const words = normalize(source.text)
    for (let i = 0; i + 60 <= words.length; i += 1)
      sourceWindows.add(words.slice(i, i + 60).join(' '))
  }
  for (const text of texts) {
    const words = normalize(text)
    for (let i = 0; i + 60 <= words.length; i++)
      if (sourceWindows.has(words.slice(i, i + 60).join(' '))) {
        push('text.copied-source', 'A long source passage was copied instead of explained.')
        break
      }
  }
  return findings
}
export function studyLessonQuality(chapter, evidence = []) {
  return [...new Set(lessonQualityFindings(chapter, evidence).map(finding => finding.detail))]
}
