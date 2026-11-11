
    // ---------------------------------------------------------------------
    // Gomoku (五子棋): 15x15, human = black, simple heuristic AI = white.
    // ---------------------------------------------------------------------
    const GOMOKU_SIZE = 15
    const GOMOKU_DIRS = [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ]
    const STONE_EMPTY = 0
    const STONE_HUMAN = 1
    const STONE_AI = 2

    const LEVEL_PRESETS = {
      easy: { radius: 1, defense: 0.35, top: 3 },
      medium: { radius: 2, defense: 0.9, top: 1 },
      hard: { radius: 3, defense: 1.15, top: 1, doubleBonus: 800, blockMajor: true },
    }

    const gomokuIndex = (x, y) => y * GOMOKU_SIZE + x
    const inGomoku = (x, y) => x >= 0 && y >= 0 && x < GOMOKU_SIZE && y < GOMOKU_SIZE

    function createGomokuState() {
      return {
        board: new Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(STONE_EMPTY),
        status: 'playing',
        moves: 0,
        lastMove: -1,
        winner: STONE_EMPTY,
      }
    }

    /** Five or more in a row through `index` for `color`. */
    function gomokuWins(board, index, color) {
      const x = index % GOMOKU_SIZE
      const y = Math.floor(index / GOMOKU_SIZE)
      for (const [dx, dy] of GOMOKU_DIRS) {
        let count = 1
        for (const sign of [1, -1]) {
          let cx = x + dx * sign
          let cy = y + dy * sign
          while (inGomoku(cx, cy) && board[gomokuIndex(cx, cy)] === color) {
            count += 1
            cx += dx * sign
            cy += dy * sign
          }
        }
        if (count >= 5) return true
      }
      return false
    }

    /** Rough strength of one shape: longer runs with more open ends score higher. */
    function gomokuWeight(count, open) {
      if (count >= 5) return 100000
      if (count === 4) return open >= 2 ? 12000 : open === 1 ? 1500 : 0
      if (count === 3) return open >= 2 ? 600 : open === 1 ? 60 : 0
      if (count === 2) return open >= 2 ? 30 : open === 1 ? 6 : 0
      return open >= 2 ? 1 : 0
    }

    /** Sum of the four directional shapes if `color` were placed at `index`. */
    function gomokuShape(board, index, color) {
      const x = index % GOMOKU_SIZE
      const y = Math.floor(index / GOMOKU_SIZE)
      let total = 0
      for (const [dx, dy] of GOMOKU_DIRS) {
        let count = 1
        let open = 0
        for (const sign of [1, -1]) {
          let cx = x + dx * sign
          let cy = y + dy * sign
          while (inGomoku(cx, cy) && board[gomokuIndex(cx, cy)] === color) {
            count += 1
            cx += dx * sign
            cy += dy * sign
          }
          if (inGomoku(cx, cy) && board[gomokuIndex(cx, cy)] === STONE_EMPTY) open += 1
        }
        total += gomokuWeight(count, open)
      }
      return total
    }

    /** Empty cells within `radius` steps of an existing stone. */
    function gomokuCandidates(board, radius) {
      const reach = Math.max(1, radius)
      const list = []
      for (let y = 0; y < GOMOKU_SIZE; y += 1) {
        for (let x = 0; x < GOMOKU_SIZE; x += 1) {
          if (board[gomokuIndex(x, y)] !== STONE_EMPTY) continue
          let near = false
          for (let dy = -reach; dy <= reach && !near; dy += 1) {
            for (let dx = -reach; dx <= reach; dx += 1) {
              const nx = x + dx
              const ny = y + dy
              if (!inGomoku(nx, ny)) continue
              if (board[gomokuIndex(nx, ny)] !== STONE_EMPTY) {
                near = true
                break
              }
            }
          }
          if (near) list.push(gomokuIndex(x, y))
        }
      }
      return list
    }

    /** Directions where the point would form a three-or-better with an open end. */
    function gomokuThreats(board, index, color) {
      const x = index % GOMOKU_SIZE
      const y = Math.floor(index / GOMOKU_SIZE)
      let threats = 0
      for (const [dx, dy] of GOMOKU_DIRS) {
        let count = 1
        let open = 0
        for (const sign of [1, -1]) {
          let cx = x + dx * sign
          let cy = y + dy * sign
          while (inGomoku(cx, cy) && board[gomokuIndex(cx, cy)] === color) {
            count += 1
            cx += dx * sign
            cy += dy * sign
          }
          if (inGomoku(cx, cy) && board[gomokuIndex(cx, cy)] === STONE_EMPTY) open += 1
        }
        if (count >= 3 && open >= 1) threats += 1
      }
      return threats
    }

    /** A placed stone threatens a forced win soon: a live/closed four, or two
     * simultaneous threats (double three / three-plus-four). Blocking such a
     * point cannot wait for the shape-score pass. */
    function gomokuIsMajorThreat(board, index, color) {
      const x = index % GOMOKU_SIZE
      const y = Math.floor(index / GOMOKU_SIZE)
      let threats = 0
      for (const [dx, dy] of GOMOKU_DIRS) {
        let count = 1
        let open = 0
        for (const sign of [1, -1]) {
          let cx = x + dx * sign
          let cy = y + dy * sign
          while (inGomoku(cx, cy) && board[gomokuIndex(cx, cy)] === color) {
            count += 1
            cx += dx * sign
            cy += dy * sign
          }
          if (inGomoku(cx, cy) && board[gomokuIndex(cx, cy)] === STONE_EMPTY) open += 1
        }
        if (count >= 4 && open >= 1) return true
        if (count >= 3 && open >= 1) threats += 1
      }
      return threats >= 2
    }

    /** Win now, block now, then — on levels with `blockMajor` — block any
     * point where the human would create a major threat (four / double three);
     * otherwise the best weighted point for the level. */
    function gomokuAiMove(board, levelId, random) {
      const level = LEVEL_PRESETS[levelId] || LEVEL_PRESETS.medium
      const roll = typeof random === 'function' ? random : Math.random
      const center = gomokuIndex(Math.floor(GOMOKU_SIZE / 2), Math.floor(GOMOKU_SIZE / 2))
      if (board.every((value) => value === STONE_EMPTY)) return center
      const candidates = gomokuCandidates(board, level.radius)
      if (candidates.length === 0) return center
      for (const index of candidates) {
        board[index] = STONE_AI
        const win = gomokuWins(board, index, STONE_AI)
        board[index] = STONE_EMPTY
        if (win) return index
      }
      for (const index of candidates) {
        board[index] = STONE_HUMAN
        const win = gomokuWins(board, index, STONE_HUMAN)
        board[index] = STONE_EMPTY
        if (win) return index
      }
      if (level.blockMajor) {
        let bestBlock = -1
        let bestBlockScore = -Infinity
        for (const index of candidates) {
          board[index] = STONE_HUMAN
          const major = gomokuIsMajorThreat(board, index, STONE_HUMAN)
          board[index] = STONE_EMPTY
          if (!major) continue
          const score =
            gomokuShape(board, index, STONE_AI) +
            gomokuShape(board, index, STONE_HUMAN) * level.defense
          if (score > bestBlockScore) {
            bestBlockScore = score
            bestBlock = index
          }
        }
        if (bestBlock >= 0) return bestBlock
      }
      const scored = candidates.map((index) => {
        let score =
          gomokuShape(board, index, STONE_AI) + gomokuShape(board, index, STONE_HUMAN) * level.defense
        if (level.doubleBonus !== undefined && gomokuThreats(board, index, STONE_AI) >= 2) {
          score += level.doubleBonus
        }
        return { index, score }
      })
      scored.sort((a, b) => b.score - a.score)
      const pool = scored.slice(0, Math.max(1, level.top))
      return pool[Math.min(pool.length - 1, Math.floor(roll() * pool.length))].index
    }

    /** Human move followed by the AI reply; terminal states stop the round. */
    function placeGomoku(state, index, levelId, random) {
      if (state.status !== 'playing') return state
      if (index < 0 || index >= state.board.length) return state
      if (state.board[index] !== STONE_EMPTY) return state
      const board = state.board.slice()
      board[index] = STONE_HUMAN
      let moves = state.moves + 1
      if (gomokuWins(board, index, STONE_HUMAN)) {
        return { board, status: 'won', moves, lastMove: index, winner: STONE_HUMAN }
      }
      if (moves >= board.length) {
        return { board, status: 'draw', moves, lastMove: index, winner: STONE_EMPTY }
      }
      const ai = gomokuAiMove(board, levelId, random)
      board[ai] = STONE_AI
      moves += 1
      if (gomokuWins(board, ai, STONE_AI)) {
        return { board, status: 'lost', moves, lastMove: ai, winner: STONE_AI }
      }
      if (moves >= board.length) {
        return { board, status: 'draw', moves, lastMove: ai, winner: STONE_EMPTY }
      }
      return { board, status: 'playing', moves, lastMove: ai, winner: STONE_EMPTY }
    }

    function createGomokuStore() {
      let state = createGomokuState()
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
        place(index, levelId) {
          publish(placeGomoku(state, index, levelId, Math.random))
        },
        reset() {
          publish(createGomokuState())
        },
      }
    }

    const gomokuStore = forwardStore(() => gomokuStoreImpl)

    const SETTINGS_KEY = 'dsh-wait-buddy.settings.v1'
    const DEFAULT_SETTINGS = {
      speed: 'normal',
      level: 'medium',
      // 扫雷难度（D46）：默认初级。
      msLevel: 'easy',
      // 低调模式（D29 §8.7 / D31）：默认胶囊 + 系统通知开。
      presence: 'pill',
      notify: true,
      // D42: the Ctrl/Cmd+Shift+W presence shortcut can be turned off.
      shortcut: true,
      pillCorner: 'top-right',
      // Floating-panel position {x,y} (D30); null = use the corner origin.
      pillPos: null,
    }
    const PRESENCE_MODES = ['quiet', 'pill']
    const PILL_CORNERS = ['top-right', 'bottom-right', 'top-left']
    const SPEED_LABEL = { slow: 'speed.slow', normal: 'speed.normal', fast: 'speed.fast' }
    const LEVEL_LABEL = { easy: 'level.easy', medium: 'level.medium', hard: 'level.hard' }
    // Minesweeper presets (D46); lives here so createSettingsStore sees it.
    const MS_LEVEL_PRESETS = {
      easy: { cols: 9, rows: 9, mines: 10 },
      medium: { cols: 12, rows: 12, mines: 24 },
      hard: { cols: 16, rows: 16, mines: 40 },
    }
    const MS_LEVEL_LABEL = { easy: 'ms.level.easy', medium: 'ms.level.medium', hard: 'ms.level.hard' }

    /** Player preferences; corrupt or unavailable storage falls back to defaults. */
    function readSettings() {
      try {
        const raw = window.localStorage.getItem(SETTINGS_KEY)
        if (raw === null) return { ...DEFAULT_SETTINGS }
        const parsed = JSON.parse(raw)
        return {
          speed: SPEED_PRESETS[parsed.speed] === undefined ? DEFAULT_SETTINGS.speed : parsed.speed,
          level: LEVEL_PRESETS[parsed.level] === undefined ? DEFAULT_SETTINGS.level : parsed.level,
          msLevel: MS_LEVEL_PRESETS[parsed.msLevel] === undefined ? DEFAULT_SETTINGS.msLevel : parsed.msLevel,
          presence: PRESENCE_MODES.includes(parsed.presence) ? parsed.presence : DEFAULT_SETTINGS.presence,
          notify: typeof parsed.notify === 'boolean' ? parsed.notify : DEFAULT_SETTINGS.notify,
          shortcut: typeof parsed.shortcut === 'boolean' ? parsed.shortcut : DEFAULT_SETTINGS.shortcut,
          pillCorner: PILL_CORNERS.includes(parsed.pillCorner)
            ? parsed.pillCorner
            : DEFAULT_SETTINGS.pillCorner,
          pillPos:
            parsed.pillPos !== null &&
            typeof parsed.pillPos === 'object' &&
            typeof parsed.pillPos.x === 'number' &&
            typeof parsed.pillPos.y === 'number'
              ? { x: parsed.pillPos.x, y: parsed.pillPos.y }
              : null,
        }
      } catch (error) {
        return { ...DEFAULT_SETTINGS }
      }
    }

    function createSettingsStore() {
      let state = readSettings()
      const listeners = new Set()
      const publish = (next) => {
        state = next
        try {
          window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(state))
        } catch (error) {
          console.error('[wait-buddy] storing settings failed', error)
        }
        for (const listener of [...listeners]) listener()
      }
      return {
        getSnapshot: () => state,
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        setSpeed(id) {
          if (SPEED_PRESETS[id] === undefined || state.speed === id) return
          publish({ ...state, speed: id })
        },
        setLevel(id) {
          if (LEVEL_PRESETS[id] === undefined || state.level === id) return
          publish({ ...state, level: id })
        },
        setMsLevel(id) {
          if (MS_LEVEL_PRESETS[id] === undefined || state.msLevel === id) return
          publish({ ...state, msLevel: id })
        },
        setPresence(id) {
          if (!PRESENCE_MODES.includes(id) || state.presence === id) return
          publish({ ...state, presence: id })
        },
        setNotify(enabled) {
          if (typeof enabled !== 'boolean' || state.notify === enabled) return
          publish({ ...state, notify: enabled })
        },
        setShortcut(enabled) {
          if (typeof enabled !== 'boolean' || state.shortcut === enabled) return
          publish({ ...state, shortcut: enabled })
        },
        setPillCorner(id) {
          if (!PILL_CORNERS.includes(id) || state.pillCorner === id) return
          publish({ ...state, pillCorner: id })
        },
        setPillPos(pos) {
          if (
            pos === null ||
            (typeof pos === 'object' && typeof pos.x === 'number' && typeof pos.y === 'number')
          ) {
            publish({ ...state, pillPos: pos })
          }
        },
      }
    }

    const settingsStore = createSettingsStore()

    const presenceStore = createPresenceStore(settingsStore, gameStore)

    /** Selected mini-game; both rounds survive a switch. */
    function createModeStore() {
      let mode = 'snake'
      const listeners = new Set()
      return {
        getSnapshot: () => mode,
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        set(next) {
          if (next === mode) return
          mode = next
          for (const listener of [...listeners]) listener()
        },
      }
    }

    const modeStore = createModeStore()

    function drawGomoku(canvas, state) {
      if (canvas === null || canvas === undefined) return
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (width === 0 || height === 0) return
      const ctx = canvas.getContext('2d')
      if (ctx === null) return
      const bw = Math.round(width * 2)
      const bh = Math.round(height * 2)
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw
        canvas.height = bh
      }
      ctx.setTransform(2, 0, 0, 2, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const size = Math.min(width, height)
      const ox = (width - size) / 2
      const oy = (height - size) / 2

      ctx.fillStyle = '#d8b37a'
      ctx.fillRect(ox, oy, size, size)

      const pad = size / (GOMOKU_SIZE * 2)
      const cell = (size - pad * 2) / (GOMOKU_SIZE - 1)
      const at = (line) => pad + line * cell

      ctx.strokeStyle = 'rgba(60,40,20,0.5)'
      ctx.lineWidth = 1
      for (let i = 0; i < GOMOKU_SIZE; i += 1) {
        const p = at(i)
        ctx.beginPath()
        ctx.moveTo(ox + pad, oy + p)
        ctx.lineTo(ox + size - pad, oy + p)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(ox + p, oy + pad)
        ctx.lineTo(ox + p, oy + size - pad)
        ctx.stroke()
      }

      ctx.fillStyle = 'rgba(50,32,14,0.85)'
      for (const [sx, sy] of [
        [3, 3],
        [11, 3],
        [3, 11],
        [11, 11],
        [7, 7],
      ]) {
        ctx.beginPath()
        ctx.arc(ox + at(sx), oy + at(sy), Math.max(1.5, cell * 0.08), 0, Math.PI * 2)
        ctx.fill()
      }

      const radius = cell * 0.42
      state.board.forEach((stone, index) => {
        if (stone === STONE_EMPTY) return
        const cx = ox + at(index % GOMOKU_SIZE)
        const cy = oy + at(Math.floor(index / GOMOKU_SIZE))
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fillStyle = stone === STONE_HUMAN ? '#16181d' : '#f6f1e7'
        ctx.fill()
        ctx.strokeStyle = stone === STONE_HUMAN ? '#000000' : 'rgba(60,40,20,0.45)'
        ctx.lineWidth = 1
        ctx.stroke()
        if (index === state.lastMove) {
          ctx.beginPath()
          ctx.arc(cx, cy, Math.max(1.6, cell * 0.1), 0, Math.PI * 2)
          ctx.fillStyle = '#d9534f'
          ctx.fill()
        }
      })
    }

    /** Nearest intersection under a pointer event, or -1 outside the board. */
    function gomokuPointAt(canvas, clientX, clientY) {
      const rect = canvas.getBoundingClientRect()
      const size = Math.min(rect.width, rect.height)
      if (size === 0) return -1
      const ox = (rect.width - size) / 2
      const oy = (rect.height - size) / 2
      const pad = size / (GOMOKU_SIZE * 2)
      const cell = (size - pad * 2) / (GOMOKU_SIZE - 1)
      const x = Math.round((clientX - rect.left - ox - pad) / cell)
      const y = Math.round((clientY - rect.top - oy - pad) / cell)
      return inGomoku(x, y) ? gomokuIndex(x, y) : -1
    }

    /** Gomoku result overlay. */
    function gomokuOverlay(t, state, focusRoot) {
      if (state.status === 'playing') return null
      const title =
        state.status === 'won'
          ? t('gomoku.won')
          : state.status === 'lost'
            ? t('gomoku.lost')
            : t('gomoku.draw')
      return h(
        'div',
        { className: 'wb-overlay' },
        h('div', { className: 'wb-overlayTitle' }, title),
        h(
          'button',
          {
            type: 'button',
            className: 'wb-btn wb-btnPrimary',
            onClick: () => {
              gomokuStore.reset()
              focusRoot()
            },
          },
          t('gomoku.again'),
        ),
      )
    }

    /** Game area: mode switch, one board, one control row. */
    function GameArea({ t, sessionId, focusRoot, pendingKind }) {
      const canvasRef = React.useRef(null)
      const boardRef = React.useRef(null)
      const gomokuCanvasRef = React.useRef(null)
      const lastSession = React.useRef(sessionId)
      // D42: notification permission is requested from this button (user
      // gesture), never at plugin load; the local state re-renders the row.
      const [notifyPerm, setNotifyPerm] = React.useState(
        () => (typeof Notification === 'undefined' ? 'denied' : Notification.permission),
      )
      const requestNotify = () => {
        if (typeof Notification === 'undefined') return
        try {
          Promise.resolve(Notification.requestPermission())
            .then((value) => setNotifyPerm(value === undefined ? 'default' : value))
            .catch(() => {})
        } catch (error) {
          console.warn('[wait-buddy] notification permission request failed', error)
        }
      }
      React.useEffect(() => {
        if (lastSession.current === sessionId) return
        lastSession.current = sessionId
        gameStore.pauseWithHint('session-switch')
      }, [sessionId])
      const [mode, setMode] = React.useState(() => modeStore.getSnapshot())
      React.useEffect(() => modeStore.subscribe(() => setMode(modeStore.getSnapshot())), [])
      const [snake, setSnake] = React.useState(() => gameStore.getSnapshot())
      React.useEffect(() => {
        const sync = () => setSnake(gameStore.getSnapshot())
        sync()
        return gameStore.subscribe(sync)
      }, [])
      const [settings, setSettings] = React.useState(() => settingsStore.getSnapshot())
      React.useEffect(
        () => settingsStore.subscribe(() => setSettings(settingsStore.getSnapshot())),
        [],
      )
      const [gomoku, setGomoku] = React.useState(() => gomokuStore.getSnapshot())
      React.useEffect(() => {
        const sync = () => setGomoku(gomokuStore.getSnapshot())
        sync()
        return gomokuStore.subscribe(sync)
      }, [])

      const switchMode = (next) => {
        if (next === mode) return
        modeStore.set(next)
        if (GAMES[mode].pauseOnLeave) GAMES[mode].store().pause()
        focusRoot()
      }

      // D45: everything below renders through the GameAdapter registry —
      // no `mode === 'snake'` branches here.
      const game = GAMES[mode]
      const setting = h(game.Setting, { t, settings })
      const board = h(game.Board, {
        t,
        snake,
        gomoku,
        focusRoot,
        pendingKind,
        boardRef,
        canvasRef,
        gomokuCanvasRef,
      })
      const controls = h(game.Controls, { t, snake, gomoku })

      // Presence mode control (D29 §8.7 / D31): quiet / pill.
      const presenceSetting = h(
        'div',
        { className: 'wb-setting' },
        h('span', { className: 'wb-settingLabel' }, t('presence.mode')),
        h(
          'div',
          { className: 'wb-seg' },
          gameSegButton(t('presence.quiet'), 'quiet', settings.presence === 'quiet', () =>
            settingsStore.setPresence('quiet'),
          ),
          gameSegButton(t('presence.pill'), 'pill', settings.presence === 'pill', () =>
            settingsStore.setPresence('pill'),
          ),
        ),
      )

      // D42: the presence shortcut can be disabled; notification permission is
      // requested here (user gesture) — never at plugin load.
      const shortcutSetting = h(
        'div',
        { className: 'wb-setting' },
        h('span', { className: 'wb-settingLabel' }, t('shortcut.label')),
        h(
          'div',
          { className: 'wb-seg' },
          gameSegButton(t('shortcut.on'), 'shortcut-on', settings.shortcut, () =>
            settingsStore.setShortcut(true),
          ),
          gameSegButton(t('shortcut.off'), 'shortcut-off', !settings.shortcut, () =>
            settingsStore.setShortcut(false),
          ),
        ),
      )
      const notifySetting =
        notifyPerm === 'default'
          ? h(
              'div',
              { className: 'wb-setting' },
              h(
                'button',
                { type: 'button', className: 'wb-btn', onClick: requestNotify },
                t('notify.enable'),
              ),
            )
          : null

      return h(
        'section',
        { className: 'wb-game' },
        board,
        h(
          'div',
          { className: 'wb-gameFoot' },
          h(
            'div',
            { className: 'wb-seg' },
            ...GAME_ORDER.map((id) =>
              gameSegButton(t(GAMES[id].titleKey), id, mode === id, () => switchMode(id)),
            ),
          ),
          setting,
          presenceSetting,
          shortcutSetting,
          notifySetting,
          controls,
        ),
      )
    }

    /** One alert banner; the native dialog always keeps precedence. */
    function AlertBanner({ t, state }) {
      if (state.status === 'pending_approval') {
        // D28: every blocking pending interaction alerts, with per-kind copy.
        const kind = state.pendingKind
        const titleKey =
          kind === 'question'
            ? 'alert.question.title'
            : kind === 'plan-review'
              ? 'alert.planReview.title'
              : kind === 'approval'
                ? 'alert.approval.title'
                : 'alert.pending.title'
        const meta =
          kind === 'approval'
            ? state.approvalTool === ''
              ? null
              : h(
                  'span',
                  { className: 'wb-alertMeta', title: state.approvalTool },
                  t('alert.approval.tool', { tool: state.approvalTool }),
                )
            : state.pendingDetail === ''
              ? null
              : h(
                  'span',
                  { className: 'wb-alertMeta', title: state.pendingDetail },
                  state.pendingDetail,
                )
        return h(
          'div',
          { className: 'wb-alert', 'data-kind': kind === '' ? 'approval' : kind, role: 'alert' },
          h('span', { className: 'wb-alertTitle' }, t(titleKey)),
          meta,
        )
      }
      if (state.status === 'failed') {
        return h(
          'div',
          { className: 'wb-alert', 'data-kind': 'failed', role: 'alert' },
          h('span', { className: 'wb-alertTitle' }, t('alert.failed.title')),
          state.reasonCode === '' && state.errorMessage === ''
            ? null
            : h(
                'span',
                {
                  className: 'wb-alertMeta',
                  title: state.errorMessage === '' ? undefined : state.errorMessage,
                },
                failureText(t, state),
              ),
        )
      }
      return null
    }

