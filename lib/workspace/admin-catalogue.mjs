export function programmeEditPayload(programmeId, source) {
  let value
  try { value = typeof source === 'string' ? JSON.parse(source) : structuredClone(source) }
  catch { throw new Error('Programme JSON is not valid JSON.') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Programme JSON must be an object.')
  if (!String(value.name || '').trim()) throw new Error('The programme needs a name.')
  if (!Array.isArray(value.versions)) throw new Error('The programme needs a versions array.')
  for (const [index, version] of value.versions.entries()) {
    if (!version?.id || !Array.isArray(version.courses)) throw new Error(`Version ${index + 1} needs an id and courses array.`)
  }
  return { ...value, id: programmeId }
}

export function programmeCounts(programme) {
  const versions = programme?.versions ?? []
  const ids = new Set(versions.flatMap((version) => (version.courses ?? []).map((course) => course.id || course.code).filter(Boolean)))
  return { versions: versions.length, courses: ids.size, dates: (programme?.calendar ?? []).length }
}
