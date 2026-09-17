import {fileKind} from './course-file-types.mjs'
import {outlineCandidates,conceptKey,outlineRejection,MAX_BUNDLE_GUIDES} from './study-version-content.mjs'

// AUTOMATIC COURSE SCOPE AND GRANULARITY POLICY (whole-course bundles).
// The student never chooses scope or chapter granularity. The current edition's
// own syllabus, learning outcomes, announcements and slides decide what is
// assessed; the planner assigns every mapped concept one role:
//  - core: assessed in the current edition; taught in a chapter.
//  - supporting: prerequisite or practical/project material (code, archives,
//    datasets) needed for assessed work; attached to the core chapter that needs
//    it, or gathered into at most one compact reference chapter per guide.
//  - excluded: outside current-edition scope; needs a reason and a citation of
//    current scope context or current-edition evidence, is capped at a bounded
//    share of the mapped concepts, and is shown to students as a scope note.
// The chapter budget is derived deterministically from core teaching evidence
// only, so bulky implementation code no longer multiplies chapters. Review,
// citation and teaching standards are unchanged; a breach is a correctable
// outline rejection, never a silent cut.
export const COURSE_BUNDLE_PLANNING_POLICY='scope-roles-v1'
// On the first measured whole-course plan (IUI, 320 mapped concepts) 45% of
// concepts had only historical lecture evidence and 36% only code/archive
// evidence. Code belongs in `supporting`, so an exclusion share above 35% means
// the planner is dodging coverage rather than applying a cited scope decision.
export const EXCLUDED_CONCEPT_SHARE_LIMIT=0.35
// About one and a half current lecture decks (the measured current-edition PDF
// average is ~22k extracted characters) per thorough teaching unit.
export const CORE_CHARACTERS_PER_CHAPTER=36000
// Bin-packing slack over the hard evidence-capacity minimum.
export const CHAPTER_PACKING_SLACK=1.25
export const COURSE_CHAPTER_CAP=60
export const MIN_COURSE_CHAPTERS=6
export const BUNDLE_GUIDE_CHAPTER_MIN=3
export const BUNDLE_GUIDE_CHAPTER_MAX=10
export const SUPPORTING_CHAPTERS_PER_GUIDE=1

