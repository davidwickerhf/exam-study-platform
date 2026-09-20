// This scanner only identifies duplicate object keys; JSON.parse remains the
// grammar authority. Escaped key spellings are compared after decoding.
export function parseUniqueJson(text) {
  const tokens=text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g) || []
  const stack=[]
  for(let i=0;i<tokens.length;i++) {
    const token=tokens[i]
    if(token==='{' || token==='[')stack.push(token==='{'?new Set():null)
    else if(token==='}' || token===']')stack.pop()
    else if(token.startsWith('"') && tokens[i+1]===':' && stack.at(-1) instanceof Set) {
      const key=JSON.parse(token)
      if(stack.at(-1).has(key))throw new Error('duplicate JSON object key')
      stack.at(-1).add(key)
    }
  }
  return JSON.parse(text)
}
export function renderingPreflight(chapter) {
  const issues=[]
  const visit=(value,path)=>{
    if(typeof value==='string') {
      if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b\u202a-\u202e\u2066-\u2069\ufeff]/u.test(value))issues.push(`${path}: invisible control character; reconstruct the affected notation from its source.`)
      if(/\t(?:imes|ext\{|heta\b)|\r(?:ight|ho)\b|\n(?:abla|eq)\b|\\\\(?:frac|times|text|mathcal|rightarrow|sum|qquad)\b/.test(value))issues.push(`${path}: malformed LaTeX escape; verify the decoded command and its operands.`)
    } else if(Array.isArray(value))value.forEach((v,i)=>visit(v,`${path}[${i}]`))
    else if(value && typeof value==='object')for(const [key,item] of Object.entries(value))if(!['factualAudit','evidenceReview','pedagogyAudit','pedagogicalReview'].includes(key))visit(item,`${path}.${key}`)
  }
  visit(chapter,'chapter')
  for(const [field,key] of [['questions','key'],['sections','id']]) {
    const seen=new Set()
    for(const [i,item] of (chapter[field]||[]).entries()) {
      if(seen.has(item[key]))issues.push(`chapter.${field}[${i}].${key}: duplicate identity.`)
      seen.add(item[key])
    }
  }
  return issues
}
// DETERMINISTIC PROSE-COHERENCE REPAIR. A teaching-plan gap/exclusion entry
// and a chapter caveat are free prose written by the model (the objective
// plan is produced by its own earlier call and copied onto every draft and
// correction of the chapter). A generation can leave a fragment of the JSON
// scaffolding itself inside one of those strings — observed in a hosted
// pilot as a gaps entry reading exactly `prerequisites”:”: [    {`, curly
// quotes included. Nothing downstream can teach from such an entry, but the
// paid reviewers CAN see it: they flagged it as an error every round, and
// each round bought a whole-chapter correction that had no way to fix a
// string it was not asked to rewrite. Detect that class deterministically
// and repair or drop it before any review call, the same way
// stripUnsupportedEvidenceIds removes internal identifiers from the same
// fields. Rules are conservative by construction: ordinary prose punctuation
// (a quoted phrase, a colon, parentheses, a bracketed citation) is coherent
// and must be left byte-identical; only structurally broken text — a
// quote-colon-quote key fragment, unbalanced brackets or double quotes, a
// JSON opener at the start, or an entry truncated on an opening bracket or a
// trailing comma — is touched. A repair only ever deletes corrupt scaffolding
// characters; if what survives is not a sentence in its own right the entry
// is dropped rather than sent on, because a paid reviewer must never be shown
// corrupt text.
// `":"`-style key punctuation: a double quote (straight or curly) closing on
// a colon that is followed by another quote, a JSON opener, or nothing at
// all. Deliberately NOT matched: `the term "affordance": a property of…`,
// where the colon introduces ordinary prose.
const JSON_KEY_FRAGMENT = /["“”]\s*:\s*(?:["“”]|[[{]|$)/
const JSON_OPENER_START = /^\s*[[{]/
const TRUNCATED_TAIL = /[[{(,]\s*$/
const OPENERS = { '(': ')', '[': ']', '{': '}' }
const CLOSERS = { ')': '(', ']': '[', '}': '{' }
function unmatchedBracketIndexes(text) {
  const chars = [...text], stack = [], stray = new Set()
  for (const [index, char] of chars.entries()) {
    if (OPENERS[char]) stack.push(index)
    else if (CLOSERS[char]) {
      let matched = false
      while (stack.length) {
        const open = stack.pop()
        if (chars[open] === CLOSERS[char]) { matched = true; break }
        stray.add(open)
      }
      if (!matched) stray.add(index)
    }
  }
  for (const open of stack) stray.add(open)
  return stray
}
function quotesUnbalanced(text) {
  const count = pattern => (text.match(pattern) || []).length
  return count(/"/g) % 2 === 1 || count(/“/g) !== count(/”/g)
}
// The reason this entry is not coherent prose, or null when it is fine.
export function incoherentProseReason(entry) {
  if (typeof entry !== 'string') return null
  const text = entry.trim()
  if (!text) return null
  if (JSON_KEY_FRAGMENT.test(text)) return 'stray JSON key punctuation'
  if (JSON_OPENER_START.test(text)) return 'JSON fragment'
  if (unmatchedBracketIndexes(text).size) return 'unbalanced brackets'
  if (quotesUnbalanced(text)) return 'unbalanced quotes'
  if (TRUNCATED_TAIL.test(text)) return 'truncated entry'
  return null
}
function dropUnmatchedBrackets(text) {
  const stray = unmatchedBracketIndexes(text)
  return stray.size ? [...text].filter((_, index) => !stray.has(index)).join('') : text
}
function dropUnmatchedQuotes(text) {
  let out = text
  const count = (value, pattern) => (value.match(pattern) || []).length
  if (count(out, /"/g) % 2 === 1) out = out.replace(/"(?=[^"]*$)/, '')
  while (count(out, /”/g) > count(out, /“/g)) out = out.replace(/”(?=[^”]*$)/, '')
  while (count(out, /“/g) > count(out, /”/g)) out = out.replace(/“(?=[^“]*$)/, '')
  return out
}
function tidyProse(text) {
  return text
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;:.)\]}]+/, '')
    .replace(/[\s,;:([{]+$/, '')
    .trim()
}
// A repaired entry is only accepted when it stands on its own as prose: a
// stub of two or three surviving words is not a gap statement and is dropped.
function coherentSentence(text) {
  return Boolean(text) && !incoherentProseReason(text) && /[A-Za-z]/.test(text) && text.split(/\s+/).filter(word => /[A-Za-z]/.test(word)).length >= 4
}
function repairProseEntry(entry) {
  let text = entry
  const fragment = text.match(JSON_KEY_FRAGMENT)
  // Cut the scaffolding tail at the fragment, then remove the bare key name
  // that introduced it (`prerequisites` in `prerequisites”:”: [ {`). Only a
  // single unspaced token is removed: surrounding prose is never touched.
  if (fragment) text = text.slice(0, fragment.index).replace(/["“”']?\s*$/, '').replace(/[\w'’-]+$/, '')
  text = tidyProse(dropUnmatchedQuotes(dropUnmatchedBrackets(text.replace(JSON_OPENER_START, ''))))
  return coherentSentence(text) && text !== entry ? text : null
}
function repairProseList(list, field, repairs) {
  if (!Array.isArray(list)) return list
  let changed = false
  const next = []
  for (const [index, entry] of list.entries()) {
    const reason = incoherentProseReason(entry)
    if (!reason) {
      next.push(entry)
      continue
    }
    changed = true
    const repaired = repairProseEntry(entry)
    if (repaired) {
      repairs.push({ field, index, reason })
      next.push(repaired)
    } else repairs.push({ field, index, reason, dropped: true })
  }
  return changed ? next : list
}
// Repair (or drop) every incoherent caveat / teaching-plan gap / exclusion on
// a chapter, recording each action on chapter.proseRepairs — the same
// visibility the evidenceIdRepairs and linkRepairs lists give. Returns the
// chapter unchanged (same reference) when every entry is already coherent.
export function repairIncoherentProse(chapter) {
  const repairs = []
  const caveats = repairProseList(chapter.caveats, 'caveats', repairs)
  const plan = chapter.teachingPlan
  const gaps = plan ? repairProseList(plan.gaps, 'teachingPlan.gaps', repairs) : undefined
  const exclusions = plan ? repairProseList(plan.exclusions, 'teachingPlan.exclusions', repairs) : undefined
  if (!repairs.length) return chapter
  return {
    ...chapter,
    ...(caveats !== chapter.caveats ? { caveats } : {}),
    ...(plan && (gaps !== plan.gaps || exclusions !== plan.exclusions)
      ? { teachingPlan: { ...plan, ...(gaps !== plan.gaps ? { gaps } : {}), ...(exclusions !== plan.exclusions ? { exclusions } : {}) } }
      : {}),
    proseRepairs: [...(chapter.proseRepairs || []), ...repairs]
  }
}
// The corrupt entries a chapter is carrying right now, used both to decide
// whether anything is left to repair and to recognise a review finding that
// quotes one of them verbatim.
export function incoherentProseEntries(chapter) {
  return [chapter.caveats, chapter.teachingPlan?.gaps, chapter.teachingPlan?.exclusions]
    .flatMap(list => (Array.isArray(list) ? list : []))
    .filter(entry => incoherentProseReason(entry))
}
export function incoherentProseRemains(chapter) {
  return incoherentProseEntries(chapter).length > 0
}
// Recognise a review finding whose complaint is exactly this corruption, so a
// free recovery can tell it apart from a genuine teaching problem. A finding
// that quotes the corrupt entry itself is unambiguous; otherwise the finding
// must BOTH describe corrupt/malformed/truncated text AND name one of the
// three fields this repair owns, so an unrelated complaint about, say, a
// truncated worked example is never cleared for free.
const CORRUPT_PROSE_COMPLAINT = /malformed JSON|invalid JSON|JSON fragment|corrupt|stray (?:JSON|text|characters|punctuation)|truncat|unbalanced|not (?:coherent|valid) (?:prose|text)/i
const CORRUPT_PROSE_FIELD = /\bgaps?\b|\bcaveats?\b|\bexclusions?\b|teaching[ -]?plan/i
export function corruptProseFindingMatcher(chapter) {
  const quoted = incoherentProseEntries(chapter).map(entry => entry.trim()).filter(entry => entry.length >= 8)
  return issue => {
    const detail = String(issue?.detail || '')
    if (quoted.some(entry => detail.includes(entry))) return true
    return CORRUPT_PROSE_COMPLAINT.test(detail) && CORRUPT_PROSE_FIELD.test(detail)
  }
}
