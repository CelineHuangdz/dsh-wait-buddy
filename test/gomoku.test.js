import test from 'node:test'
import assert from 'node:assert/strict'
import { loadClient } from '../test-support/load-client.mjs'

const client = loadClient()
const { gomokuAiMove, gomokuIsMajorThreat, GOMOKU_SIZE, LEVEL_PRESETS } = client.__game

const E = 0
const H = 1 // human (black)
const A = 2 // AI (white)

const at = (x, y) => y * GOMOKU_SIZE + x
const emptyBoard = () => new Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(E)

/** Deterministic pick: gomokuAiMove with a constant zero random. */
function aiMove(board, level = 'hard') {
  return gomokuAiMove(board, level, () => 0)
}

test('hard AI wins immediately when a five is available', () => {
  const board = emptyBoard()
  for (const x of [3, 4, 5, 6]) board[at(x, 7)] = A
  board[at(3, 8)] = H
  board[at(4, 8)] = H
  assert.equal(aiMove(board), at(2, 7))
})

test('hard AI blocks an immediate human five', () => {
  const board = emptyBoard()
  for (const x of [3, 4, 5, 6]) board[at(x, 7)] = H
  board[at(6, 8)] = A
  board[at(6, 9)] = A
  // Human wins at either end; the AI must occupy one of them.
  const move = aiMove(board)
  assert.ok(move === at(2, 7) || move === at(7, 7), `expected an end blocking move, got ${move}`)
})

test('hard AI blocks an open three before it becomes an open four', () => {
  const board = emptyBoard()
  // Human open three on row 7: cells (4..6,7), both ends empty.
  for (const x of [4, 5, 6]) board[at(x, 7)] = H
  // Some AI stones elsewhere so the board is not empty and candidates exist.
  board[at(10, 10)] = A
  board[at(10, 11)] = H
  // Without blockMajor the shape score may prefer attacking; with it the AI
  // must play one of the two extension/inner points of the open three.
  const move = aiMove(board)
  const expected = new Set([at(3, 7), at(7, 7), at(4, 7), at(5, 7), at(6, 7)].filter((i) => board[i] === E))
  assert.ok(expected.has(move), `expected a block on the open three line, got ${move}`)
})

test('hard AI blocks a double-three fork point', () => {
  const board = emptyBoard()
  // Two open threes sharing the point (7,7): row y=7 (4..6) and column x=7 (4..6).
  // If the human ever gets (7,7), both lines complete into double threats.
  for (const x of [4, 5, 6]) board[at(x, 7)] = H
  for (const y of [4, 5, 6]) board[at(7, y)] = H
  board[at(0, 0)] = A
  board[at(14, 14)] = A
  const move = aiMove(board)
  assert.equal(move, at(7, 7), `expected the fork point (7,7) blocked, got ${move}`)
})

test('gomokuIsMajorThreat detects a four but not a quiet two', () => {
  const board = emptyBoard()
  for (const x of [4, 5, 6]) board[at(x, 7)] = H
  // Placing H at (7,7) makes a four (count 4, open ends) — major.
  board[at(7, 7)] = H
  assert.equal(gomokuIsMajorThreat(board, at(7, 7), H), true)
  board[at(7, 7)] = E
  // A lone stone with an empty neighbour is not major.
  assert.equal(gomokuIsMajorThreat(board, at(1, 1), H), false)
})

test('medium level keeps the old behaviour: no forced major-threat block', () => {
  const board = emptyBoard()
  for (const x of [4, 5, 6]) board[at(x, 7)] = H
  board[at(10, 10)] = A
  board[at(10, 11)] = H
  // medium has no blockMajor, so the move is shape-driven; it only must not
  // crash and must be a legal empty cell.
  const move = gomokuAiMove(board, 'medium', () => 0)
  assert.equal(board[move], E)
})

test('hard preset declares blockMajor; other presets do not', () => {
  assert.equal(LEVEL_PRESETS.hard.blockMajor, true)
  assert.equal(LEVEL_PRESETS.medium.blockMajor, undefined)
  assert.equal(LEVEL_PRESETS.easy.blockMajor, undefined)
})
