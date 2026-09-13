import { z } from 'zod/v3'
import { arithmeticValue } from './study-content-quality.mjs'
import { digest, evidencePrompt, reviewPrompt, studyResponseSchema, parseStudyJson, StudyVersionError } from './study-version-content.mjs'

export const FACTUAL_REVIEW_VERSION = 1
const prose = z.string().trim().min(1).max(5000)
const judgment = z.object({ correct: z.boolean(), rationale: prose, issues: z.array(z.object({detail:prose,severity:z.enum(['warning','error'])})).max(12) }).strict()
const solution = z.object({ answer:prose, assumptions:z.array(prose).max(8), calculations:z.array(z.object({expression:z.string().min(1).max(300).regex(new RegExp('^[0-9+*/^().\\s-]+$')),result:z.number().finite()}).strict()).max(12) }).strict()
const batch = (items, size=4) => Array.from({length:Math.ceil(items.length/size)},(_,i)=>items.slice(i*size,(i+1)*size))
const keyedSchema = (items, schema) => z.object({items:z.object(Object.fromEntries(items.map(item=>[item.key,schema]))).strict()}).strict()

export function factualReviewItems(chapter) {
  const items = chapter.sections.map(s=>({key:`section:${s.id}`,kind:'teaching',content:s}))
  items.push({key:'summary',kind:'revision summary',content:chapter.summary})
  for(const [i,cards] of batch(chapter.flashcards).entries())items.push({key:`cards:${i}`,kind:'flashcards',content:cards})
  items.push({key:'scope',kind:'scope and source attribution',content:{learningGoals:chapter.learningGoals,caveats:chapter.caveats,teachingPlan:chapter.teachingPlan}})
  if(chapter.walkthrough)items.push({key:'walkthrough',kind:'worked reasoning',content:chapter.walkthrough})
  return items
}
export function factualFingerprint(chapter) {
  return digest({items:factualReviewItems(chapter),questions:chapter.questions})
}
function stateFor(chapter) {
  const fingerprint=factualFingerprint(chapter), saved=chapter.factualAudit
  return saved?.version===FACTUAL_REVIEW_VERSION && saved.fingerprint===fingerprint
    ? structuredClone(saved) : {version:FACTUAL_REVIEW_VERSION,fingerprint,solutions:{},judgments:{}}
}

