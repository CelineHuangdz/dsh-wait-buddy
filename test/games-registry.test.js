import test from 'node:test'
import assert from 'node:assert/strict'
import { loadClient } from '../test-support/load-client.mjs'

const client = loadClient()
const { GAMES, GAME_ORDER } = client.__games

const ADAPTER_SURFACE = [
  'id',
  'titleKey',
  'store',
  'pauseOnLeave',
  'keyboard',
  'Board',
  'Setting',
  'Controls',
  'Float',
  'FloatCtl',
]

test('D45: every registered game exposes the full adapter surface', () => {
  assert.deepEqual([...GAME_ORDER], ['snake', 'gomoku'])
  for (const id of GAME_ORDER) {
    const adapter = GAMES[id]
    assert.equal(adapter.id, id)
    for (const field of ADAPTER_SURFACE) {
      assert.ok(field in adapter, `${id}.${field}`)
    }
  }
})

test('D45: adapter capability flags match game semantics', () => {
  assert.equal(GAMES.snake.pauseOnLeave, true, 'snake ticks — leaving must pause it')
  assert.equal(GAMES.snake.keyboard, true)
  assert.equal(GAMES.gomoku.pauseOnLeave, false, 'gomoku is turn-based')
  assert.equal(GAMES.gomoku.keyboard, false)
})
