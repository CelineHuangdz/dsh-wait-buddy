
    // ---------------------------------------------------------------------
    // §8c Sprite Safari (D47): explore a grid map, encounter procedural
    // sprites in the grass, catch them with one click, fill a persistent
    // dex. Turn-based, click-only: pauseOnLeave false, keyboard false.
    // ---------------------------------------------------------------------

    const SAFARI_SIZE = 12
    const SAFARI_GRASS_CHANCE = 0.35
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

    /** Deterministic 12×12 terrain for one region number. */
    function sfMapOf(region) {
      let seed = (region * 2654435761) % 2147483647
      if (seed <= 0) seed += 2147483646
      const next = () => {
        seed = (seed * 16807) % 2147483647
        return seed / 2147483647
      }
      const map = new Array(SAFARI_SIZE * SAFARI_SIZE).fill(SF_TERRAIN.plain)
      for (let i = 0; i < map.length; i += 1) {
        const roll = next()
        map[i] = roll < 0.42 ? SF_TERRAIN.grass : roll < 0.52 ? SF_TERRAIN.water : roll < 0.6 ? SF_TERRAIN.rock : SF_TERRAIN.plain
      }
      // The spawn cell and its cross neighbours are always walkable.
      const mid = Math.floor(SAFARI_SIZE / 2)
      const spawn = mid * SAFARI_SIZE + mid
      for (const i of [spawn, spawn - 1, spawn + 1, spawn - SAFARI_SIZE, spawn + SAFARI_SIZE]) {
        map[i] = SF_TERRAIN.plain
      }
      return map
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
      const mid = Math.floor(SAFARI_SIZE / 2)
      return {
        region: 1,
        map: sfMapOf(1),
        pos: mid * SAFARI_SIZE + mid,
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

    function sfAdjacent(a, b) {
      const ax = a % SAFARI_SIZE
      const ay = Math.floor(a / SAFARI_SIZE)
      const bx = b % SAFARI_SIZE
      const by = Math.floor(b / SAFARI_SIZE)
      return Math.abs(ax - bx) + Math.abs(ay - by) === 1
    }

    /** Try to step to a cell; grass may trigger an encounter. */
    function sfStep(prev, cell, random = Math.random) {
      if (prev.encounter !== null) return prev
      if (!sfAdjacent(prev.pos, cell)) return prev
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
      const listeners = new Set()
      const publish = (next) => {
        if (next === state) return
        state = next
        for (const listener of [...listeners]) listener()
      }
      return {
        getSnapshot: () => state,
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        step(cell) {
          publish(sfStep(state, cell))
        },
        throwBall() {
          publish(sfThrowBall(state))
        },
        release() {
          publish(sfRelease(state))
        },
        nextRegion() {
          const region = state.region + 1
          const mid = Math.floor(SAFARI_SIZE / 2)
          publish({ ...state, region, map: sfMapOf(region), pos: mid * SAFARI_SIZE + mid, encounter: null, lastResult: '' })
        },
        toggleDex() {
          publish({ ...state, dexOpen: !state.dexOpen })
        },
      }
    }

    let safariStoreImpl = null
    const safariStore = forwardStore(() => safariStoreImpl)

    // ---- painting ----------------------------------------------------------

    function drawSafariMap(canvas, state) {
      if (canvas === null || canvas === undefined) return
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (width === 0 || height === 0) return
      const ctx = canvas.getContext('2d')
      if (ctx === null) return
      const cell = Math.floor(Math.min(width, height) / SAFARI_SIZE)
      const ox = Math.floor((width - cell * SAFARI_SIZE) / 2)
      const oy = Math.floor((height - cell * SAFARI_SIZE) / 2)
      ctx.clearRect(0, 0, width, height)
      for (let y = 0; y < SAFARI_SIZE; y += 1) {
        for (let x = 0; x < SAFARI_SIZE; x += 1) {
          const i = y * SAFARI_SIZE + x
          const px = ox + x * cell
          const py = oy + y * cell
          const terrain = state.map[i]
          ctx.fillStyle =
            terrain === SF_TERRAIN.grass
              ? '#1f3d2b'
              : terrain === SF_TERRAIN.water
                ? '#16324a'
                : terrain === SF_TERRAIN.rock
                  ? '#2a3546'
                  : '#1b2839'
          ctx.fillRect(px, py, cell, cell)
          if (terrain === SF_TERRAIN.grass) {
            ctx.strokeStyle = '#2f5d42'
            ctx.beginPath()
            for (let b = 1; b <= 3; b += 1) {
              const bx = px + (cell * b) / 4
              ctx.moveTo(bx, py + cell * 0.7)
              ctx.lineTo(bx + cell * 0.08, py + cell * 0.35)
            }
            ctx.stroke()
          } else if (terrain === SF_TERRAIN.rock) {
            ctx.fillStyle = '#3b4860'
            ctx.beginPath()
            ctx.arc(px + cell / 2, py + cell / 2, cell * 0.24, 0, Math.PI * 2)
            ctx.fill()
          }
          // Walkable-adjacent highlight (where the player may step).
          if (sfAdjacent(state.pos, i) && sfWalkable(terrain)) {
            ctx.strokeStyle = 'rgba(142,247,176,0.55)'
            ctx.strokeRect(px + 1.5, py + 1.5, cell - 3, cell - 3)
          }
        }
      }
      // The player.
      const px = ox + (state.pos % SAFARI_SIZE) * cell
      const py = oy + Math.floor(state.pos / SAFARI_SIZE) * cell
      ctx.fillStyle = '#e6f2ff'
      ctx.beginPath()
      ctx.arc(px + cell / 2, py + cell / 2, cell * 0.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#8ef7b0'
      ctx.stroke()
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

    function sfPointAt(canvas, clientX, clientY) {
      const rect = canvas.getBoundingClientRect()
      const cell = Math.min(rect.width, rect.height) / SAFARI_SIZE
      const ox = (rect.width - cell * SAFARI_SIZE) / 2
      const oy = (rect.height - cell * SAFARI_SIZE) / 2
      const x = Math.floor((clientX - rect.left - ox) / cell)
      const y = Math.floor((clientY - rect.top - oy) / cell)
      if (x < 0 || y < 0 || x >= SAFARI_SIZE || y >= SAFARI_SIZE) return -1
      return y * SAFARI_SIZE + x
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
        const measure = () => drawSafariMap(canvasRef.current, safariStore.getSnapshot())
        measure()
        if (typeof ResizeObserver !== 'function') return undefined
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
      }, [])
      return h(
        'div',
        { className: 'wb-boardWrap wb-squareBoard', tabIndex: 0, ref: boardRef },
        h('canvas', {
          ref: canvasRef,
          className: 'wb-board',
          role: 'img',
          'aria-label': t('sf.title'),
          onClick: (event) => {
            if (canvasRef.current === null) return
            const cell = sfPointAt(canvasRef.current, event.clientX, event.clientY)
            if (cell >= 0) safariStore.step(cell)
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
            const cell = sfPointAt(canvasRef.current, event.clientX, event.clientY)
            if (cell >= 0) safariStore.step(cell)
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
