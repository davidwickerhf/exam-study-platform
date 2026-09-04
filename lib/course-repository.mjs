import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { safeFetch } from './security.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const cachePath = resolve(root, 'data/cache/course-repository.json')
const FRESH_MS = 24 * 60 * 60_000
const MAX_STALE_MS = 30 * 24 * 60 * 60_000
const RETRY_MS = 5 * 60_000
const BASE = 'https://courserepository.maastrichtuniversity.nl'
const SITEMAPS = {
  programmes: `${BASE}/sitemaps/programs/sitemap.xml`,
  modules: `${BASE}/sitemaps/modules/sitemap.xml`
}

// The public sitemap contains identifiers, not programme names. These names
// were verified against the public, rendered 2026–2027 Course Repository
// records on 2026-09-04. Keep unknown identifiers in the cache for later
// resolution, but never publish a guessed label such as “Programme 5502”.
const VERIFIED_PROGRAMMES = Object.freeze({
  "5903": { title: "Advanced Master in Privacy, Cybersecurity and Data Management LL.M." },
  "5901": { title: "Advanced Master Intellectual Property Law and Knowledge Management LL.M." },
  "5902": { title: "Advanced Master Intellectual Property Law and Knowledge Management MSc." },
  "1501_T2": { title: "Bachelor Arts and Culture" },
  "3502": { title: "Bachelor Biomedical Sciences" },
  "4502": { title: "Bachelor Brain Science" },
  "2507": { title: "Bachelor Business Analytics" },
  "9551": { title: "Bachelor Business Engineering" },
  "1501_T1": { title: "Bachelor Cultuurwetenschappen" },
  "1504": { title: "Bachelor Digital Society" },
  "5501": { title: "Bachelor Dutch Law" },
  "2503": { title: "Bachelor Econometrics and Operations Research" },
  "2501": { title: "Bachelor Economics and Business Economics" },
  "2501_T2": { title: "Bachelor Economics and Business Economics - Specialisation Economics and Management of Information" },
  "2501_T3": { title: "Bachelor Economics track Int. business econ." },
  "2501_T1": { title: "Bachelor Economics track International economic studies" },
  "5553": { title: "Bachelor European Law School" },
  "3503": { title: "Bachelor European Public Health" },
  "1502": { title: "Bachelor European Studies" },
  "5502": { title: "Bachelor Fiscaal Recht" },
  "2502": { title: "Bachelor Fiscal Economics" },
  "1505": { title: "Bachelor Global Studies" },
  "3501": { title: "Bachelor Health Sciences" },
  "2504": { title: "Bachelor International Business" },
  "2508": { title: "Bachelor International Business" },
  "7501": { title: "Bachelor Liberal Arts and Sciences / University College Maastricht" },
  "7504": { title: "Bachelor Liberal Arts and Sciences / University College Venlo" },
  "6501": { title: "Bachelor of Medicine" },
  "9502": { title: "Bachelor of Science in Circular Engineering" },
  "9503": { title: "Bachelor of Science in Computer Science", aliases: ['52451738'], officialUrl: 'https://www.maastrichtuniversity.nl/education/bachelor/programmes/computer-science/courses-and-curriculum' },
  "9501": { title: "Bachelor of Science in Data Science and Artificial Intelligence" },
  "4501": { title: "Bachelor Psychology" },
  "4501_T1": { title: "Bachelor Psychology English track" },
  "3505": { title: "Bachelor Regenerative Medicine and Technology" },
  "8501": { title: "Bachelor Sustainable Bioscience" },
  "8571": { title: "Bachelor Urban Sustainability Studies" },
  "CES__BEiE": { title: "CES: Business & Economics in Europe" },
  "CES__UVA": { title: "CES: University of Virginia" },
  "CES__CNU": { title: "Christopher Newport University" },
  "3804": { title: "Educatieve Module - Wiskunde" },
  "LAW__BUIT": { title: "Exchange Master Programme" },
  "2905": { title: "Executive Master in Cultural Leadership" },
  "3611": { title: "Health Food Innovation Management" },
  "CES__HSSE": { title: "Humanities & Social Sciences in Europe" },
  "CES__IU": { title: "Indiana University programme" },
  "CES__IEL": { title: "International Environmental Law" },
  "2902": { title: "international Executive Master of Finance and Control" },
  "4605": { title: "International Joint Master of Research in Work and Organizational Psychology" },
  "CES__IRP": { title: "International Relations and Politics" },
  "SBE__TRI": { title: "International Triangle Programme" },
  "LC": { title: "Language Centre" },
  "LAW__BUITB": { title: "LAW: Exchange Bachelor programme" },
  "CES__LVC": { title: "Lebanon Valley College" },
  "7503": { title: "Liberal Arts and Sciences / Maastricht Science Programme" },
  "1615_T2": { title: "M Art, Literature and Society" },
  "3619": { title: "M Occupational Health and Sustainable Work" },
  "1615_T4": { title: "M Politics and Society" },
  "5602": { title: "MA Fiscaal Recht" },
  "SSC__MSS": { title: "Maastricht Summer School" },
  "9603": { title: "Master Artificial Intelligence" },
  "1615_T1": { title: "Master Arts and Culture Specialisation Kunst, Literatuur en Samenleving" },
  "1615_T3": { title: "Master Arts and Culture Specialisation Politiek en Samenleving" },
  "1615_T6": { title: "Master Arts and Culture: Arts and Heritage" },
  "1615_T7": { title: "Master Arts and Culture: Contemporary Literature and Arts: Cultural Interventions and Social Justice" },
  "1615_T8": { title: "Master Arts and Culture: Modern Political Culture: Ideas and Discourses in Context" },
  "8651": { title: "Master Biobased Materials" },
  "9607": { title: "Master Biomedical Sciences" },
  "2612": { title: "Master Business Intelligence and Smart Services" },
  "2605": { title: "Master Business Research" },
  "2605_T2": { title: "Master Business Research" },
  "2605_T1": { title: "Master Business Research specialisation Operations Research" },
  "8602": { title: "Master Crop Biotechnology and Engineering" },
  "9602": { title: "Master Data Science for Decision Making" },
  "2602": { title: "Master Digital Business and Economics" },
  "2606": { title: "Master Econometrics and Operations Research" },
  "2607": { title: "Master Economic and Financial Research" },
  "2607_T2": { title: "Master Economic and Financial Research" },
  "2607_T1": { title: "Master Economic and Financial Research specialisation Econometrics and Operations Research" },
  "2601": { title: "Master Economics" },
  "2613": { title: "Master Economics and Strategy in Emerging Markets" },
  "3618": { title: "Master Epidemiology" },
  "5603": { title: "Master European Law School" },
  "5603_T3": { title: "Master European Law School (General Programme)" },
  "5603_T4": { title: "Master European Law School (Specialisation European Business Law)" },
  "5603_T5": { title: "Master European Law School (Specialisation European Public Law)" },
  "5603_T6": { title: "Master European Law School (Specialisation Law for a Sustainable Europe)" },
  "5603_T2": { title: "Master European Law School, specialisation EU Law" },
  "5603_T7": { title: "Master European Law School, Specialisation Law & Artificial Intelligence" },
  "1602": { title: "Master European Public Affairs" },
  "1603": { title: "Master European Studies" },
  "1613": { title: "Master European Studies on Society, Science and Technology" },
  "1603_T1": { title: "Master European Studies Specialisation: European Public Policy, Institutions and Governance" },
  "1603_T3": { title: "Master European Studies Specialisation: Global Policy and Governance Challenges" },
  "1603_T2": { title: "Master European Studies Specialisation: International Relations" },
  "2608": { title: "Master Financial Economics" },
  "5602_T1": { title: "Master Fiscaal Recht (Specialisation Directe Belastingen)" },
  "5602_T2": { title: "Master Fiscaal Recht (Specialisation Indirecte Belastingen)" },
  "5602_T6": { title: "Master Fiscaal Recht specialisatie Tax and Technology" },
  "2603": { title: "Master Fiscal Economics" },
  "4604": { title: "Master Forensic Psychology" },
  "5607_T1": { title: "Master Forensica, Criminologie en Rechtspleging" },
  "5607_T4": { title: "Master Forensica, Criminologie en Rechtspleging (Specialisatie Forensica)" },
  "5607_T3": { title: "Master Forensica, Criminologie en Rechtspleging (Specialisatie Strafrechtspleging)" },
  "5607_T2": { title: "Master Forensics, Criminology and Law" },
  "3613": { title: "Master Global Health" },
  "2610": { title: "Master Global Supply Chain Management and Change" },
  "1612": { title: "Master Globalisation and Development Studies" },
  "5605_T5": { title: "Master Globalisation and Law (General Programme)" },
  "5605_T2": { title: "Master Globalisation and Law (Specialisation Corporate and Commercial Law)" },
  "5605_T1": { title: "Master Globalisation and Law (Specialisation Human Rights)" },
  "5605_T4": { title: "Master Globalisation and Law (Specialisation International Trade and Investment Law)" },
  "5605_T3": { title: "Master Globalisation and Law, specialisation International Economic Law" },
  "3612": { title: "Master Governance and leadership in European Public Health" },
  "3620": { title: "Master Health and Digital Transformation" },
  "3617": { title: "Master Health Education and Promotion" },
  "3616": { title: "Master Healthcare Policy, Innovation and Management" },
  "2611": { title: "Master Human Decision Science" },
  "2907": { title: "Master International Accountancy" },
  "5610": { title: "Master International and European Tax Law (General Programme)" },
  "5610_T3": { title: "Master International and European Tax Law (Specialisation Customs and International Supply Chain Taxation)" },
  "5610_T2": { title: "Master International and European Tax Law (Specialisation Tax and Technology)" },
  "2604": { title: "Master International Business" },
  "2604_T6": { title: "Master International Business specialisation Accountancy" },
  "2604_T11": { title: "Master International Business specialisation Accounting and Control" },
  "2604_T16": { title: "Master International Business specialisation Accounting and Financial Analysis" },
  "2604_T12": { title: "Master International Business specialisation Controlling" },
  "2604_T15": { title: "Master International Business specialisation Entrepreneurship and Business Development" },
  "2604_T1": { title: "Master International Business specialisation Entrepreneurship and Small and Medium-sized Enterprises Management" },
  "2604_T13": { title: "Master International Business specialisation Information Management and Business Intelligence" },
  "2604_T17": { title: "Master International Business specialisation Managerial Decision-Making and Control" },
  "2604_T9": { title: "Master International Business specialisation Marketing-Finance" },
  "2604_T4": { title: "Master International Business specialisation Organisation: Management, Change and Consultancy" },
  "2604_T2": { title: "Master International Business specialisation Strategic Corporate Finance" },
  "2604_T5": { title: "Master International Business specialisation Strategic Marketing" },
  "2604_T7": { title: "Master International Business specialisation Strategy and Innovation" },
  "2604_T8": { title: "Master International Business specialisation Supply Chain Management" },
  "2604_T14": { title: "Master International Business specialisation Sustainable Finance" },
  "5609": { title: "Master International Laws" },
  "1615_T5": { title: "Master Kunst- en cultuurwetenschappen: Kunst en Erfgoed" },
  "2609": { title: "Master Learning and Development in Organisations" },
  "1616_T1": { title: "Master Media Studies Specialisation Digital Cultures" },
  "1616": { title: "Master Media Studies Specialisation Media Culture" },
  "4606": { title: "Master Mental Health" },
  "4606_T2": { title: "Master Mental Health Specialisation Adult Psychopathology" },
  "4606_T1": { title: "Master Mental Health Specialisation Child and Adolescence Psychopathology" },
  "5601": { title: "Master Nederlands Recht" },
  "2911_T1": { title: "Master of Arts in Management" },
  "2911_T2": { title: "Master of Arts in Management" },
  "2911_T3": { title: "Master of Arts in Management" },
  "2911": { title: "Master of Arts in Management, MA" },
  "2912": { title: "Master of Business Administration" },
  "2912_T1": { title: "Master of Business Administration" },
  "2912_T2": { title: "Master of Business Administration" },
  "2912_T3": { title: "Master of Business Administration" },
  "2912_T4": { title: "Master of Business Administration" },
  "2912_T5": { title: "Master of Business Administration" },
  "2912_T6": { title: "Master of Business Administration" },
  "2912_T7": { title: "Master of Business Administration" },
  "2912_T8": { title: "Master of Business Administration" },
  "5601_T6": { title: "Master of Laws in Dutch Law (General Programme)" },
  "5601_T2": { title: "Master of Laws in Dutch Law (Specialisation Commercial Law and Company Law)" },
  "5601_T3": { title: "Master of Laws in Dutch Law (Specialisation Constitutional Law and Administrative Law)" },
  "5601_T7": { title: "Master of Laws in Dutch Law (Specialisation Labour Law and Social Security Law)" },
  "5601_T8": { title: "Master of Laws in Dutch Law (Specialisation Labour, Social Security and Health)" },
  "5601_T1": { title: "Master of Laws in Dutch Law (Specialisation Private Law)" },
  "6601": { title: "Master of Medicine" },
  "3615": { title: "Master of Science Human Movement Sciences" },
  "8652": { title: "Master of Science in Imaging Engineering" },
  "6603": { title: "Master of Science in Medicine and Clinical Research" },
  "8601": { title: "Master of Science in Public Policy and Human Development" },
  "4601": { title: "Master Psychologie" },
  "4601_T4": { title: "Master Psychology Specialisation Cognitive Neuroscience" },
  "4601_T3": { title: "Master Psychology Specialisation Developmental Psychology" },
  "4601_T6": { title: "Master Psychology Specialisation Health and Social Psychology" },
  "4601_T1": { title: "Master Psychology Specialisation Legal Psychology" },
  "4601_T5": { title: "Master Psychology Specialisation Neuropsychology" },
  "4601_T2": { title: "Master Psychology Specialisation Work & Organisational Psychology" },
  "5606_T1": { title: "Master Recht en Arbeid (Specialisation Arbeid en Gezondheid)" },
  "5606_T2": { title: "Master Recht en Arbeid (Specialisation Arbeid en Onderneming)" },
  "9604": { title: "Master Responsible Data Science" },
  "4664": { title: "Master Sustainability Science in Transforming Societies" },
  "8650": { title: "Master Systems Biology and Bioinformatics" },
  "CES__MEIJI": { title: "Meiji Gakuin University" },
  "CES__MUM": { title: "Miami University" },
  "CES__MUHL": { title: "Muhlenberg College" },
  "CES__OEPS": { title: "Open Enrolment Semester Programmes (electives)" },
  "SBE__OBK": { title: "Opleiding Bedrijfskunde" },
  "CES__PLIRE": { title: "Politics, Law & International Relations in Europe" },
  "CES__PP": { title: "Positive Psychology" },
  "8802": { title: "Pre-master Biobased Materials" },
  "2821": { title: "Pre-master Econometrics and Operations Research" },
  "5803_T1": { title: "Pre-master Fiscaal Recht Traject 1" },
  "5803_T2": { title: "Pre-master Fiscaal Recht Traject 2" },
  "8803": { title: "Pre-master Imaging Engineering" },
  "5802": { title: "Pre-master Law" },
  "4803": { title: "Pre-master psychology" },
  "4802": { title: "Pre-master Psychology" },
  "5801": { title: "Pre-master Recht (voor HBO-rechten afgestudeerden) (NL)" },
  "9803": { title: "Pre-master Responsible Data Science" },
  "8801": { title: "Pre-master Systems Biology and Bioinformatics" },
  "CES__PNE": { title: "Psychology & Neuroscience in Europe" },
  "1614": { title: "Research Master Arts and Culture Specialisation Cultures of Arts, Science and Technology" },
  "4603": { title: "Research Master Cognitive and Clinical Neuroscience" },
  "4603_T3": { title: "Research Master Cognitive and Clinical Neuroscience Specialisation Clinical Psychology" },
  "4603_T4": { title: "Research Master Cognitive and Clinical Neuroscience Specialisation Cognitive Neuroscience" },
  "4603_T6": { title: "Research Master Cognitive and Clinical Neuroscience Specialisation Drug Development & Neurohealth" },
  "4603_T1": { title: "Research Master Cognitive and Clinical Neuroscience Specialisation Fundamental Neuroscience" },
  "4603_T2": { title: "Research Master Cognitive and Clinical Neuroscience Specialisation Neuropsychology" },
  "1611": { title: "Research Master European Studies" },
  "SBE__DD": { title: "SBE: Dual Degree" },
  "SBE__OFC": { title: "SBE: Opleiding Financial Control" },
  "SBE__SLV": { title: "SBE: Opleiding Strategie, Leiderschap en Veranderen" },
  "SBE__TZW": { title: "SBE: Transformatie in Zorg en Welzijn" },
  "CES__SHIE": { title: "Science and Health in Europe" },
  "CES__SES": { title: "Summer programme in European Studies" },
  "CES__WL": { title: "Washington & Lee University" },
  "CES__XAV": { title: "Xavier University" }
})

