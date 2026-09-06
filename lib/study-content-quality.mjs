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
export function studyLessonQuality(chapter, evidence = []) {
  const issues = [],
    texts = []
  function visit(value) {
    if (!value || typeof value !== 'object') return
    for (const [key, v] of Object.entries(value)) {
      if (
        ['text', 'detail', 'takeaway', 'caption', 'description', 'question', 'answer', 'front', 'back', 'hint'].includes(key) &&
        typeof v === 'string'
      )
        texts.push(v)
      else if (Array.isArray(v)) v.forEach(visit)
      else if (v && typeof v === 'object') visit(v)
    }
  }
  visit(chapter)
  if (chapter.formatVersion === 2) {
    const words = value => String(value || '').trim().split(/\s+/).filter(Boolean).length
    if (chapter.sections.some(s => words(s.text) > 140 || !s.takeaway)) issues.push('Keep each main explanation concise and give it a clear takeaway; put depth in the expandable detail.')
    const visuals = chapter.sections.map(s => s.visual).filter(Boolean)
    if (!visuals.length) issues.push('The chapter needs a useful visual explanation, not only prose.')
    for (const visual of visuals) issues.push(...studyVisualIssues(visual))
    if (chapter.summary.length < 5 || chapter.summary.some(s => words(s.text) < 8 || /this (?:chapter|section) (?:covers|discusses)|revise (?:these|the) topics/i.test(s.text))) issues.push('The summary must explain the core concepts, relationships and conditions.')
    if (chapter.questions.length < 8 || chapter.questions.filter(q => q.kind !== 'recall').length < 4
      || chapter.questions.filter(q => q.difficulty === 'challenge').length < 2
      || new Set(chapter.questions.map(q => q.skill)).size < 3
      || chapter.questions.some(q => !q.hint || !q.objective || words(q.answer) < 20)) issues.push('Practice needs varied skills, progressive challenge, useful hints and reasoned solutions covering the learning goals.')
    const administrative = /exam rules?|exam duration|current exam is|how many ects|(?:lecturer|professor).{0,20}name/i
    if (chapter.questions.some(q => administrative.test(q.question)) || chapter.flashcards.some(c => administrative.test(c.front))) issues.push('Practice and flashcards must test academic concepts, not course administration or exam-policy trivia.')
    const sourceRecall = /\b(?:what|which|how many)\b[^?]{0,160}\b(?:slides?|lecture|chapter)\b[^?]{0,45}\b(?:say|state|list|mention|name|ask|provide|present)|\b(?:stated|listed|mentioned|named|presented|summari[sz](?:es|ed))\b[^?]{0,100}\b(?:slides?|lecture|chapter)\b|\baccording to (?:the )?(?:slides?|lecture|chapter)\b/i
    if (chapter.questions.some(q => sourceRecall.test(q.question)) || chapter.flashcards.some(c => sourceRecall.test(c.front))) issues.push('Ask about the academic concept directly, not what a slide, lecture or chapter says, lists or mentions. Replace source-wording recall with understanding, application or a useful definition.')
    if (chapter.flashcards.length < 10 || new Set(chapter.flashcards.map(f => f.kind)).size < 3
      || new Set(chapter.flashcards.map(f => f.front.trim().toLowerCase())).size !== chapter.flashcards.length) issues.push('Flashcards need distinct prompts spanning definitions, contrasts, applications and misconceptions.')
  }
  if (
    (chapter.sections || []).reduce(
      (n, s) => n + `${s.text} ${s.detail || ''} ${(s.callouts || []).map(c => c.text).join(' ')}`.trim().split(/\s+/).length,
      0
    ) < 300
  )
    issues.push(
      'The lesson needs more substantive teaching, including reasoning and a worked example.'
    )
  if (
    new Set(
      (chapter.questions || []).map((q) => q.question.trim().toLowerCase())
    ).size !== (chapter.questions || []).length
  )
    issues.push('The exercise set repeats a question.')
  if (
    !(chapter.questions || []).some(
      (q) => q.kind === 'application' || q.kind === 'exam-style'
    )
  )
    issues.push('The exercise set needs an application question.')
  if (
    (chapter.questions || []).some(
      (q) => q.answer.trim().split(/\s+/).length < 8
    )
  )
    issues.push(
      'Each exercise needs a reasoned solution, not just a final answer.'
    )
  const flattened = texts.join('\n')
  if (
    /<\/?(?:script|iframe|object|embed|style|img|svg|html|body)\b|!\[[^\]]*\]\(/i.test(
      flattened
    )
  )
    issues.push(
      'Generated lessons must use safe text and structured components.'
    )
  // Only complete constant equations in inline/display math are evaluated.
  // Variable expressions, units, approximations and scientific notation are
  // left to the evidence reviewer to avoid pretending to be a CAS.
  for (const match of flattened.matchAll(/\$+([^$\n]+)\$+/g)) {
    const equation = match[1].trim().split('=')
    if (equation.length !== 2) continue
    const left = arithmeticValue(equation[0]),
      right = arithmeticValue(equation[1])
    if (
      left !== null &&
      right !== null &&
      Math.abs(left - right) >
        1e-8 * Math.max(1, Math.abs(left), Math.abs(right))
    )
      issues.push(`Check the arithmetic: ${match[1].slice(0, 120)}`)
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
        issues.push('A long source passage was copied instead of explained.')
        break
      }
  }
  return [...new Set(issues)]
}
