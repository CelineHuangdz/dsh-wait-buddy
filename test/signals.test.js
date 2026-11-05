import test from 'node:test'
import assert from 'node:assert'
import { loadClient } from '../test-support/load-client.mjs'

const client = loadClient()
const { diffMonitorSignals, createSignalHub } = client.__signals

const snapshot = (over = {}) => ({
  ready: true,
  status: 'running',
  turn: 1,
  stepCount: 0,
  pendingKey: '',
  pendingKind: '',
  approvalTool: '',
  health: 'ready',
  errorMessage: '',
  ...over,
})

const baseline = snapshot({ ready: false, status: 'idle', turn: 0 })

test('first ready snapshot is a baseline and emits no task/step signals', () => {
  assert.deepEqual(diffMonitorSignals(baseline, snapshot({ stepCount: 3 }), { sessionId: 's1', baseline: true, at: 1 }), [])
})

test('baseline emits a currently-pending approval', () => {
  const signals = diffMonitorSignals(
    baseline,
    snapshot({ pendingKey: 'approval:1', pendingKind: 'approval', approvalTool: 'bash' }),
    { sessionId: 's1', baseline: true, at: 1 },
  )
  assert.equal(signals.length, 1)
  assert.equal(signals[0].type, 'agent:approval_enter')
  assert.equal(signals[0].key, 'approval:1')
  assert.equal(signals[0].detail.tool, 'bash')
  assert.equal(signals[0].at, 1)
})

test('approval enter, leave, and key replacement are edge signals', () => {
  const running = snapshot()
  const first = diffMonitorSignals(running, snapshot({ pendingKey: 'approval:1', pendingKind: 'approval' }), {
    sessionId: 's1',
    at: 2,
  })
  assert.deepEqual(first.map((s) => s.type), ['agent:approval_enter'])

  const second = diffMonitorSignals(
    snapshot({ pendingKey: 'approval:1', pendingKind: 'approval' }),
    snapshot({ pendingKey: 'approval:2', pendingKind: 'approval' }),
    { sessionId: 's1', at: 3 },
  )
  assert.deepEqual(second.map((s) => s.type), ['agent:approval_leave', 'agent:approval_enter'])
  assert.deepEqual(second.map((s) => s.key), ['approval:1', 'approval:2'])

  const leave = diffMonitorSignals(
    snapshot({ pendingKey: 'approval:2', pendingKind: 'approval' }),
    running,
    { sessionId: 's1', at: 4 },
  )
  assert.deepEqual(leave.map((s) => s.type), ['agent:approval_leave'])
})

test('task start, step advance, and finish emit once per edge', () => {
  const start = diffMonitorSignals(
    snapshot({ status: 'success', turn: 1, stepCount: 2 }),
    snapshot({ status: 'running', turn: 2, stepCount: 0 }),
    { sessionId: 's1', at: 10 },
  )
  assert.deepEqual(start.map((s) => s.type), ['agent:task_start'])
  assert.equal(start[0].key, '2')

  const step = diffMonitorSignals(snapshot({ stepCount: 2 }), snapshot({ stepCount: 3 }), { sessionId: 's1', at: 11 })
  assert.equal(step.length, 1)
  assert.equal(step[0].type, 'agent:step_advance')
  assert.equal(step[0].detail.delta, 1)
  assert.equal(step[0].detail.stepCount, 3)

  const finish = diffMonitorSignals(
    snapshot({ status: 'running', turn: 2, stepCount: 4 }),
    snapshot({ status: 'success', turn: 2, stepCount: 4 }),
    { sessionId: 's1', at: 12 },
  )
  assert.equal(finish.length, 1)
  assert.equal(finish[0].type, 'agent:task_finish')
  assert.equal(finish[0].detail.status, 'success')
})

test('no signals for unchanged snapshots or non-ready snapshots', () => {
  const state = snapshot({ stepCount: 2 })
  assert.deepEqual(diffMonitorSignals(state, state, { sessionId: 's1' }), [])
  assert.deepEqual(
    diffMonitorSignals(state, snapshot({ ready: false, health: 'degraded', status: 'idle' }), { sessionId: 's1' }),
    [],
  )
})

test('a late ready snapshot is still a baseline', () => {
  assert.deepEqual(
    diffMonitorSignals(baseline, snapshot({ stepCount: 5, status: 'success' }), { sessionId: 's1' }),
    [],
  )
})

test('signal hub dedupes by type/session/key and fans out', () => {
  const hub = createSignalHub()
  const seen = []
  const stop = hub.subscribe((signal) => seen.push(signal))
  const signal = { type: 'agent:step_advance', sessionId: 's1', key: '1:1', at: 1, detail: {} }
  hub.emit(signal)
  hub.emit({ ...signal })
  assert.equal(seen.length, 1)
  stop()
  hub.emit({ ...signal, key: '1:2' })
  assert.equal(seen.length, 1)
  hub.dispose()
})

test('leaving approval is still emitted if the projection goes unavailable', () => {
  const signals = diffMonitorSignals(
    snapshot({ pendingKey: 'approval:1', pendingKind: 'approval' }),
    snapshot({ ready: false, status: 'idle', pendingKey: '', pendingKind: '', health: 'degraded' }),
    { sessionId: 's1', at: 5 },
  )
  assert.deepEqual(signals.map((s) => s.type), ['agent:approval_leave'])
})
