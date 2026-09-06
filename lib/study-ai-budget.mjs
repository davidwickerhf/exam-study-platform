import { aiQuotaExemption } from './ai-quota-policy.mjs'
import { randomUUID } from 'node:crypto'
import { currentUserId, withRequestContext } from './request-context.mjs'
import {
  readDocument,
  compareAndSwapDocument,
  DocumentConflictError
} from './user-store.mjs'
import {
  digest,
  StudyVersionError,
  evidenceBatches
} from './study-version-content.mjs'
import {
  STUDY_MODELS,
  personalAiSettings,
  personalAiCredential
} from './study-ai-settings.mjs'
const setting = (name, fallback) => {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value >= 0 && process.env[name] !== undefined
    ? value
    : fallback
}
export function studyBudgetLimits() {
  return {
    platformDayUsd: setting('STUDY_PLATFORM_DAILY_USD', 10),
    platformMonthUsd: setting('STUDY_PLATFORM_MONTHLY_USD', 100),
    userDayUsd: setting('STUDY_USER_DAILY_USD', 0.5),
    userMonthUsd: setting('STUDY_USER_MONTHLY_USD', 3),
    chaptersDay: setting('STUDY_CHAPTERS_PER_DAY', 6),
    chaptersMonth: setting('STUDY_CHAPTERS_PER_MONTH', 30),
    requestsMinute: setting('STUDY_REQUESTS_PER_MINUTE', 4),
    tokensDay: setting('STUDY_TOKENS_PER_DAY', 300000),
    personalTokensDay: setting('STUDY_PERSONAL_TOKENS_PER_DAY', 2000000),
    maxJobUsd: setting('STUDY_MAX_JOB_USD', 1)
  }
}
const usd = (value) => Math.ceil(value * 1000000)
export class StudyBudgetError extends StudyVersionError {
  constructor(message, retryAfter = 86400) {
    super(message, 429)
    this.retryAfter = retryAfter
  }
}
export function estimateStudyCall(prompt, maxOutputTokens, model) {
  const price = STUDY_MODELS[model]
  if (!price)
    throw new StudyVersionError(
      'This model has no configured study pricing. Choose a supported model.',
      503
    )
  // UTF-8 bytes are a conservative upper bound for tokenized text, with room
  // for message framing. Never use chars/4 for a hard spending reservation.
  const inputTokens = Buffer.byteLength(prompt, 'utf8') + 2048,
    outputTokens = Math.min(12000, Math.max(1, maxOutputTokens))
  return {
    inputTokens,
    outputTokens,
    micros: Math.ceil(inputTokens * price.input + outputTokens * price.output)
  }
}
export function reserveStudyLedger(
  ledger,
  input,
  limits = studyBudgetLimits()
) {
  const now = input.now ?? Date.now(),
    day = new Date(now).toISOString().slice(0, 10),
    month = day.slice(0, 7)
  const next = structuredClone(
    ledger || {
      month,
      users: {},
      days: {},
      total: 0,
      reservations: {},
      jobs: {}
    }
  )
  if (next.month !== month)
    throw new StudyVersionError(
      'The budget period changed. Retry this step.',
      409
    )
  const user = next.users[input.user] || {
    total: 0,
    days: {},
    chapters: {},
    recent: [],
    lease: null
  }
  const today = user.days[day] || { spent: 0, tokens: 0, chapters: 0 }
  const own = input.source === 'personal',
    amount = input.estimate.micros,
    tokens = input.estimate.inputTokens + input.estimate.outputTokens
  if (user.lease?.expiresAt > now)
    throw new StudyBudgetError(
      'Another chapter is generating on your account. This job will continue shortly.',
      30
    )
  user.recent = user.recent.filter((t) => t > now - 60000)
  if (!input.quotaExempt && user.recent.length >= limits.requestsMinute)
    throw new StudyBudgetError(
      'Generation is waiting for the per-minute allowance.',
      60
    )
  if (
    !input.quotaExempt && !own &&
    ((next.days[day] || 0) + amount > usd(limits.platformDayUsd) ||
      next.total + amount > usd(limits.platformMonthUsd))
  )
    throw new StudyBudgetError(
      'The shared generation budget has been reached. Resume later or explicitly choose your own AI key in Settings.'
    )
  if (
    !input.quotaExempt && !own &&
    (today.spent + amount > usd(limits.userDayUsd) ||
      user.total + amount > usd(limits.userMonthUsd))
  )
    throw new StudyBudgetError(
      'Your platform generation allowance is used. Resume later or explicitly choose your own AI key in Settings.'
    )
  if (!input.quotaExempt && own && user.total + amount > usd(input.personalMonthUsd))
    throw new StudyBudgetError(
      'The monthly spending limit for your own AI key has been reached. Adjust it in Settings or resume next month.'
    )
  if (
    !input.quotaExempt && today.tokens + tokens >
    (own ? limits.personalTokensDay : limits.tokensDay)
  )
    throw new StudyBudgetError(
      'Your daily study token allowance has been reached. Finished work is saved.'
    )
  const chapterKey = input.chapterKey,
    newChapter = chapterKey && !user.chapters[chapterKey]
  if (
    !input.quotaExempt && !own &&
    newChapter &&
    (today.chapters >= limits.chaptersDay ||
      Object.keys(user.chapters).length >= limits.chaptersMonth)
  )
    throw new StudyBudgetError(
      'Your included chapter allowance is used. Resume later or explicitly choose your own AI key. Finished chapters remain readable.'
    )
  const job = next.jobs[input.jobKey] || 0
  if (!input.quotaExempt && job + amount > usd(input.maxJobUsd))
    throw new StudyBudgetError(
      'This generation reached its spending cap. Review its progress and explicitly raise the cap to continue.'
    )
  const id = randomUUID()
  next.total += amount
  next.days[day] = (next.days[day] || 0) + amount
  next.jobs[input.jobKey] = job + amount
  today.spent += amount
  today.tokens += tokens
  if (newChapter) {
    today.chapters++
    user.chapters[chapterKey] = true
  }
  user.total += amount
  user.days[day] = today
  user.recent.push(now)
  user.lease = { id, expiresAt: now + 300000 }
  next.users[input.user] = user
  next.reservations[id] = {
    id,
    user: input.user,
    day,
    jobKey: input.jobKey,
    micros: amount,
    tokens,
    model: input.model,
    status: 'reserved',
    quotaExempt: Boolean(input.quotaExempt),
    createdAt: now
  }
  return { ledger: next, reservation: next.reservations[id] }
}
export function settleStudyLedger(ledger, id, usage) {
  const next = structuredClone(ledger),
    r = next.reservations[id]
  if (!r || r.status !== 'reserved') return next
  const price = STUDY_MODELS[r.model]
  const measured =
    usage &&
    !usage.estimated &&
    Number.isSafeInteger(usage.inputTokens) &&
    usage.inputTokens >= 0 &&
    Number.isSafeInteger(usage.outputTokens) &&
    usage.outputTokens >= 0
  const actual = measured
    ? Math.ceil(
        usage.inputTokens * price.input + usage.outputTokens * price.output
      )
    : r.micros
  const usedTokens = measured
    ? usage.inputTokens + usage.outputTokens
    : r.tokens
  const refund = r.micros - actual,
    tokenRefund = r.tokens - usedTokens,
    user = next.users[r.user]
  next.total -= refund
  next.days[r.day] -= refund
  next.jobs[r.jobKey] -= refund
  user.total -= refund
  user.days[r.day].spent -= refund
  user.days[r.day].tokens -= tokenRefund
  if (user.lease?.id === id) user.lease = null
  r.status = measured ? 'completed' : 'uncertain'
  r.micros = actual
  r.tokens = usedTokens
  return next
}
function budgetLocation(source, owner) {
  return source === 'personal'
    ? { owner, namespace: 'study-ai-personal-budget' }
    : {
        owner: 'wicker-study-platform-budget',
        namespace: 'study-ai-platform-budget'
      }
}
async function mutateLedger(location, month, fn) {
  return withRequestContext(
    { userId: location.owner, mode: 'study-budget' },
    async () => {
      for (let retry = 0; retry < 12; retry++) {
        const old = await readDocument(location.namespace, month, null),
          result = fn(old),
          next = { ...result.ledger, revision: randomUUID() }
        try {
          await compareAndSwapDocument(
            location.namespace,
            month,
            next,
            old?.revision ?? null
          )
          return result
        } catch (e) {
          if (!(e instanceof DocumentConflictError) || retry === 11) throw e
        }
      }
    }
  )
}
export async function resolveStudyBilling(input = {}, platform = {}) {
  const source = input.billingSource || 'platform',
    limits = studyBudgetLimits()
  if (!['personal', 'platform'].includes(source))
    throw new StudyVersionError('Choose platform allowance or your own AI key.')
  let model = platform.model,
    provider = platform.provider,
    credentialRevision = null
  if (source === 'personal') {
    const own = await personalAiCredential()
    model = own.model
    provider = own.provider
    credentialRevision = own.revision
  } else if (!platform.configured)
    throw new StudyVersionError(
      'Platform AI is not configured. Connect your own AI key in Settings.',
      503
    )
  if (input.quality && !['standard', 'enhanced'].includes(input.quality))
    throw new StudyVersionError('Choose standard or enhanced generation.')
  if (source === 'platform' && input.quality === 'enhanced') {
    if (provider !== 'openai') throw new StudyVersionError('Enhanced generation requires an OpenAI platform connection.')
    model = 'gpt-5.4'
  }
  if (
    !STUDY_MODELS[model] ||
    STUDY_MODELS[model].provider !==
      (provider === 'api' ? 'anthropic' : provider)
  )
    throw new StudyVersionError(
      'The platform model is not enabled for budgeted study generation. Use your own supported AI key or configure a priced platform model.',
      503
    )
  const unlimited = Boolean(await aiQuotaExemption())
  const maxJobUsd = unlimited ? limits.maxJobUsd : Number(input.maxJobUsd ?? limits.maxJobUsd)
  if (!unlimited && (!Number.isFinite(maxJobUsd) || maxJobUsd < 0.05 || maxJobUsd > 10))
    throw new StudyVersionError(
      'Set a generation spending cap between $0.05 and $10.'
    )
  return {
    source,
    model,
    unlimited,
    provider: STUDY_MODELS[model].provider,
    maxJobUsd,
    credentialRevision
  }
}
export async function studyBudgetSummary(platform = {}) {
  const own = await personalAiSettings(),
    limits = studyBudgetLimits(),
    owner = currentUserId(),
    user = digest(owner),
    month = new Date().toISOString().slice(0, 7),
    day = new Date().toISOString().slice(0, 10)
  const summary = async (source) => {
    const loc = budgetLocation(source, owner)
    const ledger = await withRequestContext({ userId: loc.owner }, () =>
      readDocument(loc.namespace, month, null)
    )
    const u = ledger?.users[user]
    return {
      spentMonthUsd: (u?.total || 0) / 1000000,
      spentTodayUsd: (u?.days[day]?.spent || 0) / 1000000,
      chaptersMonth: Object.keys(u?.chapters || {}).length,
      chaptersToday: u?.days[day]?.chapters || 0,
      tokensToday: u?.days[day]?.tokens || 0
    }
  }
  const exemptionReason = await aiQuotaExemption()
  return {
    limits,
    unlimited: Boolean(exemptionReason),
    exemptionReason,
    platform: { ...platform, ...(await summary('platform')) },
    personal: { ...own, ...(await summary('personal')) }
  }
}
export function estimateStudyProduction(snapshot, billing) {
  const chars = snapshot.chunks.reduce((n, c) => n + c.text.length, 0),
    batches = evidenceBatches(snapshot.chunks).length
  const chapterRange = [
    Math.max(1, Math.ceil(chars / 24000)),
    Math.min(40, Math.max(2, Math.ceil(chars / 8000)))
  ]
  const estimate = (chapters) => {
    const input = chars / 3 + chapters * 12000 + batches * 1500,
      output = batches * 1800 + chapters * 6000
    const p = STUDY_MODELS[billing.model]
    return Math.ceil((input * p.input + output * p.output) / 10000) / 100
  }
  return {
    sourceCount: snapshot.sources.length,
    batches,
    chapterRange,
    estimatedUsd: chapterRange.map(estimate),
    maxJobUsd: billing.maxJobUsd,
    unlimited: Boolean(billing.unlimited),
    billingSource: billing.source,
    model: billing.model,
    explanation: billing.unlimited ? 'Planning estimate, not a quote. No usage quota applies; costs remain recorded. Unchanged chapters are reused.' :
      'Planning estimate, not a quote. Exact chapter count follows source mapping. Each API call reserves a conservative maximum before it runs; generation pauses at your cap. Unchanged chapters are reused.'
  }
}
export async function runBudgetedStudyCall(
  prompt,
  options,
  { billing, jobKey, callPlatform, callPersonal }
) {
  if (!billing)
    throw new StudyVersionError(
      'Review the generation budget before resuming.',
      409
    )
  const owner = currentUserId(),
    location = budgetLocation(billing.source, owner),
    month = new Date().toISOString().slice(0, 7)
  let credential = null
  if (billing.source === 'personal') {
    credential = await personalAiCredential()
    if (credential.revision !== billing.credentialRevision)
      throw new StudyVersionError(
        'Your AI key settings changed. Review billing and resume to use the new settings.',
        409
      )
  }
  const estimate = estimateStudyCall(
    prompt,
    options.maxOutputTokens || 10000,
    billing.model
  )
  const quotaExempt = Boolean(await aiQuotaExemption({owner}))
  const { reservation } = await mutateLedger(location, month, (ledger) =>
    reserveStudyLedger(ledger, {
      user: digest(owner),
      quotaExempt,
      jobKey,
      source: billing.source,
      model: billing.model,
      chapterKey: options.usageMetadata?.chapterId
        ? digest([jobKey, options.usageMetadata.chapterId])
        : null,
      personalMonthUsd: credential?.monthlyLimitUsd,
      estimate,
      maxJobUsd: billing.maxJobUsd
    })
  )
  let usage = null
  try {
    const result = await (credential
      ? callPersonal(prompt, {
          ...options,
          model: billing.model,
          apiKey: credential.apiKey,
          provider: credential.provider,
          maxOutputTokens: estimate.outputTokens
        })
      : callPlatform(prompt, {
          ...options,
          model: billing.model,
          maxOutputTokens: estimate.outputTokens
        }))
    usage = result.usage
    return typeof result === 'string' ? result : result.text
  } finally {
    // Unknown/failed calls remain charged at their full reservation. A lost
    // response is never treated as free, and retries must reserve again.
    await mutateLedger(location, month, (ledger) => ({
      ledger: settleStudyLedger(ledger, reservation.id, usage)
    }))
  }
}
