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
  sfWalkable,
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
  const calls = { fillRect: 0, drawImage: 0 }
  const ctx = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop in calls) {
          return () => {
            calls[prop] += 1
          }
        }
        return () => {}
      },
    },
  )
  const canvas = { clientWidth: 480, clientHeight: 360, getContext: () => ctx, width: 0, height: 0 }
  const state = { ...createSafariState(), cols: 24, rows: 12 }
  drawSafariMap(canvas, state)
  // Fallback path (no DOM in the loader): pixels painted straight onto ctx.
  assert.ok(calls.fillRect > 100, `terrain tiles painted (${calls.fillRect})`)
  // Degenerate sizes are ignored, not crashed.
  drawSafariMap({ clientWidth: 0, clientHeight: 0, getContext: () => ctx }, state)
  drawSafariMap(null, state)
})

test('sfPaintPixels covers the whole pixel map; encounters/targets draw marks', () => {
  const { sfPaintPixels } = client.__game
  let fillRects = 0
  const ctx = { fillStyle: '', fillRect(x, y, w, h) { void x; void y; void w; void h; fillRects += 1 } }
  const base = createSafariState()
  const water = base.map.indexOf(2)
  const state = {
    ...base,
    rustle: base.map.indexOf(1),
    route: [base.pos + 1, base.pos + 2],
    target: base.pos + 3,
    invalid: water,
  }
  sfPaintPixels(ctx, state, 8)
  // 24×12 cells × (base + details) — comfortably over 288 rects.
  assert.ok(fillRects > 288, `pixel painter coverage (${fillRects})`)
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

test('value-noise terrain: contiguous patches, no isolated specks, all terrains present', () => {
  const shapes = [
    [1, 24, 12],
    [2, 24, 12],
    [3, 45, 20],
    [1, 66, 30],
    [5, 90, 44],
    [1, 10, 8],
    [1, 23, 9],
  ]
  for (const [region, cols, rows] of shapes) {
    const map = sfMapOf(region, cols, rows)
    const counts = [0, 0, 0, 0]
    map.forEach((t) => {
      counts[t] += 1
    })
    // Every map still has lake, rocks and grass.
    assert.ok(counts[2] >= 2, `region ${region} ${cols}x${rows} has water`)
    assert.ok(counts[3] >= 2, `region ${region} ${cols}x${rows} has rock`)
    assert.ok(counts[1] >= 2, `region ${region} ${cols}x${rows} has grass`)
    // No water/rock cell is fully isolated (8-dir) — no "sesame" specks.
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const t = map[y * cols + x]
        if (t !== 2 && t !== 3) continue
        let same = 0
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
            if (map[ny * cols + nx] === t) same += 1
          }
        }
        assert.ok(same > 0, `region ${region} ${cols}x${rows} cell ${x},${y} is not isolated`)
      }
    }
  }
})

test('sfMigratePos maps proportionally and escapes unwalkable landings', () => {
  const { sfMigratePos, sfSpawnOf } = client.__game
  const cols = 24
  const rows = 12
  const bigCols = 66
  const bigRows = 30
  const bigMap = sfMapOf(1, bigCols, bigRows)
  const center = Math.floor(rows / 2) * cols + Math.floor(cols / 2)
  const migrated = sfMigratePos(center, cols, rows, bigCols, bigRows, bigMap)
  assert.ok(sfWalkable(bigMap[migrated]))
  const mx = migrated % bigCols
  const my = Math.floor(migrated / bigCols)
  assert.ok(Math.abs(mx - 33) <= 3, `x stays central (${mx})`)
  assert.ok(Math.abs(my - 15) <= 3, `y stays central (${my})`)
  // Unwalkable landing: an all-water map except one island → nearest island.
  const drowned = new Array(66 * 30).fill(2)
  drowned[7 * 66 + 8] = 0
  const escaped = sfMigratePos(center, cols, rows, 66, 30, drowned)
  assert.equal(escaped, 7 * 66 + 8)
  // Nothing walkable at all: fall back to spawn.
  const flooded = new Array(66 * 30).fill(2)
  assert.equal(sfMigratePos(center, cols, rows, 66, 30, flooded), sfSpawnOf(66, 30))
})