// One provider request per checkpoint. No answer key or generated lesson is
// visible to the independent solver, including through hints or diagnostics.
export function nextFactualReview(course,sources,evidence,chapter) {
  const state=stateFor(chapter)
  const context=evidencePrompt(course,sources,evidence)
  for(const group of batch(chapter.questions)) {
    const missing=group.filter(q=>!state.solutions[q.key])
    if(missing.length) {
      const payload=missing.map(({key,question,type,options,sourceIds})=>({key,question,type,options,sourceIds}))
      const schema=keyedSchema(payload,solution)
      return {kind:'solve',keys:payload.map(q=>q.key),state,schema,responseSchema:studyResponseSchema(schema),tokens:8000,
        prompt:`${context}\nINDEPENDENT QUESTION SOLVING. Solve every supplied question from first principles before seeing the author's answer or lesson. State assumptions, intermediate reasoning, complete constraints and the conclusion. Check feasibility, units, boundary cases and all requested parts. For probability ranges derive both bounds from nonnegative probabilities and a union no greater than one; do not cap an impossible intermediate calculation. Distinguish a source gap from an explicit exam exclusion. For choices identify the supported option(s), but explain the reasoning. Include simple numeric calculations as executable arithmetic expressions using only numbers, + - * / ^ and parentheses, with their claimed result; omit symbolic expressions, comparisons, labels, equal signs and conclusions from calculations. Put those in answer. For example use expression "0.7+0.5-1", result 0.2; never "P(A)=0.7". An empty calculations list is appropriate for nonnumeric reasoning. Never infer correctness from a supplied skill label. Return one independently solved answer under each exact key.\nReview payload: ${JSON.stringify(payload)}`}
    }
    const unchecked=group.filter(q=>!state.judgments[`question:${q.key}`])
    if(unchecked.length) {
      const payload=unchecked.map(q=>({key:`question:${q.key}`,question:q,independentSolution:state.solutions[q.key]}))
      const schema=keyedSchema(payload,judgment)
      return {kind:'answers',keys:payload.map(q=>q.key),state,schema,responseSchema:studyResponseSchema(schema),tokens:8000,
        prompt:`${context}\nANSWER COMPARISON REVIEW. Every item needs its own explicit correctness verdict and reasoning; never return only a list of noticed errors. Compare the proposed answer with the separately produced blind solution. Independently resolve disagreements: neither answer is authoritative. Check every requested part, option index, computation, complete feasible range, and verbal conclusion. A correct final number with invalid reasoning is incorrect. For intervals check lower AND upper bounds; a union cannot exceed one. Inspect diagnostic explanations too. correct=false requires a concrete explanation of the error, not an optional style preference. Harmless wording differences and an explicitly constructed teaching scenario are not factual errors. Do not accept a question solely because other questions pass.\nReview payload: ${JSON.stringify(payload)}`}
    }
  }
  const unchecked=factualReviewItems(chapter).filter(item=>!state.judgments[item.key]).slice(0,4)
  if(unchecked.length) {
    const schema=keyedSchema(unchecked,judgment)
    return {kind:'content',keys:unchecked.map(i=>i.key),state,schema,responseSchema:studyResponseSchema(schema),tokens:9000,
      prompt:`${reviewPrompt(course,sources,evidence,{id:chapter.id})}\nITEM-BY-ITEM CONTENT REVIEW. The payload below is the artifact to review. Give a verdict for EVERY exact item key. Check all claims, calculations and visual elements within each item, including worked examples, callouts and optional detail. correct=false means a substantive error; explain its location and correction. Minor provenance/style improvements may be warnings with correct=true. Do not overlook one error because another item contains a more obvious error. Check complete feasible ranges, not only one bound. Source-labelled visuals must faithfully derive their relationships from evidence; invented event assignments should be labelled illustrative. Ordinary mathematical consequences and explicit teaching constructions are allowed, but invented measurements or original-image readings are not. Missing source coverage is not an official exam exclusion.\nReview payload: ${JSON.stringify(unchecked)}`}
  }
  return null
}
export function acceptFactualReview(chapter,step,raw) {
  if(step.state.fingerprint!==factualFingerprint(chapter))throw new StudyVersionError('The chapter changed during its factual review.',409)
  const parsed=parseStudyJson(raw,step.schema), state=structuredClone(step.state)
  for(const key of step.keys) {
    const item=parsed.items[key]
    if(step.kind==='solve') {
      for(const check of item.calculations) {
        const actual=arithmeticValue(check.expression)
        if(actual===null || Math.abs(actual-check.result)>1e-8*Math.max(1,Math.abs(actual)))throw new StudyVersionError(`The independent solution contains an invalid arithmetic check for ${key}. Retry the review step.`,502)
      }
      state.solutions[key]=item
    } else state.judgments[key]=item
  }
  chapter.factualAudit=state
  return factualAuditIssues(chapter)
}
export function factualAuditIssues(chapter) {
  const audit=chapter.factualAudit
  const fail=detail=>({topicId:chapter.id,severity:'error',detail})
  if(audit?.version!==FACTUAL_REVIEW_VERSION || audit.fingerprint!==factualFingerprint(chapter))return [fail('Factual review must match the exact current chapter.')]
  const keys=[...chapter.questions.map(q=>`question:${q.key}`),...factualReviewItems(chapter).map(i=>i.key)]
  const missing=keys.filter(key=>!audit.judgments[key])
  if(missing.length || chapter.questions.some(q=>!audit.solutions[q.key]))return [fail('Every question needs an independent solution and every teaching item needs a factual verdict.')]
  return keys.flatMap(key=>{
    const judgment=audit.judgments[key]
    const issues=judgment.issues.map(i=>({...i,itemKey:key,topicId:chapter.id}))
    if(!judgment.correct && !issues.some(i=>i.severity==='error'))issues.push({...fail(judgment.rationale),itemKey:key})
    return issues
  })
}
