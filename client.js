/**
 * WaitBuddy — Client half.
 *
 * Registers the `WaitBuddy` entry in the Conversation View slot (the per-session
 * view tab bar next to Chat / Trajectory) and renders the M1 status board.
 *
 * Data path:
 *   Host projection `waitbuddy` (durable log fold)  ─┐
 *   ctx.uiSession.sessionStatus (running + pending) ─┼─> createMonitorSource()
 *   ctx.sessions binding (session snapshot)         ─┘        │
 *                                                             ▼
 *                                                    <WaitBuddyView>
 *
 * The panel is strictly read-only: it never answers an approval, never cancels
 * or steers a turn, and never blocks the native approval dialog.
 */
window.__ModuleLoader__.load({
  id: 'dsh-wait-buddy',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Locale namespace owned by this plugin. */
    const NS = 'waitBuddy'

    /** Simplified Chinese dictionary — the key-set source of truth. */
    const zh = {
      'view.label': 'WaitBuddy',
      'status.idle': '空闲 · 等待本会话任务',
      'status.runningStart': '任务开始，Agent 正在规划',
      'status.running': '正在执行任务',
      'status.approval': '【重要】等待你审批工具调用！',
      'status.success': '任务执行成功 ✅',
      'status.failed': '任务执行失败',
      'status.aborted': '任务已中断',
      'status.loading': '正在读取监控数据…',
      'status.degraded': '监控数据不可用',
      'status.stale': '状态同步中断（可能已断开）',
      'status.endedUnknown': '本轮已结束（未知原因）',
      'status.steps': '已完成 {count} 步',
      'status.openChat': '查看对话',
      'status.updated': '更新于 {time}',
      'feed.command': '命令',
      'feed.tool': '工具',
      'feed.empty': '等待 Agent 活动',
      'alert.approval.title': '【重要】等待你审批工具调用',
      'alert.approval.tool': '工具 {tool}',
      'alert.failed.title': '任务执行失败',
      'footer.line': '仅跟踪当前会话 · 游戏与任务独立 · 辅助提醒，不拦截原生审批弹窗',
      'game.title': '贪吃蛇',
      'game.score': '得分 {score}',
      'game.best': '最高 {best}',
      'game.pause': '暂停',
      'game.resume': '继续',
      'game.reset': '重置',
      'game.startBody': '方向键控制，吃到果实得分。',
      'game.start': '开始游戏',
      'game.pausedTitle': '已暂停',
      'game.approvalPausedTitle': '等待审批',
      'game.approvalPausedBody': 'Agent 等待审批，已自动暂停',
      'game.resumeReadyBody': '已处理，按空格或点击继续',
      'game.sessionPausedBody': '切换会话后已暂停，点击继续恢复',
      'game.manualPausedBody': '已手动暂停，点击继续恢复',
      'game.viewPausedBody': '视图切换后已暂停，点击继续恢复',
      'game.reward': '+{amount}',
      'game.notice.success': '任务完成！+50 分',
      'game.notice.failed': '任务失败',
      'game.notice.aborted': '任务已中断',
      'game.notice.unknown': '本轮已结束',
      'game.overTitle': '游戏结束',
      'game.overBody': '本局得分 {score}',
      'game.again': '再来一局',
      'game.canvasLabel': '贪吃蛇游戏区域，当前得分 {score}',
      'game.hint': '方向键控制，点棋盘后生效',
      'gomoku.title': '五子棋',
      'game.speed': '速度',
      'speed.slow': '慢',
      'speed.normal': '标准',
      'speed.fast': '快',
      'gomoku.level': '难度',
      'level.easy': '初级',
      'level.medium': '中级',
      'level.hard': '高级',
      'gomoku.moves': '你 {you} 手 · 电脑 {ai} 手',
      'gomoku.hint': '点击交叉点落子',
      'gomoku.canvasLabel': '五子棋棋盘，已下 {moves} 手',
      'gomoku.won': '你赢了',
      'gomoku.lost': '电脑赢了',
      'gomoku.draw': '平局',
      'gomoku.again': '再来一局',
    }

    /** English dictionary, complete against the Chinese key set. */
    const en = {
      'view.label': 'WaitBuddy',
      'status.idle': 'Idle · waiting for a task in this session',
      'status.runningStart': 'Task started, the agent is planning',
      'status.running': 'Running the task',
      'status.approval': 'Important: a tool call is waiting for your approval!',
      'status.success': 'Task finished successfully ✅',
      'status.failed': 'Task failed',
      'status.aborted': 'Task was interrupted',
      'status.loading': 'Loading monitoring data…',
      'status.degraded': 'Monitoring data unavailable',
      'status.stale': 'Status sync interrupted (possibly disconnected)',
      'status.endedUnknown': 'Turn ended (unknown reason)',
      'status.steps': '{count} steps completed',
      'status.openChat': 'Open chat',
      'status.updated': 'Updated {time}',
      'feed.command': 'Command',
      'feed.tool': 'Tool',
      'feed.empty': 'Waiting for agent activity',
      'alert.approval.title': 'Important: a tool call is waiting for your approval',
      'alert.approval.tool': 'tool {tool}',
      'alert.failed.title': 'Task failed',
      'footer.line': 'This session only · the game is independent · a secondary reminder that never intercepts the native approval dialog',
      'game.title': 'Snake',
      'game.score': 'Score {score}',
      'game.best': 'Best {best}',
      'game.pause': 'Pause',
      'game.resume': 'Resume',
      'game.reset': 'Reset',
      'game.startBody': 'Arrow keys only — eat the fruit to score.',
      'game.start': 'Start game',
      'game.pausedTitle': 'Paused',
      'game.approvalPausedTitle': 'Waiting for approval',
      'game.approvalPausedBody': 'The agent is waiting for approval; the game is paused.',
      'game.resumeReadyBody': 'Handled — press Space or click Resume to continue.',
      'game.sessionPausedBody': 'Session changed — the game is paused. Resume when ready.',
      'game.manualPausedBody': 'Paused manually. Resume when ready.',
      'game.viewPausedBody': 'View changed — the game is paused. Resume when ready.',
      'game.reward': '+{amount}',
      'game.notice.success': 'Task complete! +50 points',
      'game.notice.failed': 'Task failed',
      'game.notice.aborted': 'Task interrupted',
      'game.notice.unknown': 'Turn ended',
      'game.overTitle': 'Game over',
      'game.overBody': 'Score {score}',
      'game.again': 'Play again',
      'game.canvasLabel': 'Snake board, current score {score}',
      'game.hint': 'Arrow keys only — click the board once to enable',
      'gomoku.title': 'Gomoku',
      'game.speed': 'Speed',
      'speed.slow': 'Slow',
      'speed.normal': 'Normal',
      'speed.fast': 'Fast',
      'gomoku.level': 'Level',
      'level.easy': 'Easy',
      'level.medium': 'Medium',
      'level.hard': 'Hard',
      'gomoku.moves': 'You {you} · AI {ai}',
      'gomoku.hint': 'Click an intersection to place a stone',
      'gomoku.canvasLabel': 'Gomoku board, {moves} stones placed',
      'gomoku.won': 'You win',
      'gomoku.lost': 'The AI wins',
      'gomoku.draw': 'Draw',
      'gomoku.again': 'Play again',
    }

    /** Neutral state before any projection arrives. */
    /** Stable empty feed so unchanged snapshots keep the same reference. */
    const EMPTY_ACTIVITY = []

    const EMPTY_STATE = {
      status: 'idle',
      running: false,
      stepCount: 0,
      turn: 0,
      errorMessage: '',
      activity: EMPTY_ACTIVITY,
      updatedAt: 0,
      revision: 0,
      approvalTool: '',
      pendingKind: '',
      pendingKey: '',
      health: 'loading',
      isAlerting: false,
      ready: false,
    }

    /** Compare two monitor snapshots by value. */
    function sameMonitor(left, right) {
      return (
        left.status === right.status &&
        left.running === right.running &&
        left.stepCount === right.stepCount &&
        left.turn === right.turn &&
        left.activity === right.activity &&
        left.errorMessage === right.errorMessage &&
        left.updatedAt === right.updatedAt &&
        left.revision === right.revision &&
        left.approvalTool === right.approvalTool &&
        left.pendingKind === right.pendingKind &&
        left.pendingKey === right.pendingKey &&
        left.health === right.health &&
        left.isAlerting === right.isAlerting &&
        left.ready === right.ready
      )
    }

    /** Client root context captured at apply time; the view renders inside it. */
    let clientCtx = null

    /** Locale-bound translator captured at apply time (fallback for the slot's `t`). */
    let boundT = (key) => key


    /**
     * Pure state reconciliation between the durable Host projection and the
     * process-local session status. `status` stays within the M0 six-value
     * enum; `health` / `pendingKind` / `pendingKey` are client-only metadata.
     */
    function composeMonitor(input) {
      const durable = input.durable
      const live = input.status
      const session = input.session
      const pending = input.pending
      const now = input.now
      const mountedAt = input.mountedAt
      const mismatchSince = input.mismatchSince
      const projectionError = input.projectionError === true
      const ready = durable !== undefined
      const base = ready ? durable : EMPTY_STATE
      const approval =
        pending !== undefined && pending !== null && pending.kind === 'approval' ? pending : undefined
      const liveRunning =
        live !== undefined && live.running !== undefined
          ? live.running
          : session === undefined
            ? undefined
            : session.running
      const running = liveRunning === true

      let health = 'ready'
      if (!ready) {
        health = now - mountedAt < 1500 && !projectionError ? 'loading' : 'degraded'
      } else if (liveRunning === false && base.status === 'running') {
        health =
          mismatchSince !== undefined && mismatchSince !== null && now - mismatchSince >= 5000
            ? 'stale'
            : 'ready'
      }

      let nextStatus = base.status
      if (approval !== undefined) nextStatus = 'pending_approval'
      else if (running) nextStatus = 'running'

      return {
        status: nextStatus,
        health,
        running,
        stepCount: base.stepCount === undefined ? 0 : base.stepCount,
        turn: base.turn === undefined ? 0 : base.turn,
        errorMessage: base.errorMessage === undefined ? '' : base.errorMessage,
        activity: Array.isArray(base.activity) ? base.activity : EMPTY_ACTIVITY,
        updatedAt: base.updatedAt === undefined ? 0 : base.updatedAt,
        revision: base.revision === undefined ? 0 : base.revision,
        approvalTool:
          approval !== undefined && typeof approval.toolName === 'string' ? approval.toolName : '',
        pendingKind: approval === undefined ? '' : 'approval',
        pendingKey:
          approval !== undefined && typeof approval.key === 'string' ? approval.key : '',
        isAlerting: nextStatus === 'pending_approval' || nextStatus === 'failed',
        ready,
      }
    }

    /** Bound on remembered signal keys; enough for one long turn's steps. */
    const SIGNAL_SEEN_LIMIT = 500

    /**
     * Client-only signal hub. Monitor sources publish; game runtimes consume.
     * Dedupe is global so two views of the same session cannot double-reward.
     */
    function createSignalHub() {
      const listeners = new Set()
      const seen = new Set()
      return {
        emit(signal) {
          const identity = `${signal.type}:${signal.sessionId}:${signal.key}`
          if (seen.has(identity)) return
          seen.add(identity)
          if (seen.size > SIGNAL_SEEN_LIMIT) {
            const oldest = seen.values().next().value
            if (oldest !== undefined) seen.delete(oldest)
          }
          for (const listener of [...listeners]) {
            try {
              listener(signal)
            } catch (error) {
              console.error('[wait-buddy] signal listener failed', error)
            }
          }
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        dispose() {
          listeners.clear()
          seen.clear()
        },
      }
    }

    /**
     * Pure edge detection between two monitor snapshots. The first ready
     * snapshot is a baseline: only a currently-pending approval is emitted
     * (so opening the view during an approval still pauses the game), never
     * historical task/step/finish signals.
     */
    function diffMonitorSignals(previous, next, meta) {
      const sessionId = meta.sessionId
      const at = typeof meta.at === 'number' ? meta.at : Date.now()
      const baseline = meta.baseline === true || (!previous.ready && next.ready)
      const make = (type, key, detail) => ({ type, sessionId, key, at, detail: detail === undefined ? {} : detail })
      const approvalDetail = {
        kind: next.pendingKind,
        tool: next.approvalTool,
      }
      if (baseline) {
        if (next.pendingKey === '') return []
        return [make('agent:approval_enter', next.pendingKey, approvalDetail)]
      }
      if (!next.ready && next.pendingKey === '' && previous.pendingKey === '') return []

      const signals = []
      if (previous.pendingKey !== next.pendingKey) {
        if (previous.pendingKey !== '') {
          signals.push(make('agent:approval_leave', previous.pendingKey, { kind: previous.pendingKind }))
        }
        if (next.pendingKey !== '') {
          signals.push(make('agent:approval_enter', next.pendingKey, approvalDetail))
        }
      }

      const startedFromIdle =
        next.status === 'running' && previous.status === 'idle' && next.turn === previous.turn
      if (next.turn > previous.turn || startedFromIdle) {
        signals.push(make('agent:task_start', String(next.turn), { turn: next.turn }))
      }

      if (next.stepCount > previous.stepCount) {
        signals.push(
          make('agent:step_advance', `${next.turn}:${next.stepCount}`, {
            delta: next.stepCount - previous.stepCount,
            stepCount: next.stepCount,
          }),
        )
      }

      const terminal =
        next.status === 'success' || next.status === 'failed' || next.status === 'aborted'
      if (terminal && next.status !== previous.status) {
        signals.push(
          make('agent:task_finish', `${next.turn}:${next.status}`, {
            status: next.status,
            reasonKind: next.errorMessage,
          }),
        )
      }
      return signals
    }

    /**
     * Merge the durable projection with the process-local pending-interaction
     * state into the single TrackState the view renders.
     * @param ctx - client root context.
     * @param sessionId - the session this view instance is bound to.
     */
    function createMonitorSource(ctx, sessionId, signalHub) {
      let snapshot = { ...EMPTY_STATE }
      const listeners = new Set()
      let subscribers = 0
      let disposers = []
      let mountedAt = Date.now()
      let mismatchSince = null
      let projectionError = false
      let healthTimer = null
      let refreshRequested = false
      let hasBaseline = false

      const bindingOf = () => ctx.sessions.binding(sessionId)

      const readDurable = () => {
        const binding = bindingOf()
        if (binding === undefined) return undefined
        const face = binding.session.projections.faceOf('waitbuddy')
        return face === undefined ? undefined : face.getSnapshot()
      }

      const readSessionStatus = () => {
        const uiSession = ctx.get('uiSession')
        const source = uiSession === undefined ? undefined : uiSession.sessionStatus
        return source === undefined ? undefined : source.getSnapshot().get(sessionId)
      }

      const readSession = () => {
        const binding = bindingOf()
        return binding === undefined ? undefined : binding.session.getSnapshot()
      }

      const compose = () => {
        const durable = readDurable()
        const live = readSessionStatus()
        const session = readSession()
        const pending = live === undefined ? undefined : live.pendingInteraction
        const liveRunning =
          live !== undefined && live.running !== undefined
            ? live.running
            : session === undefined
              ? undefined
              : session.running
        if (durable !== undefined && durable.status === 'running' && liveRunning === false) {
          if (mismatchSince === null) mismatchSince = Date.now()
        } else {
          mismatchSince = null
        }
        return composeMonitor({
          durable,
          status: live,
          session,
          pending,
          now: Date.now(),
          mountedAt,
          mismatchSince,
          projectionError,
        })
      }

      const publish = (next) => {
        if (sameMonitor(snapshot, next)) return
        const previous = snapshot
        snapshot = next
        for (const listener of [...listeners]) listener()
        if (signalHub !== undefined) {
          const signals = diffMonitorSignals(previous, next, {
            sessionId,
            baseline: !hasBaseline,
          })
          hasBaseline = true
          for (const signal of signals) signalHub.emit(signal)
        }
      }

      const clearHealthTimer = () => {
        if (healthTimer !== null) {
          clearTimeout(healthTimer)
          healthTimer = null
        }
      }

      const scheduleHealth = (next) => {
        clearHealthTimer()
        const now = Date.now()
        let delay = null
        if (next.health === 'loading') delay = Math.max(0, 1500 - (now - mountedAt))
        else if (next.health === 'ready' && mismatchSince !== null) {
          delay = Math.max(0, 5000 - (now - mismatchSince))
        }
        if (delay === null) return
        healthTimer = setTimeout(() => {
          healthTimer = null
          refresh()
        }, delay)
      }

      const refresh = () => {
        const next = compose()
        publish(next)
        scheduleHealth(next)
      }

      /** Ask the controller once for a fresh projection read when the key is still missing. */
      const ensureProjection = () => {
        if (refreshRequested || readDurable() !== undefined) return
        refreshRequested = true
        const failed = (error) => {
          projectionError = true
          refresh()
          console.error('[wait-buddy] projection refresh failed', error)
        }
        try {
          const pending = ctx.sessions.refreshProjections(sessionId)
          if (pending !== undefined && typeof pending.then === 'function') {
            Promise.resolve(pending)
              .then(() => {
                projectionError = false
                refresh()
              })
              .catch(failed)
          }
        } catch (error) {
          failed(error)
        }
      }

      const start = () => {
        mountedAt = Date.now()
        mismatchSince = null
        projectionError = false
        refreshRequested = false
        hasBaseline = false
        ensureProjection()
        const disposersNext = []
        const binding = bindingOf()
        if (binding !== undefined) {
          const face = binding.session.projections.faceOf('waitbuddy')
          if (face !== undefined) disposersNext.push(face.subscribe(refresh))
          disposersNext.push(binding.session.subscribe(refresh))
        }
        const uiSession = ctx.get('uiSession')
        if (uiSession !== undefined && uiSession.sessionStatus !== undefined) {
          disposersNext.push(uiSession.sessionStatus.subscribe(refresh))
        }
        disposers = disposersNext
        refresh()
      }

      const stop = () => {
        clearHealthTimer()
        for (const dispose of disposers) {
          try {
            dispose()
          } catch (error) {
            console.error('[wait-buddy] monitor unsubscribe failed', error)
          }
        }
        disposers = []
      }

      return {
        getSnapshot: () => snapshot,
        subscribe(listener) {
          listeners.add(listener)
          if (subscribers === 0) start()
          subscribers += 1
          return () => {
            listeners.delete(listener)
            subscribers -= 1
            if (subscribers === 0) stop()
          }
        },
      }
    }

    /** Locale keys for the activity kinds (kept literal so doc/code checks can see them). */
    const FEED_LABEL = {
      command: 'feed.command',
      tool: 'feed.tool',
    }

    /** Status line copy for one monitor state. */
    function statusText(t, state) {
      // Approval/failure are the highest-priority copy; health never hides them.
      if (state.status !== 'pending_approval' && state.status !== 'failed') {
        if (state.health === 'loading') return t('status.loading')
        if (state.health === 'degraded') return t('status.degraded')
        if (state.health === 'stale') return t('status.stale')
      }
      switch (state.status) {
        case 'running':
          return state.activity.length > 0 ? t('status.running') : t('status.runningStart')
        case 'pending_approval':
          return t('status.approval')
        case 'success':
          return t('status.success')
        case 'failed':
          return t('status.failed')
        case 'aborted':
          return state.errorMessage === '' ? t('status.aborted') : t('status.endedUnknown')
        default:
          return t('status.idle')
      }
    }

    /** Right-hand meta: last observed time + real step count (M0 §6). */
    function metaText(t, state) {
      const parts = []
      if (state.updatedAt > 0) parts.push(t('status.updated', { time: clockOf(state.updatedAt) }))
      if (state.stepCount > 0) parts.push(t('status.steps', { count: state.stepCount }))
      return parts.join(' · ')
    }

    /** Clock label for the last observed event. */
    function clockOf(time) {
      const date = new Date(time)
      const pad = (value) => String(value).padStart(2, '0')
      return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    }

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
        if (pauseReasons.has('view-inactive')) return 'view-inactive'
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
        set({ ...state, pauseReason: reasonLabel(), resumeReason, resumeReady })
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
        set({ ...state, status: 'running', pauseReason: '', resumeReason: '', resumeReady: false })
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
        if (document.hidden) addPause('hidden', false)
        else releasePause('hidden')
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
              const reasonKind =
                signal.detail === undefined || signal.detail.reasonKind === undefined
                  ? ''
                  : signal.detail.reasonKind
              setNotice(reasonKind === '' ? 'aborted' : 'unknown')
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

    const gameStore = createGameStore()

    /** Process-local signal hub; monitor sources publish, the game consumes. */
    const signalHub = createSignalHub()

    /** Logical 324x324 board drawn into a 2x backing store for crisp edges. */
    function drawGame(canvas, state) {
      if (canvas === null || canvas === undefined) return
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (width === 0 || height === 0) return
      const ctx = canvas.getContext('2d')
      if (ctx === null) return

      const backingW = Math.round(width * 2)
      const backingH = Math.round(height * 2)
      if (canvas.width !== backingW || canvas.height !== backingH) {
        canvas.width = backingW
        canvas.height = backingH
      }
      ctx.setTransform(2, 0, 0, 2, 0, 0)
      ctx.clearRect(0, 0, width, height)

      ctx.fillStyle = '#0d1624'
      ctx.fillRect(0, 0, width, height)

      const cellW = width / state.cols
      const cellH = height / state.rows

      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      for (let y = 1; y < state.rows; y += 1) {
        for (let x = 1; x < state.cols; x += 1) {
          ctx.fillRect(x * cellW - 1, y * cellH - 1, 2, 2)
        }
      }

      const unit = Math.min(cellW, cellH)

      if (state.food !== null) {
        const fx = state.food.x * cellW + cellW / 2
        const fy = state.food.y * cellH + cellH / 2
        ctx.beginPath()
        ctx.arc(fx, fy, unit * 0.42, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(246,196,83,0.35)'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(fx, fy, unit * 0.27, 0, Math.PI * 2)
        ctx.fillStyle = '#f6c453'
        ctx.fill()
      }

      state.snake.forEach((segment, index) => {
        const insetX = Math.min(2, cellW * 0.12)
        const insetY = Math.min(2, cellH * 0.12)
        ctx.fillStyle =
          index === 0
            ? '#8ef7b0'
            : `rgba(63,206,122,${Math.max(0.45, 0.9 - index * 0.04)})`
        ctx.fillRect(
          segment.x * cellW + insetX,
          segment.y * cellH + insetY,
          cellW - insetX * 2,
          cellH - insetY * 2,
        )
      })

      const head = state.snake[0]
      const vector = DIR_VECTORS[state.dir]
      const hx = head.x * cellW + cellW / 2 + vector.x * unit * 0.14
      const hy = head.y * cellH + cellH / 2 + vector.y * unit * 0.14
      const px = -vector.y
      const py = vector.x
      const eye = Math.max(1.2, unit * 0.09)
      ctx.fillStyle = '#06240f'
      ctx.beginPath()
      ctx.arc(hx + px * unit * 0.18, hy + py * unit * 0.18, eye, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(hx - px * unit * 0.18, hy - py * unit * 0.18, eye, 0, Math.PI * 2)
      ctx.fill()
    }

    /** Arrow keys act only while focus is inside this view, so the composer keeps its keys. */
    function onGameKeyDown(event) {
      if (modeStore.getSnapshot() !== 'snake') return
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target
      if (
        target !== null &&
        target !== undefined &&
        typeof target.closest === 'function' &&
        target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]') !== null
      ) {
        return
      }
      if (event.key === ' ' || event.key === 'Spacebar') {
        if (
          target !== null &&
          target !== undefined &&
          typeof target.closest === 'function' &&
          target.closest('button, a[href], [role="button"]') !== null
        ) {
          return
        }
        event.preventDefault()
        gameStore.togglePause()
        return
      }
      const dir = ARROW_DIRECTIONS[event.key]
      if (dir === undefined) return
      event.preventDefault()
      gameStore.turn(dir)
    }

    /** Centred overlay shown whenever the round is not running. */
    function gameOverlay(t, state, focusRoot) {
      if (state.pauseReason === 'approval') {
        return h(
          'div',
          { className: 'wb-overlay' },
          h('div', { className: 'wb-overlayTitle' }, t('game.approvalPausedTitle')),
          h('div', { className: 'wb-overlayBody' }, t('game.approvalPausedBody')),
          h(
            'button',
            {
              type: 'button',
              className: 'wb-btn wb-btnPrimary',
              disabled: true,
            },
            t('game.resume'),
          ),
        )
      }
      if (state.status === 'idle') {
        return h(
          'div',
          { className: 'wb-overlay' },
          h('div', { className: 'wb-overlayBody' }, t('game.startBody')),
          h(
            'button',
            {
              type: 'button',
              className: 'wb-btn wb-btnPrimary',
              onClick: () => {
                gameStore.start(settingsStore.getSnapshot().speed)
                focusRoot()
              },
            },
            t('game.start'),
          ),
        )
      }
      if (state.status === 'paused') {
        const waiting = state.pauseReason === 'approval'
        const body =
          state.pauseReason === 'approval'
            ? t('game.approvalPausedBody')
            : state.pauseReason === 'session-switch'
              ? t('game.sessionPausedBody')
              : state.pauseReason === 'view-inactive'
                ? t('game.viewPausedBody')
                : state.pauseReason === 'manual'
                  ? t('game.manualPausedBody')
                  : state.resumeReason === 'approval' && state.resumeReady
                    ? t('game.resumeReadyBody')
                    : null
        return h(
          'div',
          { className: 'wb-overlay' },
          h('div', { className: 'wb-overlayTitle' }, waiting ? t('game.approvalPausedTitle') : t('game.pausedTitle')),
          body === null ? null : h('div', { className: 'wb-overlayBody' }, body),
          h(
            'button',
            {
              type: 'button',
              className: 'wb-btn wb-btnPrimary',
              disabled: waiting,
              onClick: () => {
                gameStore.togglePause()
                focusRoot()
              },
            },
            t('game.resume'),
          ),
        )
      }
      if (state.status === 'over') {
        return h(
          'div',
          { className: 'wb-overlay' },
          h('div', { className: 'wb-overlayTitle' }, t('game.overTitle')),
          h('div', { className: 'wb-overlayBody' }, t('game.overBody', { score: state.score })),
          h(
            'button',
            {
              type: 'button',
              className: 'wb-btn wb-btnPrimary',
              onClick: () => {
                gameStore.start(settingsStore.getSnapshot().speed)
                focusRoot()
              },
            },
            t('game.again'),
          ),
        )
      }
      return null
    }

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
      hard: { radius: 3, defense: 1.15, top: 1, doubleBonus: 800 },
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

    /** Win now, usually block now, otherwise the best weighted point for the level. */
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

    const gomokuStore = createGomokuStore()

    const SETTINGS_KEY = 'dsh-wait-buddy.settings.v1'
    const DEFAULT_SETTINGS = { speed: 'normal', level: 'medium' }
    const SPEED_LABEL = { slow: 'speed.slow', normal: 'speed.normal', fast: 'speed.fast' }
    const LEVEL_LABEL = { easy: 'level.easy', medium: 'level.medium', hard: 'level.hard' }

    /** Player preferences; corrupt or unavailable storage falls back to defaults. */
    function readSettings() {
      try {
        const raw = window.localStorage.getItem(SETTINGS_KEY)
        if (raw === null) return { ...DEFAULT_SETTINGS }
        const parsed = JSON.parse(raw)
        return {
          speed: SPEED_PRESETS[parsed.speed] === undefined ? DEFAULT_SETTINGS.speed : parsed.speed,
          level: LEVEL_PRESETS[parsed.level] === undefined ? DEFAULT_SETTINGS.level : parsed.level,
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
      }
    }

    const settingsStore = createSettingsStore()

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
    function GameArea({ t, sessionId, focusRoot }) {
      const canvasRef = React.useRef(null)
      const boardRef = React.useRef(null)
      const gomokuCanvasRef = React.useRef(null)
      const lastSession = React.useRef(sessionId)
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

      React.useEffect(() => {
        if (mode !== 'snake') return
        drawGame(canvasRef.current, snake)
      }, [mode, snake])
      React.useEffect(() => {
        if (mode !== 'gomoku') return
        drawGomoku(gomokuCanvasRef.current, gomoku)
      }, [mode, gomoku])
      React.useEffect(() => {
        if (mode !== 'snake') return undefined
        const element = boardRef.current
        if (element === null) return undefined
        const measure = () => {
          const rect = element.getBoundingClientRect()
          if (rect.width < 60 || rect.height < 60) return
          const grid = gridFor(rect.width, rect.height)
          gameStore.setGrid(grid.cols, grid.rows)
        }
        measure()
        if (typeof ResizeObserver !== 'function') return undefined
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
      }, [mode])

      React.useEffect(() => {
        if (mode !== 'gomoku') return undefined
        const element = boardRef.current
        if (element === null) return undefined
        const measure = () => drawGomoku(gomokuCanvasRef.current, gomokuStore.getSnapshot())
        measure()
        if (typeof ResizeObserver !== 'function') return undefined
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
      }, [mode])

      const switchMode = (next) => {
        if (next === mode) return
        modeStore.set(next)
        if (next === 'gomoku') gameStore.pause()
        focusRoot()
      }

      const segButton = (label, key, active, onPick) =>
        h(
          'button',
          {
            key,
            type: 'button',
            className: 'wb-segBtn',
            'data-active': active ? 'true' : 'false',
            onClick: onPick,
          },
          label,
        )

      const settingButtons = (labels, activeId, onPick) =>
        Object.keys(labels).map((id) =>
          segButton(t(labels[id]), id, activeId === id, () => onPick(id)),
        )

      const setting =
        mode === 'snake'
          ? h(
              'div',
              { className: 'wb-setting' },
              h('span', { className: 'wb-settingLabel' }, t('game.speed')),
              h(
                'div',
                { className: 'wb-seg' },
                settingButtons(SPEED_LABEL, settings.speed, (id) => {
                  settingsStore.setSpeed(id)
                  gameStore.setSpeed(id)
                }),
              ),
            )
          : h(
              'div',
              { className: 'wb-setting' },
              h('span', { className: 'wb-settingLabel' }, t('gomoku.level')),
              h(
                'div',
                { className: 'wb-seg' },
                settingButtons(LEVEL_LABEL, settings.level, (id) => settingsStore.setLevel(id)),
              ),
            )

      const board =
        mode === 'snake'
          ? h(
              'div',
              { className: 'wb-boardWrap', tabIndex: 0, ref: boardRef },
              h('canvas', {
                ref: canvasRef,
                className: 'wb-board',
                role: 'img',
                'aria-label': t('game.canvasLabel', { score: snake.score }),
              }),
              gameOverlay(t, snake, focusRoot),
              snake.reward === null
                ? null
                : h(
                    'div',
                    { key: `reward-${snake.reward.id}`, className: 'wb-reward', 'aria-hidden': true },
                    t('game.reward', { amount: snake.reward.amount }),
                  ),
              snake.notice === null
                ? null
                : h(
                    'div',
                    { key: `notice-${snake.notice.id}`, className: 'wb-notice', role: 'status' },
                    t(`game.notice.${snake.notice.kind}`),
                  ),
            )
          : h(
              'div',
              { className: 'wb-boardWrap wb-squareBoard', tabIndex: 0, ref: boardRef },
              h('canvas', {
                ref: gomokuCanvasRef,
                className: 'wb-board',
                role: 'img',
                'aria-label': t('gomoku.canvasLabel', { moves: gomoku.moves }),
                onClick: (event) => {
                  if (gomokuCanvasRef.current === null) return
                  const index = gomokuPointAt(gomokuCanvasRef.current, event.clientX, event.clientY)
                  if (index >= 0) gomokuStore.place(index, settingsStore.getSnapshot().level)
                },
              }),
              gomokuOverlay(t, gomoku, focusRoot),
            )

      const controls =
        mode === 'snake'
          ? h(
              React.Fragment,
              null,
              h(
                'div',
                { className: 'wb-caption' },
                `${t('game.score', { score: snake.score })} · ${t('game.best', { best: snake.best })}`,
              ),
              h(
                'div',
                { className: 'wb-gameActions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'wb-btn',
                    disabled:
                      snake.status === 'idle' ||
                      snake.status === 'over' ||
                      snake.pauseReason === 'approval',
                    onClick: () => gameStore.togglePause(),
                  },
                  snake.status === 'running' ? t('game.pause') : t('game.resume'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'wb-btn',
                    onClick: () => gameStore.reset(settingsStore.getSnapshot().speed),
                  },
                  t('game.reset'),
                ),
              ),
              h('div', { className: 'wb-hint' }, t('game.hint')),
            )
          : h(
              React.Fragment,
              null,
              h(
                'div',
                { className: 'wb-caption' },
                t('gomoku.moves', {
                  you: Math.ceil(gomoku.moves / 2),
                  ai: Math.floor(gomoku.moves / 2),
                }),
              ),
              h(
                'div',
                { className: 'wb-gameActions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'wb-btn',
                    onClick: () => gomokuStore.reset(),
                  },
                  t('game.reset'),
                ),
              ),
              h('div', { className: 'wb-hint' }, t('gomoku.hint')),
            )

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
            segButton(t('game.title'), 'snake', mode === 'snake', () => switchMode('snake')),
            segButton(t('gomoku.title'), 'gomoku', mode === 'gomoku', () => switchMode('gomoku')),
          ),
          setting,
          controls,
        ),
      )
    }

    /** One alert banner; the native approval dialog always keeps precedence. */    /** One alert banner; the native approval dialog always keeps precedence. */
    function AlertBanner({ t, state }) {
      if (state.status === 'pending_approval') {
        return h(
          'div',
          { className: 'wb-alert', 'data-kind': 'approval', role: 'alert' },
          h('span', { className: 'wb-alertTitle' }, t('alert.approval.title')),
          state.approvalTool === ''
            ? null
            : h(
                'span',
                { className: 'wb-alertMeta', title: state.approvalTool },
                t('alert.approval.tool', { tool: state.approvalTool }),
              ),
        )
      }
      if (state.status === 'failed') {
        return h(
          'div',
          { className: 'wb-alert', 'data-kind': 'failed', role: 'alert' },
          h('span', { className: 'wb-alertTitle' }, t('alert.failed.title')),
          state.errorMessage === ''
            ? null
            : h('span', { className: 'wb-alertMeta', title: state.errorMessage }, state.errorMessage),
        )
      }
      return null
    }

