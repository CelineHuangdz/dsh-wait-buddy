
    // ---------------------------------------------------------------------
    // §8c Sprite Safari (D47): explore a grid map, encounter procedural
    // sprites in the grass, catch them with one click, fill a persistent
    // dex. Turn-based; pauseOnLeave false.
    // ---------------------------------------------------------------------

    // D47b/D48: click-to-walk plus arrow/WASD one-cell steering.
    const SF_KEY_DIRECTIONS = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      s: 'down',
      a: 'left',
      d: 'right',
      W: 'up',
      S: 'down',
      A: 'left',
      D: 'right',
      KeyW: 'up',
      KeyS: 'down',
      KeyA: 'left',
      KeyD: 'right',
    }

    /**
     * Encounter-window key map: F throws, Q releases (Esc also releases).
     * Space is deliberately NOT a throw key — the host page scrolls on it
     * (feedback), so the encounter keys stay off the scroll key entirely.
     * Matched by `code` (physical) with a `key` fallback for IME safety.
     */
    function sfEncounterKey(key, code) {
      const k = key === 'Process' || key === 'Unidentified' ? '' : key
      if (k === 'f' || k === 'F' || code === 'KeyF') return 'throw'
      if (k === 'q' || k === 'Q' || code === 'KeyQ') return 'release'
      if (k === 'Escape' || code === 'Escape') return 'release'
      return null
    }

    // D47b: cells stay ~36px; the grid shape follows the board's aspect ratio
    // (a wide board is e.g. 25×12), so tiles never stretch into bars.
    const SF_CELL_TARGET = 14
    const SAFARI_GRASS_CHANCE = 0.18
    const SF_TERRAIN = { plain: 0, grass: 1, water: 2, rock: 3 }
    const SF_DEX_KEY = 'dsh-wait-buddy.dex.v1'
    /** Body × palette × pattern = 3 × 6 × 3 = 54 species. */
    const SF_BODIES = 3
    const SF_PALETTES = 6
    const SF_PATTERNS = 3
    const SF_SPECIES_TOTAL = SF_BODIES * SF_PALETTES * SF_PATTERNS

    const SF_PALETTE_COLORS = ['#e5484d', '#3b82f6', '#30a46c', '#e2a93b', '#8e4ec6', '#29bac5']
    const SF_BODY_KEYS = ['sf.body.round', 'sf.body.block', 'sf.body.tall']
    const SF_PALETTE_KEYS = [
      'sf.color.red',
      'sf.color.blue',
      'sf.color.green',
      'sf.color.yellow',
      'sf.color.purple',
      'sf.color.cyan',
    ]
    const SF_PATTERN_KEYS = ['sf.pattern.plain', 'sf.pattern.spots', 'sf.pattern.stripes']

    /** Deterministic rarity from the species number: 6 very rare, 12 rare. */
    function sfRarityOf(species) {
      if (species % 9 === 4) return 'very'
      if (species % 3 === 1) return 'rare'
      return 'common'
    }

    /** Localized species name composed from dictionary parts. */
    function sfSpeciesName(t, species) {
      const body = Math.floor(species / (SF_PALETTES * SF_PATTERNS))
      const palette = Math.floor((species % (SF_PALETTES * SF_PATTERNS)) / SF_PATTERNS)
      const pattern = species % SF_PATTERNS
      return t('sf.name', {
        color: t(SF_PALETTE_KEYS[palette]),
        pattern: t(SF_PATTERN_KEYS[pattern]),
        body: t(SF_BODY_KEYS[body]),
      })
    }

    /**
     * Deterministic terrain for one region at a given grid shape.
     * Feedback P1: i.i.d. per-cell dice read as "sesame noise", so the map is
     * built from smooth value noise — a coarse random lattice bilinearly
     * interpolated, normalised per map, then sliced into contiguous terrain
     * bands. The seed stays `region × cols × rows`, so shapes remain fully
     * deterministic.
     */
    function sfMapOf(region, cols, rows) {
      let seed = (region * 2654435761 + cols * 31 + rows) % 2147483647
      if (seed <= 0) seed += 2147483646
      const next = () => {
        seed = (seed * 16807) % 2147483647
        return seed / 2147483647
      }
      const scale = 5
      const gw = Math.ceil(cols / scale) + 2
      const gh = Math.ceil(rows / scale) + 2
      const grid = new Array(gw * gh)
      for (let i = 0; i < grid.length; i += 1) grid[i] = next()
      const at = (x, y) => grid[Math.min(gh - 1, y) * gw + Math.min(gw - 1, x)]
      const values = new Array(cols * rows).fill(0)
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const fx = x / scale
          const fy = y / scale
          const x0 = Math.floor(fx)
          const y0 = Math.floor(fy)
          const tx = fx - x0
          const ty = fy - y0
          // Smoothstep weights keep the lattice interpolation C1-continuous.
          const wx = tx * tx * (3 - 2 * tx)
          const wy = ty * ty * (3 - 2 * ty)
          const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * wx
          const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * wx
          let v = top + (bottom - top) * wy
          // A light per-cell jitter roughens band edges without breaking
          // spatial correlation (still deterministic via position hash).
          v = v * 0.92 + sfJitter(y * cols + x, region) * 0.08
          values[y * cols + x] = v
        }
      }
      // Normalise per map, then slice into fixed bands: every region gets
      // ~16% water / 16% rock / 30% grass in contiguous patches regardless of
      // lattice luck (interpolated values otherwise cluster around 0.5).
      let lo = 1
      let hi = 0
      for (const v of values) {
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
      const span = hi - lo < 1e-9 ? 1 : hi - lo
      const map = values.map((v) => {
        const u = (v - lo) / span
        return u < 0.18
          ? SF_TERRAIN.water
          : u < 0.34
            ? SF_TERRAIN.rock
            : u < 0.64
              ? SF_TERRAIN.grass
              : SF_TERRAIN.plain
      })
      // Despeckle helper: a water/rock cell with no same-terrain neighbour at
      // all is band-edge jitter, not a feature — demote it to plain.
      const despeckle = () => {
        for (let y = 0; y < rows; y += 1) {
          for (let x = 0; x < cols; x += 1) {
            const i = y * cols + x
            const t = map[i]
            if (t !== SF_TERRAIN.water && t !== SF_TERRAIN.rock) continue
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
            if (same === 0) map[i] = SF_TERRAIN.plain
          }
        }
      }
      // Tiny boards can miss a band entirely; carve a 2×2 patch at the
      // extreme-value corner so every map still has water and rock. Kept away
      // from the spawn cross and the board edge so it never clips.
      const spawn = sfSpawnOf(cols, rows)
      const sx = spawn % cols
      const sy = Math.floor(spawn / cols)
      const carve = (terrain, pickHigh) => {
        if (map.includes(terrain)) return
        let best = null
        for (let y = 1; y < rows - 2; y += 1) {
          for (let x = 1; x < cols - 2; x += 1) {
            if (Math.abs(x - sx) <= 2 && Math.abs(y - sy) <= 2) continue
            if (best === null) best = { x, y }
            else if (pickHigh ? values[y * cols + x] > values[best.y * cols + best.x] : values[y * cols + x] < values[best.y * cols + best.x]) best = { x, y }
          }
        }
        if (best === null) return
        for (let dy = 0; dy < 2; dy += 1) {
          for (let dx = 0; dx < 2; dx += 1) {
            map[(best.y + dy) * cols + best.x + dx] = terrain
          }
        }
      }
      // Clean band-edge specks first so the carve check below is meaningful.
      despeckle()
      carve(SF_TERRAIN.water, false)
      carve(SF_TERRAIN.rock, true)
      // The spawn cell and its cross neighbours are always walkable.
      for (const i of [spawn, spawn - 1, spawn + 1, spawn - cols, spawn + cols]) {
        map[i] = SF_TERRAIN.plain
      }
      despeckle()
      return map
    }

    function sfSpawnOf(cols, rows) {
      return Math.floor(rows / 2) * cols + Math.floor(cols / 2)
    }

    /** Grid shape that keeps cells ~36px on a board of this size. */
    function sfFitDims(width, height) {
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
      return {
        cols: clamp(Math.round(width / SF_CELL_TARGET), 10, 90),
        rows: clamp(Math.round(height / SF_CELL_TARGET), 8, 44),
      }
    }

    /** BFS over walkable cells; returns the path excluding the start. */
    function sfPath(prev, target) {
      if (target === prev.pos) return []
      const total = prev.cols * prev.rows
      const prevOf = new Array(total).fill(-1)
      prevOf[prev.pos] = prev.pos
      const queue = [prev.pos]
      let head = 0
      while (head < queue.length) {
        const at = queue[head]
        head += 1
        if (at === target) break
        const x = at % prev.cols
        for (const d of [-1, 1, -prev.cols, prev.cols]) {
          const n = at + d
          if (n < 0 || n >= total) continue
          if ((d === -1 && x === 0) || (d === 1 && x === prev.cols - 1)) continue
          if (prevOf[n] !== -1 || !sfWalkable(prev.map[n])) continue
          prevOf[n] = at
          queue.push(n)
        }
      }
      if (prevOf[target] === -1) return null
      const path = []
      let at = target
      while (at !== prev.pos) {
        path.unshift(at)
        at = prevOf[at]
      }
      return path
    }

    /** Encounter roll: rarity first, then a uniform species of that tier. */
    function sfRollEncounter(random = Math.random) {
      const roll = random()
      const tier = roll < 0.05 ? 'very' : roll < 0.3 ? 'rare' : 'common'
      const pool = []
      for (let s = 0; s < SF_SPECIES_TOTAL; s += 1) {
        if (sfRarityOf(s) === tier) pool.push(s)
      }
      return { species: pool[Math.floor(random() * pool.length)], rarity: tier }
    }

    const SF_CATCH_RATE = { common: 0.7, rare: 0.45, very: 0.2 }

    /** Fresh safari state; the dex is loaded from localStorage when present. */
    function createSafariState() {
      let dex = { caught: {} }
      try {
        const raw = window.localStorage.getItem(SF_DEX_KEY)
        if (raw !== null) {
          const parsed = JSON.parse(raw)
          if (parsed !== null && typeof parsed === 'object' && typeof parsed.caught === 'object') {
            dex = { caught: parsed.caught }
          }
        }
      } catch (error) {
        dex = { caught: {} }
      }
      let caught = 0
      for (const key of Object.keys(dex.caught)) {
        if (Number.isInteger(dex.caught[key]) && dex.caught[key] > 0) caught += 1
      }
      const cols = 24
      const rows = 12
      return {
        region: 1,
        cols,
        rows,
        map: sfMapOf(1, cols, rows),
        pos: sfSpawnOf(cols, rows),
        encounter: null, // { species, rarity }
        rustle: null, // grass cell shaking before an encounter pops (feedback P1)
        lastResult: '', // 'caught' | 'fled' | 'released'
        target: null, // walk destination (click feedback, D47b)
        invalid: null, // clicked an unreachable cell (red cross flash)
        route: [], // remaining walk path, drawn as dots (visibility at 14px)
        dex,
        dexCaught: caught,
        dexOpen: false,
      }
    }

    function sfWalkable(terrain) {
      return terrain === SF_TERRAIN.plain || terrain === SF_TERRAIN.grass
    }

    function sfAdjacent(a, b, cols) {
      const ax = a % cols
      const ay = Math.floor(a / cols)
      const bx = b % cols
      const by = Math.floor(b / cols)
      return Math.abs(ax - bx) + Math.abs(ay - by) === 1
    }

    /** Try to step to a cell; grass may trigger an encounter. */
    function sfStep(prev, cell, random = Math.random) {
      if (prev.encounter !== null) return prev
      if (!sfAdjacent(prev.pos, cell, prev.cols)) return prev
      if (!sfWalkable(prev.map[cell])) return prev
      const stepped = { ...prev, pos: cell, lastResult: '' }
      if (prev.map[cell] !== SF_TERRAIN.grass) return stepped
      if (random() >= SAFARI_GRASS_CHANCE) return stepped
      return { ...stepped, encounter: sfRollEncounter(random) }
    }

    /** One-click catch: by rarity; a miss makes the sprite flee. */
    function sfThrowBall(prev, random = Math.random) {
      if (prev.encounter === null) return prev
      const rarity = prev.encounter.rarity
      const caught = random() < SF_CATCH_RATE[rarity]
      if (!caught) return { ...prev, encounter: null, lastResult: 'fled' }
      const id = String(prev.encounter.species)
      const caughtMap = { ...prev.dex.caught, [id]: (prev.dex.caught[id] ?? 0) + 1 }
      try {
        window.localStorage.setItem(SF_DEX_KEY, JSON.stringify({ caught: caughtMap }))
      } catch (error) {
        console.error('[wait-buddy] storing dex failed', error)
      }
      const isNew = caughtMap[id] === 1
      return {
        ...prev,
        encounter: null,
        lastResult: 'caught',
        dex: { caught: caughtMap },
        dexCaught: prev.dexCaught + (isNew ? 1 : 0),
      }
    }

    function sfRelease(prev) {
      if (prev.encounter === null) return prev
      return { ...prev, encounter: null, lastResult: 'released' }
    }

    /** 320ms grass-shake warning before an encounter window pops (feedback P1). */
    const SF_RUSTLE_MS = 320

    /**
     * Map the player's cell onto a refitted grid proportionally; if the new
     * cell is unwalkable, walk outward to the nearest walkable cell instead
     * of silently teleporting to spawn (feedback P0-new).
     */
    function sfMigratePos(pos, oldCols, oldRows, cols, rows, map) {
      const x = Math.min(cols - 1, Math.max(0, Math.round(((pos % oldCols) + 0.5) * (cols / oldCols) - 0.5)))
      const y = Math.min(rows - 1, Math.max(0, Math.round((Math.floor(pos / oldCols) + 0.5) * (rows / oldRows) - 0.5)))
      const start = y * cols + x
      if (sfWalkable(map[start])) return start
      const total = cols * rows
      const seen = new Uint8Array(total)
      const queue = [start]
      seen[start] = 1
      let head = 0
      while (head < queue.length) {
        const at = queue[head]
        head += 1
        if (sfWalkable(map[at])) return at
        const ax = at % cols
        for (const d of [-1, 1, -cols, cols]) {
          const n = at + d
          if (n < 0 || n >= total || seen[n]) continue
          if ((d === -1 && ax === 0) || (d === 1 && ax === cols - 1)) continue
          seen[n] = 1
          queue.push(n)
        }
      }
      return sfSpawnOf(cols, rows)
    }

    function createSafariStore() {
      let state = createSafariState()
      let path = []
      let timer = null
      let invalidTimer = null
      let rustleTimer = null
      // A fit requested while walking / rustling / encountering is applied as
      // soon as the board goes quiet again — never dropped (feedback P0-new).
      let pendingFit = null
      const listeners = new Set()
      const clearRustle = () => {
        if (rustleTimer !== null) {
          clearTimeout(rustleTimer)
          rustleTimer = null
        }
      }
      const stopWalk = () => {
        if (timer !== null) {
          clearInterval(timer)
          timer = null
        }
        path = []
      }
      /** True while a refit would tear an in-flight walk or encounter. */
      const busy = () => path.length > 0 || rustleTimer !== null || state.encounter !== null
      const applyFit = () => {
        if (pendingFit === null || busy()) return
        const { width, height } = pendingFit
        pendingFit = null
        const { cols, rows } = sfFitDims(width, height)
        if (cols === state.cols && rows === state.rows) return
        const map = sfMapOf(state.region, cols, rows)
        publish({
          ...state,
          cols,
          rows,
          map,
          pos: sfMigratePos(state.pos, state.cols, state.rows, cols, rows, map),
          lastResult: '',
          route: [],
        })
      }
      const publish = (next) => {
        if (next === state) return
        state = next
        if (state.encounter !== null) stopWalk()
        for (const listener of [...listeners]) listener()
      }
      const flashInvalid = (cell) => {
        publish({ ...state, invalid: cell })
        if (invalidTimer !== null) clearTimeout(invalidTimer)
        invalidTimer = setTimeout(() => {
          invalidTimer = null
          if (state.invalid === cell) publish({ ...state, invalid: null })
        }, 800)
      }
      /** Feedback P1: warn first — shake the grass ~300ms before the
       * encounter window pops, so a stop feels foreshadowed. */
      const startEncounter = (stepped, cell) => {
        stopWalk()
        const rolled = stepped.encounter
        publish({ ...stepped, encounter: null, rustle: cell, target: null, route: [] })
        rustleTimer = setTimeout(() => {
          rustleTimer = null
          publish({ ...state, rustle: null, encounter: rolled })
          applyFit()
        }, SF_RUSTLE_MS)
      }
      const tick = () => {
        if (path.length === 0) {
          stopWalk()
          publish({ ...state, target: null, route: [] })
          applyFit()
          return
        }
        const next = path.shift()
        const stepped = sfStep(state, next)
        if (stepped === state) return
        if (stepped.encounter !== null) {
          startEncounter(stepped, next)
          return
        }
        publish({ ...stepped, route: path.slice(), target: stepped.target })
      }
      return {
        getSnapshot: () => state,
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        /** Click-to-walk: BFS to the target, one step per tick; encounters stop. */
        walkTo(cell) {
          if (state.encounter !== null || state.rustle !== null) return
          if (invalidTimer !== null) {
            clearTimeout(invalidTimer)
            invalidTimer = null
          }
          const route = sfPath(state, cell)
          if (route === null || route.length === 0) {
            // D47b: never a silent no-op — flash a red cross on the cell.
            if (route === null) flashInvalid(cell)
            return
          }
          path = route
          if (timer === null) {
            timer = setInterval(tick, 90)
            tick()
          }
          // The first tick may already have hit grass and started a rustle
          // (or finished the walk) — never stamp a stale target over that.
          if (timer !== null && path.length > 0 && state.rustle === null && state.encounter === null) {
            publish({ ...state, target: cell, invalid: null, route: path.slice() })
          }
        },
        /**
         * Keyboard step (arrows / WASD): one cell in a cardinal direction.
         * Manual steering cancels an auto-walk; water/rock flash the same red
         * cross as an unreachable click.
         */
        stepDir(name) {
          if (state.encounter !== null || state.rustle !== null) return
          const deltas = { up: -state.cols, down: state.cols, left: -1, right: 1 }
          const delta = deltas[name]
          if (delta === undefined) return
          const x = state.pos % state.cols
          if ((delta === -1 && x === 0) || (delta === 1 && x === state.cols - 1)) return
          const cell = state.pos + delta
          if (cell < 0 || cell >= state.cols * state.rows) return
          if (invalidTimer !== null) {
            clearTimeout(invalidTimer)
            invalidTimer = null
          }
          stopWalk()
          const stepped = sfStep(state, cell)
          if (stepped === state) {
            flashInvalid(cell)
            return
          }
          if (stepped.encounter !== null) {
            startEncounter(stepped, cell)
            return
          }
          publish({ ...stepped, target: null, invalid: null, route: [] })
        },
        /**
         * Re-fit the grid to the measured board; keeps region and dex. When
         * the board is busy the request is parked and applied later — a fit
         * may never be silently skipped (feedback P0-new).
         */
        fitBoard(width, height) {
          pendingFit = { width, height }
          applyFit()
        },
        throwBall() {
          publish(sfThrowBall(state))
          applyFit()
        },
        release() {
          publish(sfRelease(state))
          applyFit()
        },
        nextRegion() {
          stopWalk()
          clearRustle()
          if (invalidTimer !== null) {
            clearTimeout(invalidTimer)
            invalidTimer = null
          }
          pendingFit = null
          publish({
            ...state,
            region: state.region + 1,
            target: null,
            invalid: null,
            route: [],
            rustle: null,
            map: sfMapOf(state.region + 1, state.cols, state.rows),
            pos: sfSpawnOf(state.cols, state.rows),
            encounter: null,
            lastResult: '',
          })
        },
        toggleDex() {
          publish({ ...state, dexOpen: !state.dexOpen })
        },
        dispose() {
          stopWalk()
          clearRustle()
          if (invalidTimer !== null) clearTimeout(invalidTimer)
          listeners.clear()
        },
      }
    }

    let safariStoreImpl = null
    const safariStore = forwardStore(() => safariStoreImpl)

    // ---- painting ----------------------------------------------------------

    /** Deterministic per-cell jitter in [0,1) — organic but never flickering. */
    function sfJitter(i, salt) {
      let h = (i * 2654435761 + salt * 40503) % 2147483647
      if (h < 0) h += 2147483647
      return (h % 1000) / 1000
    }

    /** Region theme palettes (D48 M5): cycled by `region % 4`; every theme
     * keeps terrain-to-terrain base-colour contrast readable at a glance
     * (D48 M3). All colours are flat solids — no gradients. */
    const SF_THEMES = [
      {
        key: 'sf.theme.grass',
        plain: '#232f3f', plainAlt: '#1e2937', plainStar: '#3a4a61',
        grass: '#275432', grassAlt: '#214629', grassDark: '#193523',
        blade1: '#54a568', blade2: '#3d7f50',
        water: '#17537f', waterAlt: '#134869', waterEdge: '#3378ab', wave: '#6fbbe6',
        rock: '#202a3b', boulder: '#4c5a74', boulderLit: '#68799c',
        // Player colours per theme (D48b): white-on-dark default.
        player: '#e6f2ff', playerEdge: '#8ef7b0',
      },
      {
        key: 'sf.theme.snow',
        plain: '#dfe7ef', plainAlt: '#d4dee9', plainStar: '#f4f8fb',
        grass: '#9fc4a8', grassAlt: '#8fb89a', grassDark: '#75a081',
        blade1: '#5f8f6d', blade2: '#4d7a5b',
        water: '#4f8fc0', waterAlt: '#4483b4', waterEdge: '#79b2da', wave: '#cfe7f6',
        rock: '#8d9bb0', boulder: '#5d6d86', boulderLit: '#7e8fa9',
        // Deep blue body + red cap: a white player vanishes on snow (user report).
        player: '#31435c', playerEdge: '#d9534f',
      },
      {
        key: 'sf.theme.desert',
        plain: '#d8b57c', plainAlt: '#cda972', plainStar: '#e8cd9e',
        grass: '#a2b354', grassAlt: '#93a449', grassDark: '#79893b',
        blade1: '#c3d06e', blade2: '#a8b659',
        water: '#3f9fae', waterAlt: '#3691a0', waterEdge: '#63bcc8', wave: '#bfe9ee',
        rock: '#a5713f', boulder: '#7c4e2a', boulderLit: '#9c6435',
        // Dark brown body on sand; keep the green cap as the identity anchor.
        player: '#4a3319', playerEdge: '#8ef7b0',
      },
      {
        key: 'sf.theme.volcano',
        plain: '#3a2c2c', plainAlt: '#332425', plainStar: '#5c4038',
        grass: '#6e4a35', grassAlt: '#63412e', grassDark: '#4d3223',
        blade1: '#c96a3b', blade2: '#a1542e',
        water: '#8a3d20', waterAlt: '#7c351c', waterEdge: '#b4582f', wave: '#f0a35c',
        rock: '#241d20', boulder: '#55474c', boulderLit: '#6f5d63',
        player: '#e6f2ff', playerEdge: '#8ef7b0',
      },
    ]

    function sfThemeOf(region) {
      return SF_THEMES[(Math.max(1, region) - 1) % SF_THEMES.length]
    }

    /** Theme-independent marker colours (feedback/route/player). */
    const SF_MARK_COLORS = {
      mark: '#8ef7b0',
      bad: '#e5484d',
      warn: '#e2a93b',
      player: '#e6f2ff',
      playerEdge: '#8ef7b0',
      rockShadow: 'rgba(0,0,0,0.38)',
    }

    /**
     * Pixel map painter (D48 M1–M4): fixed 8×8 offscreen pixels per cell,
     * two-tone deterministic dithering per tile, neighbour-aware edges
     * (water shoreline / rock drop shadow / grass fringe) and a two-frame
     * water animation driven by `state.waveFrame` (0|1; absent = static,
     * which keeps pure test calls deterministic).
     * Pure over a given 2d context so tests can drive it directly.
     */
    function sfPaintPixels(ctx, state, u) {
      const T = sfThemeOf(state.region || 1)
      const C = SF_MARK_COLORS
      const frame = state.waveFrame === 1 ? 1 : 0
      const put = (ox, oy, fx, fy, fw, fh, color) => {
        ctx.fillStyle = color
        ctx.fillRect(Math.round(ox + fx * u), Math.round(oy + fy * u), Math.max(1, Math.round(fw * u)), Math.max(1, Math.round(fh * u)))
      }
      const at = (x, y) => (x < 0 || y < 0 || x >= state.cols || y >= state.rows ? -1 : state.map[y * state.cols + x])
      const isLand = (t) => t !== SF_TERRAIN.water
      for (let y = 0; y < state.rows; y += 1) {
        for (let x = 0; x < state.cols; x += 1) {
          const i = y * state.cols + x
          const ox = x * u
          const oy = y * u
          const j = (salt) => sfJitter(i, salt)
          const terrain = state.map[i]
          if (terrain === SF_TERRAIN.water) {
            ctx.fillStyle = j(9) < 0.5 ? T.water : T.waterAlt
            ctx.fillRect(ox, oy, u, u)
            // Shoreline (D48 M2): a lit edge on every side that touches land.
            if (isLand(at(x, y - 1)) && at(x, y - 1) !== -1) put(ox, oy, 0, 0, 1, 0.125, T.waterEdge)
            if (isLand(at(x, y + 1)) && at(x, y + 1) !== -1) put(ox, oy, 0, 0.875, 1, 0.125, T.waterEdge)
            if (isLand(at(x - 1, y)) && at(x - 1, y) !== -1) put(ox, oy, 0, 0, 0.125, 1, T.waterEdge)
            if (isLand(at(x + 1, y)) && at(x + 1, y) !== -1) put(ox, oy, 0.875, 0, 0.125, 1, T.waterEdge)
            // Two wave dashes, deterministically placed; the frame shifts
            // them by one tile-pixel and swaps which one is bright (M4).
            for (let wv = 0; wv < 2; wv += 1) {
              const bright = (wv + frame) % 2 === 0
              put(
                ox,
                oy,
                Math.min(0.5, 0.125 + j(wv + 1) * 0.375 + frame * 0.125),
                0.3 + wv * 0.375 + j(wv + 4) * 0.1,
                0.375,
                0.125,
                bright ? T.wave : T.waterEdge,
              )
            }
            // Rounded shore corners (D48c): where two perpendicular sides
            // both touch land, the corner pixel of the lit edge fills in.
            const nUp = at(x, y - 1) !== -1 && isLand(at(x, y - 1))
            const nDn = at(x, y + 1) !== -1 && isLand(at(x, y + 1))
            const nLf = at(x - 1, y) !== -1 && isLand(at(x - 1, y))
            const nRt = at(x + 1, y) !== -1 && isLand(at(x + 1, y))
            if (nUp && nLf) put(ox, oy, 0, 0, 0.125, 0.125, T.waterEdge)
            if (nUp && nRt) put(ox, oy, 0.875, 0, 0.125, 0.125, T.waterEdge)
            if (nDn && nLf) put(ox, oy, 0, 0.875, 0.125, 0.125, T.waterEdge)
            if (nDn && nRt) put(ox, oy, 0.875, 0.875, 0.125, 0.125, T.waterEdge)
          } else if (terrain === SF_TERRAIN.rock) {
            ctx.fillStyle = T.rock
            ctx.fillRect(ox, oy, u, u)
            // Chunky boulder with a lit top-left face (M3 tone steps).
            put(ox, oy, 0.25, 0.375, 0.5, 0.5, T.boulder)
            put(ox, oy, 0.375, 0.125, 0.25, 0.375, T.boulder)
            put(ox, oy, 0.375, 0.25, 0.25, 0.125, T.boulderLit)
            put(ox, oy, 0.25, 0.875, 0.5, 0.125, T.boulderLit)
            // Drop shadow onto the walkable cell below (M2).
            const below = at(x, y + 1)
            if (below !== SF_TERRAIN.rock && below !== SF_TERRAIN.water && below !== -1) {
              put(ox, oy, 0.125, 1, 0.75, 0.125, C.rockShadow)
            }
          } else if (terrain === SF_TERRAIN.grass) {
            ctx.fillStyle = j(9) < 0.5 ? T.grass : T.grassAlt
            ctx.fillRect(ox, oy, u, u)
            const rustling = state.rustle === i
            if (rustling) put(ox, oy, 0, 0, 1, 1, 'rgba(142,247,176,0.14)')
            const blades = 2 + Math.floor(j(3) * 2)
            for (let b = 0; b < blades; b += 1) {
              put(
                ox,
                oy,
                0.12 + (b / blades) * 0.7 + j(b + 11) * 0.1,
                0.25 + j(b + 17) * 0.3,
                0.125,
                0.4 + j(b + 23) * 0.2,
                b % 2 === 0 ? T.blade1 : T.blade2,
              )
            }
            put(ox, oy, 0, 0.8, 1, 0.2, T.grassDark)
            // D48c: rare little flowers — visual anchors in the green.
            if (j(61) < 0.08 && !rustling) {
              const bloom = ['#e5484d', '#e2a93b', '#f4f8fb'][j(62) % 3]
              const fxp = 0.2 + j(63) * 0.55
              const fyp = 0.2 + j(64) * 0.45
              put(ox, oy, fxp, fyp, 0.25, 0.125, bloom)
              put(ox, oy, fxp + 0.06, fyp - 0.06, 0.125, 0.25, bloom)
            }
            // Grass fringe (M2): blades spill one tile-pixel into plain sides.
            if (at(x - 1, y) === SF_TERRAIN.plain) put(ox, oy, -0.125, 0.3 + j(31) * 0.3, 0.125, 0.375, T.blade2)
            if (at(x + 1, y) === SF_TERRAIN.plain) put(ox, oy, 1, 0.3 + j(32) * 0.3, 0.125, 0.375, T.blade2)
            if (at(x, y + 1) === SF_TERRAIN.plain) put(ox, oy, 0.25 + j(33) * 0.4, 1, 0.375, 0.125, T.blade2)
            if (rustling) {
              // Warning: exclamation mark over the shaking cell.
              put(ox, oy, 0.45, -0.9, 0.14, 0.5, C.warn)
              put(ox, oy, 0.45, -0.3, 0.14, 0.14, C.warn)
            }
          } else {
            ctx.fillStyle = j(9) < 0.5 ? T.plain : T.plainAlt
            ctx.fillRect(ox, oy, u, u)
            if (j(41) < 0.3) put(ox, oy, 0.2 + j(43) * 0.6, 0.2 + j(47) * 0.6, 0.125, 0.125, T.plainStar)
            if (j(51) < 0.12) put(ox, oy, 0.3 + j(53) * 0.4, 0.5 + j(57) * 0.3, 0.25, 0.125, T.plainStar)
            // D48c: volcano theme — glowing ember specks on the ash plain.
            if (T.key === 'sf.theme.volcano' && j(71) < 0.1) {
              put(ox, oy, 0.25 + j(72) * 0.5, 0.25 + j(73) * 0.5, 0.125, 0.125, j(74) < 0.5 ? '#f0a35c' : '#c96a3b')
            }
          }
        }
      }
      // D48c: dithered transition bands — where two different terrains meet,
      // each side "bites" deterministic pixels into the other along the seam,
      // so lakes and meadows get organic edges instead of straight grid lines.
      const baseColorOf = (t) =>
        t === SF_TERRAIN.water ? T.water : t === SF_TERRAIN.grass ? T.grass : t === SF_TERRAIN.rock ? T.rock : T.plain
      for (let y = 0; y < state.rows; y += 1) {
        for (let x = 0; x < state.cols; x += 1) {
          const i = y * state.cols + x
          const ox = x * u
          const oy = y * u
          const here = state.map[i]
          const bite = (side, nT) => {
            const nBase = baseColorOf(nT)
            for (let k = 0; k < 4; k += 1) {
              if (sfJitter(i * 4 + k, side + 91) >= 0.45) continue
              const p = 0.125 + k * 0.25
              if (side === 0) put(ox, oy, p, 0, 0.125, 0.125, nBase)
              else if (side === 1) put(ox, oy, p, 0.875, 0.125, 0.125, nBase)
              else if (side === 2) put(ox, oy, 0, p, 0.125, 0.125, nBase)
              else put(ox, oy, 0.875, p, 0.125, 0.125, nBase)
            }
          }
          const up = at(x, y - 1)
          const dn = at(x, y + 1)
          const lf = at(x - 1, y)
          const rt = at(x + 1, y)
          if (up !== -1 && up !== here) bite(0, up)
          if (dn !== -1 && dn !== here) bite(1, dn)
          if (lf !== -1 && lf !== here) bite(2, lf)
          if (rt !== -1 && rt !== here) bite(3, rt)
        }
      }
      // Remaining walk path: one green pixel per cell.
      if (state.route.length > 0) {
        for (const at of state.route) {
          const rx = (at % state.cols) * u
          const ry = Math.floor(at / state.cols) * u
          put(rx, ry, 0.4, 0.4, 0.2, 0.2, C.mark)
        }
      }
      // Walk target: diamond marker.
      if (state.target !== null) {
        const tx = (state.target % state.cols) * u
        const ty = Math.floor(state.target / state.cols) * u
        const cxp = tx + u / 2
        const cyp = ty + u / 2
        const rr = Math.max(1, Math.round(u * 0.3))
        ctx.fillStyle = C.mark
        for (let d = -rr; d <= rr; d += 1) {
          const span = rr - Math.abs(d)
          ctx.fillRect(Math.round(cxp - span), Math.round(cyp + d), span * 2 + 1, 1)
        }
      }
      // Unreachable cross.
      if (state.invalid !== null) {
        const ix = (state.invalid % state.cols) * u
        const iy = Math.floor(state.invalid / state.cols) * u
        const cxp = ix + u / 2
        const cyp = iy + u / 2
        const rr = Math.max(1, Math.round(u * 0.3))
        ctx.fillStyle = C.bad
        for (let d = -rr; d <= rr; d += 1) {
          ctx.fillRect(Math.round(cxp + d), Math.round(cyp + d), 1, 1)
          ctx.fillRect(Math.round(cxp + d), Math.round(cyp - d), 1, 1)
        }
      }
      // The player: a tiny pixel person (head/body/legs), always readable.
      // D48b: theme-aware body/cap colours plus a dark halo + ground shadow —
      // the white default player vanished on the snow theme's pale plain.
      const pxp = (state.pos % state.cols) * u
      const pyp = Math.floor(state.pos / state.cols) * u
      const P = T.player || C.player
      const PE = T.playerEdge || C.playerEdge
      put(pxp, pyp, 0.18, 0.02, 0.64, 0.98, 'rgba(8,12,20,0.55)') // dark halo backdrop
      if (u >= 6) {
        put(pxp, pyp, 0.3, 0.08, 0.4, 0.3, P) // head
        put(pxp, pyp, 0.25, 0.4, 0.5, 0.3, P) // body
        put(pxp, pyp, 0.3, 0.72, 0.14, 0.28, P) // legs
        put(pxp, pyp, 0.56, 0.72, 0.14, 0.28, P)
        put(pxp, pyp, 0.3, 0.08, 0.4, 0.1, PE) // cap
        put(pxp, pyp, 0.25, 0.4, 0.5, 0.08, PE) // belt
      } else {
        put(pxp, pyp, 0.25, 0.15, 0.5, 0.7, P)
        put(pxp, pyp, 0.25, 0.15, 0.5, 0.15, PE)
      }
      put(pxp, pyp, 0.2, 1, 0.6, 0.06, 'rgba(0,0,0,0.4)') // ground shadow
    }

    /**
     * Full-view / pill painter. Sizes the canvas backing store to the CSS box
     * times DPR (the snake board convention — without this the default
     * 300×150 buffer stretches the whole map and crops the player out of the
     * visible area), then paints the pixel map offscreen and blits it up with
     * smoothing disabled so every offscreen pixel stays a crisp block.
     */
        /**
     * Games must never take the monitoring view down (D43 spirit): a paint
     * failure is logged and skipped — the board may go blank, the status
     * board stays alive.
     */
    function sfSafeDraw(fn) {
      try {
        fn()
      } catch (error) {
        console.error('[wait-buddy] safari paint failed', error)
      }
    }

    function drawSafariMap(canvas, state) {
      if (canvas === null || canvas === undefined) return
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (width === 0 || height === 0) return
      const ctx = canvas.getContext('2d')
      if (ctx === null) return
      const dpr =
        typeof window !== 'undefined' && window.devicePixelRatio > 0
          ? Math.min(window.devicePixelRatio, 2)
          : 1
      const backingW = Math.round(width * dpr)
      const backingH = Math.round(height * dpr)
      if (canvas.width !== backingW || canvas.height !== backingH) {
        canvas.width = backingW
        canvas.height = backingH
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.imageSmoothingEnabled = false
      // D48 M1: fixed 8×8 offscreen pixels per cell — every tile has enough
      // pixel budget for texture and edge detail at any board size; the
      // offscreen buffer is blitted up with smoothing disabled (crisp blocks).
      const u = 8
      const off =
        typeof document !== 'undefined' && typeof document.createElement === 'function'
          ? document.createElement('canvas')
          : null
      if (off !== null && typeof off.getContext === 'function') {
        off.width = state.cols * u
        off.height = state.rows * u
        const offCtx = off.getContext('2d')
        if (offCtx !== null && offCtx !== undefined) {
          sfPaintPixels(offCtx, state, u)
          ctx.fillStyle = '#141f2e'
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(off, 0, 0, width, height)
          return
        }
      }
      // Fallback (no DOM): paint pixels straight onto the target context.
      sfPaintPixels(ctx, state, u)
    }

    /**
     * Pixel-art species painter (D48 S1–S3): fills a size×size box with
     * u-pixel blocks. 54 species read from silhouette (round blob + ears /
     * squat block + tail / tall bean + crest) × palette colour × pattern
     * (belly / spots / stripes) — no ellipses, no "circle with eyes"
     * (feedback P0). Each species gets a 1px dark outline, three solid tone
     * steps (base/dark/light derived from the palette colour), bigger
     * pattern coverage, and a deterministic rarity flourish (very = star
     * sparkle, rare = light aura dots) since rarity is a pure function of
     * the species number.
     */
    /** Deterministic tone steps for a palette hex: solid colours, no rgba
     * overlays — pixel-art shading reads through shape, not translucency. */
    function sfMixHex(hex, target, k) {
      const n = hex.replace('#', '')
      const part = (s) => parseInt(n.slice(s, s + 2), 16)
      const mix = (v) => Math.round(v + (target - v) * k)
      const h2 = (v) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0')
      return `#${h2(mix(part(0)))}${h2(mix(part(2)))}${h2(mix(part(4)))}`
    }

    function sfTones(hex) {
      return {
        base: hex,
        dark: sfMixHex(hex, 10, 0.45),
        light: sfMixHex(hex, 250, 0.38),
        outline: sfMixHex(hex, 6, 0.72),
      }
    }

    /** Sprite pixel grid (D48e): 24×24 — enough pixel budget for dome
     * silhouettes, 3px eyes and tone bands, matching the approved AI
     * references that the old 16×16 rect pile could never reach. */
    const SF_SPRITE_GRID = 24

    // Per-body silhouette spans: [y, x0, x1] inclusive; multiple entries per
    // row allowed. Authored against the approved references (dome blob with
    // ears / squat block with tail / chibi big head with crest).
    const SF_BODY_SPANS = [
      [
        [0, 6, 8], [0, 15, 17], [1, 6, 8], [1, 15, 17], [2, 6, 17], [3, 5, 18],
        [4, 4, 19], [5, 3, 20], [6, 3, 20], [7, 3, 20], [8, 3, 20], [9, 3, 20],
        [10, 3, 20], [11, 3, 20], [12, 3, 20], [13, 4, 19], [14, 4, 19],
        [15, 5, 18], [16, 5, 18], [17, 6, 17], [18, 7, 16], [19, 8, 15],
      ],
      [
        [4, 19, 21], [5, 5, 18], [5, 20, 21], [6, 4, 22], [7, 3, 20], [8, 3, 20],
        [9, 3, 20], [10, 3, 20], [11, 3, 20], [12, 3, 20], [13, 3, 20], [14, 3, 20],
        [15, 3, 20], [16, 3, 20], [17, 4, 19], [18, 5, 18], [19, 6, 8], [19, 14, 16],
        [20, 6, 8], [20, 14, 16],
      ],
      [
        [0, 11, 12], [1, 10, 13], [2, 8, 15], [3, 7, 16], [4, 6, 17], [5, 5, 18],
        [6, 4, 19], [7, 4, 19], [8, 4, 19], [9, 4, 19], [10, 5, 18], [11, 5, 18],
        [12, 6, 17], [13, 7, 16], [14, 8, 15], [15, 8, 15], [16, 9, 14],
        [17, 9, 14], [18, 9, 10], [18, 13, 14], [19, 9, 10], [19, 13, 14],
        [20, 9, 10], [20, 13, 14],
      ],
    ]

    // Face/feature geometry per body: eye row + left/right eye x (3×3 eyes),
    // mouth pixels, blush pixels, tone bands, belly rect, accent pixels.
    const SF_BODY_FACE = [
      {
        eyeY: 9, eyeL: 6, eyeR: 15,
        mouth: [[11, 13], [12, 13]],
        blush: [[4, 13], [5, 13], [18, 13], [19, 13]],
        light: [3, 5], dark: [16, 18],
        belly: [9, 13, 14, 17],
        accents: [[7, 1], [16, 1]],
      },
      {
        eyeY: 11, eyeL: 6, eyeR: 14,
        mouth: [[10, 15], [11, 15]],
        blush: [[5, 14], [6, 14], [17, 14], [18, 14]],
        light: [6, 7], dark: [15, 17],
        belly: [9, 12, 14, 16],
        accents: [[21, 4]],
      },
      {
        eyeY: 6, eyeL: 6, eyeR: 15,
        mouth: [[11, 10], [12, 10]],
        blush: [[5, 10], [6, 10], [17, 10], [18, 10]],
        light: [3, 5], dark: [16, 17],
        belly: [10, 14, 13, 17],
        accents: [[11, 0]],
      },
    ]

    // Pattern pixel positions (2×2 spots) per body — kept off the face rows.
    const SF_BODY_SPOTS = [
      [[6, 7], [15, 6], [8, 14], [11, 12]],
      [[5, 9], [16, 9], [9, 14], [12, 10]],
      [[6, 4], [16, 4], [9, 14], [12, 11]],
    ]

    /**
     * Pixel-art species painter (D48e): authors a 24×24 character grid per
     * species — silhouette spans → 1px boundary outline → light/dark tone
     * bands → pattern (belly / spots / stripes) → 3px eyes with pupils and
     * catch-lights → blush / mouth / accent pixels → rarity flourish — then
     * paints one solid rect per pixel. Zero assets, deterministic.
     */
    function sfPaintSprite(ctx, species, u) {
      const body = Math.floor(species / (SF_PALETTES * SF_PATTERNS))
      const palette = Math.floor((species % (SF_PALETTES * SF_PATTERNS)) / SF_PATTERNS)
      const pattern = species % SF_PATTERNS
      const tone = sfTones(SF_PALETTE_COLORS[palette])
      const px = u / SF_SPRITE_GRID
      const put = (gx, gy, fill) => {
        ctx.fillStyle = fill
        ctx.fillRect(Math.round(gx * px), Math.round(gy * px), Math.max(1, Math.ceil(px)), Math.max(1, Math.ceil(px)))
      }
      const N = SF_SPRITE_GRID
      const g = Array.from({ length: N }, () => Array(N).fill('.'))
      for (const [y, x0, x1] of SF_BODY_SPANS[body]) {
        for (let x = x0; x <= x1 && x < N; x += 1) g[y][x] = 'B'
      }
      // Boundary outline: any interior pixel touching transparency.
      const at = (x, y) => (x >= 0 && x < N && y >= 0 && y < N ? g[y][x] : '.')
      const rim = []
      for (let y = 0; y < N; y += 1) {
        for (let x = 0; x < N; x += 1) {
          if (g[y][x] === 'B' && (at(x - 1, y) === '.' || at(x + 1, y) === '.' || at(x, y - 1) === '.' || at(x, y + 1) === '.')) rim.push([x, y])
        }
      }
      for (const [x, y] of rim) g[y][x] = 'O'
      const face = SF_BODY_FACE[body]
      // Tone bands: light on the upper rows, dark on the lower rows.
      for (let y = face.light[0]; y <= face.light[1]; y += 1) {
        for (let x = 0; x < N; x += 1) if (g[y][x] === 'B') g[y][x] = 'L'
      }
      for (let y = face.dark[0]; y <= face.dark[1]; y += 1) {
        for (let x = 0; x < N; x += 1) if (g[y][x] === 'B') g[y][x] = 'D'
      }
      // Pattern (S2): belly / spots / stripes, only into bare body pixels.
      if (pattern === 0) {
        for (let y = face.belly[1]; y <= face.belly[3]; y += 1) {
          for (let x = face.belly[0]; x <= face.belly[2]; x += 1) {
            if (x < N && g[y][x] === 'B') g[y][x] = 'F'
          }
        }
      } else if (pattern === 1) {
        for (const [sx, sy] of SF_BODY_SPOTS[body]) {
          for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
            const x = sx + dx
            const y = sy + dy
            if (x < N && y < N && g[y][x] === 'B') g[y][x] = 'D'
          }
        }
      } else {
        const cols = body === 0 ? [7, 12, 17] : body === 1 ? [7, 11, 15] : [8, 11, 14]
        const rows = body === 0 ? [12, 15] : body === 1 ? [13, 16] : [10, 13]
        for (const cx of cols) {
          for (let y = rows[0]; y <= rows[1]; y += 1) {
            if (cx < N && g[y][cx] === 'B') g[y][cx] = 'D'
          }
        }
      }
      // Eyes (S1): 3×3 whites, 2×2 pupils looking inward, catch-light pixel.
      const setEye = (ex, ey, lookRight) => {
        for (let dy = 0; dy < 3; dy += 1) {
          for (let dx = 0; dx < 3; dx += 1) g[ey + dy][ex + dx] = 'W'
        }
        const pxs = lookRight ? [ex + 1, ex + 2] : [ex, ex + 1]
        for (const cxp of pxs) {
          g[ey + 1][cxp] = 'P'
          g[ey + 2][cxp] = 'P'
        }
        g[ey][lookRight ? ex + 2 : ex] = 'H'
      }
      setEye(face.eyeL, face.eyeY, false)
      setEye(face.eyeR, face.eyeY, true)
      // Face details (D48c) and accent pixels.
      for (const [mx, my] of face.mouth) g[my][mx] = 'D'
      for (const [cx2, cy2] of face.blush) g[cy2][cx2] = 'R'
      for (const [ax, ay] of face.accents) g[ay][ax] = 'L'
      // Rarity flourish (D48 S3), deterministic from the species number.
      const rarity = sfRarityOf(species)
      if (rarity === 'very') {
        // Gold star sparkle, top-right (free space on every body).
        g[0][21] = 'G'
        g[1][20] = 'G'
        g[1][22] = 'G'
        g[2][21] = 'G'
        g[1][21] = 'S'
      } else if (rarity === 'rare') {
        // Light aura dots.
        g[2][2] = 'L'
        g[8][22] = 'L'
      }
      // Paint one solid rect per grid pixel.
      const colors = {
        O: tone.outline,
        B: tone.base,
        L: tone.light,
        D: tone.dark,
        F: sfMixHex(SF_PALETTE_COLORS[palette], 250, 0.6),
        W: '#ffffff',
        P: '#101014',
        H: '#e8f4ff',
        R: sfMixHex(SF_PALETTE_COLORS[palette], 255, 0.5),
        G: '#ffd23f',
        S: '#fff6c9',
      }
      for (let y = 0; y < N; y += 1) {
        for (let x = 0; x < N; x += 1) {
          const ch = g[y][x]
          if (ch !== '.') put(x, y, colors[ch])
        }
      }
    }

    function sfPointAt(canvas, state, clientX, clientY) {
      const rect = canvas.getBoundingClientRect()
      const cell = rect.width / state.cols
      const cellH = rect.height / state.rows
      const x = Math.floor((clientX - rect.left) / cell)
      const y = Math.floor((clientY - rect.top) / cellH)
      if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) return -1
      return y * state.cols + x
    }

    // ---- adapter components -------------------------------------------------

    /** Keycap chip: prominent keyboard hint, e.g. [F] 投球. */
    function SfKeyHint({ keys, label }) {
      return h(
        'span',
        { className: 'wb-keyHint' },
        h('span', { className: 'wb-kbd' }, keys),
        label,
      )
    }

    /** Encounter overlay: portrait + name + rarity + catch/release. */
    function sfEncounterOverlay(t, state, focusRoot, mini) {
      if (state.encounter === null) return null
      const { species, rarity } = state.encounter
      const portrait = mini
        ? null
        : h(SfSpriteIcon, { species, size: 72 })
      return h(
        'div',
        { className: mini ? 'wb-pillMiniOverlay' : 'wb-overlay' },
        portrait,
        mini
          ? h('span', { className: 'wb-pillMiniScore' }, sfSpeciesName(t, species))
          : h('div', { className: 'wb-overlayTitle' }, sfSpeciesName(t, species)),
        h(
          'span',
          { className: mini ? 'wb-pillMiniScore' : 'wb-overlayBody' },
          `${t(`sf.rarity.${rarity}`)} · ${t('sf.catchRate', { rate: Math.round(SF_CATCH_RATE[rarity] * 100) })}`,
        ),
        mini
          ? null
          : h(
              'div',
              { className: 'wb-keyHints' },
              h(SfKeyHint, { keys: 'F', label: t('sf.throw') }),
              h(SfKeyHint, { keys: 'Q / Esc', label: t('sf.release') }),
            ),
        h(
          'button',
          {
            type: 'button',
            className: mini ? 'wb-pillMiniBtn' : 'wb-btn wb-btnPrimary',
            onClick: () => {
              safariStore.throwBall()
              if (typeof focusRoot === 'function') focusRoot()
            },
          },
          t('sf.throw'),
        ),
        h(
          'button',
          {
            type: 'button',
            className: mini ? 'wb-pillMiniBtn' : 'wb-btn',
            onClick: () => safariStore.release(),
          },
          t('sf.release'),
        ),
      )
    }

    /** Pixel sprite icon: one small canvas per species. */
    function SfSpriteIcon({ species, size = 64 }) {
      const canvasRef = React.useRef(null)
      React.useEffect(() => {
        const canvas = canvasRef.current
        if (canvas === null) return
        const ctx = canvas.getContext('2d')
        if (ctx === null) return
        sfSafeDraw(() => {
          ctx.clearRect(0, 0, SF_SPRITE_GRID, SF_SPRITE_GRID)
          sfPaintSprite(ctx, species, SF_SPRITE_GRID)
        })
      }, [species])
      // 24×24 pixel buffer, integer-scaled by CSS (pixelated) — crisp blocks.
      return h('canvas', {
        ref: canvasRef,
        width: SF_SPRITE_GRID,
        height: SF_SPRITE_GRID,
        style: { width: `${size}px`, height: `${size}px`, imageRendering: 'pixelated' },
        role: 'img',
        'aria-label': 'sprite',
      })
    }

    /** Dex overlay: caught list + progress. */
    function sfDexOverlay(t, state) {
      if (!state.dexOpen) return null
      const entries = Object.entries(state.dex.caught)
        .filter(([, count]) => count > 0)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
      return h(
        'div',
        { className: 'wb-overlay' },
        h('div', { className: 'wb-overlayTitle' }, t('sf.dex', { caught: state.dexCaught, total: SF_SPECIES_TOTAL })),
        h(
          'div',
          { className: 'wb-dexGrid' },
          entries.length === 0
            ? t('sf.dexEmpty')
            : entries.map(([id, count]) =>
                h(
                  'div',
                  {
                    key: id,
                    className: 'wb-dexItem',
                    title: `#${String(Number(id) + 1).padStart(3, '0')} ${sfSpeciesName(t, Number(id))} ×${count}`,
                  },
                  h(SfSpriteIcon, { species: Number(id), size: 48 }),
                  h('span', { className: 'wb-dexCount' }, `×${count}`),
                ),
              ),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'wb-btn',
            onClick: () => safariStore.toggleDex(),
          },
          t('sf.dexClose'),
        ),
      )
    }

    /** Full-view board: the map, encounter + dex overlays on top. */
    function SafariBoard({ t, focusRoot, boardRef, canvasRef }) {
      const [state, setState] = React.useState(() => safariStore.getSnapshot())
      React.useEffect(() => {
        const sync = () => setState(safariStore.getSnapshot())
        sync()
        return safariStore.subscribe(sync)
      }, [])
      React.useEffect(() => {
        sfSafeDraw(() => drawSafariMap(canvasRef.current, state))
      }, [state])
      // D48 M4: two-frame water animation. Static under reduced motion (D43
      // spirit) and where matchMedia is unavailable.
      React.useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
        let frame = 0
        const timer = setInterval(() => {
          frame = 1 - frame
          sfSafeDraw(() => drawSafariMap(canvasRef.current, { ...safariStore.getSnapshot(), waveFrame: frame }))
        }, 640)
        return () => clearInterval(timer)
      }, [])
      // When an encounter window closes, its buttons unmount and focus falls
      // back to <body> — steering keys would die mid-play. Refocus the board.
      const prevEncounterRef = React.useRef(null)
      React.useEffect(() => {
        if (prevEncounterRef.current !== null && state.encounter === null && state.rustle === null) {
          const board = boardRef.current
          if (board !== null && typeof board.focus === 'function') board.focus({ preventScroll: true })
        }
        prevEncounterRef.current = state.encounter
      }, [state.encounter, state.rustle])
      React.useEffect(() => {
        const element = boardRef.current
        if (element === null) return undefined
        let retries = 0
        let retryHandle = null
        // Feedback P0-new: a first measure while the panel is still animating
        // (rect ≤ 60px) must retry, not silently give up — the board would
        // otherwise stay at the initial 24×12 forever.
        const measure = () => {
          sfSafeDraw(() => drawSafariMap(canvasRef.current, safariStore.getSnapshot()))
          try {
            const rect = element.getBoundingClientRect()
            if (rect.width > 60 && rect.height > 60) {
              safariStore.fitBoard(rect.width, rect.height)
              return
            }
          if (retries >= 10) return
          retries += 1
          retryHandle = setTimeout(measure, 50)
          } catch (error) {
            console.error('[wait-buddy] safari fit failed', error)
          }
        }
        measure()
        if (typeof ResizeObserver !== 'function') return undefined
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => {
          observer.disconnect()
          if (retryHandle !== null) clearTimeout(retryHandle)
        }
      }, [])
      return h(
        'div',
        { className: 'wb-boardWrap', tabIndex: 0, ref: boardRef },
        h('canvas', {
          ref: canvasRef,
          className: 'wb-board',
          role: 'img',
          'aria-label': t('sf.title'),
          onClick: (event) => {
            if (canvasRef.current === null) return
            const cell = sfPointAt(canvasRef.current, state, event.clientX, event.clientY)
            if (cell >= 0) safariStore.walkTo(cell)
          },
        }),
        sfDexOverlay(t, state),
        sfEncounterOverlay(t, state, focusRoot, false),
      )
    }

    /** Safari has no presets row (D47: 无设置项). */
    function SafariSetting() {
      return null
    }

    /** Full-view foot: dex progress, dex toggle, next region, hint. */
    function SafariControls({ t }) {
      const [state, setState] = React.useState(() => safariStore.getSnapshot())
      React.useEffect(() => {
        const sync = () => setState(safariStore.getSnapshot())
        sync()
        return safariStore.subscribe(sync)
      }, [])
      const flash =
        state.lastResult === ''
          ? null
          : h(
              'span',
              { className: 'wb-caption', 'data-result': state.lastResult },
              t(`sf.result.${state.lastResult}`),
            )
      return h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'wb-caption' },
          `${t('sf.dexCount', { caught: state.dexCaught, total: SF_SPECIES_TOTAL })} · ${t('sf.region', { n: state.region })} · ${t(sfThemeOf(state.region).key)}`,
        ),
        h(
          'div',
          { className: 'wb-gameActions' },
          flash,
          h(
            'button',
            {
              type: 'button',
              className: 'wb-btn',
              onClick: () => safariStore.toggleDex(),
            },
            t('sf.dexBtn'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'wb-btn',
              onClick: () => safariStore.nextRegion(),
            },
            t('sf.nextRegion'),
          ),
        ),
        h(
          'div',
          { className: 'wb-hint wb-keyHints' },
          h(SfKeyHint, { keys: 'WASD / ↑↓←→', label: t('sf.hint.move') }),
          h(SfKeyHint, { keys: 'F', label: t('sf.hint.throw') }),
          h(SfKeyHint, { keys: 'N', label: t('sf.hint.region') }),
          h('span', { className: 'wb-hintNote' }, t('sf.hint.grass')),
        ),
      )
    }

    /** Pill mini board: the same map at ~184px. */
    function FloatSafari({ t }) {
      const [state, setState] = React.useState(() => safariStore.getSnapshot())
      React.useEffect(() => {
        const sync = () => setState(safariStore.getSnapshot())
        sync()
        return safariStore.subscribe(sync)
      }, [])
      const canvasRef = React.useRef(null)
      React.useEffect(() => {
        sfSafeDraw(() => drawSafariMap(canvasRef.current, state))
      }, [state])
      // D48 M4: pill board gets the same two-frame water, same guards.
      React.useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
        let frame = 0
        const timer = setInterval(() => {
          frame = 1 - frame
          sfSafeDraw(() => drawSafariMap(canvasRef.current, { ...safariStore.getSnapshot(), waveFrame: frame }))
        }, 640)
        return () => clearInterval(timer)
      }, [])
      return h(
        'div',
        { className: 'wb-pillGomoku' },
        h('canvas', {
          ref: canvasRef,
          role: 'img',
          'aria-label': t('sf.title'),
          onClick: (event) => {
            if (canvasRef.current === null) return
            const cell = sfPointAt(canvasRef.current, state, event.clientX, event.clientY)
            if (cell >= 0) safariStore.walkTo(cell)
          },
        }),
        sfEncounterOverlay(t, state, undefined, true),
      )
    }

    /** Pill control row: dex toggle, next region, background. */
    function PillSafariCtl({ t, goBackground }) {
      const [state, setState] = React.useState(() => safariStore.getSnapshot())
      React.useEffect(() => {
        const sync = () => setState(safariStore.getSnapshot())
        sync()
        return safariStore.subscribe(sync)
      }, [])
      return h(
        'div',
        { className: 'wb-pillCtl' },
        h(
          'button',
          {
            type: 'button',
            className: 'wb-pillCtlBtn',
            onClick: () => safariStore.toggleDex(),
          },
          t('sf.dexCount', { caught: state.dexCaught, total: SF_SPECIES_TOTAL }),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'wb-pillCtlBtn',
            onClick: () => safariStore.nextRegion(),
          },
          t('sf.nextRegion'),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'wb-pillCtlBtn',
            'aria-label': t('pill.background'),
            onClick: goBackground,
          },
          t('pill.backgroundShort'),
        ),
      )
    }

    // D45 registry entry.
    GAMES.safari = {
      id: 'safari',
      titleKey: 'sf.title',
      store: () => safariStore,
      pauseOnLeave: false,
      keyboard: true,
      Board: SafariBoard,
      Setting: SafariSetting,
      Controls: SafariControls,
      Float: FloatSafari,
      FloatCtl: PillSafariCtl,
    }
    GAME_ORDER.push('safari')
