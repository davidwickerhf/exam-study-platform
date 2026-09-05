const codeKey = value => String(value || '').trim().toUpperCase()
const yearKey = value => String(value || '').replace(/[–—]/g, '-').replace(/^(20\d{2})\/(\d{2})$/, (_, year, end) => `${year}-${year.slice(0, 2)}${end}`)

// Current obligations must never inherit a retaken course's older syllabus.
export function programmePriorityCourses(workspace, editorial = [], scans = []) {
  const year = yearKey(workspace?.profile?.academicYear)
  const byCode = new Map()
  for (const scan of [...scans].sort((a, b) => String(b.scannedAt).localeCompare(String(a.scannedAt)))) {
    if (!year || yearKey(scan.academicYear) !== year || byCode.has(codeKey(scan.courseCode))) continue
    byCode.set(codeKey(scan.courseCode), scan)
  }
  return (workspace?.courses || []).filter(course => course.code && !course.hiddenFromStats).map(course => {
    const published = editorial.find(item => codeKey(item.code) === codeKey(course.code))
    const scan = byCode.get(codeKey(course.code))
    return { id: published?.id || course.code, code: course.code, name: course.name,
      archived: published?.archived || false,
      courseProfile: scan?.courseProfile || published?.courseProfile || null,
      ...(scan ? { priorityScan: { status: scan.status, conflicts: scan.conflicts, scannedAt: scan.scannedAt, academicYear: scan.academicYear } } : {}) }
  })
}