const CSS = `
.wb-root{box-sizing:border-box;width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;container-type:inline-size;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}
.wb-root:focus{outline:none}
.wb-root:focus-visible .wb-boardWrap,.wb-boardWrap:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.wb-boardWrap:focus{outline:none}
.wb-inner{box-sizing:border-box;width:100%;flex:1 1 auto;min-height:0;overflow:auto;padding:10px 24px 176px;display:flex;flex-direction:column;gap:16px}
.wb-alert{flex:none;margin:12px 24px 0;display:flex;align-items:center;gap:8px;border:1px solid var(--dsw-alias-state-warn-primary);border-radius:10px;padding:8px 12px;background:var(--dsw-alias-bg-base);flex-wrap:wrap}
.wb-alert[data-kind="failed"]{border-color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-base)}
.wb-alertTitle{flex:1 1 auto;min-width:0;font-size:13px;font-weight:600;white-space:normal;overflow-wrap:anywhere}
.wb-alertMeta{flex:1;min-width:0;font-size:11px;font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-top{display:flex;align-items:flex-start;gap:24px;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.wb-status{flex:0 1 auto;min-width:min(260px,100%);display:flex;flex-direction:column;gap:6px}
.wb-statusRow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.wb-dot{flex:none;width:9px;height:9px;border-radius:50%;background:var(--dsw-alias-state-idle-primary)}
.wb-dot[data-state="running"]{background:var(--dsw-alias-state-success-primary)}
.wb-dot[data-state="pending_approval"]{background:var(--dsw-alias-state-warn-primary)}
.wb-dot[data-state="success"]{background:var(--dsw-alias-state-success-primary)}
.wb-dot[data-state="failed"]{background:var(--dsw-alias-state-error-primary)}
.wb-dot[data-state="aborted"]{background:var(--dsw-alias-state-idle-primary)}
.wb-dot[data-health="degraded"]:not([data-state="pending_approval"]):not([data-state="failed"]),.wb-dot[data-health="stale"]:not([data-state="pending_approval"]):not([data-state="failed"]){background:var(--dsw-alias-state-warn-primary)}
.wb-statusText{flex:0 1 auto;min-width:0;font-size:15px;font-weight:600;line-height:22px}
.wb-meta{flex:none;font-size:11px;line-height:18px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.wb-disclaimer{font-size:10px;line-height:14px;color:var(--dsw-alias-label-secondary)}
.wb-pulse{position:relative;height:2px;border-radius:999px;overflow:hidden;background:var(--dsw-alias-bg-layer-2)}
.wb-pulseFill{position:absolute;top:0;bottom:0;width:32%;border-radius:999px;background:linear-gradient(90deg,transparent,var(--dsw-alias-state-warn-primary),transparent);animation:wb-sweep 1.6s linear infinite}
@keyframes wb-sweep{0%{transform:translateX(-110%)}100%{transform:translateX(320%)}}
.wb-feed{flex:1 1 420px;min-width:0;display:flex;flex-direction:column;gap:4px;padding-top:2px}
.wb-feedRow{display:flex;align-items:baseline;gap:8px;min-width:0}
.wb-feedKind{flex:none;width:30px;font-size:10px;line-height:16px;color:var(--dsw-alias-label-secondary)}
.wb-feedText{flex:1;min-width:0;font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary)}
.wb-feedEmpty{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}
.wb-game{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:8px}
.wb-boardWrap{position:relative;flex:1 1 auto;width:100%;height:min(46vh,480px);min-height:200px;max-height:520px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;overflow:hidden;background:#0d1624}
.wb-board{display:block;width:100%;height:100%}
.wb-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;text-align:center;background:color-mix(in srgb,#0d1624 48%,transparent);color:#e6f2ff}
.wb-overlayTitle{font-size:15px;font-weight:600}
.wb-overlayBody{font-size:11px;line-height:16px;color:rgba(230,242,255,.76)}
.wb-reward{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);font-size:20px;font-weight:700;color:#8ef7b0;pointer-events:none;text-shadow:0 2px 10px rgba(0,0,0,.45);animation:wb-float 1.2s ease-out forwards}
@keyframes wb-float{0%{opacity:0;transform:translate(-50%,-20%)}20%{opacity:1}100%{opacity:0;transform:translate(-50%,-130%)}}
.wb-notice{position:absolute;left:50%;top:12px;transform:translateX(-50%);max-width:90%;padding:6px 12px;border-radius:999px;background:rgba(6,36,15,.9);color:#e6f2ff;font-size:12px;line-height:18px;text-align:center;pointer-events:none;animation:wb-toast 4s ease forwards}
@keyframes wb-toast{0%{opacity:0;transform:translate(-50%,-6px)}10%,80%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-6px)}}
.wb-gameFoot{display:flex;align-items:center;gap:18px;flex-wrap:wrap;min-width:0}
.wb-chatBtn{flex:none}
.wb-seg{display:inline-flex;align-items:stretch;flex:none;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;overflow:hidden}
.wb-segBtn{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);padding:2px 10px;font-size:12px;line-height:18px;font-family:inherit;cursor:pointer}
.wb-segBtn + .wb-segBtn{border-left:1px solid var(--dsw-alias-border-l1)}
.wb-segBtn:hover{background:var(--dsw-alias-bg-layer-2)}
.wb-segBtn[data-active="true"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:500}
.wb-segBtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.wb-caption{font-size:15px;line-height:22px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.wb-gameActions{display:flex;gap:6px;flex-wrap:wrap}
.wb-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:8px;padding:5px 14px;font-size:14px;line-height:20px;font-family:inherit;cursor:pointer}
.wb-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.wb-btn:disabled{opacity:.4;cursor:default}
.wb-btnPrimary{background:#8ef7b0;border-color:#8ef7b0;color:#06240f;font-weight:600;padding:6px 16px}
.wb-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.wb-setting{display:flex;align-items:center;gap:8px;flex:none}
.wb-settingLabel{margin-right:2px;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.wb-squareBoard{flex:0 1 auto;width:min(100%,max(200px,min(46vh,520px)));max-width:100%;height:auto;min-height:0;max-height:520px;aspect-ratio:1/1;border:0;background:transparent;align-self:center;margin:0 auto}
@container (max-width:480px){.wb-inner{padding:8px 12px 176px}.wb-top{gap:12px}.wb-status{min-width:0}.wb-setting{display:none}.wb-hint{display:none}.wb-disclaimer{display:none}.wb-caption{font-size:13px}.wb-gameFoot{gap:10px}.wb-boardWrap{height:128px;min-height:128px;max-height:128px}.wb-alert{padding:8px 10px;margin:12px 12px 0}.wb-statusText{overflow-wrap:anywhere}}
.wb-crash{box-sizing:border-box;width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:24px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-state-error-primary);border-radius:10px;margin:12px}
@media (prefers-reduced-motion: reduce){.wb-pulseFill{animation:none}.wb-reward{animation:none;opacity:1}.wb-notice{animation:none;opacity:1}}
`
