import test from 'node:test'
import assert from 'node:assert/strict'
import { loadClient } from '../test-support/load-client.mjs'

const { createGameState, startGame, turnGame, tickGame } = loadClient().__game

function running(cols = 20, rows = 10) {
  const state = startGame(createGameState(0, cols, rows, 'normal'), 'normal')
  return { ...state, food: null }
}

test('a two-step queue allows a quick U-turn without reversing into itself', () => {
  let state = running()
  state = turnGame(state, 'up')
  state = turnGame(state, 'left')
  assert.deepEqual([...state.dirQueue], ['up', 'left'])

  state = tickGame(state)
  assert.equal(state.status, 'running')
  assert.equal(state.dir, 'up')
  assert.deepEqual([...state.dirQueue], ['left'])

  state = tickGame(state)
  assert.equal(state.status, 'running')
  assert.equal(state.dir, 'left')
  assert.deepEqual([...state.dirQueue], [])
})

test('a third direction is ignored while the queue is full', () => {
  let state = running()
  state = turnGame(state, 'up')
  state = turnGame(state, 'left')
  const third = turnGame(state, 'down')
  assert.equal(third, state)
})

test('the queued move validates against the queue tail, not the current direction', () => {
  let state = running()
  state = turnGame(state, 'up')
  const reverse = turnGame(state, 'down')
  assert.equal(reverse, state)
})
