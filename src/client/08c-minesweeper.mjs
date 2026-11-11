
    // ---------------------------------------------------------------------
    // §8c Minesweeper (D46): the third game, and the proof that a new game
    // is one adapter entry. Pure logic first (unit-tested via __game), then
    // the store, canvas drawing, and the adapter components.
    // ---------------------------------------------------------------------

    /** Neighbour indices of one cell (8-neighbourhood, board edges honored). */
    function msNeighbors(state, index) {
      const x = index % state.cols
      const y = Math.floor(index / state.cols)
      const out = []
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= state.cols || ny >= state.rows) continue
          out.push(ny * state.cols + nx)
        }
      }
      return out
    }

    /** Fresh board; mines are placed lazily after the first reveal. */
    function createMinesState(levelId) {
      const level = MS_LEVEL_PRESETS[levelId] === undefined ? 'easy' : levelId
      const preset = MS_LEVEL_PRESETS[level]
      const total = preset.cols * preset.rows
      return {
        level,
        cols: preset.cols,
        rows: preset.rows,
        mines: preset.mines,
        mineAt: new Array(total).fill(false),
        revealed: new Array(total).fill(false),
        flagged: new Array(total).fill(false),
        counts: new Array(total).fill(0),
        minesPlaced: false,
        revealedCount: 0,
        flagMode: false,
        status: 'playing',
      }
    }

    /** Place mines excluding the first-click cell and its neighbourhood. */
    function msPlaceMines(state, safeIndex, random) {
      const total = state.cols * state.rows
      const forbidden = new Set([safeIndex, ...msNeighbors(state, safeIndex)])
      const candidates = []
      for (let i = 0; i < total; i += 1) {
        if (!forbidden.has(i)) candidates.push(i)
      }
      // Partial Fisher–Yates on the candidate pool.
      const pool = candidates.slice()
      const need = Math.min(state.mines, pool.length)
      for (let i = 0; i < need; i += 1) {
        const j = i + Math.floor(random() * (pool.length - i))
        const swap = pool[i]
        pool[i] = pool[j]
        pool[j] = swap
      }
      const mineAt = state.mineAt.slice()
      const counts = state.counts.slice()
      for (let i = 0; i < need; i += 1) mineAt[pool[i]] = true
      for (let i = 0; i < total; i += 1) {
        if (!mineAt[i]) continue
        for (const n of msNeighbors(state, i)) counts[n] += 1
      }
      return { mineAt, counts, minesPlaced: true }
    }

    /**
     * Reveal one cell. First click is always safe (mines are placed around
     * it); zero-count cells flood-fill; hitting a mine loses and unmasks the
     * field; revealing every safe cell wins and flags the remaining mines.
     */
    function msRevealAt(prev, index, random = Math.random) {
      if (prev.status !== 'playing') return prev
      if (index < 0 || index >= prev.revealed.length) return prev
      if (prev.revealed[index] || prev.flagged[index]) return prev
      let state = prev
      if (!state.minesPlaced) {
        state = { ...state, ...msPlaceMines(state, index, random) }
      }
      if (state.mineAt[index]) {
        const revealed = state.revealed.slice()
        for (let i = 0; i < revealed.length; i += 1) {
          if (state.mineAt[i]) revealed[i] = true
        }
        return { ...state, revealed, revealedCount: state.revealedCount + 1, status: 'lost' }
      }
      const revealed = state.revealed.slice()
      const flagged = state.flagged.slice()
      let opened = 0
      const stack = [index]
      while (stack.length > 0) {
        const at = stack.pop()
        if (revealed[at] || flagged[at]) continue
        revealed[at] = true
        opened += 1
        if (state.counts[at] === 0) {
          for (const n of msNeighbors(state, at)) {
            if (!revealed[n] && !state.mineAt[n]) stack.push(n)
          }
        }
      }
      const revealedCount = state.revealedCount + opened
      if (revealedCount === revealed.length - state.mines) {
        for (let i = 0; i < flagged.length; i += 1) {
          if (state.mineAt[i]) flagged[i] = true
        }
        return { ...state, revealed, flagged, revealedCount, status: 'won' }
      }
      return { ...state, revealed, revealedCount }
    }

    /** Toggle a flag on an unrevealed cell (never reveals). */
    function msToggleFlag(prev, index) {
      if (prev.status !== 'playing') return prev
      if (index < 0 || index >= prev.revealed.length) return prev
      if (prev.revealed[index]) return prev
      const flagged = prev.flagged.slice()
      flagged[index] = !flagged[index]
      return { ...prev, flagged }
    }

    /** Flags still standing minus those placed = mines still to find. */
    function msMinesLeft(state) {
      let placed = 0
      for (let i = 0; i < state.flagged.length; i += 1) {
        if (state.flagged[i]) placed += 1
      }
      return state.mines - placed
    }

    function createMinesweeperStore() {
      let state = createMinesState()
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
        place(index) {
          publish(msRevealAt(state, index))
        },
        toggleFlag(index) {
          publish(msToggleFlag(state, index))
        },
        toggleFlagMode() {
          publish({ ...state, flagMode: !state.flagMode })
        },
        reset(levelId) {
          publish(createMinesState(levelId))
        },
      }
    }

    let minesweeperStoreImpl = null
    const minesweeperStore = forwardStore(() => minesweeperStoreImpl)

    /** Cell fill for one number value (classic palette). */
    const MS_NUMBER_COLOR = ['#0000ff', '#008000', '#ff0000', '#000080', '#800000', '#008080', '#000000', '#808080']

    /** Imperative board painting; shared by the full view and the pill mini. */
    function drawMinesweeper(canvas, state) {
      if (canvas === null || canvas === undefined) return
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (width === 0 || height === 0) return
      const ctx = canvas.getContext('2d')
      if (ctx === null) return
      const cell = Math.floor(Math.min(width / state.cols, height / state.rows))
      const ox = Math.floor((width - cell * state.cols) / 2)
      const oy = Math.floor((height - cell * state.rows) / 2)
      ctx.clearRect(0, 0, width, height)
      for (let y = 0; y < state.rows; y += 1) {
        for (let x = 0; x < state.cols; x += 1) {
          const i = y * state.cols + x
          const px = ox + x * cell
          const py = oy + y * cell
          if (state.revealed[i]) {
            const boom = state.mineAt[i] && state.status === 'lost'
            ctx.fillStyle = boom ? '#5c1f24' : '#16202f'
            ctx.fillRect(px, py, cell, cell)
            if (state.mineAt[i]) {
              ctx.fillStyle = '#0a0a0a'
              ctx.beginPath()
              ctx.arc(px + cell / 2, py + cell / 2, cell * 0.26, 0, Math.PI * 2)
              ctx.fill()
            } else if (state.counts[i] > 0) {
              ctx.fillStyle = MS_NUMBER_COLOR[(state.counts[i] - 1) % MS_NUMBER_COLOR.length]
              ctx.font = `600 ${Math.floor(cell * 0.55)}px ui-sans-serif, system-ui, sans-serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText(String(state.counts[i]), px + cell / 2, py + cell / 2 + 1)
            }
          } else {
            // Covered cell: raised tile with a hairline edge.
            ctx.fillStyle = state.flagMode ? '#26354d' : '#22304a'
            ctx.fillRect(px, py, cell, cell)
            ctx.strokeStyle = 'rgba(255,255,255,0.08)'
            ctx.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1)
            if (state.flagged[i]) {
              ctx.fillStyle = '#e5484d'
              ctx.beginPath()
              ctx.moveTo(px + cell * 0.62, py + cell * 0.25)
              ctx.lineTo(px + cell * 0.3, py + cell * 0.45)
              ctx.lineTo(px + cell * 0.62, py + cell * 0.65)
              ctx.closePath()
              ctx.fill()
            }
          }
        }
      }
    }

    /** Map one click to a cell index (or -1 outside the field). */
    function msPointAt(canvas, state, clientX, clientY) {
      const rect = canvas.getBoundingClientRect()
      const cell = Math.min(rect.width / state.cols, rect.height / state.rows)
      const ox = (rect.width - cell * state.cols) / 2
      const oy = (rect.height - cell * state.rows) / 2
      const x = Math.floor((clientX - rect.left - ox) / cell)
      const y = Math.floor((clientY - rect.top - oy) / cell)
      if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) return -1
      return y * state.cols + x
    }

    /** Terminal overlay (won / lost). */
    function msOverlay(t, state, focusRoot) {
      if (state.status === 'playing') return null
      return h(
        'div',
        { className: 'wb-overlay' },
        h('div', { className: 'wb-overlayTitle' }, state.status === 'won' ? t('ms.won') : t('ms.lost')),
        h(
          'button',
          {
            type: 'button',
            className: 'wb-btn wb-btnPrimary',
            onClick: () => {
              minesweeperStore.reset(settingsStore.getSnapshot().msLevel)
              if (typeof focusRoot === 'function') focusRoot()
            },
          },
          t('ms.again'),
        ),
      )
    }

    /** Full-view board: square canvas, click reveals, contextmenu flags. */
    function MSBoard({ t, focusRoot, boardRef, canvasRef }) {
      const [ms, setMs] = React.useState(() => minesweeperStore.getSnapshot())
      React.useEffect(() => {
        const sync = () => setMs(minesweeperStore.getSnapshot())
        sync()
        return minesweeperStore.subscribe(sync)
      }, [])
      React.useEffect(() => {
        drawMinesweeper(canvasRef.current, ms)
      }, [ms])
      React.useEffect(() => {
        const element = boardRef.current
        if (element === null) return undefined
        const measure = () => drawMinesweeper(canvasRef.current, minesweeperStore.getSnapshot())
        measure()
        if (typeof ResizeObserver !== 'function') return undefined
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
      }, [])
      const play = (event, forceFlag) => {
        if (ms.status !== 'playing' || canvasRef.current === null) return
        const index = msPointAt(canvasRef.current, ms, event.clientX, event.clientY)
        if (index < 0) return
        if (forceFlag || ms.flagMode) minesweeperStore.toggleFlag(index)
        else minesweeperStore.place(index)
      }
      return h(
        'div',
        { className: 'wb-boardWrap wb-squareBoard', tabIndex: 0, ref: boardRef },
        h('canvas', {
          ref: canvasRef,
          className: 'wb-board',
          role: 'img',
          'aria-label': t('ms.canvasLabel', { left: msMinesLeft(ms) }),
          onClick: (event) => play(event, false),
          onContextMenu: (event) => {
            event.preventDefault()
            play(event, true)
          },
        }),
        msOverlay(t, ms, focusRoot),
      )
    }

    /** Full-view settings row: difficulty presets. */
    function MSSetting({ t, settings }) {
      return h(
        'div',
        { className: 'wb-setting' },
        h('span', { className: 'wb-settingLabel' }, t('ms.level')),
        h(
          'div',
          { className: 'wb-seg' },
          gameSettingButtons(t, MS_LEVEL_LABEL, settings.msLevel, (id) => settingsStore.setMsLevel(id)),
        ),
      )
    }

    /** Full-view foot: mines left, flag-mode toggle, reset, hint. */
    function MSControls({ t }) {
      const [ms, setMs] = React.useState(() => minesweeperStore.getSnapshot())
      React.useEffect(() => {
        const sync = () => setMs(minesweeperStore.getSnapshot())
        sync()
        return minesweeperStore.subscribe(sync)
      }, [])
      return h(
        React.Fragment,
        null,
        h('div', { className: 'wb-caption' }, t('ms.mines', { left: msMinesLeft(ms) })),
        h(
          'div',
          { className: 'wb-gameActions' },
          h(
            'button',
            {
              type: 'button',
              className: 'wb-btn',
              'data-active': ms.flagMode ? 'true' : 'false',
              onClick: () => minesweeperStore.toggleFlagMode(),
            },
            `🚩 ${t('ms.flagMode')}`,
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'wb-btn',
              onClick: () => minesweeperStore.reset(settingsStore.getSnapshot().msLevel),
            },
            t('game.reset'),
          ),
        ),
        h('div', { className: 'wb-hint' }, t('ms.hint')),
      )
    }

    /** Pill mini board: same rules on a ~184px square. */
    function FloatMinesweeper({ t }) {
      const [state, setState] = React.useState(() => minesweeperStore.getSnapshot())
      React.useEffect(() => {
        const sync = () => setState(minesweeperStore.getSnapshot())
        sync()
        return minesweeperStore.subscribe(sync)
      }, [])
      const canvasRef = React.useRef(null)
      React.useEffect(() => {
        drawMinesweeper(canvasRef.current, state)
      }, [state])
      const play = (event, forceFlag) => {
        if (state.status !== 'playing' || canvasRef.current === null) return
        const index = msPointAt(canvasRef.current, state, event.clientX, event.clientY)
        if (index < 0) return
        if (forceFlag || state.flagMode) minesweeperStore.toggleFlag(index)
        else minesweeperStore.place(index)
      }
      const overlay =
        state.status === 'playing'
          ? null
          : h(
              'div',
              { className: 'wb-pillMiniOverlay' },
              h('span', { className: 'wb-pillMiniScore' }, state.status === 'won' ? t('ms.won') : t('ms.lost')),
              h(
                'button',
                {
                  type: 'button',
                  className: 'wb-pillMiniBtn',
                  onClick: () => minesweeperStore.reset(settingsStore.getSnapshot().msLevel),
                },
                t('ms.again'),
              ),
            )
      return h(
        'div',
        { className: 'wb-pillGomoku' },
        h('canvas', {
          ref: canvasRef,
          role: 'img',
          'aria-label': t('ms.canvasLabel', { left: msMinesLeft(state) }),
          onClick: (event) => play(event, false),
          onContextMenu: (event) => {
            event.preventDefault()
            play(event, true)
          },
        }),
        overlay,
      )
    }

    /** Pill control row: flag-mode toggle, reset, background. */
    function PillMinesweeperCtl({ t, goBackground }) {
      const [state, setState] = React.useState(() => minesweeperStore.getSnapshot())
      React.useEffect(() => {
        const sync = () => setState(minesweeperStore.getSnapshot())
        sync()
        return minesweeperStore.subscribe(sync)
      }, [])
      return h(
        'div',
        { className: 'wb-pillCtl' },
        h(
          'span',
          null,
          h(
            'button',
            {
              type: 'button',
              className: 'wb-pillCtlBtn',
              'data-active': state.flagMode ? 'true' : 'false',
              onClick: () => minesweeperStore.toggleFlagMode(),
            },
            `🚩 ${t('ms.flagMode')}`,
          ),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'wb-pillCtlBtn',
            onClick: () => minesweeperStore.reset(settingsStore.getSnapshot().msLevel),
          },
          t('game.reset'),
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

    // D45 registry entry: the whole integration point for this game.
    GAMES.minesweeper = {
      id: 'minesweeper',
      titleKey: 'ms.title',
      store: () => minesweeperStore,
      pauseOnLeave: false,
      keyboard: false,
      Board: MSBoard,
      Setting: MSSetting,
      Controls: MSControls,
      Float: FloatMinesweeper,
      FloatCtl: PillMinesweeperCtl,
    }
    GAME_ORDER.push('minesweeper')
