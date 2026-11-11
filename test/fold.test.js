import test from 'node:test'
import assert from 'node:assert/strict'
import { endedWith, fold } from '../index.js'

const initial = () => ({
  status: 'idle',
  turn: 0,
  stepCount: 0,
  reasonCode: '',
  errorMessage: '',
  updatedAt: 0,
  revision: 0,
  activity: [],
})

const event = (type, data, time = 100) => ({ type, data, time })

function started(turn = 1) {
  return fold(initial(), event('turn/start', { turn }, 10))
}

test('turn/start starts a running turn and clears activity', () => {
  const state = fold(
    { ...initial(), status: 'success', activity: [{ kind: 'tool', text: 'old' }], stepCount: 4 },
    event('turn/start', { turn: 2 }, 20),
  )
  assert.equal(state.status, 'running')
  assert.equal(state.turn, 2)
  assert.equal(state.stepCount, 0)
  assert.deepEqual(state.activity, [])
})

test('duplicate turn/start for the active turn is a no-op', () => {
  const state = started(1)
  assert.equal(fold(state, event('turn/start', { turn: 1 }, 30)), state)
})

test('step/end counts only the active running turn', () => {
  let state = started(1)
  state = fold(state, event('step/end', { turn: 1 }, 20))
  assert.equal(state.stepCount, 1)
  assert.equal(fold(state, event('step/end', { turn: 0 }, 30)), state)
  const terminal = fold(state, event('turn/end', { turn: 1, reason: { kind: 'completed' } }, 30))
  assert.equal(fold(terminal, event('step/end', { turn: 1 }, 40)), terminal)
})

test('unknown turn/end reason never becomes success', () => {
  const ended = endedWith({ kind: 'goal-budget' })
  assert.equal(ended.status, 'aborted')
  assert.equal(ended.reasonCode, 'unknown')
  assert.match(ended.errorMessage, /goal-budget/)
  const state = fold(started(1), event('turn/end', { turn: 1, reason: { kind: 'goal-budget' } }, 20))
  assert.equal(state.status, 'aborted')
  assert.equal(state.reasonCode, 'unknown')
  assert.notEqual(state.status, 'success')
})

test('D41: failure reasons are locale-neutral codes, not copy', () => {
  const max = endedWith({ kind: 'max-tokens' })
  assert.deepEqual([max.status, max.reasonCode, max.errorMessage], ['failed', 'max-tokens', ''])
  const blocked = endedWith({ kind: 'blocked' })
  assert.deepEqual([blocked.status, blocked.reasonCode, blocked.errorMessage], ['failed', 'blocked', ''])
  const error = endedWith({ kind: 'error', error: { message: 'upstream boom' } })
  assert.equal(error.reasonCode, 'error')
  assert.equal(error.errorMessage, 'upstream boom')
  assert.equal(endedWith({ kind: 'error' }).errorMessage, '')
  assert.equal(endedWith({ kind: 'completed' }).reasonCode, 'completed')
  assert.equal(endedWith({ kind: 'aborted' }).reasonCode, 'aborted')
  // No plugin-authored copy anywhere in the projection.
  for (const kind of ['error', 'max-tokens', 'blocked', 'aborted', 'interrupted', 'forked', 'completed']) {
    assert.doesNotMatch(endedWith({ kind }).errorMessage, /[\u4e00-\u9fff]/, kind)
  }
})

test('explicit completed remains success', () => {
  const state = fold(started(1), event('turn/end', { turn: 1, reason: { kind: 'completed' } }, 20))
  assert.equal(state.status, 'success')
  assert.equal(state.errorMessage, '')
})

test('failed and aborted reasons keep the M0 vocabulary', () => {
  for (const kind of ['error', 'max-tokens', 'blocked']) {
    assert.equal(endedWith({ kind }).status, 'failed', kind)
  }
  for (const kind of ['aborted', 'interrupted']) {
    assert.equal(endedWith({ kind }).status, 'aborted', kind)
  }
  assert.equal(endedWith({ kind: 'forked' }).status, 'idle')
})

test('late turn/end for an older turn is ignored', () => {
  let state = started(2)
  state = fold(state, event('turn/end', { turn: 1, reason: { kind: 'completed' } }, 20))
  assert.equal(state.status, 'running')
  assert.equal(state.turn, 2)
  state = fold(state, event('turn/end', { turn: 2, reason: { kind: 'completed' } }, 30))
  assert.equal(state.status, 'success')
})

test('duplicate terminal turn/end is idempotent', () => {
  let state = started(1)
  state = fold(state, event('turn/end', { turn: 1, reason: { kind: 'completed' } }, 20))
  const duplicate = fold(state, event('turn/end', { turn: 1, reason: { kind: 'error' } }, 30))
  assert.equal(duplicate, state)
})

test('activity ignores terminal and wrong-turn tool calls', () => {
  let state = started(1)
  const call = event('tool/call', {
    turn: 1,
    name: 'read_file',
    arguments: JSON.stringify({ file_path: '/tmp/x' }),
  })
  state = fold(state, call)
  assert.equal(state.activity.length, 1)
  const wrongTurn = fold(
    state,
    event('tool/call', {
      turn: 2,
      name: 'read_file',
      arguments: JSON.stringify({ file_path: '/tmp/y' }),
    }),
  )
  assert.equal(wrongTurn, state)
  const terminal = fold(state, event('turn/end', { turn: 1, reason: { kind: 'completed' } }, 30))
  assert.equal(fold(terminal, call), terminal)
})

test('assistant reasoning messages never enter the activity feed', () => {
  const state = started(1)
  const message = event('assistant/message', {
    turn: 1,
    message: { content: [{ type: 'reasoning', text: 'private chain of thought' }] },
  })
  assert.equal(fold(state, message), state)
})

test('tool activity does not surface prose descriptions or objectives', () => {
  const state = fold(
    started(1),
    event('tool/call', {
      turn: 1,
      name: 'local_tools',
      arguments: JSON.stringify({ description: 'Good — package names confirmed, all alive.' }),
    }),
  )
  assert.equal(state.activity[0].text, 'local_tools')
})

test('tool activity clips the combined tool name and hint', () => {
  const longName = 'a'.repeat(80)
  const longHint = 'b'.repeat(80)
  const state = fold(
    started(1),
    event('tool/call', {
      turn: 1,
      name: longName,
      arguments: JSON.stringify({ file_path: longHint }),
    }),
  )
  assert.equal(state.activity.length, 1)
  assert.ok(state.activity[0].text.length <= 120)
})
