#!/usr/bin/env node
/** Debug: render all 54 pixel species into a sheet PNG (tools/sprite-sheet). */
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
const clientSrc = fs.readFileSync(path.join(root, 'client.js'), 'utf8')

const reactSrc = fs.readFileSync(path.join(root, 'node_modules/react/cjs/react.production.js'), 'utf8')
const domSrc = fs.readFileSync(path.join(root, 'node_modules/react-dom/cjs/react-dom.production.js'), 'utf8')
const domClientSrc = fs.readFileSync(path.join(root, 'node_modules/react-dom/cjs/react-dom-client.production.js'), 'utf8')
const reactBootstrap = `
window.__modules = {}
function loadCjs(name, src) {
  const module = { exports: {} }
  const fn = new Function('module', 'exports', 'require', 'process', src)
  fn(module, module.exports, (id) => window.__modules[id], { env: { NODE_ENV: 'production' } })
  window.__modules[name] = module.exports
}
loadCjs('react', ${JSON.stringify(reactSrc)})
loadCjs('react-dom', ${JSON.stringify(domSrc)})
window.__modules['scheduler'] = {
  unstable_now: () => performance.now(),
  unstable_scheduleCallback: (_p, fn) => ({ id: setTimeout(fn, 0) }),
  unstable_cancelCallback: (h) => clearTimeout(h.id),
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
loadCjs('react-dom/client', ${JSON.stringify(domClientSrc)})
`

const browser = await chromium.launch({ headless: true, executablePath: findHeadlessShell() })
const page = await browser.newPage({ viewport: { width: 6 * 96, height: 9 * 96 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.setContent('<body style="margin:0;background:#0d1624"><div id="s"></div></body>')
await page.addScriptTag({
  content: reactBootstrap + `\nwindow.__ModuleLoader__ = { load(def) { window.__DEF__ = def } }\n${clientSrc}\nwindow.__G__ = window.__DEF__.factory((id) => window.__modules[id])`,
})
await page.evaluate(() => {
  const api = window.__G__
  const host = document.getElementById('s')
  for (let s = 0; s < 54; s += 1) {
    const cell = document.createElement('div')
    cell.style.cssText = 'display:inline-flex;flex-direction:column;align-items:center;margin:6px;color:#8b9bb5;font:9px monospace'
    const canvas = document.createElement('canvas')
    canvas.width = 24
    canvas.height = 24
    canvas.style.width = '64px'
    canvas.style.height = '64px'
    canvas.style.imageRendering = 'pixelated'
    canvas.style.background = '#141f2e'
    canvas.style.borderRadius = '4px'
    api.__game.sfPaintSprite(canvas.getContext('2d'), s, 24)
    const label = document.createElement('span')
    label.textContent = '#' + String(s + 1).padStart(2, '0')
    cell.append(canvas, label)
    host.append(cell)
  }
})
await page.screenshot({ path: 'test-results/sprite-sheet.png' })
await browser.close()
console.log('wrote test-results/sprite-sheet.png')
