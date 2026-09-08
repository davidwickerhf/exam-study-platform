import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

export const guidance = readFileSync(new URL('./guidance.md', import.meta.url), 'utf8')
export const mcpVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version
export const guidanceUri = 'wicker://guidance/current'
export const guidanceInfo = Object.freeze({ version: mcpVersion, sha256: createHash('sha256').update(guidance).digest('hex'), tool: 'wicker_guidance', resource: guidanceUri })
export const guidanceInstructions = `Wicker Study supplies its workflow guidance through this MCP connection. Call wicker_status and wicker_guidance once at the start of a Wicker Study session before selecting study tools; fetch guidance again when the MCP version changes. No separate skill download is needed. wicker_guidance is a read of the guide bundled with this exact MCP release, not a hosted model call. Use this release's guide and tool schemas instead of older copied workflow documentation; preserve the user's instructions and confirmation requirements for writes. Notice lasting student preferences, project decisions and availability during conversations: check tutor_sources, proactively prepare a concise context update, and save only after the required approval. A draft is not saved memory. Prefer focused source reads and prepare_original_download with native HTTP/file tools when a complete original is needed; keep its temporary file capability out of chat/logs and verify size/hash. The local package adds optional admin and bulk-import helpers. Never request credentials in chat.`

export function registerGuidance(server) {
  server.registerResource('wicker-guidance', guidanceUri, { title: 'Wicker Study workflow guide', description: `Workflow guidance bundled with MCP ${mcpVersion}. Also available through wicker_guidance.`, mimeType: 'text/markdown' }, async () => ({ contents: [{ uri: guidanceUri, mimeType: 'text/markdown', text: guidance }] }))
  server.tool('wicker_guidance', 'Read the current Wicker Study workflow guide once per session/connection before selecting tools. Includes proactive saved context, original files, source-backed course rules, attendance, practice and local generation. Ships with this MCP version, needs no account or model call, and replaces separately downloaded workflow instructions. Read it again after updating MCP.', {}, async () => ({ content: [{ type: 'text', text: JSON.stringify({ ...guidanceInfo, content: guidance }) }] }))
}
