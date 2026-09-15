import { STUDY_MODELS } from './study-ai-settings.mjs'
import { StudyVersionError } from './study-version-content.mjs'
import { OPENAI_REASONING_EFFORTS, openAiReasoningEffort } from './llm-config.mjs'

const routeModel=value=>value && typeof value==='object' && !Array.isArray(value) ? value.model : value
const phases=new Set(['source-mapping','course-outline','teaching-plan','authoring','factual-review','pedagogical-review','correction'])
export function studyModelPhase(options) {
 const phase=options.usageMetadata?.phase
 if(phase?.startsWith('factual-'))return 'factual-review'
 if(phase==='source-refresh' || phase?.endsWith('-correction') || phase==='practice-links')return 'correction'
 if(phases.has(phase))return phase
 if(options.usageMetadata?.stage==='chapters')return 'authoring'
 return null
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
 const entry=policy.routes[phase],model=routeModel(entry)
 const reasoningEffort=typeof entry==='object' && entry?.reasoning ? openAiReasoningEffort(model,entry.reasoning) : null
 if(!model || (model===billing.model && !reasoningEffort))return null
 const target=STUDY_MODELS[model],base=STUDY_MODELS[billing.model]
 const boundaries=[1,...[base?.longContextThreshold,target.longContextThreshold].filter(Boolean).flatMap(n=>[n,n+1])]
 if(!base || boundaries.some(n=>{
  const input=p=>p.input*(p.cacheWriteMultiplier || 1)*(p.longContextThreshold && n>p.longContextThreshold?2:1)
  const output=p=>p.output*(p.longContextThreshold && n>p.longContextThreshold?1.5:1)
  return input(target)>input(base) || output(target)>output(base)
 }))throw new StudyVersionError('A study model route cannot increase the selected model’s input or output price.',503)
 return {model,baseModel:billing.model,phase,policyVersion:1,...(reasoningEffort?{reasoningEffort}:{})}
}
