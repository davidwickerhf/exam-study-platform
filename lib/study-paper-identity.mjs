const courseValue = value => String(value || '').trim().toLowerCase()

export function paperKind(source) {
  const title = String(source.title || '').replace(/[_-]/g, ' ')
  if (!/\.pdf$/i.test(title)) return null
  if (/\b(solution|solutions|answer|answers|marking|rubric)\b/i.test(title))
    return 'solutions'
  if (
    /exam|past.*question|practice.*question|sample.*question|mock|relevant.*qus|\b(?:resit|final)\b|\b[fs]\d{2,4}\s+t\d+\b/i.test(
      title,
    )
  )
    return 'paper'
  if (/tutorial|exercise|assignment|problem.*set/i.test(title))
    return 'exercises'
  return null
}

export function sameCourseEdition(left, right) {
  const leftPeriod = courseValue(left?.period)
  const rightPeriod = courseValue(right?.period)
  return (
    courseValue(left?.courseCode) === courseValue(right?.courseCode) &&
    courseValue(left?.academicYear) === courseValue(right?.academicYear) &&
    (!leftPeriod || !rightPeriod || leftPeriod === rightPeriod)
  )
}

export function canonicalPaperIdentity(source) {
  return source.sha256 ? `sha256:${source.sha256}` : `source:${source.key}`
}

function uniqueObjects(values) {
  const seen = new Set()
  return values.filter(value => {
    const key = JSON.stringify(value)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const kindRank = { solutions: 3, paper: 2, exercises: 1 }

export function deduplicatePaperSources(sources, retainedKeys = new Set()) {
  const groups = new Map()
  for (const source of sources) {
    const identity = canonicalPaperIdentity(source)
    if (!groups.has(identity)) groups.set(identity, [])
    groups.get(identity).push(source)
  }
  const papers = []
  for (const group of groups.values()) {
    const classified = group
      .map(source => ({ source, kind: paperKind(source) }))
      .filter(item => item.kind)
      .sort((a, b) => kindRank[b.kind] - kindRank[a.kind])
    if (!classified.length && !group.some(source => retainedKeys.has(source.key)))
      continue
    const kind = classified[0]?.kind || 'paper'
    const representative =
      classified.find(item => item.kind === kind)?.source || group[0]
    papers.push({
      ...representative,
      paperKind: kind,
      sourceKeys: [...new Set(group.map(source => source.key))],
      locations: uniqueObjects(group.flatMap(source => source.locations || [])),
      provenance: group.map(source => ({
        key: source.key,
        title: source.title,
        sourcePath: source.sourcePath,
        url: source.url,
        locations: source.locations || [],
      })),
    })
  }
  return papers
}

const statusRank = { complete: 4, running: 3, queued: 2, paused: 1 }

export function preferredPaperJob(jobs) {
  return [...jobs].sort((left, right) =>
    Number(right.status === 'complete') - Number(left.status === 'complete') ||
    Number(right.completedSections || 0) - Number(left.completedSections || 0) ||
    (statusRank[right.status] || 0) - (statusRank[left.status] || 0) ||
    Number(right.sections?.length || 0) - Number(left.sections?.length || 0) ||
    String(right.updatedAt || right.createdAt || '').localeCompare(
      String(left.updatedAt || left.createdAt || ''),
    ) ||
    String(left.id).localeCompare(String(right.id)),
  )[0]
}

export function deduplicatePaperJobs(jobs) {
  const groups = new Map()
  for (const job of jobs) {
    const identity = canonicalPaperIdentity({
      key: job.sourceKey,
      sha256: job.sha256,
    })
    if (!groups.has(identity)) groups.set(identity, [])
    groups.get(identity).push(job)
  }
  return [...groups.values()].map(preferredPaperJob)
}
