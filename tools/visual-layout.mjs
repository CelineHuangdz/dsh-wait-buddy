import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium } from 'playwright'
import { loadClient } from '../test-support/load-client.mjs'

const HOST_CSS = `
html,body{margin:0;height:100%;background:#0b0e14;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}
.host{height:100%;display:flex;flex-direction:column}
.host-tabs{height:40px;flex:none;display:flex;align-items:center;gap:22px;padding:0 24px;border-bottom:1px solid #2a2a2e;background:#151517;color:#8b8b93;font-size:13px;overflow:hidden}
.host-tabs .active{height:100%;display:flex;align-items:center;color:#f2f2f5;border-bottom:2px solid #6aa8ff}
.host-body{position:relative;flex:1 1 auto;min-height:0;overflow:hidden;background:#151517}
.host-view{height:100%;min-height:0}
.host-todo{position:absolute;left:24px;right:24px;bottom:8px;height:38px;z-index:5;box-sizing:border-box;display:flex;align-items:center;padding:0 14px;border:1px solid #34343a;border-radius:10px;background:#1d1d22;color:#d8d8de;font-size:13px}
.host-composer{height:96px;flex:none;box-sizing:border-box;padding:16px 24px;border-top:1px solid #2a2a2e;background:#151517;color:#6f6f78;font-size:13px}
`
const dict = {
  'status.idle': '空闲 · 等待本会话任务',
  'status.runningStart': '任务开始，Agent 正在规划',
  'status.running': '正在执行任务',
  'status.approval': '【重要】等待你审批工具调用！',
  'status.success': '任务执行成功 ✅',
  'status.failed': '任务执行失败',
  'status.aborted': '任务已中断',
  'status.loading': '正在读取监控数据…',
  'status.degraded': '监控数据不可用',
  'status.stale': '状态同步中断（可能已断开）',
  'status.endedUnknown': '本轮已结束（未知原因）',
  'status.steps': '已完成 {count} 步',
  'status.openChat': '查看对话',
  'status.updated': '更新于 {time}',
  'feed.command': '命令',
  'feed.tool': '工具',
  'feed.empty': '等待 Agent 活动',
  'alert.approval.title': '【重要】等待你审批工具调用',
  'alert.approval.tool': '工具 {tool}',
  'alert.failed.title': '任务执行失败',
  'footer.line': '仅跟踪当前会话 · 游戏与任务独立 · 辅助提醒，不拦截原生审批弹窗',
  'game.title': '贪吃蛇',
  'game.score': '得分 {score}',
  'game.best': '最高 {best}',
  'game.pause': '暂停',
  'game.resume': '继续',
  'game.reset': '重置',
  'game.startBody': '方向键控制，吃到果实得分。',
  'game.start': '开始游戏',
  'game.pausedTitle': '已暂停',
  'game.approvalPausedTitle': '等待审批',
  'game.approvalPausedBody': 'Agent 等待审批，已自动暂停',
  'game.resumeReadyBody': '已处理，按空格或点击继续',
  'game.sessionPausedBody': '切换会话后已暂停，点击继续恢复',
  'game.viewPausedBody': '视图切换后已暂停，点击继续恢复',
  'game.reward': '+{amount}',
  'game.notice.success': '任务完成！+50 分',
  'game.notice.failed': '任务失败',
  'game.notice.aborted': '任务已中断',
  'game.notice.unknown': '本轮已结束',
  'game.overTitle': '游戏结束',
  'game.overBody': '本局得分 {score}',
  'game.again': '再来一局',
  'game.canvasLabel': '贪吃蛇游戏区域，当前得分 {score}',
  'game.hint': '方向键控制，点棋盘后生效',
  'game.speed': '速度',
  'speed.slow': '慢',
  'speed.normal': '标准',
  'speed.fast': '快',
  'gomoku.title': '五子棋',
  'gomoku.level': '难度',
  'level.easy': '初级',
  'level.medium': '中级',
  'level.hard': '高级',
  'gomoku.moves': '你 {you} 手 · 电脑 {ai} 手',
  'gomoku.hint': '点击交叉点落子',
  'gomoku.canvasLabel': '五子棋棋盘，已下 {moves} 手',
  'gomoku.won': '你赢了',
  'gomoku.lost': '电脑赢了',
  'gomoku.draw': '平局',
  'gomoku.again': '再来一局',
}