export const COURSE_REPOSITORY_FALLBACKS = Object.freeze(Object.entries(VERIFIED_PROGRAMMES).map(([code, programme]) => ({
  id: `programme-${code}`,
  kind: 'programme',
  code,
  title: programme.title,
  aliases: programme.aliases || [],
  language: 'EN',
  url: `${BASE}/p/program/EN/${encodeURIComponent(code)}`,
  officialUrl: programme.officialUrl || null,
  resolved: true,
  source: 'verified-index'
})))

let memory = null
const clean = (value, max = 300) => String(value ?? '').trim().slice(0, max)

function decodeXml(value) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

export function parseCourseRepositorySitemap(xml, kind) {
  const entries = []
  for (const block of String(xml || '').matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const url = decodeXml(block[1].match(/<loc>([\s\S]*?)<\/loc>/i)?.[1]?.trim() || '')
    if (!url.startsWith(`${BASE}/`)) continue
    const lastModified = clean(block[1].match(/<lastmod>([\s\S]*?)<\/lastmod>/i)?.[1], 40) || null
    let parsed
    try { parsed = new URL(url) } catch { continue }
    const segments = parsed.pathname.split('/').filter(Boolean)
    const languageIndex = segments.findIndex((segment) => /^(?:EN|NL|DE)$/i.test(segment))
    const id = clean(decodeURIComponent(segments.at(-1) || ''), 100)
    if (!id || languageIndex === segments.length - 1) continue
    const hint = clean(parsed.searchParams.get('name') || parsed.searchParams.get('title') || '', 200)
    const programme = kind === 'programmes' ? VERIFIED_PROGRAMMES[id] : null
    const title = programme?.title || (kind === 'modules' && hint ? hint : null)
    entries.push({
      id: `${kind === 'modules' ? 'module' : 'programme'}-${id || entries.length + 1}`,
      kind: kind === 'modules' ? 'module' : 'programme',
      code: id || null,
      title,
      aliases: programme?.aliases || [],
      language: languageIndex >= 0 ? segments[languageIndex].toUpperCase() : null,
      url,
      officialUrl: programme?.officialUrl || null,
      lastModified,
      resolved: Boolean(title),
      source: 'course-repository'
    })
  }
  return [...new Map(entries.map((entry) => [entry.url, entry])).values()]
}

