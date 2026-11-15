#!/usr/bin/env node
/**
 * Full host-simulation repro: runs the real apply(ctx) registration against a
 * mock ctx, renders the registered conversation.view component (ErrorBoundary
 * included) with a live monitor source — the closest thing to the real host
 * that runs offline. Reports slot-crash errors like the host does.
 *
 * Usage: node tools/view-live.mjs [width] [height] [sessionStatus: idle|running]
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

function findHeadlessShell() {
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright')
  if (!fs.existsSync(cache)) return undefined
  const dirs = fs.readdirSync(cache).filter((n) => n.startsWith('chromium_headless_shell-')).sort().reverse()
  for (const dir of dirs) {
    for (const sub of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64', 'chrome-headless-shell-linux64']) {
      const candidate = path.join(cache, dir, sub, 'chrome-headless-shell')
      if (fs.existsSync(candidate)) return candidate
    }
  }
  return undefined
}

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname))
const width = Number(process.argv[2] ?? 1200)
const height = Number(process.argv[3] ?? 800)
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const reactSrc = read('node_modules/react/cjs/react.production.js')
const domSrc = read('node_modules/react-dom/cjs/react-dom.production.js')
const domClientSrc = read('node_modules/react-dom/cjs/react-dom-client.production.js')
const clientSrc = read('client.js')

const schedulerStub = `
window.__modules['scheduler'] = {
  unstable_now: () => performance.now(),
  unstable_scheduleCallback: (_p, fn) => ({ id: setTimeout(fn, 0) }),
  unstable_cancelCallback: (h) => clearTimeout(h && h.id),
  unstable_shouldYield: () => false,
  unstable_getFirstCallbackNode: () => null,
  unstable_pauseExecution: () => {},
  unstable_continueExecution: () => {},
  unstable_getCurrentPriorityLevel: () => 3,
  unstable_requestPaint: () => {},
  unstable_setDisableYieldValue: () => {},
  log: () => {},
  unstable_ImmediatePriority: 1,
  unstable_UserBlockingPriority: 2,
  unstable_NormalPriority: 3,
  unstable_LowPriority: 4,
  unstable_IdlePriority: 5,
}
`

const pageScript = `
window.__modules = {}
function loadCjs(name, src) {
  const module = { exports: {} }
  const fn = new Function('module', 'exports', 'require', 'process', src)
  fn(module, module.exports, (id) => window.__modules[id], { env: { NODE_ENV: 'production' } })
  window.__modules[name] = module.exports
}
loadCjs('react', ${JSON.stringify(reactSrc)})
loadCjs('react-dom', ${JSON.stringify(domSrc)})
${schedulerStub}
loadCjs('react-dom/client', ${JSON.stringify(domClientSrc)})
window.__ModuleLoader__ = { load(def) { window.__DEF__ = def } }
${clientSrc}
window.__API__ = window.__DEF__.factory((id) => {
  if (id === 'react') return window.__modules.react
  throw new Error('unexpected require ' + id)
})
// ---- mock host ctx (mirrors the real service surface) ----
const listeners = { face: new Set(), session: new Set(), status: new Set() }
const durable = {
  status: 'running',
  running: true,
  stepCount: 5,
  turn: 1,
  reasonCode: '',
  errorMessage: '',
  activity: [
    { kind: 'command', text: 'git status --short', count: 2 },
    { kind: 'tool', text: 'Read /a.js', count: 3 },
  ],
  updatedAt: Date.now(),
  revision: 3,
  approvalTool: '',
  pendingKind: '',
  pendingKey: '',
  pendingDetail: '',
}
const face = { getSnapshot: () => durable, subscribe: (fn) => listeners.face.add(fn) }
const session = { getSnapshot: () => ({}), subscribe: (fn) => listeners.session.add(fn), projections: { faceOf: () => face } }
const binding = { session }
window.__CTX__ = {
  sessions: {
    binding: () => binding,
    refreshProjections: () => Promise.resolve(),
  },
  get: (name) => (name === 'uiSession' ? { sessionStatus: { getSnapshot: () => new Map(), subscribe: (fn) => listeners.status.add(fn) } } : undefined),
  locale: { bind: () => (key) => key, register: () => {} },
  slots: {
    inject: (slotName, cb) => { (window.__INJECTORS__ = window.__INJECTORS__ || {})[slotName] = cb },
    register: (spec, comp) => { (window.__SLOTS__ = window.__SLOTS__ || []).push({ spec, comp }) },
  },
  effect(fn) { const d = fn(); if (typeof d === 'function') (window.__DISPOSERS__ = window.__DISPOSERS__ || []).push(d) },
}
window.__API__.apply(window.__CTX__)
`

const browser = await chromium.launch({ headless: true, executablePath: findHeadlessShell() })
const page = await browser.newPage({ viewport: { width, height } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300))
})
await page.setContent('<!doctype html><html><body style="margin:0;background:#151517"><div id="root" style="height:100vh"></div><div id="pill"></div></body></html>')
await page.addScriptTag({ content: pageScript })

const mountResult = await page.evaluate(() => {
  const React = window.__modules.react
  const ReactDOM = window.__modules['react-dom/client']
  for (const name of Object.keys(window.__INJECTORS__ ?? {})) {
    try { window.__INJECTORS__[name]() } catch (e) { console.log('[injector]', name, e.message) }
  }
  const slot = (window.__SLOTS__ ?? []).find((s) => s.spec.name === 'conversation.view')
  if (slot === undefined) return { mounted: false, reason: 'no conversation.view slot' }
  const root = ReactDOM.createRoot(document.getElementById('root'))
  root.render(React.createElement(slot.comp, { sessionId: 's1' }))
  window.__ROOT__ = root
  // The pill lives on shell.overlay with its own error boundary + same
  // fallback copy — mount it too (presence=pill).
  const pill = (window.__SLOTS__ ?? []).find((s) => s.spec.name === 'shell.overlay')
  if (pill !== undefined) {
    const pillRoot = ReactDOM.createRoot(document.getElementById('pill'))
    pillRoot.render(React.createElement(pill.comp, { sessionId: 's1' }))
  }
  return { mounted: true, label: slot.spec.label ? slot.spec.label() : '' }
})
console.log('mount:', JSON.stringify(mountResult))
await page.waitForTimeout(1200)

// Interact: switch to the Safari tab, open dex, click the board.
const interactions = []
for (const [name, text] of [['safari', 'sf.title'], ['dex', 'sf.dexBtn'], ['close', 'sf.dexClose']]) {
  const ok = await page
    .getByText(text, { exact: false })
    .first()
    .click({ timeout: 3000 })
    .then(() => true)
    .catch(() => false)
  interactions.push(`${name}:${ok}`)
  await page.waitForTimeout(400)
}
console.log('interactions:', interactions.join(' '))
// press space probe: measure scroll before/after a real (trusted) Space press
const probe = await page.evaluate(() => {
  const scrollables = []
  const scan = (el, depth) => {
    if (el === null || depth > 8) return
    for (const child of el.children) scan(child, depth + 1)
    if (el.scrollHeight > el.clientHeight + 2) {
      scrollables.push({ tag: el.tagName, cls: String(el.className).slice(0, 40), top: el.scrollTop, sh: el.scrollHeight, ch: el.clientHeight })
    }
  }
  scan(document.body, 0)
  return { win: window.scrollY, doc: document.scrollingElement.scrollTop, scrollables }
})
console.log('before space:', JSON.stringify(probe))
// ime probe: an IME-mangled Space (key='Process', code='Space') must still be consumed
const ime = await page.evaluate(() => {
  const ev = new KeyboardEvent('keydown', { key: 'Process', code: 'Space', bubbles: true, cancelable: true })
  document.dispatchEvent(ev)
  return { prevented: ev.defaultPrevented }
})
console.log('ime probe:', JSON.stringify(ime))
await page.keyboard.press('Space')
await page.waitForTimeout(300)
const probe2 = await page.evaluate(() => {
  const scrollables = []
  const scan = (el, depth) => {
    if (el === null || depth > 8) return
    for (const child of el.children) scan(child, depth + 1)
    if (el.scrollHeight > el.clientHeight + 2) {
      scrollables.push({ tag: el.tagName, cls: String(el.className).slice(0, 40), top: el.scrollTop, sh: el.scrollHeight, ch: el.clientHeight })
    }
  }
  scan(document.body, 0)
  return { win: window.scrollY, doc: document.scrollingElement.scrollTop, scrollables }
})
console.log('after space:', JSON.stringify(probe2))
const crash = await page.evaluate(() => {
  const el = document.querySelector('.wb-crash')
  return el === null ? null : el.textContent
})
console.log('crash:', crash === null ? 'none' : crash)
await page.screenshot({ path: 'test-results/view-live.png', fullPage: false })
await browser.close()
