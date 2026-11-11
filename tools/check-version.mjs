#!/usr/bin/env node
/**
 * Version-consistency + syntax gate (Phase A, release 0.6.1).
 *
 * Fails when any of these disagree with package.json:
 *   - README.md / README_CN.md version badge
 *   - CHANGELOG.md top entry
 *   - docs/release.md "current release" references
 * Also runs `node --check` on every top-level .js entry and parses all JSON.
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { globSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const version = pkg.version
const failures = []

const expect = (file, needle, what) => {
  const text = readFileSync(file, 'utf8')
  if (!text.includes(needle)) {
    failures.push(`${file}: expected ${what} (${JSON.stringify(needle)}) not found`)
  }
}

expect('README.md', `version-${version}-blue`, 'version badge')
expect('README_CN.md', `version-${version}-blue`, 'version badge')
expect('CHANGELOG.md', `## ${version} `, 'top changelog entry')
expect('docs/release.md', `v${version}`, 'current release tag')

for (const js of ['index.js', 'client.js']) {
  try {
    execFileSync(process.execPath, ['--check', js], { stdio: 'pipe' })
  } catch (error) {
    failures.push(`node --check ${js}: ${error.stderr || 'failed'}`)
  }
}

for (const jsonFile of [...globSync('locale/*.json'), 'package.json']) {
  try {
    JSON.parse(readFileSync(jsonFile, 'utf8'))
  } catch (error) {
    failures.push(`JSON parse ${jsonFile}: ${error.message}`)
  }
}

if (failures.length > 0) {
  console.error(`[check-version] FAIL (expected version ${version})`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log(`[check-version] OK — package.json, READMEs, CHANGELOG, release.md all at ${version}; JS syntax and JSON valid`)
