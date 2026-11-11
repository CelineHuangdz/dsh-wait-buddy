import test from 'node:test'
import assert from 'node:assert/strict'
import { loadClient } from '../test-support/load-client.mjs'

const client = loadClient()
const {
  createSafariState,
  createSafariStore,
  sfMapOf,
  sfStep,
  sfThrowBall,
  sfRelease,
  sfRollEncounter,
  sfRarityOf,
  sfSpeciesName,
  sfFitDims,
  sfPath,
  drawSafariMap,
  SF_SPECIES_TOTAL,
} = client.__game

const t = (key, params = {}) =>
  String(
    {
      'sf.name': '{color}{pattern}{body}',
      'sf.color.red': '红',
      'sf.color.blue': '蓝',
      'sf.color.green': '绿',
      'sf.color.yellow': '黄',
      'sf.color.purple': '紫',
      'sf.color.cyan': '青',
      'sf.pattern.plain': '素',
      'sf.pattern.spots': '点',
      'sf.pattern.stripes': '纹',
      'sf.body.round': '圆宝',
      'sf.body.block': '方宝',
      'sf.body.tall': '长宝',
    }[key] ?? key,
  ).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''))

/** Sequence-driven random for deterministic tests. */
const seq = (...values) => () => (values.length > 1 ? values.shift() : values[0])

test('species space is 3 bodies × 6 palettes × 3 patterns', () => {
  assert.equal(SF_SPECIES_TOTAL, 54)
  // D47 rarity split: 6 very rare, 12 rare, 36 common.
  const counts = { common: 0, rare: 0, very: 0 }
  for (let s = 0; s < SF_SPECIES_TOTAL; s += 1) counts[sfRarityOf(s)] += 1
  assert.deepEqual(counts, { common: 36, rare: 12, very: 6 })
})

test('species names compose from dictionary parts', () => {
  assert.equal(sfSpeciesName(t, 0), '红素圆宝')
  assert.equal(sfSpeciesName(t, SF_SPECIES_TOTAL - 1), '青纹长宝')
})

test('maps are deterministic per region+shape and spawn is always walkable', () => {
  const a = sfMapOf(3, 24, 12)
  const b = sfMapOf(3, 24, 12)
  assert.deepEqual(a, b)
  assert.notDeepEqual(a, sfMapOf(4, 24, 12))
  assert.notDeepEqual(a, sfMapOf(3, 20, 12), 'shape feeds the seed')
  const spawn = Math.floor(12 / 2) * 24 + 12
  for (const i of [spawn, spawn - 1, spawn + 1, spawn - 24, spawn + 24]) {
    assert.notEqual(a[i], 2, `cell ${i} not water`)
    assert.notEqual(a[i], 3, `cell ${i} not rock`)
  }
})

test('grid shape follows the board aspect at ~14px cells', () => {
  const wide = sfFitDims(920, 420)
  assert.equal(wide.cols, 66)
  assert.equal(wide.rows, 30)
  const narrow = sfFitDims(320, 128)
  assert.equal(narrow.cols, 23)
  assert.equal(narrow.rows, 9)
  assert.equal(sfFitDims(2000, 900).cols <= 90, true)
})

test('sfPath finds a walkable route and refuses unwalkable targets', () => {
  let state = createSafariState()
  // Force a known shape: clear a corridor.
  const cols = state.cols
  const target = state.pos + 3
  state = { ...state, map: state.map.map((t, i) => (i >= state.pos && i <= target && Math.abs((i % cols) - state.pos % cols) <= 3 ? 0 : t)) }
  const path = sfPath(state, target)
  assert.ok(path !== null && path.length === 3)
  assert.equal(path[0], state.pos + 1)
  // Water target: no route.
  const waterState = { ...state, map: state.map.slice() }
  waterState.map[target + 1] = 2
  assert.equal(sfPath(waterState, target + 1), null)
})

test('encounter roll tiers follow the rarity schedule', () => {
  // random() < 0.05 → very; first pick index 0 of that tier.
  const very = sfRollEncounter(seq(0.01, 0))
  assert.equal(very.rarity, 'very')
  assert.equal(sfRarityOf(very.species), 'very')
  const rare = sfRollEncounter(seq(0.2, 0))
  assert.equal(rare.rarity, 'rare')
  assert.equal(sfRarityOf(rare.species), 'rare')
  const common = sfRollEncounter(seq(0.9, 0.99))
  assert.equal(common.rarity, 'common')
})

test('steps only reach adjacent walkable cells; grass may trigger encounters', () => {
  const state = createSafariState()
  const mid = Math.floor(state.rows / 2)
  const spawn = mid * state.cols + Math.floor(state.cols / 2)
  // Non-adjacent and unwalkable cells are refused.
  assert.equal(sfStep(state, spawn + 20), state)
  // Left neighbour is forced plain (walkable): no encounter there.
  const walkPlain = sfStep(state, spawn - 1, seq(0.99))
  assert.equal(walkPlain.pos, spawn - 1)
  assert.equal(walkPlain.encounter, null)
  // Walking onto a grass cell with a low roll stays quiet…
  const state2 = { ...walkPlain, map: walkPlain.map.slice(), pos: spawn }
  state2.map[spawn + 1] = 1 // grass
  const quiet = sfStep(state2, spawn + 1, seq(0.9))
  assert.equal(quiet.encounter, null)
  // …a high roll encounters something.
  const boom = sfStep(state2, spawn + 1, seq(0.1, 0.5, 0.5))
  assert.ok(boom.encounter !== null)
})

