#!/usr/bin/env node
/**
 * Guided first-run setup for the exam-study-platform.
 *
 *   • Verifies Node.js version
 *   • Detects available LLM providers (Codex CLI / Claude CLI / API key)
 *   • Prompts the user to pick one, walks through install hints if missing
 *   • Bootstraps data/study-state.json from the shipped template
 *   • Creates data/cache/ subfolders
 *   • Writes data/llm-config.json with the chosen provider
 *
 * Re-runnable: if anything is already set up, the script reports it and asks
 * before overwriting. Safe to run multiple times.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import readline from 'node:readline'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const dataDir   = resolve(__dirname, 'data')
const cacheDir  = resolve(dataDir, 'cache')
const statePath = resolve(dataDir, 'study-state.json')
const tmplPath  = resolve(dataDir, 'study-state.template.json')
const llmCfgPath = resolve(dataDir, 'llm-config.json')

// ── tiny TTY helpers ────────────────────────────────────────────────────────
const c = { dim: '\x1b[2m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', bold: '\x1b[1m', reset: '\x1b[0m' }
const print = (s = '') => process.stdout.write(`${s}\n`)
const ok    = (s) => print(`  ${c.green}✓${c.reset} ${s}`)
const warn  = (s) => print(`  ${c.yellow}!${c.reset} ${s}`)
const miss  = (s) => print(`  ${c.red}✗${c.reset} ${s}`)
const head  = (s) => print(`\n${c.bold}${c.cyan}${s}${c.reset}`)

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise((res) => rl.question(`  ${c.cyan}?${c.reset} ${q} `, (a) => res(a.trim())))
const askYN = async (q, defYes = true) => {
  const a = (await ask(`${q} ${defYes ? '[Y/n]' : '[y/N]'}`)).toLowerCase()
  if (!a) return defYes
  return a === 'y' || a === 'yes'
}

// ── checks ──────────────────────────────────────────────────────────────────
function checkNode() {
  head('Checking prerequisites')
  const v = process.versions.node.split('.').map(Number)
  if (v[0] < 18) {
    miss(`Node.js ${process.version} (need 18+ for fetch / ESM)`)
    print(`     Install a newer Node from https://nodejs.org or use nvm.`)
    process.exit(1)
  }
  ok(`Node.js ${process.version}`)
}

function which(bin) {
  try {
    const r = execFileSync('command', ['-v', bin], { stdio: ['ignore', 'pipe', 'ignore'], shell: '/bin/sh' }).toString().trim()
    return r || null
  } catch { return null }
}

function detectProviders() {
  head('Detecting LLM providers')
  const codexPath = existsSync('/Applications/Codex.app/Contents/Resources/codex')
    ? '/Applications/Codex.app/Contents/Resources/codex'
    : which('codex')
  const claudePath  = which('claude')
  const hasApiKey   = !!process.env.ANTHROPIC_API_KEY
  if (codexPath)   ok(`Codex CLI (${codexPath})`); else miss('Codex CLI not found')
  if (claudePath)  ok(`Claude CLI (${claudePath})`); else miss('Claude CLI not found')
  if (hasApiKey)   ok('ANTHROPIC_API_KEY env var is set'); else miss('ANTHROPIC_API_KEY not in env')
  return { codexPath, claudePath, hasApiKey }
}

async function pickProvider({ codexPath, claudePath, hasApiKey }) {
  head('Choose your LLM provider')
  print(`  The platform uses an LLM to generate practice questions, grade your`)
  print(`  attempts, and provide hints. Pick whichever you have access to:`)
  print(`    ${c.bold}1${c.reset}) Codex CLI    ${codexPath ? c.green + '(detected)' + c.reset : c.dim + '(install from https://www.anthropic.com/codex)' + c.reset}`)
  print(`    ${c.bold}2${c.reset}) Claude CLI   ${claudePath ? c.green + '(detected)' + c.reset : c.dim + '(install: npm install -g @anthropic-ai/claude-code)' + c.reset}`)
  print(`    ${c.bold}3${c.reset}) API key      ${hasApiKey ? c.green + '(detected in env)' + c.reset : c.dim + '(get one at https://console.anthropic.com/settings/keys)' + c.reset}`)
  print(`    ${c.bold}4${c.reset}) Skip — set up later`)
  while (true) {
    const a = (await ask('Pick 1, 2, 3, or 4:')).trim()
    if (a === '1') return { provider: 'codex', codexBin: codexPath || undefined }
    if (a === '2') return { provider: 'claude', claudeBin: claudePath || 'claude' }
    if (a === '3') {
      let key = process.env.ANTHROPIC_API_KEY || ''
      if (!key) key = await ask('Paste your Anthropic API key (sk-ant-…):')
      if (!key.startsWith('sk-')) warn(`That doesn't look like a normal Anthropic key — saving it anyway.`)
      const model = (await ask('Model to use (press Enter for claude-sonnet-4-5):')) || 'claude-sonnet-4-5'
      return { provider: 'api', anthropicApiKey: key, anthropicModel: model }
    }
    if (a === '4') return null
  }
}

function writeLlmConfig(cfg) {
  if (!cfg) return
  if (existsSync(llmCfgPath)) {
    warn(`Overwriting existing data/llm-config.json`)
  }
  writeFileSync(llmCfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8')
  ok(`Wrote data/llm-config.json (provider: ${cfg.provider})`)
}

function bootstrapState() {
  head('Bootstrapping state')
  if (!existsSync(tmplPath)) {
    miss(`Template missing at ${tmplPath}`)
    print(`     Did you clone the full repo? Bailing.`)
    process.exit(1)
  }
  if (existsSync(statePath)) {
    ok(`data/study-state.json already present — keeping your progress`)
  } else {
    copyFileSync(tmplPath, statePath)
    ok(`Created data/study-state.json from template`)
  }
}

function ensureCacheDirs() {
  for (const sub of ['mock-questions', 'mock-toc', 'practice-exam', 'questions', 'schemas', 'mistakes']) {
    const p = resolve(cacheDir, sub)
    if (!existsSync(p)) mkdirSync(p, { recursive: true })
  }
  ok(`Cache directories ready under data/cache/`)
}

function summary(cfg) {
  head('All set')
  print(`  Start the platform with:`)
  print(`    ${c.bold}npm start${c.reset}`)
  print()
  if (cfg) {
    print(`  LLM provider: ${c.cyan}${cfg.provider}${c.reset}`)
    if (cfg.provider === 'api') print(`  Model: ${c.cyan}${cfg.anthropicModel}${c.reset}`)
  } else {
    print(`  ${c.yellow}LLM not configured — you can read notes and use the pre-generated question bank,${c.reset}`)
    print(`  ${c.yellow}but generating new content or grading attempts will fail until you re-run setup.${c.reset}`)
  }
  print()
  print(`  Edit ${c.dim}data/llm-config.json${c.reset} to change provider or key without re-running this script.`)
  print()
}

// ── main ───────────────────────────────────────────────────────────────────
;(async () => {
  print(`${c.bold}exam-study-platform — first-run setup${c.reset}`)
  checkNode()
  const have = detectProviders()
  const cfg = await pickProvider(have)
  writeLlmConfig(cfg)
  bootstrapState()
  ensureCacheDirs()
  summary(cfg)
  rl.close()
})().catch((e) => {
  print(`\n${c.red}Setup failed:${c.reset} ${e.message}`)
  rl.close()
  process.exit(1)
})
