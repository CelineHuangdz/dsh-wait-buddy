import test from 'node:test'
import assert from 'node:assert/strict'
import { loadClient } from '../test-support/load-client.mjs'

const client = loadClient()
const { createMinesState, msRevealAt, msToggleFlag, msMinesLeft, createMinesweeperStore } =
  client.__game

/** Deterministic LCG so mine layouts are stable across runs. */
const lcg = (seed) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}

test('first reveal is always safe: the clicked cell and its neighbourhood have no mine', () => {
  let state = msRevealAt(createMinesState('easy'), 40, lcg(1))
  assert.equal(state.minesPlaced, true)
  assert.equal(state.revealed[40], true)
  assert.equal(state.status, 'playing')
  const safe = new Set([40, 30, 31, 32, 39, 41, 48, 49, 50])
  for (const i of safe) assert.equal(state.mineAt[i], false, `cell ${i}`)
  assert.equal(state.mines, 10)
})

test('a zero-count reveal floods the region and its numbered rim', () => {
  // seed 1: count at 40 is 0 → one click opens a multi-cell region.
  const state = msRevealAt(createMinesState('easy'), 40, lcg(1))
  assert.equal(state.counts[40], 0)
  assert.ok(state.revealedCount > 1, `opened ${state.revealedCount} cells`)
  for (let i = 0; i < state.revealed.length; i += 1) {
    if (state.revealed[i]) assert.equal(state.mineAt[i], false, `revealed cell ${i} must be safe`)
  }
  assert.equal(state.status, 'playing')
})

test('flagging guards a cell; revealing a mine loses and unmasks every mine', () => {
  let state = msRevealAt(createMinesState('easy'), 40, lcg(1))
  const mine = state.mineAt.indexOf(true) // seed 1 → cell 1
  assert.ok(mine >= 0)
  state = msToggleFlag(state, mine)
  assert.equal(state.flagged[mine], true)
  const guarded = msRevealAt(state, mine, lcg(1))
  assert.equal(guarded.revealed[mine], false, 'a flagged cell never reveals')
  assert.equal(guarded.status, 'playing')
  state = msToggleFlag(state, mine) // unflag
  assert.equal(state.flagged[mine], false)
  state = msRevealAt(state, mine, lcg(1))
  assert.equal(state.status, 'lost')
  for (let i = 0; i < state.mineAt.length; i += 1) {
    if (state.mineAt[i]) assert.equal(state.revealed[i], true, `mine ${i} unmasked on loss`)
  }
})

test('revealing every safe cell wins and flags the remaining mines', () => {
  let state = msRevealAt(createMinesState('easy'), 40, lcg(2))
  for (let i = 0; i < state.revealed.length && state.status === 'playing'; i += 1) {
    if (state.mineAt[i] || state.revealed[i]) continue
    state = msRevealAt(state, i, lcg(2))
  }
  assert.equal(state.status, 'won')
  assert.equal(state.revealedCount, state.revealed.length - state.mines)
  for (let i = 0; i < state.flagged.length; i += 1) {
    if (state.mineAt[i]) assert.equal(state.flagged[i], true, `mine ${i} auto-flagged on win`)
  }
})

test('msMinesLeft counts placed flags against the mine total', () => {
  let state = createMinesState('easy')
  assert.equal(msMinesLeft(state), 10)
  state = msToggleFlag(state, 5)
  assert.equal(msMinesLeft(state), 9)
  state = msToggleFlag(state, 5)
  assert.equal(msMinesLeft(state), 10)
})

test('level presets shape the board and reset restores a fresh field', () => {
  const medium = createMinesState('medium')
  assert.deepEqual([medium.cols, medium.rows, medium.mines], [12, 12, 24])
  const store = createMinesweeperStore()
  store.place(0)
  assert.equal(store.getSnapshot().minesPlaced, true)
  store.reset('hard')
  const next = store.getSnapshot()
  assert.equal(next.minesPlaced, false)
  assert.equal(next.status, 'playing')
  assert.deepEqual([next.cols, next.rows, next.mines], [16, 16, 40])
})

test('flag mode toggles without touching the field', () => {
  const store = createMinesweeperStore()
  assert.equal(store.getSnapshot().flagMode, false)
  store.toggleFlagMode()
  assert.equal(store.getSnapshot().flagMode, true)
  assert.equal(store.getSnapshot().minesPlaced, false, 'toggling mode never places mines')
})