export function practicalSource(source){
 const path=String(source?.sourcePath||source?.title||'')
 return ['archive','code','spreadsheet'].includes(fileKind(path)) || /\.bin$/i.test(path)
}
export function currentSource(source,course){
 return !!source && !source.historical && (!course?.academicYear || !source.academicYear || source.academicYear===course.academicYear)
}
// Deterministic planning arithmetic from the snapshot, the accepted maps and the
// shared outline capacity. Plain data: it is recomputed, never trusted from a draft.
export function courseBundlePolicy(snapshot,course,maps,capacity){
 const sources=new Map(snapshot.sources.map(s=>[s.key,s])),chunks=new Map(snapshot.chunks.map(c=>[c.id,c]))
 const scopeIds=new Set(capacity?.scopeEvidenceIds||[])
 const classOf=chunk=>{
  if(scopeIds.has(chunk.id))return 'scope'
  const source=sources.get(chunk.sourceKey)
  return practicalSource(source)?'practical':currentSource(source,course)?'current':'historical'
 }
 const classes=new Map(snapshot.chunks.map(c=>[c.id,classOf(c)]))
 const evidenceClasses={current:[],'historical-only':[],'practical-only':[],'scope-only':[]},core=new Set()
 for(const item of outlineCandidates(maps)){
  const ids=item.sourceIds.filter(id=>chunks.has(id)),of=kind=>ids.filter(id=>classes.get(id)===kind)
  const current=of('current'),historical=of('historical'),practical=of('practical')
  evidenceClasses[current.length?'current':historical.length?'historical-only':practical.length?'practical-only':'scope-only'].push(item.ref)
  for(const id of current.length?current:historical)core.add(id)
 }
 const size=ids=>[...ids].reduce((n,id)=>n+chunks.get(id).text.length,0)
 const coreTeachingCharacters=size(core)
 const practicalCharacters=size(snapshot.chunks.filter(c=>classes.get(c.id)==='practical').map(c=>c.id))
 const available=capacity?.availableChapterCharacters ?? Math.max(0,(capacity?.chapterEvidenceCharacters||0)-(capacity?.scopeCharacters||0))
 const capacityMinimumChapters=available>0?Math.ceil(coreTeachingCharacters/available):0
 const proportional=Math.max(Math.ceil(coreTeachingCharacters/CORE_CHARACTERS_PER_CHAPTER),available>0?Math.ceil(CHAPTER_PACKING_SLACK*coreTeachingCharacters/available):0)
 // Never below what the core evidence physically needs: an assessed concept is
 // not cut to meet the cap.
 const courseChapterBudget=Math.max(capacityMinimumChapters,Math.min(COURSE_CHAPTER_CAP,Math.max(MIN_COURSE_CHAPTERS,proportional)))
 const totalConcepts=outlineCandidates(maps).length
 return {version:COURSE_BUNDLE_PLANNING_POLICY,scopeEvidenceIds:[...scopeIds],
  // An exclusion rests on scope context or current-edition lecture material, never on code.
  currentEvidenceIds:snapshot.chunks.filter(c=>['scope','current'].includes(classes.get(c.id))).map(c=>c.id),
  practicalSourceKeys:snapshot.sources.filter(practicalSource).map(s=>s.key),currentSourceKeys:snapshot.sources.filter(s=>currentSource(s,course)).map(s=>s.key),
  evidenceClasses,coreTeachingCharacters,practicalCharacters,availableChapterCharacters:available,capacityMinimumChapters,
  charactersPerChapter:CORE_CHARACTERS_PER_CHAPTER,courseChapterBudget,courseChapterCap:COURSE_CHAPTER_CAP,
  // A course whose core evidence physically needs more than 12 x 10 chapters
  // widens the per-guide range rather than becoming unplannable.
  guideChapterMin:BUNDLE_GUIDE_CHAPTER_MIN,guideChapterMax:Math.max(BUNDLE_GUIDE_CHAPTER_MAX,Math.ceil(courseChapterBudget/MAX_BUNDLE_GUIDES)),supportingChaptersPerGuide:SUPPORTING_CHAPTERS_PER_GUIDE,
  excludedShareLimit:EXCLUDED_CONCEPT_SHARE_LIMIT,totalConcepts,maxExcludedConcepts:Math.floor(totalConcepts*EXCLUDED_CONCEPT_SHARE_LIMIT)}
}
export function budgetSummary(policy){
 return {course:policy.courseChapterBudget,guideMin:policy.guideChapterMin,guideMax:policy.guideChapterMax,coreTeachingCharacters:policy.coreTeachingCharacters,
  practicalCharacters:policy.practicalCharacters,charactersPerChapter:policy.charactersPerChapter,capacityMinimumChapters:policy.capacityMinimumChapters,cap:policy.courseChapterCap}
}
export function scopePolicyPrompt(policy){
 const pct=Math.round(policy.excludedShareLimit*100)
 return `\nAUTOMATIC SCOPE AND CHAPTER POLICY (decided for every course; the student is never asked to choose). The current edition's own syllabus, learning outcomes, announcements and slides determine what is assessed; the shared scope context is capacity.scopeEvidenceIds. Give EVERY mapped ref exactly one role:
- core: assessed in the current edition. Put it in a chapter's topicRefs (chapter role "core").
- supporting: a prerequisite or practical/project material (implementation code, project archives, datasets, lab solutions) needed to understand or do assessed work. Attach it to the core chapter that needs it through that chapter's supportingRefs, or gather it into at most ${policy.supportingChaptersPerGuide} compact practical/reference chapter per guide (chapter role "supporting", refs in topicRefs). Never make one chapter per implementation pattern.
- excluded: not in current-edition scope: only historical with no current counterpart, explicitly excluded by a current notice, purely administrative, or project internals such as build files and generated assets. List it in excluded:[{topicRefs,reason,scopeSourceIds}] with a specific reason and at least one scopeSourceIds id from the scope context or current-edition evidence that the decision rests on. Excluded refs count as covered and are shown to students as scope notes. At most ${pct}% of mapped refs (${policy.maxExcludedConcepts} of ${policy.totalConcepts}) may be excluded; when unsure, choose supporting, never excluded. Never exclude a concept that another chapter teaches.
Evidence classes of the mapped refs (server-derived from source year and file type): ${JSON.stringify(policy.evidenceClasses)}. Historical material explains current concepts provisionally; it never adds current assessment requirements.
CHAPTER BUDGET. Chapters are teaching units that may combine several closely related core concepts. This course may hold at most ${policy.courseChapterBudget} chapters in total after the server's evidence split, and each guide should hold ${policy.guideChapterMin}-${policy.guideChapterMax} chapters (at most ${policy.guideChapterMax}); choose the number of guides accordingly. The budget is derived from ${policy.coreTeachingCharacters} characters of core teaching evidence (current-edition lecture evidence, or historical lecture evidence for concepts without current evidence; the ${policy.practicalCharacters} characters of code, archives and datasets are excluded): one chapter per about ${policy.charactersPerChapter} characters, never below the ${policy.capacityMinimumChapters} chapters the evidence capacity requires, capped at ${policy.courseChapterCap}. One chapter carries at most ${policy.availableChapterCharacters} characters of core evidence; core evidence beyond that is split into “· Part N” chapters that count against the budget. Supporting evidence never causes a split: it fills a chapter's remaining capacity by relevance and the rest is trimmed and recorded. Thoroughness is unchanged: do not cut, merge away or exclude an assessed concept to meet the budget; combine related concepts into coherent units instead.`
}
function issueDetailList(items,limit=8){return items.slice(0,limit).join(', ')+(items.length>limit?` and ${items.length-limit} more`:'')}
// Role and exclusion checks on a bundle proposal. Returns the excluded entries
// (with titles) to treat as covered; throws a correctable rejection otherwise.
export function validateScopeRoles(result,maps,policy){
 const candidates=new Map(outlineCandidates(maps).map(item=>[item.ref,item])),issues=[]
 for(const guide of result.guides){
  const supporting=guide.topics.filter(topic=>topic.role==='supporting')
  if(supporting.length>SUPPORTING_CHAPTERS_PER_GUIDE)issues.push({kind:'supporting-chapter-limit',guideId:guide.id,count:supporting.length,limit:SUPPORTING_CHAPTERS_PER_GUIDE,
   detail:`Guide “${guide.id}” has ${supporting.length} supporting chapters (${issueDetailList(supporting.map(t=>t.id))}); at most ${SUPPORTING_CHAPTERS_PER_GUIDE} compact practical/reference chapter is allowed per guide. Merge them, or attach practical refs to the core chapters that need them through supportingRefs.`})
 }
 const excluded=[],seen=new Set()
 const allowed=policy?new Set([...policy.scopeEvidenceIds,...policy.currentEvidenceIds]):null
 for(const [index,entry] of (result.excluded||[]).entries()){
  const cited=(entry.scopeSourceIds||[]).filter(id=>!allowed || allowed.has(id))
  const uncited=(entry.scopeSourceIds||[]).filter(id=>allowed && !allowed.has(id))
  const reason=String(entry.reason||'').trim()
  for(const ref of entry.topicRefs||[]){
   if(!candidates.has(ref)){issues.push({kind:'unknown-ref',ref,detail:`Exclusion ${index} cites ${ref}, which is not a mapped concept. Cite only the listed refs.`});continue}
   if(seen.has(ref)){issues.push({kind:'duplicate-ref',ref,title:candidates.get(ref).title,detail:`Ref ${ref} is excluded more than once. List it exactly once.`});continue}
   seen.add(ref);excluded.push({ref,title:candidates.get(ref).title,reason,scopeSourceIds:cited})
  }
  if(!reason || !cited.length || uncited.length)issues.push({kind:'unjustified-exclusion',refs:(entry.topicRefs||[]).slice(0,20),
   ...(uncited.length?{uncitedSourceIds:uncited.slice(0,10)}:{}),
   detail:`Exclusion ${index} (${issueDetailList(entry.topicRefs||[])}) ${!reason?'has no reason':!cited.length?'cites no scope-context or current-edition evidence':'cites evidence that is neither scope context nor current-edition material'}. Give a specific reason and cite the current syllabus, learning-outcome, announcement or slide passage the decision rests on, or teach the concept as core or supporting instead.`})
 }
 const total=candidates.size,limit=Math.floor(total*EXCLUDED_CONCEPT_SHARE_LIMIT)
 if(excluded.length>limit)issues.push({kind:'excessive-exclusion',count:excluded.length,limit,total,share:Number((excluded.length/Math.max(1,total)).toFixed(3)),
  detail:`The plan excludes ${excluded.length} of ${total} mapped concepts; at most ${limit} (${Math.round(EXCLUDED_CONCEPT_SHARE_LIMIT*100)}%) may be excluded. Teach practical or prerequisite material as supporting and keep assessed concepts core; exclude only concepts a cited current-edition source places outside scope.`})
 if(issues.length)throw outlineRejection('The course plan’s scope roles need correction: every exclusion must be cited and bounded, and practical material stays compact.',issues,422)
 return excluded
}
export function assertExclusionsNotTaught(excluded,owners){
 const taught=excluded.filter(item=>owners.has(conceptKey(item.title)))
 if(taught.length)throw outlineRejection('A concept is both excluded and taught.',taught.map(item=>({kind:'excluded-concept-taught',ref:item.ref,title:item.title,taughtIn:owners.get(conceptKey(item.title)),
  detail:`Ref ${item.ref} (“${item.title}”) is excluded, but guide “${owners.get(conceptKey(item.title))}” teaches that concept. Assign the ref to that teaching home instead of excluding it.`})),422)
}
export function scopeExclusionGaps(excluded){
 return excluded.map(item=>`Scope note: “${item.title}” is not taught in this course plan because it is outside the current edition's scope. ${item.reason}`.slice(0,600))
}

