#!/usr/bin/env node
/**
 * Build the plugin client from src/client/ fragments (D38/D44).
 *
 * The host loads exactly one client.js per plugin, so the "module" stays a
 * single file: this script concatenates the ordered fragments in src/client/
 * into client.js — no bundler, no transformation, byte-for-byte the joined
 * fragments. Edit fragments, then run `npm run build:client`.
 *
 * `--check` compares the build output with the committed client.js and exits
 * non-zero on drift (wired into CI so a fragment edit without a rebuild
 * cannot ship).
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const FRAGMENTS_DIR = 'src/client'
const OUTPUT = 'client.js'

const fragments = readdirSync(FRAGMENTS_DIR)
  .filter((name) => name.endsWith('.mjs'))
  .sort()
if (fragments.length === 0) {
  console.error(`[build:client] no fragments found in ${FRAGMENTS_DIR}`)
  process.exit(1)
}

let built = ''
for (const name of fragments) {
  let text = readFileSync(join(FRAGMENTS_DIR, name), 'utf8')
  if (!text.endsWith('\n')) text += '\n'
  built += text
}

// Content-derived build id, appended after the factory: identical fragments
// always produce the identical id, so `--check` stays deterministic. The id
// is readable as window.__WB_BUILD_ID__ at runtime — the host serves plugin
// clients from an activation-time snapshot, so a page refresh can deliver a
// stale bundle; this id lets anyone verify which build is actually live.
const buildId = createHash('sha256').update(built).digest('hex').slice(0, 8)
built += `\n;window.__WB_BUILD_ID__ = '${buildId}';\n`

if (process.argv.includes('--check')) {
  const committed = readFileSync(OUTPUT, 'utf8')
  if (committed === built) {
    console.log(`[build:client] OK — ${OUTPUT} matches ${fragments.length} fragments (build ${buildId})`)
  } else {
    console.error(
      `[build:client] DRIFT — ${OUTPUT} differs from the ${fragments.length} fragments in ${FRAGMENTS_DIR}. Run: npm run build:client`,
    )
    process.exit(1)
  }
} else {
  writeFileSync(OUTPUT, built)
  console.log(`[build:client] wrote ${OUTPUT} from ${fragments.length} fragments (build ${buildId})`)
}
