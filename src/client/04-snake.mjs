
    // ---------------------------------------------------------------------
    // M2: embedded Snake game. Fully decoupled from the monitor: nothing in
    // this section reads task state, and nothing in the monitor section reads
    // game state. (Agent -> game signals arrive with M3.)
    // ---------------------------------------------------------------------

    /** Cells are derived from the measured board box, roughly this many pixels each. */
    const TARGET_CELL = 18
    const MIN_COLS = 16
    const MAX_COLS = 120
    const MIN_ROWS = 8
    const SPEED_PRESETS = {
      slow: { start: 200, min: 110, step: 5 },
      normal: { start: 140, min: 70, step: 4 },
      fast: { start: 100, min: 55, step: 3 },
    }
    const FOOD_SCORE = 10

    const DIR_VECTORS = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    }
    const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' }
    const ARROW_DIRECTIONS = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    }

    const sameCell = (a, b) => a.x === b.x && a.y === b.y

    /** Grid columns/rows that fill the measured box with roughly square cells. */
    function gridFor(width, height) {
      const cols = Math.max(MIN_COLS, Math.min(MAX_COLS, Math.round(width / TARGET_CELL)))
      const rows = Math.max(MIN_ROWS, Math.round(height / TARGET_CELL))
      return { cols, rows }
    }

    /** Initial three-cell snake, head first, centred on the board. */
    function initialSnake(cols, rows) {
      const row = Math.floor(rows / 2)
      const head = Math.floor(cols / 2)
      return [
        { x: head, y: row },
        { x: head - 1, y: row },
        { x: head - 2, y: row },
      ]
    }

    /** Pick a uniformly random free cell, or null when the board is full. */
    function placeFood(snake, cols, rows, random) {
      const taken = new Set(snake.map((segment) => `${segment.x},${segment.y}`))
      const free = []
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          if (!taken.has(`${x},${y}`)) free.push({ x, y })
        }
      }
      if (free.length === 0) return null
      const pick = Math.floor(random() * free.length)
      return free[Math.min(pick, free.length - 1)]
    }

    /** Fresh game on the given grid, preserving the best score of the client session. */
    function createGameState(best, cols, rows, speedId) {
      const speed = SPEED_PRESETS[speedId] === undefined ? 'normal' : speedId
      const snake = initialSnake(cols, rows)
      return {
        status: 'idle',
        snake,
        dir: 'right',
        dirQueue: [],
        food: placeFood(snake, cols, rows, Math.random),
        score: 0,
        eaten: 0,
        best: best === undefined ? 0 : best,
        tickMs: SPEED_PRESETS[speed].start,
        speed,
        cols,
        rows,
        pauseReason: '',
        resumeReason: '',
        resumeReady: false,
        reward: null,
        notice: null,
      }
    }

    /** Start (or restart) a round on the current grid. */
    function startGame(state, speedId) {
      return {
        ...createGameState(state.best, state.cols, state.rows, speedId === undefined ? state.speed : speedId),
        status: 'running',
      }
    }

    /** Queue up to two direction changes; validate against the queue tail. */
    function turnGame(state, dir) {
      if (state.status !== 'running') return state
      const queue = state.dirQueue
      if (queue.length >= 2) return state
      const last = queue.length > 0 ? queue[queue.length - 1] : state.dir
      if (dir === last || dir === OPPOSITE[last]) return state
      return { ...state, dirQueue: [...queue, dir] }
    }

    /** One movement step: walls, self collision, food, growth and speed-up. */
    function tickGame(state) {
      if (state.status !== 'running') return state
      const dir = state.dirQueue.length > 0 ? state.dirQueue[0] : state.dir
      const vector = DIR_VECTORS[dir]
      const head = state.snake[0]
      const next = { x: head.x + vector.x, y: head.y + vector.y }
      const eating = state.food !== null && sameCell(next, state.food)
      const body = eating ? state.snake : state.snake.slice(0, -1)
      const hitWall = next.x < 0 || next.y < 0 || next.x >= state.cols || next.y >= state.rows
      const hitSelf = body.some((segment) => sameCell(segment, next))
      if (hitWall || hitSelf) {
        return {
          ...state,
          status: 'over',
          dir,
          dirQueue: [],
          best: Math.max(state.best, state.score),
        }
      }
      if (!eating) {
        return {
          ...state,
          snake: [next, ...state.snake.slice(0, -1)],
          dir,
          dirQueue: state.dirQueue.slice(1),
        }
      }
      const grown = [next, ...state.snake]
      const score = state.score + FOOD_SCORE
      const food = placeFood(grown, state.cols, state.rows, Math.random)
      return {
        ...state,
        snake: grown,
        dir,
        dirQueue: state.dirQueue.slice(1),
        food,
        score,
        eaten: (state.eaten === undefined ? 0 : state.eaten) + 1,
        best: Math.max(state.best, score),
        tickMs: Math.max(
          (SPEED_PRESETS[state.speed] || SPEED_PRESETS.normal).min,
          state.tickMs - (SPEED_PRESETS[state.speed] || SPEED_PRESETS.normal).step,
        ),
        status: food === null ? 'over' : 'running',
      }
    }

    /** Pause a running round. */
    function pauseGame(state) {
      return state.status === 'running' ? { ...state, status: 'paused' } : state
    }

    /** Resume a paused round. */
    function resumeGame(state) {
      return state.status === 'paused' ? { ...state, status: 'running' } : state
    }

    /** Reset to a fresh idle board on the current grid, keeping the best score. */
    function resetGame(state, speedId) {
      return createGameState(state.best, state.cols, state.rows, speedId === undefined ? state.speed : speedId)
    }

    /**
     * Module-level game store: one round survives view switches (Chat <-> WaitBuddy
     * and session switches). Unmounting the view pauses the round; it never
     * discards it, and it never touches monitor state.
     */
    function createGameStore() {
      let state = createGameState(0, 48, 16)
      const listeners = new Set()
      let timer = null
      let timerKey = null
      let subscribers = 0
      let manualPaused = false
      const pauseReasons = new Set()
      let resumeReason = ''
      let resumeReady = false
      let rewardSeq = 0
      let noticeSeq = 0
      let rewardTimer = null
      let noticeTimer = null

      const clearTimer = () => {
        if (timer !== null) {
          clearInterval(timer)
          timer = null
        }
        timerKey = null
      }

      const notify = () => {
        for (const listener of [...listeners]) listener()
      }

      // A ticker is rebuilt only when the pace changes; a keypress or a score
      // update no longer pushes the next movement tick back.
      const schedule = () => {
        const nextKey = state.status === 'running' ? `${state.tickMs}` : ''
        if (timer !== null && timerKey === nextKey) return
        clearTimer()
        if (state.status !== 'running' || subscribers === 0) return
        timerKey = nextKey
        timer = setInterval(() => {
          set(tickGame(state))
        }, state.tickMs)
      }

      const set = (next) => {
        if (next === state) return
        state = next
        notify()
        schedule()
      }

      const clearTransientTimers = () => {
        if (rewardTimer !== null) {
          clearTimeout(rewardTimer)
          rewardTimer = null
        }
        if (noticeTimer !== null) {
          clearTimeout(noticeTimer)
          noticeTimer = null
        }
      }

      const reasonLabel = () => {
        for (const reason of pauseReasons) {
          if (reason.startsWith('approval:')) return 'approval'
        }
        if (pauseReasons.has('hidden')) return 'hidden'
        if (pauseReasons.has('view-inactive') || pauseReasons.has('page-hidden')) {
          return 'view-inactive'
        }
        return manualPaused ? 'manual' : ''
      }

      const addPause = (reason, signal) => {
        if (state.status !== 'running' && state.status !== 'paused') {
          if (!signal) return
          pauseReasons.add(reason)
          resumeReady = true
          resumeReason = 'approval'
          // Keep the reason visible even when the round already ended/idle:
          // approval outranks the game-over overlay.
          set({ ...state, pauseReason: reasonLabel(), resumeReason: 'approval', resumeReady: true })
          return
        }
        pauseReasons.add(reason)
        if (signal) {
          resumeReady = true
          resumeReason = 'approval'
        }
        if (state.status === 'running') {
          set({ ...state, status: 'paused', pauseReason: reasonLabel(), resumeReason, resumeReady })
        } else {
          set({ ...state, pauseReason: reasonLabel(), resumeReason, resumeReady })
        }
      }

      const releasePause = (reason) => {
        if (!pauseReasons.has(reason)) return
        pauseReasons.delete(reason)
        if (pauseReasons.size === 0) resumeReady = state.status === 'paused' && !manualPaused
        // Leaving the one-key hide state keeps the round paused (manual-resume
        // semantics, ui-spec §8.6); the overlay swaps to the restored hint.
        const hiddenResumed =
          reason === 'hidden' && pauseReasons.size === 0 && state.status === 'paused'
        set({ ...state, pauseReason: reasonLabel(), resumeReason, resumeReady, hiddenResumed })
      }

      const manualPause = () => {
        if (state.status !== 'running') return
        manualPaused = true
        resumeReady = false
        resumeReason = ''
        set({ ...state, status: 'paused', pauseReason: reasonLabel(), resumeReason: '', resumeReady: false })
      }

      const pauseWithHint = (reason) => {
        if (state.status !== 'running') return
        if (pauseReasons.size > 0) return
        clearTransientTimers()
        manualPaused = false
        resumeReady = true
        resumeReason = ''
        set({
          ...state,
          status: 'paused',
          pauseReason: reason,
          resumeReason: '',
          resumeReady: true,
          reward: null,
          notice: null,
        })
      }

      const manualResume = () => {
        if (state.status !== 'paused') return
        if (pauseReasons.size > 0) return
        manualPaused = false
        resumeReady = false
        resumeReason = ''
        set({ ...state, status: 'running', pauseReason: '', resumeReason: '', resumeReady: false, hiddenResumed: false })
      }

      const addScore = (amount) => {
        if (state.status === 'idle') return
        const id = (rewardSeq += 1)
        const score = state.score + amount
        if (rewardTimer !== null) clearTimeout(rewardTimer)
        set({
          ...state,
          score,
          best: Math.max(state.best, score),
          reward: { id, amount },
        })
        rewardTimer = setTimeout(() => {
          rewardTimer = null
          if (state.reward !== null && state.reward.id === id) {
            set({ ...state, reward: null })
          }
        }, 1200)
        rewardTimer.unref?.()
      }

      const setNotice = (kind) => {
        if (state.status === 'idle') return
        const id = (noticeSeq += 1)
        if (noticeTimer !== null) clearTimeout(noticeTimer)
        set({ ...state, notice: { id, kind } })
        noticeTimer = setTimeout(() => {
          noticeTimer = null
          if (state.notice !== null && state.notice.id === id) {
            set({ ...state, notice: null })
          }
        }, 4000)
        noticeTimer.unref?.()
      }

      const onVisibility = () => {
        // D29 red line: this is the *page* going hidden — a distinct reason
        // from the one-key hide (`hidden`), or returning to the tab would
        // wrongly release a hide-pause (reason-key collision, fixed 2026-11-09).
        if (document.hidden) addPause('page-hidden', false)
        else releasePause('page-hidden')
      }
      document.addEventListener('visibilitychange', onVisibility)

      return {
        getSnapshot: () => state,
        subscribe(listener) {
          listeners.add(listener)
          subscribers += 1
          if (subscribers === 1) {
            releasePause('view-inactive')
            schedule()
          }
          return () => {
            listeners.delete(listener)
            subscribers -= 1
            if (subscribers === 0) {
              clearTimer()
              pauseWithHint('view-inactive')
              clearTransientTimers()
              if (state.notice !== null || state.reward !== null) {
                set({ ...state, notice: null, reward: null })
              }
            }
          }
        },
        /** Re-derive the grid from the measured box; ignored while a round is live. */
        setGrid(cols, rows) {
          if (state.status === 'running' || state.status === 'paused') return
          if (state.cols === cols && state.rows === rows) return
          set(createGameState(state.best, cols, rows, state.speed))
        },
        start: (speedId) => {
          clearTransientTimers()
          manualPaused = false
          const paused = pauseReasons.size > 0
          set({
            ...startGame(state, speedId),
            status: paused ? 'paused' : 'running',
            pauseReason: reasonLabel(),
            resumeReason: paused ? resumeReason : '',
            resumeReady: paused ? resumeReady : false,
            reward: null,
            notice: null,
          })
        },
        pause: () => manualPause(),
        pauseWithHint: (reason) => pauseWithHint(reason),
        /** D29 §8.6: one-key hide pauses via the `hidden` reason; releasing keeps the round paused. */
        setHidden(hidden) {
          if (hidden) addPause('hidden')
          else releasePause('hidden')
        },
        resume: () => manualResume(),
        turn: (dir) => set(turnGame(state, dir)),
        togglePause: () => {
          if (state.status === 'running') manualPause()
          else if (state.status === 'paused') manualResume()
        },
        reset: (speedId) => {
          clearTransientTimers()
          manualPaused = false
          const paused = pauseReasons.size > 0
          set({
            ...resetGame(state, speedId),
            status: paused ? 'paused' : 'idle',
            pauseReason: reasonLabel(),
            resumeReason: paused ? resumeReason : '',
            resumeReady: paused ? resumeReady : false,
            reward: null,
            notice: null,
          })
        },
        /** Change the pace; paused/idle rounds keep the new pace for the next run. */
        setSpeed(speedId) {
          if (SPEED_PRESETS[speedId] === undefined || state.speed === speedId) return
          const preset = SPEED_PRESETS[speedId]
          const eaten = state.eaten === undefined ? 0 : state.eaten
          set({
            ...state,
            speed: speedId,
            tickMs: Math.max(preset.min, preset.start - eaten * preset.step),
          })
        },
        /** M3: consume one agent signal; never touches the Agent. */
        handleSignal(signal) {
          if (signal === undefined) return
          if (signal.type === 'agent:approval_enter') {
            addPause(`approval:${signal.key}`, true)
            return
          }
          if (signal.type === 'agent:approval_leave') {
            releasePause(`approval:${signal.key}`)
            return
          }
          if (signal.type === 'agent:step_advance') {
            addScore(5)
            return
          }
          if (signal.type === 'agent:task_finish') {
            const status = signal.detail === undefined ? '' : signal.detail.status
            if (status === 'success') {
              addScore(50)
              setNotice('success')
            } else if (status === 'aborted') {
              const reasonCode =
                signal.detail === undefined || signal.detail.reasonCode === undefined
                  ? ''
                  : signal.detail.reasonCode
              setNotice(reasonCode === 'unknown' ? 'unknown' : 'aborted')
            } else {
              setNotice('failed')
            }
          }
        },
        dispose() {
          clearTimer()
          clearTransientTimers()
          listeners.clear()
          subscribers = 0
          pauseReasons.clear()
          manualPaused = false
          resumeReason = ''
          resumeReady = false
          document.removeEventListener('visibilitychange', onVisibility)
        },
      }
    }

    /**
     * RT-04: store impls are created inside apply() (one lifetime per plugin
     * load) so a host re-apply always re-binds the `visibilitychange` listener
     * after a dispose. Module-level code holds forwarding objects; accessing
     * a store before apply() (tests, SSR) throws early instead of silently
     * using a stale impl.
     */
    let gameStoreImpl = null
    let gomokuStoreImpl = null

    const forwardStore = (implOf) =>
      new Proxy(
        {},
        {
          get(_target, prop) {
            const impl = implOf()
            if (impl === null) {
              throw new Error('[wait-buddy] store accessed outside apply() lifetime')
            }
            const value = impl[prop]
            return typeof value === 'function' ? value.bind(impl) : value
          },
        },
      )

    const gameStore = forwardStore(() => gameStoreImpl)

    /** Process-local signal hub; monitor sources publish, the game consumes. */
    const signalHub = createSignalHub()

    /**
     * One-key hide cycle (D29 §8.6, D31): normal ↔ quiet. Entering quiet
     * pauses the game via the `hidden` reason; returning to normal releases it
     * (the round stays paused, manual-resume).
     */
