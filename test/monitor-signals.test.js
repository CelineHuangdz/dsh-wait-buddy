import test from 'node:test'
import assert from 'node:assert/strict'
import { loadClient } from '../test-support/load-client.mjs'

const client = loadClient()
const { createMonitorSource } = client.__monitor
const { createSignalHub } = client.__signals

function makeContext() {
  const durable = {
    status: 'running',
    turn: 1,
    stepCount: 2,
    errorMessage: '',
    updatedAt: 1,
    revision: 1,
    activity: [],
  }
  let live = { running: true, pendingInteraction: undefined }
  const statusListeners = new Set()
  const faceListeners = new Set()
  const binding = {
    session: {
      projections: {
        faceOf() {
          return {
            getSnapshot: () => durable,
            subscribe(listener) {
              faceListeners.add(listener)
              return () => faceListeners.delete(listener)
            },
          }
        },
      },
      getSnapshot: () => ({ running: true }),
      subscribe(listener) {
        faceListeners.add(listener)
        return () => faceListeners.delete(listener)
      },
    },
  }
  const uiSession = {
    sessionStatus: {
      getSnapshot: () => new Map([['s1', live]]),
      subscribe(listener) {
        statusListeners.add(listener)
        return () => statusListeners.delete(listener)
      },
    },
  }
  return {
    ctx: {
      sessions: {
        binding: () => binding,
        refreshProjections: () => Promise.resolve(),
      },
      get: (name) => (name === 'uiSession' ? uiSession : undefined),
    },
    setPending(pending) {
      live = { running: true, pendingInteraction: pending }
      for (const listener of statusListeners) listener()
    },
  }
}

test('monitor source publishes an approval_enter edge to the game hub', (t) => {
  const { ctx, setPending } = makeContext()
  const hub = createSignalHub()
  const signals = []
  hub.subscribe((signal) => signals.push(signal))
  const source = createMonitorSource(ctx, 's1', hub)
  const stop = source.subscribe(() => {})
  t.after(() => {
    stop()
    hub.dispose()
  })

  assert.equal(signals.length, 0)
  setPending({ kind: 'approval', key: 'approval:42', toolName: 'bash' })
  assert.equal(signals.length, 1)
  assert.equal(signals[0].type, 'agent:approval_enter')
  assert.equal(signals[0].key, 'approval:42')
  assert.equal(signals[0].detail.tool, 'bash')
})