test('feedback P0-new: a fit during an encounter is deferred, then applied', async () => {
  const store = createSafariStore()
  const fresh = createSafariState()
  const spawn = fresh.pos
  // A grass cell a few steps out whose route is plain except for the final
  // grass step — shuttling onto it eventually triggers an encounter.
  let grass = -1
  let grassRouteLen = 0
  const sx = spawn % fresh.cols
  const sy = Math.floor(spawn / fresh.cols)
  outer: for (let d = 1; d <= 4; d += 1) {
    for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
      const gx = sx + dx
      const gy = sy + dy
      if (gx < 0 || gy < 0 || gx >= fresh.cols || gy >= fresh.rows) continue
      const g = gy * fresh.cols + gx
      if (fresh.map[g] !== 1) continue
      const route = sfPath(fresh, g)
      if (route !== null && route.slice(0, -1).every((i) => fresh.map[i] === 0)) {
        grass = g
        grassRouteLen = route.length
        break outer
      }
    }
  }
  assert.ok(grass >= 0, 'a plain-routed grass cell exists near spawn')
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const walkMs = grassRouteLen * 90 + 140
  let sawEncounter = false
  for (let attempt = 0; attempt < 60 && !sawEncounter; attempt += 1) {
    store.walkTo(grass)
    await sleep(walkMs)
    const snap = store.getSnapshot()
    if (snap.rustle !== null) {
      assert.equal(snap.encounter, null, 'the encounter waits out the rustle window')
      await sleep(400)
    }
    if (store.getSnapshot().encounter !== null) sawEncounter = true
    else store.walkTo(spawn)
    await sleep(walkMs)
  }
  assert.ok(sawEncounter, 'grass eventually triggered an encounter')
  const met = store.getSnapshot()
  assert.ok(met.encounter !== null, 'the encounter window opened after the warning')
  assert.equal(met.rustle, null)
  // Busy board: the fit is parked, not dropped and not applied mid-encounter.
  store.fitBoard(920, 420)
  assert.equal(store.getSnapshot().cols, met.cols, 'fit deferred while encountering')
  store.release()
  const fitted = store.getSnapshot()
  assert.deepEqual([fitted.cols, fitted.rows], [66, 30], 'parked fit applied after release')
  store.dispose()
})