const t = (key, params = {}) =>
  String(dict[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''))

function state(over = {}) {
  return {
    status: 'success',
    health: 'ready',
    running: false,
    stepCount: 14,
    turn: 1,
    errorMessage: '',
    activity: [
      { kind: 'command', text: "git status --short && git diff --stat" },
      { kind: 'tool', text: 'read_file client.js' },
    ],
    updatedAt: Date.now(),
    revision: 2,
    approvalTool: '',
    pendingKind: '',
    pendingKey: '',
    isAlerting: false,
    ready: true,
    ...over,
  }
}

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

function render(client, monitorState) {
  return renderToStaticMarkup(
    React.createElement(client.__view, {
      sessionId: 'visual-session',
      t,
      openView: () => {},
      __state: monitorState,
    }),
  )
}

function hostDocument(markup, title) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${HOST_CSS}</style></head><body><div class="host"><div class="host-tabs"><span>Chat</span><span>Trajectory</span><span class="active">WaitBuddy</span><span>${title}</span></div><div class="host-body"><div class="host-view">${markup}</div><div class="host-todo">任务 4 已完成</div></div><div class="host-composer">发消息或创建任务，/ 调用指令，@ 文件或会话</div></div></body></html>`
}

const cases = [
  {
    name: 'success-1200',
    width: 1200,
    height: 800,
    monitor: state(),
    setup: (client) => {
      client.__gameStore.start('normal')
      client.__gameStore.handleSignal({ type: 'agent:step_advance', key: '1:1' })
      client.__gameStore.handleSignal({ type: 'agent:step_advance', key: '1:2' })
    },
  },
  {
    name: 'success-320',
    width: 320,
    height: 700,
    monitor: state(),
    setup: (client) => {
      client.__gameStore.start('normal')
    },
  },
  {
    name: 'failed-320',
    width: 320,
    height: 700,
    monitor: state({
      status: 'failed',
      health: 'ready',
      isAlerting: true,
      errorMessage:
        'upstream network unreachable while fetching https://example.com/very/long/path/that/should/wrap/inside/the/alert/without/horizontal/overflow?query=abcdefghijklmnopqrstuvwxyz0123456789',
      activity: [
        {
          kind: 'command',
          text: 'cd /Users/dzhuang/DeepSeekHarness/dsh-wait-buddy && node --input-type=module -e "console.log(\"long command that should wrap\")"',
        },
        { kind: 'tool', text: 'read_file docs/acceptance-runbook.md' },
      ],
    }),
    setup: (client) => {
      client.__gameStore.start('normal')
    },
  },
  {
    name: 'approval-1200',
    width: 1200,
    height: 800,
    monitor: state({
      status: 'pending_approval',
      health: 'ready',
      isAlerting: true,
      approvalTool: 'bash',
      pendingKind: 'approval',
      pendingKey: 'approval:1',
    }),
    setup: (client) => {
      client.__gameStore.start('normal')
      client.__gameStore.handleSignal({ type: 'agent:approval_enter', key: 'approval:1' })
    },
  },
]

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? findHeadlessShell(),
})
let failed = false
fs.mkdirSync('test-results', { recursive: true })

for (const entry of cases) {
  const client = loadClient({ react: React })
  entry.setup(client)
  const markup = render(client, entry.monitor)
  const page = await browser.newPage({ viewport: { width: entry.width, height: entry.height } })
  await page.setContent(hostDocument(markup, entry.name))
  await page.waitForTimeout(50)
  const metrics = await page.evaluate(() => {
    const root = document.querySelector('.wb-root')
    const inner = document.querySelector('.wb-inner')
    const alert = document.querySelector('.wb-alert')
    const setting = document.querySelector('.wb-setting')
    const overlay = document.querySelector('.wb-overlay')
    const rect = (el) => {
      if (el === null) return null
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, height: r.height }
    }
    const tabs = document.querySelector('.host-tabs')
    const todo = document.querySelector('.host-todo')
    const status = document.querySelector('.wb-status')
    const foot = document.querySelector('.wb-gameFoot')
    return {
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      rootOverflowX: root === null ? 0 : root.scrollWidth - root.clientWidth,
      innerOverflowX: inner === null ? 0 : inner.scrollWidth - inner.clientWidth,
      rootDisplay: root === null ? '' : getComputedStyle(root).display,
      innerOverflow: inner === null ? '' : getComputedStyle(inner).overflowY,
      alertParent: alert === null ? '' : alert.parentElement?.className ?? '',
      alertTop: alert === null ? null : alert.getBoundingClientRect().top,
      settingDisplay: setting === null ? '' : getComputedStyle(setting).display,
      overlayText: overlay === null ? '' : overlay.textContent ?? '',
      tabs: rect(tabs),
      todo: rect(todo),
      status: rect(status),
      foot: rect(foot),
      innerScrollHeight: inner === null ? 0 : inner.scrollHeight,
      innerClientHeight: inner === null ? 0 : inner.clientHeight,
    }
  })
  await page.screenshot({ path: `test-results/${entry.name}.png`, fullPage: true })
  const problems = []
  if (metrics.overflowX > 0) problems.push(`horizontal overflow ${metrics.overflowX}px`)
  if (metrics.rootOverflowX > 0) problems.push(`root horizontal overflow ${metrics.rootOverflowX}px`)
  if (metrics.innerOverflowX > 0) problems.push(`inner horizontal overflow ${metrics.innerOverflowX}px`)
  if (metrics.rootDisplay !== 'flex') problems.push(`root display=${metrics.rootDisplay}`)
  if (metrics.innerOverflow !== 'auto') problems.push(`inner overflow=${metrics.innerOverflow}`)
  if (entry.monitor.status === 'failed' && !metrics.alertParent.includes('wb-root')) {
    problems.push(`alert parent=${metrics.alertParent}`)
  }
  if (entry.monitor.status === 'failed' && metrics.alertTop !== null && metrics.alertTop < 0) {
    problems.push('alert is above viewport')
  }
  if (entry.width <= 480 && metrics.settingDisplay !== 'none') {
    problems.push(`setting display=${metrics.settingDisplay} at ${entry.width}px`)
  }
  if (entry.monitor.status === 'pending_approval' && !metrics.overlayText.includes('等待审批')) {
    problems.push(`approval overlay text=${metrics.overlayText}`)
  }
  const topElement = metrics.alertTop !== null ? { top: metrics.alertTop } : metrics.status
  if (metrics.tabs === null || topElement === null) {
    problems.push('missing host tabs or top row')
  } else {
    const topGap = topElement.top - metrics.tabs.bottom
    if (topGap < 7 || topGap > 16) problems.push(`top gap=${topGap.toFixed(1)}px`)
  }
  if (metrics.foot === null || metrics.todo === null) {
    problems.push('missing game foot or todo dock')
  } else if (metrics.innerScrollHeight <= metrics.innerClientHeight + 1) {
    const bottomGap = metrics.todo.top - metrics.foot.bottom
    if (bottomGap < 6) problems.push(`bottom gap=${bottomGap.toFixed(1)}px (todo dock overlays controls)`)
  }
  if (metrics.alertTop !== null && metrics.tabs !== null && metrics.alertTop < metrics.tabs.bottom) {
    problems.push('alert above the view top')
  }
  if (problems.length > 0) {
    failed = true
    console.error(`✖ ${entry.name}: ${problems.join('; ')}`)
  } else {
    console.log(`✔ ${entry.name}: ${entry.width}x${entry.height}`)
  }
  await page.close()
}

await browser.close()
if (failed) process.exit(1)
console.log('visual layout checks passed')
