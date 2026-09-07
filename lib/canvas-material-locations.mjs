// A single file can occur in several modules or assignments. Keep every
// placement while retaining one original and one search index.
export function materialLocations(records, path) {
  const locations=new Map()
  for(const record of records.filter(r=>r.path===path || r.target===path)) {
    const s=record.source || {}
    if(!s.moduleId && !s.assignmentId) continue
    const value={moduleId:s.moduleId || null,moduleName:s.moduleName || null,modulePosition:s.modulePosition ?? null,
      itemPosition:s.itemPosition ?? null,assignmentId:s.assignmentId || null,assignmentTitle:s.assignmentTitle || null}
    locations.set(JSON.stringify(value),value)
  }
  return [...locations.values()]
}
export function materialModuleNames(material) {
  const explicit=(material.locations || []).filter(l=>l.moduleName).sort((a,b)=>(a.modulePosition??999)-(b.modulePosition??999)).map(l=>l.moduleName)
  if(explicit.length)return [...new Set(explicit)]
  // Existing imports encoded the original module in their path.
  const match=String(material.sourcePath || '').match(/(?:^|\/)modules\/\d+ (.+?)--module-[^/]+\//)
  return match ? [match[1]] : []
}
