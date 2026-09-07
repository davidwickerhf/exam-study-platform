// A newer unfinished extraction must not hide a checked older question set.
export function paperSelection(sets, jobs, key, selectedId) {
  const matches = sets.filter(s => s.questionSourceKey === key)
  const job = jobs.find(j => j.sourceKey === key)
  const chosen = matches.find(s => s.id === selectedId)
    || matches.find(s => s.id === job?.setId && s.status === 'complete' && s.questionCount > 0)
    || matches.find(s => s.status === 'complete' && s.questionCount > 0)
    || matches[0]
  return { sets: matches, job, chosen, ready: chosen?.status === 'complete' && chosen.questionCount > 0 ? chosen : undefined }
}
export function paperReadiness(ready, job) {
  if (ready) {
    const checked = job?.setId === ready.id && job.status === 'complete'
    return `${ready.questionCount} ${ready.questionCount === 1 ? 'question' : 'questions'} ready${checked ? '' : ' · selected pages'}`
  }
  if (job?.status === 'paused') return 'Questions paused'
  if (job?.status === 'running') return 'Preparing questions'
  if (job?.status === 'queued') return 'Questions queued'
  if (job?.status === 'complete') return 'No questions found'
  return 'Waiting for preparation'
}