// Split a chapter's teaching evidence into what the core concepts need (sized
// for part-splitting) and supporting evidence (attached by relevance, never a
// reason to split). A core concept needs its current-edition lecture evidence,
// else its historical lecture evidence, else all its evidence.
export function teachingRoles(topic,teaching,policy){
 if(!topic.conceptEvidence)return {core:teaching,supporting:[]}
 const practical=new Set(policy.practicalSourceKeys),current=new Set(policy.currentSourceKeys)
 const byId=new Map(teaching.map(c=>[c.id,c])),need=new Set()
 for(const concept of topic.conceptEvidence){
  if((concept.role||topic.role)==='supporting')continue
  const own=concept.sourceIds.map(id=>byId.get(id)).filter(Boolean)
  const lecture=own.filter(c=>!practical.has(c.sourceKey))
  const cur=lecture.filter(c=>current.has(c.sourceKey)),hist=lecture.filter(c=>!current.has(c.sourceKey))
  for(const c of cur.length?cur:hist.length?hist:own)need.add(c.id)
 }
 return {core:teaching.filter(c=>need.has(c.id)),supporting:teaching.filter(c=>!need.has(c.id))}
}
// Relevance order: a concept's only remaining evidence first, then passages
// cited by more of the chapter's concepts, lecture before code, then source
// order. Each passage goes to the part already holding most of its concepts'
// evidence. Returns the trimmed passages; the caller records them.
export function attachSupporting(parts,supporting,topic,capacity,policy){
 const practical=new Set(policy.practicalSourceKeys),concepts=topic.conceptEvidence||[]
 const cites=new Map(),order=new Map(supporting.map((c,i)=>[c.id,i]))
 for(const concept of concepts)for(const id of concept.sourceIds)cites.set(id,(cites.get(id)||0)+1)
 const placed=new Set(parts.flat().map(c=>c.id)),supportIds=new Set(supporting.map(c=>c.id)),firsts=new Set()
 for(const concept of concepts)if(!concept.sourceIds.some(id=>placed.has(id))){const first=concept.sourceIds.find(id=>supportIds.has(id));if(first)firsts.add(first)}
 const ranked=[...supporting].sort((a,b)=>(firsts.has(b.id)-firsts.has(a.id)) || ((cites.get(b.id)||0)-(cites.get(a.id)||0)) ||
  (practical.has(a.sourceKey)-practical.has(b.sourceKey)) || (order.get(a.id)-order.get(b.id)))
 const room=parts.map(part=>capacity-part.reduce((n,c)=>n+c.text.length,0)),trimmed=[]
 for(const chunk of ranked){
  const related=new Set(concepts.filter(c=>c.sourceIds.includes(chunk.id)).flatMap(c=>c.sourceIds))
  const preference=parts.map((part,index)=>({index,overlap:part.filter(c=>related.has(c.id)).length})).sort((a,b)=>b.overlap-a.overlap || a.index-b.index)
  const target=preference.find(({index})=>room[index]>=chunk.text.length)
  if(!target){trimmed.push(chunk);continue}
  parts[target.index].push(chunk);room[target.index]-=chunk.text.length
 }
 return trimmed
}
export function assertChapterBudget(result,expanded,expansion,policy){
 const issues=[]
 for(const guide of result.guides){
  const count=expanded.filter(topic=>topic.guideId===guide.id).length
  if(count>policy.guideChapterMax)issues.push({kind:'guide-chapter-budget',guideId:guide.id,count,limit:policy.guideChapterMax,excess:count-policy.guideChapterMax,
   expandedChapters:expansion.filter(e=>e.guideId===guide.id && e.parts>1).map(({topicId,parts,evidenceCharacters})=>({topicId,parts,evidenceCharacters})),
   detail:`Guide “${guide.id}” holds ${count} chapters after evidence splitting; the automatic policy allows ${policy.guideChapterMin}-${policy.guideChapterMax} per guide. Combine closely related core concepts into shared teaching units, attach practical material through supportingRefs or one compact supporting chapter, or move whole chapters to another guide. Do not drop or exclude an assessed concept to meet the budget.`})
 }
 if(expanded.length>policy.courseChapterBudget)issues.push({kind:'course-chapter-budget',count:expanded.length,limit:policy.courseChapterBudget,excess:expanded.length-policy.courseChapterBudget,
  coreTeachingCharacters:policy.coreTeachingCharacters,charactersPerChapter:policy.charactersPerChapter,capacityMinimumChapters:policy.capacityMinimumChapters,
  detail:`The course plan holds ${expanded.length} chapters after evidence splitting; its automatic budget is ${policy.courseChapterBudget} (one chapter per about ${policy.charactersPerChapter} of the ${policy.coreTeachingCharacters} characters of core teaching evidence, never below the ${policy.capacityMinimumChapters}-chapter capacity minimum, capped at ${policy.courseChapterCap}; code, archives and datasets do not count). Combine closely related core concepts into teaching units and keep practical material supporting. Do not drop or exclude an assessed concept to meet the budget.`})
 if(issues.length)throw outlineRejection(`This course plan exceeds its automatic chapter budget of ${policy.courseChapterBudget} chapters (${policy.guideChapterMax} per guide). Consolidate related concepts without dropping assessed coverage.`,issues,422)
}
// A saved bundle outline planned under an older policy, with nothing authored
// yet, is replanned from its saved maps instead of being treated as planned.
export function outlinePlanningStale(draft,{bundle=!!draft?.guides?.length}={}){
 return !!(bundle && draft?.topics?.length && draft.stage==='chapters' && !draft.chapters?.length && !draft.repair && !draft.refreshFrom &&
  !Object.keys(draft.teachingPlans||{}).length && draft.planningPolicy!==COURSE_BUNDLE_PLANNING_POLICY)
}
