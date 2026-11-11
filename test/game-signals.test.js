import test from 'node:test'
import assert from 'node:assert/strict'
import { loadClient } from '../test-support/load-client.mjs'

const client = loadClient()
const createGameStore = client.__game.createGameStore

function storeWithRound(t) {
  const store = createGameStore()
  t.after(() => store.dispose())
  store.start('normal')
  return store
}

test('step signals add +5 and success adds +50 without resetting the round', (t) => {
  const store = storeWithRound(t)
  store.handleSignal({ type: 'agent:step_advance', key: '1:1' })
  let state = store.getSnapshot()
  assert.equal(state.score, 5)
  assert.equal(state.best, 5)
  assert.equal(state.reward.amount, 5)

  store.handleSignal({ type: 'agent:task_finish', key: '1:success', detail: { status: 'success' } })
  state = store.getSnapshot()
  assert.equal(state.score, 55)
  assert.equal(state.best, 55)
  assert.equal(state.notice.kind, 'success')
  assert.equal(state.status, 'running')
})

test('failed/aborted finish only shows a notice and keeps the round', (t) => {
  const store = storeWithRound(t)
  store.handleSignal({ type: 'agent:step_advance', key: '1:1' })
  const before = store.getSnapshot()
  store.handleSignal({ type: 'agent:task_finish', key: '1:failed', detail: { status: 'failed' } })
  const after = store.getSnapshot()
  assert.equal(after.score, before.score)
  assert.equal(after.status, 'running')
  assert.equal(after.notice.kind, 'failed')

  store.handleSignal({ type: 'agent:task_finish', key: '2:aborted', detail: { status: 'aborted' } })
  assert.equal(store.getSnapshot().notice.kind, 'aborted')

  store.handleSignal({
    type: 'agent:task_finish',
    key: '3:aborted',
    detail: { status: 'aborted', reasonCode: 'unknown' },
  })
  assert.equal(store.getSnapshot().notice.kind, 'unknown')
})

test('step signals are ignored while the board is idle', () => {
  const store = createGameStore()
  store.handleSignal({ type: 'agent:step_advance', key: '1:1' })
  assert.equal(store.getSnapshot().score, 0)
  assert.equal(store.getSnapshot().reward, null)
  store.dispose()
})

test('approval pauses automatically and resumes only after manual action', (t) => {
  const store = storeWithRound(t)
  store.handleSignal({ type: 'agent:approval_enter', key: 'approval:1' })
  let state = store.getSnapshot()
  assert.equal(state.status, 'paused')
  assert.equal(state.pauseReason, 'approval')
  assert.equal(state.resumeReady, true)

  store.togglePause()
  assert.equal(store.getSnapshot().status, 'paused')

  store.handleSignal({ type: 'agent:approval_leave', key: 'approval:1' })
  state = store.getSnapshot()
  assert.equal(state.status, 'paused')
  assert.equal(state.pauseReason, '')
  assert.equal(state.resumeReason, 'approval')
  assert.equal(state.resumeReady, true)

  store.togglePause()
  state = store.getSnapshot()
  assert.equal(state.status, 'running')
  assert.equal(state.pauseReason, '')
  assert.equal(state.resumeReason, '')
})

test('a manual pause is not auto-resumed by approval leave', (t) => {
  const store = storeWithRound(t)
  store.pause()
  assert.equal(store.getSnapshot().pauseReason, 'manual')
  store.handleSignal({ type: 'agent:approval_enter', key: 'approval:1' })
  assert.equal(store.getSnapshot().pauseReason, 'approval')
  store.handleSignal({ type: 'agent:approval_leave', key: 'approval:1' })
  const state = store.getSnapshot()
  assert.equal(state.status, 'paused')
  assert.equal(state.resumeReady, false)
  store.togglePause()
  assert.equal(store.getSnapshot().status, 'running')
})

