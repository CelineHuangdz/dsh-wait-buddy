import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadClient } from '../test-support/load-client.mjs'

const client = loadClient({ react: React })
const { AlertBanner, gameOverlay } = client.__components

const dict = {
  'alert.approval.title': '【重要】等待你审批工具调用',
  'alert.approval.tool': '工具 {tool}',
  'alert.failed.title': '任务执行失败',
  'game.startBody': '方向键控制，吃到果实得分。',
  'game.start': '开始游戏',
  'game.pausedTitle': '已暂停',
  'game.approvalPausedTitle': '等待审批',
  'game.approvalPausedBody': 'Agent 等待审批，已自动暂停',
  'game.resumeReadyBody': '已处理，按空格或点击继续',
  'game.sessionPausedBody': '切换会话后已暂停，点击继续恢复',
  'game.manualPausedBody': '已手动暂停，点击继续恢复',
  'game.viewPausedBody': '视图切换后已暂停，点击继续恢复',
  'game.resume': '继续',
  'game.overTitle': '游戏结束',
  'game.overBody': '本局得分 {score}',
  'game.again': '再来一局',
}

const t = (key, params = {}) =>
  String(dict[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''))

const render = (element) => renderToStaticMarkup(element)

const paused = (over = {}) => ({
  status: 'paused',
  pauseReason: '',
  resumeReason: '',
  resumeReady: false,
  score: 10,
  ...over,
})

test('AlertBanner shows approval tool / failure reason', () => {
  const approval = render(
    React.createElement(AlertBanner, {
      t,
      state: { status: 'pending_approval', approvalTool: 'bash', errorMessage: '' },
    }),
  )
  assert.match(approval, /等待你审批/)
  assert.match(approval, /bash/)

  const failed = render(
    React.createElement(AlertBanner, {
      t,
      state: { status: 'failed', approvalTool: '', errorMessage: 'network down' },
    }),
  )
  assert.match(failed, /任务执行失败/)
  assert.match(failed, /network down/)
})

test('paused overlay explains approval pause and disables resume', () => {
  const html = render(gameOverlay(t, paused({ pauseReason: 'approval' }), () => {}))
  assert.match(html, /等待审批/)
  assert.match(html, /已自动暂停/)
  assert.match(html, /disabled/)
})

test('paused overlay explains session/view switches', () => {
  const session = render(gameOverlay(t, paused({ pauseReason: 'session-switch' }), () => {}))
  assert.match(session, /切换会话后已暂停/)
  assert.doesNotMatch(session, /disabled/)

  const view = render(gameOverlay(t, paused({ pauseReason: 'view-inactive' }), () => {}))
  assert.match(view, /视图切换后已暂停/)
})

test('approval leave shows the manual resume hint; manual pause stays generic', () => {
  const ready = render(
    gameOverlay(t, paused({ pauseReason: '', resumeReason: 'approval', resumeReady: true }), () => {}),
  )
  assert.match(ready, /已处理，按空格或点击继续/)

  const manual = render(gameOverlay(t, paused({ pauseReason: 'manual' }), () => {}))
  assert.match(manual, /已手动暂停/)
  assert.doesNotMatch(manual, /已处理/)
})

test('approval outranks game-over and idle overlays', () => {
  const over = render(
    gameOverlay(t, { status: 'over', pauseReason: 'approval', score: 235 }, () => {}),
  )
  assert.match(over, /等待审批/)
  assert.doesNotMatch(over, /游戏结束/)
  assert.doesNotMatch(over, /再来一局/)

  const idle = render(
    gameOverlay(t, { status: 'idle', pauseReason: 'approval', score: 0 }, () => {}),
  )
  assert.match(idle, /等待审批/)
  assert.doesNotMatch(idle, /开始游戏/)
})

test('idle/over overlays keep the start/play-again actions', () => {
  const idle = render(gameOverlay(t, { status: 'idle', score: 0 }, () => {}))
  assert.match(idle, /开始游戏/)

  const over = render(gameOverlay(t, { status: 'over', score: 10 }, () => {}))
  assert.match(over, /再来一局/)
  assert.match(over, /10/)
})

test('stylesheet encodes the independent alert rail and narrow/container rules', () => {
  const css = client.__css
  assert.match(css, /\.wb-root\{[^}]*display:flex/)
  assert.match(css, /\.wb-inner\{[^}]*overflow:auto/)
  assert.match(css, /\.wb-alert\{[^}]*flex:none/)
  assert.match(css, /@container \(max-width:480px\)/)
  assert.match(css, /\.wb-squareBoard\{[^}]*aspect-ratio:1\/1/)
  assert.match(css, /#0d1624 48%/)
})