const CSS = `
.wb-root{box-sizing:border-box;width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;container-type:inline-size;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}
.wb-root:focus{outline:none}
.wb-root:focus-visible .wb-boardWrap,.wb-boardWrap:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.wb-boardWrap:focus{outline:none}
.wb-inner{box-sizing:border-box;width:100%;flex:1 1 auto;min-height:0;overflow:auto;padding:10px 24px 56px;display:flex;flex-direction:column;gap:16px}
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
@container (max-width:480px){.wb-inner{padding:8px 12px 56px}.wb-top{gap:12px}.wb-status{min-width:0}.wb-setting{display:none}.wb-hint{display:none}.wb-caption{font-size:13px}.wb-gameFoot{gap:10px}.wb-alert{padding:8px 10px;margin:12px 12px 0}.wb-statusText{overflow-wrap:anywhere}}
`

    /** WaitBuddy status board (M1: monitoring only, no game). */
    function useMonitorState(sessionId, initialState) {
      const [state, setState] = React.useState(() =>
        initialState === undefined ? { ...EMPTY_STATE } : initialState,
      )
      React.useEffect(() => {
        if (initialState !== undefined) return undefined
        if (clientCtx === null) return undefined
        const source = createMonitorSource(clientCtx, sessionId, signalHub)
        const sync = () => setState(source.getSnapshot())
        sync()
        return source.subscribe(sync)
      }, [sessionId])
      return state
    }

    function WaitBuddyView(props) {
      const t = typeof props.t === 'function' ? props.t : boundT
      const rootRef = React.useRef(null)
      const innerRef = React.useRef(null)
      React.useEffect(() => {
        const scrollTop = () => {
          if (innerRef.current !== null) innerRef.current.scrollTop = 0
        }
        scrollTop()
        const root = rootRef.current
        let visible = true
        let observer
        if (root !== null && typeof IntersectionObserver === 'function') {
          observer = new IntersectionObserver(
            (entries) => {
              const next = entries[0] !== undefined && entries[0].isIntersecting
              if (next && !visible) scrollTop()
              visible = next
            },
            { threshold: 0.01 },
          )
          observer.observe(root)
        }
        const onVisibility = () => {
          if (!document.hidden) scrollTop()
        }
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
          if (observer !== undefined) observer.disconnect()
          document.removeEventListener('visibilitychange', onVisibility)
        }
      }, [props.sessionId])
      const focusRoot = () => {
        if (rootRef.current !== null && typeof rootRef.current.focus === 'function') {
          rootRef.current.focus({ preventScroll: true })
        }
      }
      const state = useMonitorState(props.sessionId, props.__state)
      const status = state.status
      const meta = metaText(t, state)
      const canOpenChat = typeof props.openView === 'function'
      const finished = status === 'success' || status === 'failed' || status === 'aborted'
      const openChat = () => {
        try {
          props.openView('chat', '')
        } catch (error) {
          console.error('[wait-buddy] openView failed', error)
        }
      }

      return h(
        'div',
        {
          className: 'wb-root',
          'data-waitbuddy': status,
          'data-waitbuddy-health': state.health,
          tabIndex: 0,
          ref: rootRef,
          onKeyDown: onGameKeyDown,
        },
        h('style', { key: 'wb-style' }, CSS),
        h(AlertBanner, {
          key: state.pendingKey === '' ? `${state.status}:${state.updatedAt}` : state.pendingKey,
          t,
          state,
        }),
        h(
          'div',
          { className: 'wb-inner', ref: innerRef },
          h(
            'div',
            { className: 'wb-top' },
            h(
              'div',
              { className: 'wb-status' },
              h(
                'div',
                { className: 'wb-statusRow' },
                h('span', {
                  className: 'wb-dot',
                  'data-state': status,
                  'data-health': state.health,
                  'aria-hidden': true,
                }),
                h(
                  'span',
                  {
                    className: 'wb-statusText',
                    'aria-live': 'polite',
                    title: state.errorMessage === '' ? undefined : state.errorMessage,
                  },
                  statusText(t, state),
                ),
                meta === '' ? null : h('span', { className: 'wb-meta' }, meta),
                finished && canOpenChat
                  ? h(
                      'button',
                      { type: 'button', className: 'wb-btn wb-chatBtn', onClick: openChat },
                      t('status.openChat'),
                    )
                  : null,
              ),
              status === 'running' && state.health === 'ready'
                ? h(
                    'div',
                    { className: 'wb-pulse', 'aria-hidden': true },
                    h('div', { className: 'wb-pulseFill' }),
                  )
                : null,
              h('div', { className: 'wb-disclaimer' }, t('footer.line')),
            ),
            h(
              'div',
              { className: 'wb-feed', 'data-card': 'feed' },
              state.activity.length === 0
                ? h('div', { className: 'wb-feedEmpty' }, t('feed.empty'))
                : state.activity.map((item, index) =>
                    h(
                      'div',
                      { className: 'wb-feedRow', key: `${item.kind}-${index}` },
                      h(
                        'span',
                        { className: 'wb-feedKind', 'data-kind': item.kind },
                        t(FEED_LABEL[item.kind] || FEED_LABEL.tool),
                      ),
                      h('span', { className: 'wb-feedText', title: item.text }, item.text),
                    ),
                  ),
            ),
          ),
          h(GameArea, { t, sessionId: props.sessionId, focusRoot }),
        ),
      )
    }

    return {
      inject: ['slots', 'sessions', 'locale'],
      apply(ctx) {
        clientCtx = ctx
        ctx.effect(() => {
          const stopSignals = signalHub.subscribe((signal) => gameStore.handleSignal(signal))
          return () => {
            stopSignals()
            gameStore.dispose()
          }
        }, 'wait-buddy: game runtime')
        const t = ctx.locale.bind(NS)
        boundT = t
        ctx.effect(
          () =>
            ctx.locale.register(NS, {
              zh,
              en,
            }),
          'wait-buddy: dictionaries',
        )
        ctx.slots.inject('conversation.view', () =>
          ctx.slots.register(
            {
              name: 'conversation.view',
              id: 'waitbuddy',
              order: 20,
              label: () => t('view.label'),
              locale: NS,
            },
            WaitBuddyView,
          ),
        )
      },
      /** Pure monitor reconciliation, exported for unit testing. */
      __monitor: { composeMonitor, sameMonitor, createMonitorSource },
      /** Pure signal conversion, exported for unit testing. */
      __signals: { createSignalHub, diffMonitorSignals },
      /** Pure copy helpers, exported for unit testing. */
      __ui: { statusText, metaText },
      /** Static UI pieces + stylesheet, exported for component tests. */
      __components: { AlertBanner, gameOverlay, gomokuOverlay },
      __css: CSS,
      /** Full view, exported for static layout tests only. */
      __view: WaitBuddyView,
      __gameStore: gameStore,
      /** Pure game transitions, exported for unit testing (not used at runtime). */
      __game: {
        createGameStore,
        gridFor,
        SPEED_PRESETS,
        LEVEL_PRESETS,
        settingsStore,
        createGomokuState,
        placeGomoku,
        gomokuWins,
        gomokuAiMove,
        GOMOKU_SIZE,
        createGameState,
        startGame,
        turnGame,
        tickGame,
        pauseGame,
        resumeGame,
        resetGame,
        placeFood,
      },
    }
  },
})
