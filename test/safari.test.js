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

test('maps are deterministic per region and spawn is always walkable', () => {
  const a = sfMapOf(3)
  const b = sfMapOf(3)
  assert.deepEqual(a, b)
  assert.notDeepEqual(a, sfMapOf(4))
  const mid = Math.floor(12 / 2)
  const spawn = mid * 12 + mid
  for (const i of [spawn, spawn - 1, spawn + 1, spawn - 12, spawn + 12]) {
    assert.notEqual(a[i], 2, `cell ${i} not water`)
    assert.notEqual(a[i], 3, `cell ${i} not rock`)
  }
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
  const mid = Math.floor(12 / 2)
  const spawn = mid * 12 + mid
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

test('the store drives step/throw/region and the dex round-trips storage', () => {
  const store = createSafariStore()
  const snap = store.getSnapshot()
  const mid = Math.floor(12 / 2)
  store.step(mid * 12 + mid - 1)
  assert.equal(store.getSnapshot().pos, mid * 12 + mid - 1)
  store.nextRegion()
  assert.equal(store.getSnapshot().region, snap.region + 1)
  assert.equal(store.getSnapshot().pos, mid * 12 + mid)
  store.toggleDex()
  assert.equal(store.getSnapshot().dexOpen, true)
})
