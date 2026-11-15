#!/usr/bin/env node
/**
 * Live-DOM repro harness for the Safari board (beyond the static visual
 * harness): mounts the real client view with real React effects, switches to
 * the Safari tab, then reports store grid dims vs. the measured canvas and
 * screenshots the board — catches fitBoard timing bugs the static harness
 * cannot see (effects never run there).
 *
 * Usage: node tools/safari-live.mjs [width] [height]
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

function findHeadlessShell() {
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright')
  if (!fs.existsSync(cache)) return undefined
  const dirs = fs
    .readdirSync(cache)
    .filter((name) => name.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse()
  for (const dir of dirs) {
    const candidates = [
      path.join(cache, dir, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell'),
      path.join(cache, dir, 'chrome-headless-shell-mac-x64', 'chrome-headless-shell'),
      path.join(cache, dir, 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
    ]
    for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate
  }
  return undefined
}

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname))
const width = Number(process.argv[2] ?? 1200)
const height = Number(process.argv[3] ?? 800)

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')

// Minimal CJS loader so React + ReactDOM run inside the page.
const reactSrc = read('node_modules/react/cjs/react.production.js')
const domSrc = read('node_modules/react-dom/cjs/react-dom.production.js')
const domClientSrc = read('node_modules/react-dom/cjs/react-dom-client.production.js')
const clientSrc = read('client.js')

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
// Minimal synchronous scheduler stub: the scheduler package is not installed
// locally, but React only needs the callback API to eventually run.
window.__modules['scheduler'] = {
  unstable_now: () => performance.now(),
  // Real async scheduling (setTimeout) — running callbacks synchronously
  // inside scheduleCallback breaks React's commit state machine and effects
  // silently never attach.
  unstable_scheduleCallback: (_priority, fn) => {
    const handle = { id: setTimeout(fn, 0) }
    return handle
  },
  unstable_cancelCallback: (handle) => clearTimeout(handle.id),
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
window.__ModuleLoader__ = { load(def) { window.__PLUGIN_DEF__ = def } }
${clientSrc}
window.__API__ = window.__PLUGIN_DEF__.factory((id) => {
  if (id === 'react') return window.__modules.react
  throw new Error('unexpected require ' + id)
})
window.__API__.__installRuntime()
`

const dict = {
  'view.label': 'WaitBuddy',
  'footer.line': '仅跟踪当前会话 · 游戏与任务独立 · 辅助提醒，不拦截原生弹窗',
  'status.success': '任务执行成功 ✅',
  'status.idle': '空闲',
  'status.openChat': '查看对话',
  'feed.command': '命令',
  'feed.tool': '工具',
  'feed.empty': '等待 Agent 活动',
  'feed.copy': '复制全文',
  'feed.copied': '已复制',
  'feed.pulseIdle': '近 1 分钟无工具活动',
  'feed.pulseLive': '近 1 分钟工具活动',
  'game.title': '贪吃蛇',
  'gomoku.title': '五子棋',
  'sf.title': '抓精灵',
  'sf.hint': '点击自动寻路，或方向键 / WASD 逐格探索；踩草可能遇到精灵',
  'sf.dexBtn': '图鉴',
  'sf.dexCount': '图鉴 {caught}/{total}',
  'sf.region': '区域 {n}',
  'sf.nextRegion': '换区域',
  'game.speed': '速度',
  'gomoku.level': '难度',
  'presence.steps': '{count} 步 · {elapsed}',
  'presence.successSteps': 'Done · {count} steps',
  'shortcut.label': '快捷键',
  'shortcut.on': '开',
  'shortcut.off': '关',
  'notify.enable': '启用系统通知',
}
const t = (key, params = {}) =>
  String(dict[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''))

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? findHeadlessShell(),
})
const page = await browser.newPage({ viewport: { width, height } })
page.on('console', (msg) => console.log('[page]', msg.type(), msg.text()))
page.on('pageerror', (err) => console.log('[pageerror]', err.message))
await page.setContent(`<!doctype html><html><body style="margin:0"><div id="root"></div></body></html>`)
await page.addScriptTag({ content: pageScript })

await page.evaluate((dictJson) => {
  const React = window.__modules.react
  const ReactDOM = window.__modules['react-dom/client']
  const api = window.__API__
  const dict = JSON.parse(dictJson)
  const t = (key, params = {}) =>
    String(dict[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''))
  const monitorState = {
    status: 'idle',
    running: false,
    stepCount: 0,
    turn: 0,
    reasonCode: '',
    errorMessage: '',
    activity: [],
    updatedAt: Date.now(),
    revision: 0,
    approvalTool: '',
    pendingKind: '',
    pendingKey: '',
    pendingDetail: '',
    health: 'ready',
    isAlerting: false,
    ready: true,
  }
  const root = ReactDOM.createRoot(document.getElementById('root'))
  root.render(
    React.createElement(api.__view, { sessionId: null, t, openView: () => {}, __state: monitorState }),
  )
  window.__ROOT__ = root
}, JSON.stringify(dict))

// Switch to the Safari tab, open the dex, walk somewhere.
await page.getByText('抓精灵', { exact: true }).first().click()
await page.waitForTimeout(600)
await page.getByText('图鉴', { exact: true }).first().click().catch((e) => console.log('[dex click]', e.message))
await page.waitForTimeout(400)
await page.locator('.wb-boardWrap > canvas').click({ position: { x: 200, y: 180 } }).catch((e) => console.log('[board click]', e.message))
await page.waitForTimeout(800)
await page.getByText('关闭', { exact: true }).first().click().catch(() => {})

const report = await page.evaluate(() => {
  const canvas = document.querySelector('.wb-boardWrap > canvas')
  const rect = canvas === null ? null : canvas.getBoundingClientRect()
  const api = window.__API__
  const snap = api.__safariStore.getSnapshot()
  const expected = api.__game.sfFitDims(rect === null ? 0 : rect.width, rect === null ? 0 : rect.height)
  // Probe: does a manual fit work at all (store logic) vs. the effect never
  // firing (wiring)?
  api.__safariStore.fitBoard(rect === null ? 0 : rect.width, rect === null ? 0 : rect.height)
  const afterManual = api.__safariStore.getSnapshot()
  return {
    canvasRect: rect === null ? null : { w: rect.width, h: rect.height },
    storeDims: { cols: snap.cols, rows: snap.rows },
    expectedDims: expected,
    manualFitDims: { cols: afterManual.cols, rows: afterManual.rows },
    roSupported: typeof ResizeObserver === 'function',
  }
})
console.log(JSON.stringify(report, null, 2))

const board = page.locator('.wb-boardWrap')
await board.screenshot({ path: 'test-results/safari-live.png' })

// Simulate a late layout change (panel grows after mount).
await page.setViewportSize({ width: width + 500, height })
await page.waitForTimeout(600)
const after = await page.evaluate(() => {
  const canvas = document.querySelector('.wb-boardWrap > canvas')
  const rect = canvas === null ? null : canvas.getBoundingClientRect()
  const snap = window.__API__.__safariStore.getSnapshot()
  const expected = window.__API__.__game.sfFitDims(rect === null ? 0 : rect.width, rect === null ? 0 : rect.height)
  return {
    canvasRect: rect === null ? null : { w: rect.width, h: rect.height },
    storeDims: { cols: snap.cols, rows: snap.rows },
    expectedDims: expected,
    refitAfterResize: snap.cols === expected.cols && snap.rows === expected.rows,
  }
})
console.log('after resize:', JSON.stringify(after))
await board.screenshot({ path: 'test-results/safari-live-resized.png' })
await browser.close()
