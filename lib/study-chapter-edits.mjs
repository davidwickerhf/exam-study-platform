// Explicit text-only fields shared by the editor and API. Citation IDs, visual
// specifications, evidence, review badges and ownership never come from a patch.
export function chapterEditFields(chapter) {
  const fields = []
  const add = (key, label, text) => { if (typeof text === 'string') fields.push({ key, label, text }) }
  chapter.sections.forEach((section, i) => {
    add(`sections.${i}.text`, `${section.title} · Explanation`, section.text)
    add(`sections.${i}.takeaway`, `${section.title} · Takeaway`, section.takeaway)
    add(`sections.${i}.detail`, `${section.title} · Go deeper`, section.detail)
    section.callouts?.forEach((c, j) => add(`sections.${i}.callouts.${j}.text`, `${section.title} · ${c.title}`, c.text))
  })
  chapter.summary.forEach((s, i) => add(`summary.${i}.text`, `Summary · Point ${i + 1}`, s.text))
  chapter.questions.forEach((q, i) => {
    for (const field of ['question', 'answer', 'hint']) add(`questions.${i}.${field}`, `Practice ${i + 1} · ${field}`, q[field])
  })
  chapter.flashcards.forEach((c, i) => {
    for (const field of ['front', 'back']) add(`flashcards.${i}.${field}`, `Flashcard ${i + 1} · ${field}`, c[field])
  })
  return fields
}
export function chapterTextChanges(before, after) {
  const old = new Map(chapterEditFields(before).map(f => [f.key, f]))
  const next = new Map(chapterEditFields(after).map(f => [f.key, f]))
  return [...new Set([...old.keys(), ...next.keys()])].flatMap(key => {
    const a = old.get(key), b = next.get(key)
    return a?.text === b?.text ? [] : [{ key, label: b?.label || a.label, before: a?.text || '', after: b?.text || '' }]
  })
}