async function readCache(path) {
  if (memory) return memory
  if (!existsSync(path)) return { schemaVersion: 2, kinds: {} }
  try {
    const stored = JSON.parse(await readFile(path, 'utf8'))
    if (stored?.schemaVersion === 2) { memory = stored; return memory }
    // Migrate the first prototype cache without throwing away a successful
    // upstream fetch. Each sitemap is tracked separately from this point on.
    memory = {
      schemaVersion: 2,
      kinds: Object.fromEntries(['programmes', 'modules'].map((kind) => [kind, {
        fetchedAt: stored?.fetchedAt || null,
        attemptedAt: stored?.fetchedAt || null,
        entries: (stored?.entries || []).filter((entry) => entry.kind === (kind === 'modules' ? 'module' : 'programme')),
        error: null
      }]))
    }
    return memory
  } catch { return { schemaVersion: 2, kinds: {} } }
}

async function writeCache(path, value) {
  memory = value
  try { await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8') } catch {}
}

async function refreshKind(kind, { fetchImpl, now }) {
  const url = SITEMAPS[kind]
  try {
    const { response, text } = await safeFetch(url, { fetchImpl, timeoutMs: 8_000, maxBytes: 6 * 1024 * 1024, headers: { accept: 'application/xml,text/xml;q=0.9', 'user-agent': 'Wicker-Study-Course-Discovery/1.0' } })
    if (!response.ok) throw new Error(`${kind} sitemap answered ${response.status}`)
    const entries = parseCourseRepositorySitemap(text, kind)
    if (!entries.length) throw new Error(`${kind} sitemap returned no usable records`)
    return { fetchedAt: now.toISOString(), attemptedAt: now.toISOString(), entries, error: null }
  } catch (error) {
    return { attemptedAt: now.toISOString(), error: error instanceof Error ? error.message : `${kind} sitemap could not be refreshed` }
  }
}

export async function discoverCourses({ query = '', kind = 'all', limit = 50, fetchImpl = fetch, path = cachePath, now = new Date() } = {}) {
  const needle = clean(query, 100).toLocaleLowerCase()
  const requestedKind = kind === 'programmes' ? 'programme' : kind === 'modules' ? 'module' : 'all'
  // The public page opens with one useful, named official record rather than
  // dumping hundreds of opaque upstream ids. A search opts into the sitemap.
  if (!needle) {
    const featured = COURSE_REPOSITORY_FALLBACKS.filter((entry) => entry.code === '9503' && (requestedKind === 'all' || entry.kind === requestedKind))
    return { entries: featured, total: featured.length, unresolvedTotal: 0, fetchedAt: null, source: 'verified-index', warning: null }
  }
  const catalogue = await readCache(path)
  const requested = kind === 'programmes' ? ['programmes'] : kind === 'modules' ? ['modules'] : ['programmes', 'modules']
  const due = requested.filter((name) => {
    const cached = catalogue.kinds?.[name]
    const age = cached?.fetchedAt ? now.getTime() - new Date(cached.fetchedAt).getTime() : Infinity
    const sinceAttempt = cached?.attemptedAt ? now.getTime() - new Date(cached.attemptedAt).getTime() : Infinity
    return age > FRESH_MS && sinceAttempt > RETRY_MS
  })
  if (due.length) {
    const refreshed = await Promise.all(due.map((name) => refreshKind(name, { fetchImpl, now })))
    for (const [index, name] of due.entries()) {
      const prior = catalogue.kinds?.[name] || { fetchedAt: null, entries: [] }
      const update = refreshed[index]
      catalogue.kinds[name] = update.entries ? update : { ...prior, attemptedAt: update.attemptedAt, error: update.error }
      const age = catalogue.kinds[name].fetchedAt ? now.getTime() - new Date(catalogue.kinds[name].fetchedAt).getTime() : Infinity
      if (age > MAX_STALE_MS) catalogue.kinds[name].entries = []
    }
    await writeCache(path, catalogue)
  }
  const selected = requested.map((name) => catalogue.kinds?.[name]).filter(Boolean)
  const combined = [...selected.flatMap((value) => (value.entries || []).map((entry) => {
    if (entry.kind !== 'programme') return { ...entry, resolved: Boolean(entry.title && !/^Module\s+\S+$/i.test(entry.title)) }
    const programme = VERIFIED_PROGRAMMES[entry.code]
    return programme ? { ...entry, title: programme.title, aliases: programme.aliases || [], officialUrl: programme.officialUrl || entry.officialUrl || null, resolved: true } : { ...entry, title: null, resolved: false }
  })), ...COURSE_REPOSITORY_FALLBACKS]
  const uniqueByRecord = new Map()
  for (const entry of combined) {
    const key = `${entry.kind}:${entry.code}`
    if (!uniqueByRecord.has(key)) uniqueByRecord.set(key, entry)
  }
  const unique = [...uniqueByRecord.values()]
  const candidates = unique.filter((entry) => requestedKind === 'all' || entry.kind === requestedKind)
  const resolved = candidates.filter((entry) => entry.resolved !== false && entry.title)
  const matching = resolved.filter((entry) => !needle || [entry.title, entry.code, entry.language, ...(entry.aliases || [])].some((value) => String(value || '').toLocaleLowerCase().includes(needle)))
  const visibleByName = new Map()
  for (const entry of matching) {
    const key = `${entry.kind}:${entry.title.toLocaleLowerCase()}:${entry.language || ''}`
    if (!visibleByName.has(key)) visibleByName.set(key, entry)
  }
  const filtered = [...visibleByName.values()]
  const errors = selected.map((value) => value.error).filter(Boolean)
  const freshAt = selected.map((value) => value.fetchedAt).filter(Boolean).sort().at(-1) || null
  const hasRepositoryEntries = selected.some((value) => value.entries?.length)
  return {
    entries: filtered.slice(0, Math.max(1, Math.min(100, Number(limit) || 50))),
    total: filtered.length,
    unresolvedTotal: candidates.length - resolved.length,
    fetchedAt: freshAt,
    source: hasRepositoryEntries ? (errors.length ? 'partial-cache' : 'live-cache') : 'verified-index',
    warning: errors.length ? errors.join(' ') : null
  }
}

export function clearCourseRepositoryCache() { memory = null }
