// Wicker Study now lives in papers.wicker.life (papers PR #14, 27 Oct 2026). In production every page sends visitors
// to papers: its /from-study/ brings their programme and plan over, privacy and terms go to papers' privacy page.
// During the grace period sign-in, the MCP connector's consent pages (/connect), /internal, every /api/* route (the
// hosted MCP, OAuth, the stdio package's REST calls), the OAuth discovery documents under /.well-known/ and /skills/
// keep working. MCP clients follow the 401's resource_metadata link to /.well-known/; redirecting it to an HTML page
// broke every connector (issue #121).
export const PAPERS = 'https://papers.wicker.life'
const KEEP = /^\/(?:sign-in|sign-up|connect|internal|canvas|api|\.well-known|skills)(?:\/|$)/

export function papersTarget(pathname) {
  if (KEEP.test(pathname)) return null
  if (/^\/(?:privacy|terms)(?:\/|$)/.test(pathname)) return `${PAPERS}/privacy/`
  return `${PAPERS}/from-study/`
}
