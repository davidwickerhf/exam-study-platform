import { STUDY_MODELS } from './study-ai-settings.mjs'
import { StudyVersionError } from './study-version-content.mjs'
import { OPENAI_REASONING_EFFORTS, openAiReasoningEffort } from './llm-config.mjs'

const routeModel=value=>value && typeof value==='object' && !Array.isArray(value) ? value.model : value
const phases=new Set(['source-mapping','course-outline','teaching-plan','teaching-plan-check','authoring','structural-fill','pedagogical-precheck','factual-review','pedagogical-review','correction','question-correction'])
// A more specific routable phase falls back to its general phase when a
// profile does not configure it: the structural fill is drafting, and a
// question-only correction is a correction. A profile that leaves them out
// therefore routes exactly as before.
export const STUDY_ROUTE_FALLBACKS=Object.freeze({'structural-fill':'authoring','question-correction':'correction'})
export function studyModelPhase(options) {
 const phase=options.usageMetadata?.phase
 if(phase?.startsWith('factual-'))return 'factual-review'
 // The question-only correction A/B trial asks for its own route explicitly.
 if(options.usageMetadata?.routePhase==='question-correction' && phase?.endsWith('-correction'))return 'question-correction'
 if(phase==='source-refresh' || phase?.endsWith('-correction') || phase==='practice-links')return 'correction'
 if(phases.has(phase))return phase
 if(options.usageMetadata?.stage==='chapters')return 'authoring'
 return null
}
// QUESTION-ONLY CORRECTION TRIAL. Switched on by configuration alone: a route
// profile (STUDY_MODEL_ROUTES for hosted runs, STUDY_PIPELINE_MODEL_ROUTES for
// the isolated pilot client) that sets a question-correction route whose model
// differs from its correction route. Question-only patches then try that route
// first and fall back to the correction route for the same correction when
// the merged-chapter validation or the scoped re-review rejects the result.
// Without such a route there is no trial and nothing changes.
export function questionCorrectionTrial(env=process.env) {
 for(const raw of [env.STUDY_MODEL_ROUTES,env.STUDY_PIPELINE_MODEL_ROUTES]) {
  if(!raw)continue
  let policy
  try{policy=typeof raw==='string'?JSON.parse(raw):raw}catch{continue}
  const trial=routeModel(policy?.routes?.['question-correction']),fallback=routeModel(policy?.routes?.correction)
  if(typeof trial==='string' && trial!==fallback)return {active:true,model:trial,fallbackModel:fallback || null}
 }
 return {active:false}
}
// The pre-check is additive and therefore opt-in. Merely having an authoring
// or review route must never add another paid call to existing deployments.
export function pedagogicalPrecheckEnabled(env=process.env) {
 for(const raw of [env.STUDY_MODEL_ROUTES,env.STUDY_PIPELINE_MODEL_ROUTES]) {
  if(!raw)continue
  try{
   const policy=typeof raw==='string'?JSON.parse(raw):raw
   if(typeof routeModel(policy?.routes?.['pedagogical-precheck'])==='string')return true
  }catch{/* invalid policy is reported by routeStudyModel when it is used */}
 }
 return false
}
export function studyPlanPrecheckEnabled(env=process.env) {
 for(const raw of [env.STUDY_MODEL_ROUTES,env.STUDY_PIPELINE_MODEL_ROUTES]) {
  if(!raw)continue
  try{
   const policy=typeof raw==='string'?JSON.parse(raw):raw
   if(typeof routeModel(policy?.routes?.['teaching-plan-check'])==='string')return true
  }catch{/* invalid policy is reported by routeStudyModel when it is used */}
 }
 return false
}
export function routeStudyModel(billing,options,rawPolicy) {
 const phase=studyModelPhase(options)
 // An operator must explicitly enable a tested profile. A local subscription,
 // personal-key choice, tutor call or paper job cannot silently inherit it.
 if(!rawPolicy || billing.source!=='platform' || billing.provider!=='openai' || options.generationRuntime!=='agents-sdk-responses' || !options.usageMetadata?.versionId || !phase)return null
 let policy
 try{policy=typeof rawPolicy==='string'?JSON.parse(rawPolicy):rawPolicy}catch{throw new StudyVersionError('The study model-routing configuration is invalid.',503)}
 if(!policy || policy.version!==1 || !policy.routes || typeof policy.routes!=='object' || Array.isArray(policy.routes) || Object.keys(policy).some(k=>!['version','routes'].includes(k)) || Object.keys(policy.routes).some(k=>!phases.has(k)))throw new StudyVersionError('The study model-routing configuration is invalid.',503)
 // A route value is either a model string or {model, reasoning}. Reasoning is
 // validated against the efforts the OpenAI provider layer actually accepts.
 for(const value of Object.values(policy.routes)){
  const routed=routeModel(value)
  if(typeof routed!=='string'||STUDY_MODELS[routed]?.provider!=='openai')throw new StudyVersionError('A study model route has no supported OpenAI pricing.',503)
  if(typeof value==='object' && (Object.keys(value).some(k=>!['model','reasoning'].includes(k)) || (value.reasoning!==undefined && (!OPENAI_REASONING_EFFORTS.has(value.reasoning) || !openAiReasoningEffort(routed,value.reasoning)))))throw new StudyVersionError('A study model route requests an unsupported reasoning effort.',503)
 }
 const routed=policy.routes[phase]!==undefined ? phase : STUDY_ROUTE_FALLBACKS[phase] && policy.routes[STUDY_ROUTE_FALLBACKS[phase]]!==undefined ? STUDY_ROUTE_FALLBACKS[phase] : phase
 const entry=policy.routes[routed],model=routeModel(entry)
 const reasoningEffort=typeof entry==='object' && entry?.reasoning ? openAiReasoningEffort(model,entry.reasoning) : null
 if(!model || (model===billing.model && !reasoningEffort))return null
 const target=STUDY_MODELS[model],base=STUDY_MODELS[billing.model]
 const boundaries=[1,...[base?.longContextThreshold,target.longContextThreshold].filter(Boolean).flatMap(n=>[n,n+1])]
 if(!base || boundaries.some(n=>{
  const input=p=>p.input*(p.cacheWriteMultiplier || 1)*(p.longContextThreshold && n>p.longContextThreshold?2:1)
  const output=p=>p.output*(p.longContextThreshold && n>p.longContextThreshold?1.5:1)
  return input(target)>input(base) || output(target)>output(base)
 }))throw new StudyVersionError('A study model route cannot increase the selected model’s input or output price.',503)
 return {model,baseModel:billing.model,phase:routed,policyVersion:1,...(routed!==phase?{requestedPhase:phase}:{}),...(reasoningEffort?{reasoningEffort}:{})}
}
