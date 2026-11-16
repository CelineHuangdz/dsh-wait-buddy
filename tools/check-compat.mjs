#!/usr/bin/env node
/**
 * Compat-contract drift gate.
 *
 * `docs/compat.md` is the checklist used to validate a new DSH version. A
 * checklist that disagrees with the code is worse than no checklist, so this
 * script asserts the hand-written constants against the source of truth:
 *   - projection `stateVersion` (index.js)
 *   - projection `key` (index.js)
 *   - locale namespace (src/client/00-prologue.mjs)
 *
 * No dependencies; safe to run before `pnpm install` in CI.
 */
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(file, 'utf8')
const index = read('index.js')
const prologue = read('src/client/00-prologue.mjs')
const compat = read('docs/compat.md')

const matchOne = (text, pattern, what) => {
  const match = text.match(pattern)
  if (match === null || match[1] === undefined) {
    throw new Error(`[check-compat] cannot read ${what} from source`)
  }
  return match[1]
}

const stateVersion = matchOne(index, /stateVersion:\s*(\d+)/u, 'stateVersion')
const projectionKey = matchOne(index, /key:\s*'([^']+)'/u, 'projection key')
const localeNs = matchOne(prologue, /const NS = '([^']+)'/u, 'locale namespace')

const failures = []
const expectMatch = (pattern, what) => {
  if (!pattern.test(compat)) failures.push(`docs/compat.md: missing ${what} (${pattern})`)
}

expectMatch(new RegExp(`stateVersion:\\s*${stateVersion}\\b`, 'u'), `stateVersion ${stateVersion}`)
expectMatch(new RegExp(`key:\\s*'${projectionKey.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}'`, 'u'), `projection key '${projectionKey}'`)
expectMatch(new RegExp(`NS\\s+\`${localeNs.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\``, 'u'), `locale NS \`${localeNs}\``)

// If the Host fold consumes tool/result, the compat table must list it.
if (index.includes("case 'tool/result'")) {
  expectMatch(/`tool\/result`/u, 'tool/result dependency')
}

if (failures.length > 0) {
  console.error('[check-compat] FAIL')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log(
  `[check-compat] OK — stateVersion ${stateVersion}, key '${projectionKey}', locale NS \`${localeNs}\` match docs/compat.md`,
)