test('overlapping approvals require every reason to clear', (t) => {
  const store = storeWithRound(t)
  store.handleSignal({ type: 'agent:approval_enter', key: 'approval:1' })
  store.handleSignal({ type: 'agent:approval_enter', key: 'approval:2' })
  store.handleSignal({ type: 'agent:approval_leave', key: 'approval:1' })
  store.togglePause()
  assert.equal(store.getSnapshot().status, 'paused')
  store.handleSignal({ type: 'agent:approval_leave', key: 'approval:2' })
  assert.equal(store.getSnapshot().resumeReady, true)
  store.togglePause()
  assert.equal(store.getSnapshot().status, 'running')
})

test('setGrid keeps the selected speed and paused speed changes apply', (t) => {
  const store = createGameStore()
  t.after(() => store.dispose())
  store.setSpeed('slow')
  store.setGrid(20, 10)
  assert.equal(store.getSnapshot().speed, 'slow')
  assert.equal(store.getSnapshot().tickMs, 200)

  store.start('slow')
  store.pause()
  store.setSpeed('fast')
  assert.equal(store.getSnapshot().tickMs, 100)
  store.togglePause()
  assert.equal(store.getSnapshot().status, 'running')
  assert.equal(store.getSnapshot().tickMs, 100)
})

test('unmounting pauses with a view reason and returning does not auto-run', (t) => {
  const store = storeWithRound(t)
  const stop = store.subscribe(() => {})
  stop()
  assert.equal(store.getSnapshot().status, 'paused')
  assert.equal(store.getSnapshot().pauseReason, 'view-inactive')

  const stop2 = store.subscribe(() => {})
  assert.equal(store.getSnapshot().status, 'paused')
  assert.equal(store.getSnapshot().pauseReason, 'view-inactive')
  store.togglePause()
  assert.equal(store.getSnapshot().status, 'running')
  stop2()
})

test('starting a round while approval is pending starts it paused', (t) => {
  const store = createGameStore()
  t.after(() => store.dispose())
  store.handleSignal({ type: 'agent:approval_enter', key: 'approval:9' })
  store.start('normal')
  const state = store.getSnapshot()
  assert.equal(state.status, 'paused')
  assert.equal(state.pauseReason, 'approval')
  assert.equal(state.resumeReady, true)
  store.handleSignal({ type: 'agent:approval_leave', key: 'approval:9' })
  assert.equal(store.getSnapshot().status, 'paused')
  store.togglePause()
  assert.equal(store.getSnapshot().status, 'running')
})

test('rewards from a new session keep stacking into the current round', (t) => {
  const store = storeWithRound(t)
  store.handleSignal({ type: 'agent:step_advance', sessionId: 's1', key: '1:1' })
  store.handleSignal({ type: 'agent:step_advance', sessionId: 's2', key: '1:1' })
  store.handleSignal({ type: 'agent:task_finish', sessionId: 's2', key: '1:success', detail: { status: 'success' } })
  assert.equal(store.getSnapshot().score, 60)
})

test('M3 bonus points do not change the food-based speed curve', (t) => {
  const store = storeWithRound(t)
  store.handleSignal({ type: 'agent:step_advance', key: '1:1' })
  store.handleSignal({ type: 'agent:task_finish', key: '1:success', detail: { status: 'success' } })
  assert.equal(store.getSnapshot().score, 55)
  store.pause()
  store.setSpeed('slow')
  assert.equal(store.getSnapshot().tickMs, 200)
})

test('leaving the view clears transient reward/notice so they cannot replay', (t) => {
  const store = storeWithRound(t)
  store.handleSignal({ type: 'agent:step_advance', key: '1:1' })
  store.handleSignal({ type: 'agent:task_finish', key: '1:success', detail: { status: 'success' } })
  const score = store.getSnapshot().score
  assert.equal(store.getSnapshot().notice.kind, 'success')
  assert.equal(store.getSnapshot().reward.amount, 50)

  const stop = store.subscribe(() => {})
  stop()
  assert.equal(store.getSnapshot().score, score)
  assert.equal(store.getSnapshot().notice, null)
  assert.equal(store.getSnapshot().reward, null)
})
