import test from 'node:test'
import assert from 'node:assert/strict'
import { loadClient } from '../test-support/load-client.mjs'

const client = loadClient()
const compose = client.__monitor.composeMonitor

const STATUSES = new Set(['idle', 'running', 'pending_approval', 'success', 'failed', 'aborted'])

function durable(over = {}) {
  return {
    status: 'running',
    turn: 1,
    stepCount: 2,
    errorMessage: '',
    updatedAt: 100,
    revision: 1,
    activity: [],
    ...over,
  }
}

function input(over = {}) {
  return {
    durable: durable(),
    status: { running: true },
    session: undefined,
    pending: undefined,
    now: 10_000,
    mountedAt: 0,
    mismatchSince: null,
    projectionError: false,
    ...over,
  }
}

test('running projection + live running stays running', () => {
  const state = compose(input())
  assert.equal(state.status, 'running')
  assert.equal(state.health, 'ready')
  assert.equal(state.stepCount, 2)
  assert.ok(STATUSES.has(state.status))
})

test('new live turn overrides a stale terminal projection', () => {
  const state = compose(input({ durable: durable({ status: 'failed', errorMessage: 'old' }), status: { running: true } }))
  assert.equal(state.status, 'running')
  assert.equal(state.errorMessage, 'old')
  assert.equal(state.health, 'ready')
})

test('live stopped while projection says running is stale after the grace period', () => {
  const inGrace = compose(input({ status: { running: false }, mismatchSince: 6_000, now: 10_000 }))
  assert.equal(inGrace.status, 'running')
  assert.equal(inGrace.health, 'ready')

  const stale = compose(input({ status: { running: false }, mismatchSince: 4_000, now: 10_000 }))
  assert.equal(stale.status, 'running')
  assert.equal(stale.health, 'stale')
})

test('missing projection is loading first, then degraded', () => {
  const loading = compose(input({ durable: undefined, mountedAt: 9_000, now: 10_000 }))
  assert.equal(loading.health, 'loading')
  assert.equal(loading.ready, false)

  const degraded = compose(input({ durable: undefined, mountedAt: 0, now: 10_000 }))
  assert.equal(degraded.health, 'degraded')
  assert.equal(degraded.ready, false)

  const error = compose(input({ durable: undefined, mountedAt: 9_500, now: 10_000, projectionError: true }))
  assert.equal(error.health, 'degraded')
})

test('approval is visible even without a projection and carries its key', () => {
  const state = compose(
    input({
      durable: undefined,
      mountedAt: 9_000,
      now: 10_000,
      pending: { kind: 'approval', key: 'approval:1', toolName: 'bash' },
    }),
  )
  assert.equal(state.status, 'pending_approval')
  assert.equal(state.pendingKind, 'approval')
  assert.equal(state.pendingKey, 'approval:1')
  assert.equal(state.approvalTool, 'bash')
  assert.equal(state.isAlerting, true)
})

test('question and plan-review blocks claim the pending state like approvals (D28)', () => {
  const question = compose(
    input({
      pending: {
        kind: 'question',
        key: 'question:1',
        questions: [{ question: '用哪个分支发布？' }],
      },
    }),
  )
  assert.equal(question.status, 'pending_approval')
  assert.equal(question.pendingKind, 'question')
  assert.equal(question.pendingKey, 'question:1')
  assert.equal(question.approvalTool, '')
  assert.equal(question.pendingDetail, '用哪个分支发布？')
  assert.equal(question.isAlerting, true)

  const plan = compose(
    input({ pending: { kind: 'plan-review', key: 'plan:1', questions: [{ detail: '计划正文' }] } }),
  )
  assert.equal(plan.status, 'pending_approval')
  assert.equal(plan.pendingKind, 'plan-review')
  assert.equal(plan.pendingDetail, '计划正文')

  // Unknown future kinds stay visible with the generic copy path.
  const unknown = compose(input({ pending: { kind: 'future-kind', key: 'x:1' } }))
  assert.equal(unknown.status, 'pending_approval')
  assert.equal(unknown.pendingKind, 'future-kind')

  // A pending interaction without a usable kind stays invisible.
  const blank = compose(input({ pending: { kind: '', key: 'x:2' } }))
  assert.equal(blank.status, 'running')
  assert.equal(blank.pendingKind, '')
})

test('approval keeps its tool name and never borrows question text', () => {
  const state = compose(
    input({
      pending: {
        kind: 'approval',
        key: 'approval:9',
        toolName: 'bash',
        questions: [{ question: '不应出现' }],
      },
    }),
  )
  assert.equal(state.approvalTool, 'bash')
  assert.equal(state.pendingDetail, 'bash')
})

test('failed is an alert and success is not', () => {
  const failed = compose(input({ durable: durable({ status: 'failed' }), status: { running: false } }))
  assert.equal(failed.status, 'failed')
  assert.equal(failed.isAlerting, true)

  const success = compose(input({ durable: durable({ status: 'success' }), status: { running: false } }))
  assert.equal(success.status, 'success')
  assert.equal(success.isAlerting, false)
})

test('idle projection with live running becomes running', () => {
  const state = compose(input({ durable: durable({ status: 'idle', turn: 0, stepCount: 0 }), status: { running: true } }))
  assert.equal(state.status, 'running')
})

test('missing live status falls back to the session snapshot', () => {
  const state = compose(input({ status: undefined, session: { running: true } }))
  assert.equal(state.status, 'running')

  const stopped = compose(input({ status: undefined, session: { running: false }, mismatchSince: 0, now: 10_000 }))
  assert.equal(stopped.health, 'stale')
})

test('all emitted statuses stay inside the M0 six-value enum', () => {
  const cases = [
    input(),
    input({ durable: durable({ status: 'idle' }), status: { running: false } }),
    input({ durable: durable({ status: 'success' }), status: { running: false } }),
    input({ durable: durable({ status: 'failed' }), status: { running: false } }),
    input({ durable: durable({ status: 'aborted' }), status: { running: false } }),
    input({ pending: { kind: 'approval', key: 'approval:2' } }),
  ]
  for (const value of cases) assert.ok(STATUSES.has(compose(value).status))
})

test('sameMonitor treats a new approval key as a change', () => {
  const { sameMonitor } = loadClient().__monitor
  const left = compose(input({ pending: { kind: 'approval', key: 'approval:1', toolName: 'bash' } }))
  const right = compose(input({ pending: { kind: 'approval', key: 'approval:2', toolName: 'bash' } }))
  assert.equal(sameMonitor(left, right), false)
  assert.equal(sameMonitor(left, left), true)
})