test('one-click catch: success feeds the dex and persists; a miss flees', () => {
  let state = createSafariState()
  state = { ...state, encounter: { species: 0, rarity: 'common' } }
  const caught = sfThrowBall(state, seq(0.1))
  assert.equal(caught.lastResult, 'caught')
  assert.equal(caught.dex.caught['0'], 1)
  assert.equal(caught.dexCaught, 1)
  // Same species again: count grows, distinct total does not.
  const again = sfThrowBall({ ...caught, encounter: { species: 0, rarity: 'common' } }, seq(0.1))
  assert.equal(again.dex.caught['0'], 2)
  assert.equal(again.dexCaught, 1)
  // Persistence round-trip: a fresh store reloads the dex via localStorage.
  const reloaded = createSafariState()
  assert.equal(reloaded.dex.caught['0'], 2)
  assert.equal(reloaded.dexCaught, 1)
  // A miss clears the encounter and reports the flee.
  const fled = sfThrowBall({ ...state, encounter: { species: 4, rarity: 'very' } }, seq(0.9))
  assert.equal(fled.lastResult, 'fled')
  assert.equal(fled.encounter, null)
  assert.equal(fled.dexCaught, 0)
})

test('release ends an encounter without touching the dex', () => {
  let state = createSafariState()
  const dexBefore = state.dex
  state = { ...state, encounter: { species: 7, rarity: 'rare' } }
  const released = sfRelease(state)
  assert.equal(released.encounter, null)
  assert.equal(released.lastResult, 'released')
  assert.equal(released.dex, dexBefore, 'release never rewrites the dex')
  assert.equal(released.dexCaught, state.dexCaught)
})

test('the store walks to a target, refits the board and round-trips the dex', () => {
  const store = createSafariStore()
  const snap = store.getSnapshot()
  const spawn = snap.pos
  store.walkTo(spawn - 1)
  // The walk timer moves the avatar synchronously on the first tick.
  assert.equal(store.getSnapshot().pos, spawn - 1)
  store.nextRegion()
  assert.equal(store.getSnapshot().region, snap.region + 1)
  assert.equal(store.getSnapshot().pos, Math.floor(snap.rows / 2) * snap.cols + Math.floor(snap.cols / 2))
  store.fitBoard(920, 420)
  const fitted = store.getSnapshot()
  assert.deepEqual([fitted.cols, fitted.rows], [66, 30])
  assert.equal(fitted.map.length, 66 * 30)
  store.toggleDex()
  assert.equal(store.getSnapshot().dexOpen, true)
  store.dispose()
})

test('drawSafariMap paints on a stub canvas without throwing', () => {
  const { drawSafariMap } = client.__game
  const calls = { fillRect: 0, arc: 0, stroke: 0 }
  const ctx = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'createLinearGradient') {
          return () => ({ addColorStop() {} })
        }
        if (prop in calls) {
          return () => {
            calls[prop] += 1
          }
        }
        return () => {}
      },
    },
  )
  const canvas = { clientWidth: 480, clientHeight: 360, getContext: () => ctx }
  const state = { ...createSafariState(), cols: 24, rows: 12 }
  drawSafariMap(canvas, state)
  assert.ok(calls.fillRect > 100, `terrain tiles painted (${calls.fillRect})`)
  assert.ok(calls.arc >= 2, `player/rocks drawn (${calls.arc})`)
  assert.ok(calls.stroke >= 2, `grid/details stroked (${calls.stroke})`)
  // Degenerate sizes are ignored, not crashed.
  drawSafariMap({ clientWidth: 0, clientHeight: 0, getContext: () => ctx }, state)
  drawSafariMap(null, state)
})

test('D47b: clicking an unreachable cell flashes feedback instead of silence', () => {
  const store = createSafariStore()
  const state = store.getSnapshot()
  // Find a water cell: it is unreachable by definition.
  const water = state.map.indexOf(2)
  assert.ok(water >= 0)
  store.walkTo(water)
  assert.equal(store.getSnapshot().invalid, water, 'red-cross flash set')
  assert.equal(store.getSnapshot().target, null)
  store.dispose()
})

test('D47b: a walk sets a visible target marker that clears on arrival', async () => {
  const store = createSafariStore()
  const fresh = createSafariState() // same deterministic map as the store
  const spawn = fresh.pos
  // Pick a reachable target ≥3 steps away whose whole route is plain ground,
  // so no grass encounter can interrupt the walk.
  let targetCell = null
  let routeLen = 0
  const sx = spawn % fresh.cols
  const sy = Math.floor(spawn / fresh.cols)
  outer: for (let d = 3; d <= 8; d += 1) {
    for (let ry = sy - d; ry <= sy + d; ry += 1) {
      for (let rx = sx - d; rx <= sx + d; rx += 1) {
        if (rx < 0 || ry < 0 || rx >= fresh.cols || ry >= fresh.rows) continue
        const dist = Math.abs(rx - sx) + Math.abs(ry - sy)
        if (dist < 3) continue
        const c = ry * fresh.cols + rx
        const route = sfPath(fresh, c)
        if (route !== null && route.length >= 3 && route.every((i) => fresh.map[i] === 0)) {
          targetCell = c
          routeLen = route.length
          break outer
        }
      }
    }
  }
  assert.ok(targetCell !== null, 'a plain reachable target exists near spawn')
  store.walkTo(targetCell)
  assert.equal(store.getSnapshot().target, targetCell, 'marker shows immediately')
  assert.equal(store.getSnapshot().invalid, null)
  // The walk continues on the timer and clears the marker on arrival.
  await new Promise((resolve) => setTimeout(resolve, routeLen * 90 + 250))
  const done = store.getSnapshot()
  assert.equal(done.pos, targetCell)
  assert.equal(done.target, null)
  store.dispose()
})
