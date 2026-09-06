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
        ['text', 'question', 'answer', 'front', 'back'].includes(key) &&
        typeof v === 'string'
      )
        texts.push(v)
      else if (Array.isArray(v)) v.forEach(visit)
      else if (v && typeof v === 'object') visit(v)
    }
  }
  visit(chapter)
  if (
    (chapter.sections || []).reduce(
      (n, s) => n + s.text.trim().split(/\s+/).length,
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