test('feedback P0-new: a fit during a walk applies when the walk ends', async () => {
  const store = createSafariStore()
  const fresh = createSafariState()
  const spawn = fresh.pos
  // Reuse the plain-route search: a reachable target whose route is all plain.
  let targetCell = null
  let routeLen = 0
  const sx = spawn % fresh.cols
  const sy = Math.floor(spawn / fresh.cols)
  outer: for (let d = 3; d <= 10; d += 1) {
    for (let ry = sy - d; ry <= sy + d; ry += 1) {
      for (let rx = sx - d; rx <= sx + d; rx += 1) {
        if (rx < 0 || ry < 0 || rx >= fresh.cols || ry >= fresh.rows) continue
        if (Math.abs(rx - sx) + Math.abs(ry - sy) < 3) continue
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
  assert.ok(targetCell !== null)
  store.walkTo(targetCell)
  store.fitBoard(920, 420)
  assert.equal(store.getSnapshot().cols, fresh.cols, 'fit deferred mid-walk')
  await new Promise((resolve) => setTimeout(resolve, routeLen * 90 + 260))
  const fitted = store.getSnapshot()
  assert.deepEqual([fitted.cols, fitted.rows], [66, 30], 'parked fit applied after arrival')
  store.dispose()
})

test('keyboard steering: one cell per keypress, blocks flash, edges are safe', () => {
  const store = createSafariStore()
  const fresh = createSafariState()
  const spawn = fresh.pos
  // A walkable neighbour exists by construction (spawn cross is plain).
  const dir = sfWalkable(fresh.map[spawn + 1])
    ? 'right'
    : sfWalkable(fresh.map[spawn - 1])
      ? 'left'
      : 'down'
  store.stepDir(dir)
  let snap = store.getSnapshot()
  assert.ok(snap.pos !== spawn, 'the explorer moved one cell')
  assert.equal(snap.encounter === null || snap.rustle === null, true)
  // Back to spawn, then step into water/rock: red cross, no movement.
  const back = { up: 'down', down: 'up', left: 'right', right: 'left' }[dir]
  store.stepDir(back)
  snap = store.getSnapshot()
  assert.equal(snap.pos, spawn)
  const blockedDir = ['up', 'down', 'left', 'right'].find((name) => {
    const deltas = { up: -fresh.cols, down: fresh.cols, left: -1, right: 1 }
    const cell = spawn + deltas[name]
    if (cell < 0 || cell >= fresh.map.length) return false
    if ((name === 'left' && spawn % fresh.cols === 0) || (name === 'right' && spawn % fresh.cols === fresh.cols - 1)) return false
    return !sfWalkable(fresh.map[cell])
  })
  if (blockedDir !== undefined) {
    store.stepDir(blockedDir)
    snap = store.getSnapshot()
    assert.equal(snap.pos, spawn, 'unwalkable cell refused')
    assert.ok(snap.invalid !== null, 'red cross flashed instead of silence')
  }
  // Board edges never wrap around rows (row middle: left/up are safe calls).
  assert.doesNotThrow(() => {
    store.stepDir('left')
    store.stepDir('up')
  })
  store.dispose()
})

test('pixel sprite painter: all 54 species paint and differ', () => {
  const { sfPaintSprite, SF_SPECIES_TOTAL, SF_PALETTE_COLORS } = client.__game
  const makeCtx = () => {
    const rects = []
    return {
      fillStyle: '',
      fillRect(x, y, w, h) {
        rects.push([x, y, w, h, this.fillStyle])
      },
      rects,
    }
  }
  const signatures = new Set()
  for (let s = 0; s < SF_SPECIES_TOTAL; s += 1) {
    const ctx = makeCtx()
    sfPaintSprite(ctx, s, 16)
    assert.ok(ctx.rects.length >= 12, `species ${s} paints enough blocks (${ctx.rects.length})`)
    for (const rect of ctx.rects) {
      for (const v of rect.slice(0, 4)) {
        assert.ok(Number.isFinite(v) && v >= 0, `species ${s} rect inside canvas`)
      }
    }
    signatures.add(JSON.stringify(ctx.rects))
  }
  assert.equal(signatures.size, SF_SPECIES_TOTAL, 'every species has a distinct pixel signature')
})

test('encounter key map: F throws, Q/Esc release, Space stays off the keys', () => {
  const { sfEncounterKey } = client.__game
  assert.equal(sfEncounterKey('f', 'KeyF'), 'throw')
  assert.equal(sfEncounterKey('F', undefined), 'throw')
  assert.equal(sfEncounterKey('', 'KeyF'), 'throw', 'IME-mangled key still matches via code')
  assert.equal(sfEncounterKey('q', 'KeyQ'), 'release')
  assert.equal(sfEncounterKey('Escape', 'Escape'), 'release')
  assert.equal(sfEncounterKey('Escape', undefined), 'release')
  assert.equal(sfEncounterKey(' ', 'Space'), null, 'space is deliberately not a throw key')
  assert.equal(sfEncounterKey('Enter', 'Enter'), null)
  assert.equal(sfEncounterKey('ArrowUp', 'ArrowUp'), null)
})

test('D48: region themes cycle four distinct palettes', () => {
  const { sfThemeOf } = client.__game
  const keys = [sfThemeOf(1).key, sfThemeOf(2).key, sfThemeOf(3).key, sfThemeOf(4).key, sfThemeOf(5).key]
  assert.deepEqual(keys, [
    'sf.theme.grass',
    'sf.theme.snow',
    'sf.theme.desert',
    'sf.theme.volcano',
    'sf.theme.grass',
  ], 'themes cycle by region % 4')
  // Each theme is a complete, distinct colour set.
  const sigs = new Set([1, 2, 3, 4].map((r) => JSON.stringify(sfThemeOf(r))))
  assert.equal(sigs.size, 4)
  for (const r of [1, 2, 3, 4]) {
    const T = sfThemeOf(r)
    for (const k of ['plain', 'plainAlt', 'grass', 'water', 'waterEdge', 'wave', 'rock', 'boulder', 'boulderLit', 'player', 'playerEdge']) {
      assert.match(T[k], /^#[0-9a-f]{6}$/i, `theme ${r} key ${k} is a hex colour`)
    }
  }
  // D48b: the snow theme must not keep the near-white player (it vanished on
  // the pale plain — user screenshot report).
  assert.notEqual(sfThemeOf(2).player, sfThemeOf(1).player, 'snow player colour differs from the dark-theme default')
})

test('D48: water waves animate across two frames; painter stays deterministic', () => {
  const { sfPaintPixels } = client.__game
  const run = (state) => {
    const rects = []
    const ctx = { fillStyle: '', fillRect(x, y, w, h) { rects.push([x, y, w, h, this.fillStyle]) } }
    sfPaintPixels(ctx, state, 8)
    return rects
  }
  const base = createSafariState()
  const still = run({ ...base })
  const still2 = run({ ...base })
  assert.deepEqual(still, still2, 'no waveFrame → deterministic (static) paint')
  const animated = run({ ...base, waveFrame: 1 })
  assert.notDeepEqual(still, animated, 'frame 1 changes the paint')
  assert.equal(run({ ...base, waveFrame: 1 }).length, animated.length, 'frame change keeps rect count stable')
})

test('D48: sprite painter bakes rarity flourishes deterministically', () => {
  const { sfPaintSprite, sfRarityOf } = client.__game
  assert.ok(sfRarityOf, 'sfRarityOf exported via __game')
  const run = (species) => {
    const rects = []
    const ctx = { fillStyle: '', fillRect(x, y, w, h) { rects.push([x, y, w, h, this.fillStyle]) } }
    sfPaintSprite(ctx, species, 16)
    return rects
  }
  // A very-rare species paints the golden star sparkle (#ffd23f).
  const very = Array.from({ length: 54 }, (_, s) => s).find((s) => sfRarityOf(s) === 'very')
  const rare = Array.from({ length: 54 }, (_, s) => s).find((s) => sfRarityOf(s) === 'rare')
  const rectsVery = run(very)
  assert.ok(
    rectsVery.some((r) => r[4] === '#ffd23f'),
    'very-rare species carries the star sparkle colour',
  )
  // Outline pass: the dark outline tone differs from every palette base.
  const bases = new Set(rectsVery.map((r) => r[4]))
  assert.ok(bases.size >= 4, `sprite uses multiple tone steps (${bases.size})`)
  assert.ok(run(rare).length > 0)
  // Deterministic: same species twice paints identically.
  assert.deepEqual(run(very), run(very))
})
