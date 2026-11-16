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
  turnStartedAt: 0,
  lastActivityAt: 0,
  lastToolAt: 0,
  endedAt: 0,
  activity: [],
})

const event = (type, data, time = 100) => ({ type, data, time })
const result = (callId, time = 120, isError = false) =>
  event(
    'tool/result',
    { turn: 1, step: 1, message: { role: 'tool', toolCallId: callId, isError } },
    time,
  )

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

test('completed same-tool calls fold into a counted run', () => {
  let state = started(1)
  for (const [index, path] of ['/a.js', '/b.js', '/c.js'].entries()) {
    state = fold(
      state,
      event('tool/call', {
        turn: 1,
        step: 1,
        callId: `c${index}`,
        name: 'Read',
        arguments: JSON.stringify({ file_path: path }),
      }),
    )
    state = fold(state, result(`c${index}`, 110))
  }
  assert.equal(state.activity.length, 1)
  assert.equal(state.activity[0].text, 'Read')
  assert.equal(state.activity[0].hint, 'c.js')
  assert.equal(state.activity[0].count, 3)
  assert.equal(state.activity[0].status, 'ok')
  assert.equal(state.activity[0].durationMs, 10)
})

test('a different tool breaks the run; commands are never folded', () => {
  let state = started(1)
  const tool = (callId, name, path) =>
    event('tool/call', {
      turn: 1,
      step: 1,
      callId,
      name,
      arguments: JSON.stringify({ file_path: path }),
    })
  state = fold(state, tool('r1', 'Read', '/a.js'))
  state = fold(state, result('r1'))
  state = fold(state, tool('g1', 'Grep', '/a.js'))
  state = fold(state, result('g1'))
  assert.equal(state.activity[0].text, 'Grep')
  assert.equal(state.activity[0].count, undefined)
  assert.equal(state.activity[1].text, 'Read')

  const command = (callId, cmd) =>
    event('tool/call', {
      turn: 1,
      step: 1,
      callId,
      name: 'bash',
      arguments: JSON.stringify({ command: cmd }),
    })
  state = fold(state, command('c1', 'git status'))
  state = fold(state, result('c1'))
  state = fold(state, command('c2', 'git status'))
  state = fold(state, result('c2'))
  assert.equal(state.activity[0].kind, 'command')
  // No persisted command hash: identical commands stay separate rows.
  assert.equal(state.activity[0].count, undefined)
  assert.equal(state.activity[0].foldKey, undefined)
  assert.equal(state.activity[0].text, 'git')
  assert.equal(state.activity[0].argCount, 1)
  state = fold(state, command('c3', 'git pull'))
  state = fold(state, result('c3'))
  assert.equal(state.activity[0].count, undefined)
  assert.equal(state.activity[0].text, 'git')
})

test('tool/result marks success/error, records duration and error code only', () => {
  let state = started(1)
  state = fold(
    state,
    event('tool/call', {
      turn: 1,
      step: 1,
      callId: 'c1',
      name: 'bash',
      arguments: JSON.stringify({ command: 'curl -H "Authorization: Bearer sk-secret" https://x.test/a' }),
    }, 100),
  )
  assert.equal(state.activity[0].status, 'running')
  assert.equal(state.activity[0].text, 'curl')
  assert.equal(state.activity[0].hint, undefined)
  assert.equal(JSON.stringify(state.activity).includes('sk-secret'), false)

  state = fold(state, event('tool/result', {
    turn: 1,
    step: 1,
    message: { role: 'tool', toolCallId: 'c1', isError: true },
    error: { name: 'AbortError', code: 'ABORTED' },
  }, 250))
  assert.equal(state.activity[0].status, 'error')
  assert.equal(state.activity[0].durationMs, 150)
  assert.equal(state.activity[0].errorCode, 'ABORTED')
  assert.equal(JSON.stringify(state.activity).includes('AbortError:'), false)
  assert.equal(state.lastActivityAt, 250)
})

test('tool/result is ignored for a duplicate, late, or wrong-turn call', () => {
  let state = started(1)
  state = fold(state, event('tool/call', {
    turn: 1,
    step: 1,
    callId: 'c1',
    name: 'Read',
    arguments: JSON.stringify({ file_path: '/a.js' }),
  }, 100))
  state = fold(state, result('c1', 110))
  const duplicate = fold(state, result('c1', 120))
  assert.equal(duplicate, state)
  const late = fold(state, result('missing', 130))
  assert.equal(late, state)
  const wrongTurn = fold(
    state,
    event('tool/result', {
      turn: 2,
      step: 1,
      message: { role: 'tool', toolCallId: 'c1', isError: false },
    }, 140),
  )
  assert.equal(wrongTurn, state)
})

test('tool/call without a numeric turn is ignored (malformed events)', () => {
  const state = started(1)
  const malformed = event('tool/call', {
    name: 'Read',
    arguments: JSON.stringify({ file_path: '/a.js' }),
  })
  assert.equal(fold(state, malformed), state)
})

test('turn/start resets timing; step/end advances lastActivityAt', () => {
  let state = started(1)
  const start = state
  assert.equal(start.turnStartedAt, 10)
  assert.equal(start.lastActivityAt, 10)
  state = fold(state, event('step/end', { turn: 1 }, 30))
  assert.equal(state.lastActivityAt, 30)
  state = fold(state, event('turn/end', { turn: 1, reason: { kind: 'completed' } }, 40))
  assert.equal(state.endedAt, 40)
  state = fold(state, event('turn/start', { turn: 2 }, 50))
  assert.equal(state.turnStartedAt, 50)
  assert.equal(state.lastActivityAt, 50)
  assert.equal(state.lastToolAt, 0)
  assert.equal(state.endedAt, 0)
})

test('activity keeps at most eight entries', () => {
  let state = started(1)
  for (let index = 0; index < 10; index += 1) {
    state = fold(state, event('tool/call', {
      turn: 1,
      step: index,
      callId: `c${index}`,
      name: `Tool${index}`,
      arguments: '{}',
    }, 20 + index))
  }
  assert.equal(state.activity.length, 8)
  assert.equal(state.activity[0].text, 'Tool9')
  assert.equal(state.activity[7].text, 'Tool2')
})

test('repeated command calls still advance the pulse inputs', () => {
  let state = started(1)
  const call = (time) =>
    event('tool/call', {
      turn: 1,
      step: 1,
      callId: `c${time}`,
      name: 'bash',
      arguments: JSON.stringify({ command: 'git status' }),
    }, time)
  state = fold(state, call(20))
  const first = state.revision
  state = fold(state, call(30))
  assert.equal(state.lastActivityAt, 30)
  assert.equal(state.revision, first + 1)
  assert.equal(state.activity.length, 2)
})

test('turn/end closes calls that never received a result', () => {
  let state = started(1)
  state = fold(state, event('tool/call', {
    turn: 1,
    step: 1,
    callId: 'c1',
    name: 'Read',
    arguments: JSON.stringify({ file_path: '/a.js' }),
  }, 20))
  state = fold(state, event('turn/end', { turn: 1, reason: { kind: 'aborted' } }, 50))
  assert.equal(state.activity[0].status, 'error')
  assert.equal(state.activity[0].errorCode, 'no-result')
  assert.equal(state.activity[0].durationMs, 30)
})
