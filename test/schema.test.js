import test from 'node:test'
import assert from 'node:assert/strict'
import { fold, stateSchema } from '../index.js'

const initial = () => ({
  status: 'idle',
  turn: 0,
  stepCount: 0,
  reasonCode: '',
  errorMessage: '',
  updatedAt: 0,
  revision: 0,
  turnStartedAt: 0,
  lastActivityAt: 0,
  lastToolAt: 0,
  endedAt: 0,
  activity: [],
})

const event = (type, data, time = 100) => ({ type, data, time })

test('a folded state validates against the registered projection schema', () => {
  let state = fold(initial(), event('turn/start', { turn: 1 }, 10))
  state = fold(state, event('tool/call', {
    turn: 1,
    step: 1,
    callId: 'c1',
    name: 'Read',
    arguments: JSON.stringify({ file_path: '/tmp/a.js' }),
  }, 20))
  state = fold(state, event('tool/result', {
    turn: 1,
    step: 1,
    message: { role: 'tool', toolCallId: 'c1', isError: false },
  }, 30))
  const parsed = stateSchema.parse(state)
  assert.equal(parsed.activity[0].status, 'ok')
  assert.equal(parsed.lastActivityAt, 30)
  assert.equal(stateSchema.parse(initial()).activity.length, 0)
})

test('schema rejects a raw command field smuggled into activity', () => {
  const state = {
    ...initial(),
    activity: [
      {
        kind: 'command',
        text: 'curl',
        command: 'curl -H "Authorization: Bearer sk-secret"',
        status: 'running',
        startedAt: 1,
      },
    ],
  }
  assert.throws(() => stateSchema.parse(state))
})
