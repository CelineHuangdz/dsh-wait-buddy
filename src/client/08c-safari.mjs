
    // ---------------------------------------------------------------------
    // §8c Sprite Safari (D47): explore a grid map, encounter procedural
    // sprites in the grass, catch them with one click, fill a persistent
    // dex. Turn-based, click-only: pauseOnLeave false, keyboard false.
    // ---------------------------------------------------------------------

    // D47b: cells stay ~36px; the grid shape follows the board's aspect ratio
    // (a wide board is e.g. 25×12), so tiles never stretch into bars.
    const SF_CELL_TARGET = 36
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

    /** Deterministic terrain for one region at a given grid shape. */
    function sfMapOf(region, cols, rows) {
      let seed = (region * 2654435761 + cols * 31 + rows) % 2147483647
      if (seed <= 0) seed += 2147483646
      const next = () => {
        seed = (seed * 16807) % 2147483647
        return seed / 2147483647
      }
      const map = new Array(cols * rows).fill(SF_TERRAIN.plain)
      for (let i = 0; i < map.length; i += 1) {
        const roll = next()
        map[i] = roll < 0.42 ? SF_TERRAIN.grass : roll < 0.52 ? SF_TERRAIN.water : roll < 0.6 ? SF_TERRAIN.rock : SF_TERRAIN.plain
      }
      // The spawn cell and its cross neighbours are always walkable.
      const spawn = sfSpawnOf(cols, rows)
      for (const i of [spawn, spawn - 1, spawn + 1, spawn - cols, spawn + cols]) {
        map[i] = SF_TERRAIN.plain
      }
      return map
    }

    function sfSpawnOf(cols, rows) {
      return Math.floor(rows / 2) * cols + Math.floor(cols / 2)
    }

    /** Grid shape that keeps cells ~36px on a board of this size. */
    function sfFitDims(width, height) {
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
      return {
        cols: clamp(Math.round(width / SF_CELL_TARGET), 8, 44),
        rows: clamp(Math.round(height / SF_CELL_TARGET), 6, 30),
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
        lastResult: '', // 'caught' | 'fled' | 'released'
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

    function createSafariStore() {
      let state = createSafariState()
      let path = []
      let timer = null
      const listeners = new Set()
      const stopWalk = () => {
        if (timer !== null) {
          clearInterval(timer)
          timer = null
        }
        path = []
      }
      const publish = (next) => {
        if (next === state) return
        state = next
        if (state.encounter !== null) stopWalk()
        for (const listener of [...listeners]) listener()
      }
      const tick = () => {
        if (path.length === 0) {
          stopWalk()
          return
        }
        const next = path.shift()
        const stepped = sfStep(state, next)
        if (stepped !== state) publish(stepped)
      }
      return {
        getSnapshot: () => state,
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        /** Click-to-walk: BFS to the target, one step per tick; encounters stop. */
        walkTo(cell) {
          if (state.encounter !== null) return
          const route = sfPath(state, cell)
          if (route === null || route.length === 0) return
          path = route
          if (timer === null) {
            timer = setInterval(tick, 140)
            tick()
          }
        },
        /** Re-fit the grid to the measured board; keeps region and dex. */
        fitBoard(width, height) {
          if (state.encounter !== null || path.length > 0) return
          const { cols, rows } = sfFitDims(width, height)
          if (cols === state.cols && rows === state.rows) return
          stopWalk()
          publish({
            ...state,
            cols,
            rows,
            map: sfMapOf(state.region, cols, rows),
            pos: sfSpawnOf(cols, rows),
            lastResult: '',
          })
        },
        throwBall() {
          publish(sfThrowBall(state))
        },
        release() {
          publish(sfRelease(state))
        },
        nextRegion() {
          stopWalk()
          publish({
            ...state,
            region: state.region + 1,
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

    function drawSafariMap(canvas, state) {
      if (canvas === null || canvas === undefined) return
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (width === 0 || height === 0) return
      const ctx = canvas.getContext('2d')
      if (ctx === null) return
      // D47b: the map fills the whole board box like the snake board — cells
      // stretch with the container instead of locking to a centered square.
      const cell = width / state.cols
      const cellH = height / state.rows
      const unit = Math.min(cell, cellH)
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#141f2e'
      ctx.fillRect(0, 0, width, height)
      for (let y = 0; y < state.rows; y += 1) {
        for (let x = 0; x < state.cols; x += 1) {
          const i = y * state.cols + x
          const px = x * cell
          const py = y * cellH
          const terrain = state.map[i]
          if (terrain === SF_TERRAIN.water) {
            const g = ctx.createLinearGradient(px, py, px, py + cellH)
            g.addColorStop(0, '#1b3a58')
            g.addColorStop(1, '#12283d')
            ctx.fillStyle = g
            ctx.fillRect(px + 0.5, py + 0.5, cell - 1, cellH - 1)
            ctx.strokeStyle = 'rgba(120,180,220,0.35)'
            ctx.lineWidth = Math.max(1, unit * 0.04)
            ctx.beginPath()
            for (let w = 0; w < 2; w += 1) {
              const wy = py + cellH * (0.35 + w * 0.35) + sfJitter(i, w + 1) * cellH * 0.1
              const wx = px + cell * (0.15 + sfJitter(i, w + 7) * 0.3)
              ctx.moveTo(wx, wy)
              ctx.quadraticCurveTo(wx + cell * 0.15, wy - cellH * 0.06, wx + cell * 0.3, wy)
            }
            ctx.stroke()
            ctx.lineWidth = 1
          } else if (terrain === SF_TERRAIN.rock) {
            ctx.fillStyle = '#1d2836'
            ctx.fillRect(px + 0.5, py + 0.5, cell - 1, cellH - 1)
            const cx = px + cell / 2
            const cy = py + cellH / 2
            const r = unit * 0.3
            ctx.fillStyle = '#46536b'
            ctx.beginPath()
            ctx.ellipse(cx, cy + r * 0.12, r * 1.15, r * 0.92, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = '#5b6a86'
            ctx.beginPath()
            ctx.ellipse(cx - r * 0.25, cy - r * 0.28, r * 0.62, r * 0.5, -0.4, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = 'rgba(0,0,0,0.3)'
            ctx.beginPath()
            ctx.ellipse(cx, cy + r * 0.12, r * 1.15, r * 0.92, 0, 0, Math.PI * 2)
            ctx.stroke()
          } else if (terrain === SF_TERRAIN.grass) {
            const g = ctx.createLinearGradient(px, py, px, py + cellH)
            g.addColorStop(0, '#24462f')
            g.addColorStop(1, '#1c3826')
            ctx.fillStyle = g
            ctx.fillRect(px + 0.5, py + 0.5, cell - 1, cellH - 1)
            const blades = 4 + Math.floor(sfJitter(i, 3) * 2)
            for (let b = 0; b < blades; b += 1) {
              const bx = px + cell * (0.14 + (b / blades) * 0.68 + sfJitter(i, b + 11) * 0.1)
              const by = py + cellH * (0.78 - sfJitter(i, b + 17) * 0.12)
              const tip = by - cellH * (0.22 + sfJitter(i, b + 23) * 0.16)
              const lean = (sfJitter(i, b + 29) - 0.5) * cell * 0.16
              ctx.strokeStyle = b % 2 === 0 ? 'rgba(88,166,110,0.85)' : 'rgba(64,128,84,0.9)'
              ctx.lineWidth = Math.max(1, unit * 0.045)
              ctx.beginPath()
              ctx.moveTo(bx, by)
              ctx.quadraticCurveTo(bx + lean * 0.4, (by + tip) / 2, bx + lean, tip)
              ctx.stroke()
            }
            ctx.lineWidth = 1
          } else {
            ctx.fillStyle = '#1b2634'
            ctx.fillRect(px + 0.5, py + 0.5, cell - 1, cellH - 1)
            if (sfJitter(i, 41) < 0.4) {
              ctx.fillStyle = 'rgba(255,255,255,0.05)'
              ctx.beginPath()
              ctx.arc(
                px + cell * (0.25 + sfJitter(i, 43) * 0.5),
                py + cellH * (0.25 + sfJitter(i, 47) * 0.5),
                unit * 0.05,
                0,
                Math.PI * 2,
              )
              ctx.fill()
            }
          }
          // Walkable-adjacent affordance: soft corner ticks.
          if (sfAdjacent(state.pos, i) && sfWalkable(terrain)) {
            ctx.strokeStyle = 'rgba(142,247,176,0.7)'
            ctx.lineWidth = Math.max(1.5, unit * 0.06)
            const inset = unit * 0.14
            const len = unit * 0.28
            ctx.beginPath()
            ctx.moveTo(px + inset, py + inset + len)
            ctx.lineTo(px + inset, py + inset)
            ctx.lineTo(px + inset + len, py + inset)
            ctx.moveTo(px + cell - inset - len, py + inset)
            ctx.lineTo(px + cell - inset, py + inset)
            ctx.lineTo(px + cell - inset, py + inset + len)
            ctx.moveTo(px + cell - inset, py + cellH - inset - len)
            ctx.lineTo(px + cell - inset, py + cellH - inset)
            ctx.lineTo(px + cell - inset - len, py + cellH - inset)
            ctx.moveTo(px + inset + len, py + cellH - inset)
            ctx.lineTo(px + inset, py + cellH - inset)
            ctx.lineTo(px + inset, py + cellH - inset - len)
            ctx.stroke()
            ctx.lineWidth = 1
          }
        }
      }
      // Hairline grid for readability.
      ctx.strokeStyle = 'rgba(255,255,255,0.045)'
      ctx.beginPath()
      for (let g = 1; g < state.cols; g += 1) {
        ctx.moveTo(g * cell, 0)
        ctx.lineTo(g * cell, height)
      }
      for (let g = 1; g < state.rows; g += 1) {
        ctx.moveTo(0, g * cellH)
        ctx.lineTo(width, g * cellH)
      }
      ctx.stroke()
      // The player: shadow, rounded body, eyes.
      const px = (state.pos % state.cols) * cell
      const py = Math.floor(state.pos / state.cols) * cellH
      const cx = px + cell / 2
      const cy = py + cellH / 2
      const r = unit * 0.28
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath()
      ctx.ellipse(cx, cy + r * 0.85, r * 0.9, r * 0.32, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#e6f2ff'
      ctx.strokeStyle = '#8ef7b0'
      ctx.lineWidth = Math.max(1.5, unit * 0.05)
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.lineWidth = 1
      ctx.fillStyle = '#0a0a0a'
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(cx + side * r * 0.35, cy - r * 0.12, r * 0.14, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    /** Procedural sprite portrait — body shape × palette × pattern. */
    function drawSfSprite(ctx, cx, cy, size, species) {
      const body = Math.floor(species / (SF_PALETTES * SF_PATTERNS))
      const palette = Math.floor((species % (SF_PALETTES * SF_PATTERNS)) / SF_PATTERNS)
      const pattern = species % SF_PATTERNS
      const color = SF_PALETTE_COLORS[palette]
      ctx.save()
      ctx.fillStyle = color
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath()
      const rx = body === 1 ? size * 0.42 : size * 0.34
      const ry = body === 2 ? size * 0.44 : size * 0.32
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      if (pattern === 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'
        for (const [dx, dy, r] of [
          [-0.14, -0.1, 0.08],
          [0.16, 0.02, 0.07],
          [-0.02, 0.18, 0.06],
        ]) {
          ctx.beginPath()
          ctx.arc(cx + size * dx, cy + size * dy, size * r, 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (pattern === 2) {
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'
        ctx.lineWidth = Math.max(1.5, size * 0.05)
        for (const off of [-0.12, 0.1]) {
          ctx.beginPath()
          ctx.ellipse(cx + size * off, cy, rx * 0.55, ry * 0.9, 0, -Math.PI / 2, Math.PI / 2)
          ctx.stroke()
        }
        ctx.lineWidth = 1
      }
      // Eyes.
      ctx.fillStyle = '#ffffff'
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(cx + side * size * 0.13, cy - size * 0.1, size * 0.09, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#0a0a0a'
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(cx + side * size * 0.13, cy - size * 0.1, size * 0.045, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
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

    /** Encounter overlay: portrait + name + rarity + catch/release. */
    function sfEncounterOverlay(t, state, focusRoot, mini) {
      if (state.encounter === null) return null
      const { species, rarity } = state.encounter
      const portrait = mini
        ? null
        : h(SfPortrait, { species })
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
          t(`sf.rarity.${rarity}`),
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

    /** Small canvas portrait of the encountered sprite. */
    function SfPortrait({ species }) {
      const canvasRef = React.useRef(null)
      React.useEffect(() => {
        const canvas = canvasRef.current
        if (canvas === null) return
        drawSfSprite(canvas.getContext('2d'), 32, 32, 56, species)
      }, [species])
      return h('canvas', {
        ref: canvasRef,
        width: 64,
        height: 64,
        style: { width: '64px', height: '64px' },
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
          { className: 'wb-overlayBody', style: { maxWidth: '280px', maxHeight: '46vh', overflow: 'auto', whiteSpace: 'normal' } },
          entries.length === 0
            ? t('sf.dexEmpty')
            : entries.map(([id, count]) =>
                h(
                  'div',
                  { key: id },
                  `#${String(Number(id) + 1).padStart(3, '0')} ${sfSpeciesName(t, Number(id))} ×${count}`,
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
        drawSafariMap(canvasRef.current, state)
      }, [state])
      React.useEffect(() => {
        const element = boardRef.current
        if (element === null) return undefined
        const measure = () => {
          drawSafariMap(canvasRef.current, safariStore.getSnapshot())
          const rect = element.getBoundingClientRect()
          if (rect.width > 60 && rect.height > 60) safariStore.fitBoard(rect.width, rect.height)
        }
        measure()
        if (typeof ResizeObserver !== 'function') return undefined
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
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
          `${t('sf.dexCount', { caught: state.dexCaught, total: SF_SPECIES_TOTAL })} · ${t('sf.region', { n: state.region })}`,
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
        h('div', { className: 'wb-hint' }, t('sf.hint')),
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
        drawSafariMap(canvasRef.current, state)
      }, [state])
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
      keyboard: false,
      Board: SafariBoard,
      Setting: SafariSetting,
      Controls: SafariControls,
      Float: FloatSafari,
      FloatCtl: PillSafariCtl,
    }
    GAME_ORDER.push('safari')
