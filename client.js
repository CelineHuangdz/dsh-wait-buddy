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
 *
 * Layout (search anchors, top to bottom inside the factory):
 *   §1  Dictionaries (zh / en)            — `Simplified Chinese dictionary`
 *   §2  Monitor projection & signals      — `EMPTY_ACTIVITY`, `composeMonitor`,
 *                                           `createSignalHub`, `createMonitorSource`
 *   §3  Status copy & formatting          — `FEED_LABEL`, `statusText`, `clockOf`
 *   §4  Snake game core (M2)              — banner `M2: embedded Snake game`
 *   §5  Presence, settings, notifier      — `createPresenceStore`, `createNotifier`
 *   §6  Canvas drawing (snake + gomoku)   — `drawGame`
 *   §7  Input & game overlays             — `snakeSpaceAction`, `gameOverlay`
 *   §8  Gomoku (board + heuristic AI)     — banner `Gomoku (五子棋)`
 *   §9  Shared stores & UI components     — `GameArea`, `FloatGame`,
 *                                           `ViewMenuEntry`, `PresencePill`,
 *                                           `WaitBuddyView`
 *   §10 Module registration               — `inject: ['slots', 'sessions', 'locale']`
 *
 * Single-file note: the host loads exactly one client.js per plugin, so this
 * file intentionally stays one module. If it grows past ~4.5k lines or gains a
 * third game, introduce src/ + a concat build (see decisions D38) — not a
 * bundler.
 */
window.__ModuleLoader__.load({
  id: 'dsh-wait-buddy',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Locale namespace owned by this plugin. */
    const NS = 'waitBuddy'

    // ---------------------------------------------------------------------
    // §1 Dictionaries. The zh key set is the source of truth; en must match.
    // ---------------------------------------------------------------------
    /** Simplified Chinese dictionary — the key-set source of truth. */
    const zh = {
      'view.label': 'WaitBuddy',
      'view.openLabel': 'Open the WaitBuddy board',
      'view.openLabel': '打开 WaitBuddy 看板',
      'status.idle': '空闲 · 等待本会话任务',
      'status.runningStart': '任务开始，Agent 正在规划',
      'status.running': '正在执行任务',
      'status.approval': '【重要】等待你审批工具调用！',
      'status.question': '【重要】Agent 有问题等你回答！',
      'status.planReview': '【重要】Agent 的计划等你确认！',
      'status.pending': '【重要】Agent 在等你处理请求！',
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
      'alert.question.title': '【重要】Agent 有问题等你回答',
      'alert.planReview.title': '【重要】Agent 的计划等你确认',
      'alert.pending.title': '【重要】Agent 在等你处理请求',
      'alert.failed.title': '任务执行失败',
      'footer.line': '仅跟踪当前会话 · 游戏与任务独立 · 辅助提醒，不拦截原生弹窗',
      'game.title': '贪吃蛇',
      'game.score': '得分 {score}',
      'game.best': '最高 {best}',
      'game.reset': '重置',
      'game.startBody': '方向键控制，吃到果实得分。',
      'game.start': '开始游戏',
      'game.pausedTitle': '已暂停',
      'game.approvalPausedTitle': '等待审批',
      'game.approvalPausedBody': 'Agent 等待审批，已自动暂停',
      'game.questionPausedTitle': '等待你的回答',
      'game.questionPausedBody': 'Agent 有问题等你回答，已自动暂停',
      'game.planPausedTitle': '等待计划确认',
      'game.planPausedBody': 'Agent 提交了计划等你确认，已自动暂停',
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
      'game.hint': '方向键控制，点棋盘后生效；空格 开始/暂停/继续',
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
      // 低调模式（D29 / ui-spec §8）
      'presence.steps': '{count} 步 · {elapsed}',
      'presence.pendingApproval': '待审批',
      'presence.pendingQuestion': '待回答',
      'presence.pendingPlanReview': '待确认',
      'presence.pendingGeneric': '待处理',
      'presence.failed': '失败',
      'notify.title': 'WaitBuddy',
      'notify.approval': '会话 {session} 等待审批',
      'notify.success': '会话 {session} 任务完成',
      'notify.failed': '会话 {session} 任务失败',
      'notify.aborted': '会话 {session} 任务已中断',
      'game.hiddenPausedBody': '已一键隐藏（Ctrl+Shift+W），游戏保持暂停',
      'game.hiddenResumeBody': '已从隐藏中恢复，按空格或点击继续',
      'presence.mode': '存在感',
      'presence.quiet': '后台',
      'presence.pill': '胶囊',
      'presence.idle': '空闲',
      'presence.aborted': '已中断',
      'presence.successSteps': '成功 · {count} 步',
      'pill.background': '切到后台并打开看板',
      'pill.backgroundShort': '后台',
      'pill.expand': '展开浮动小窗',
      'pill.collapse': '收起胶囊',
      'pill.miniStart': '开始',
      'pill.miniAgain': '再来一局',
      'pill.miniPaused': '已暂停',
      'pill.miniOver': '得分 {score}',
      'pill.canvasLabel': '迷你贪吃蛇，得分 {score}',
    }

    /** English dictionary, complete against the Chinese key set. */
    const en = {
      'view.label': 'WaitBuddy',
      'status.idle': 'Idle · waiting for a task in this session',
      'status.runningStart': 'Task started, the agent is planning',
      'status.running': 'Running the task',
      'status.approval': 'Important: a tool call is waiting for your approval!',
      'status.question': 'Important: the agent has a question for you!',
      'status.planReview': 'Important: a plan is waiting for your review!',
      'status.pending': 'Important: the agent is waiting for you!',
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
      'alert.question.title': 'Important: the agent has a question for you',
      'alert.planReview.title': 'Important: a plan is waiting for your review',
      'alert.pending.title': 'Important: the agent is waiting for you',
      'alert.failed.title': 'Task failed',
      'footer.line': 'This session only · the game is independent · a secondary reminder that never intercepts the native dialogs',
      'game.title': 'Snake',
      'game.score': 'Score {score}',
      'game.best': 'Best {best}',
      'game.reset': 'Reset',
      'game.startBody': 'Arrow keys only — eat the fruit to score.',
      'game.start': 'Start game',
      'game.pausedTitle': 'Paused',
      'game.approvalPausedTitle': 'Waiting for approval',
      'game.approvalPausedBody': 'The agent is waiting for approval; the game is paused.',
      'game.questionPausedTitle': 'Waiting for your answer',
      'game.questionPausedBody': 'The agent has a question for you; the game is paused.',
      'game.planPausedTitle': 'Waiting for plan review',
      'game.planPausedBody': 'The agent submitted a plan for your review; the game is paused.',
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
      'game.hint': 'Arrow keys steer (click the board first); Space starts, pauses and resumes',
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
      // Low-key presence (D29 / ui-spec §8)
      'presence.steps': '{count} steps · {elapsed}',
      'presence.pendingApproval': 'approval needed',
      'presence.pendingQuestion': 'answer needed',
      'presence.pendingPlanReview': 'review needed',
      'presence.pendingGeneric': 'waiting for you',
      'presence.failed': 'failed',
      'notify.title': 'WaitBuddy',
      'notify.approval': 'Session {session} is waiting for approval',
      'notify.success': 'Session {session} finished successfully',
      'notify.failed': 'Session {session} failed',
      'notify.aborted': 'Session {session} was interrupted',
      'game.hiddenPausedBody': 'Hidden by shortcut (Ctrl+Shift+W); the game stays paused',
      'game.hiddenResumeBody': 'Restored from hidden — press Space or click Resume',
      'presence.mode': 'Presence',
      'presence.quiet': 'Background',
      'presence.pill': 'Pill',
      'presence.idle': 'Idle',
      'presence.aborted': 'Interrupted',
      'presence.successSteps': 'Done · {count} steps',
      'pill.background': 'Switch to background & open the board',
      'pill.backgroundShort': 'Background',
      'pill.expand': 'Expand the floating panel',
      'pill.collapse': 'Collapse the pill',
      'pill.miniStart': 'Start',
      'pill.miniAgain': 'Play again',
      'pill.miniPaused': 'Paused',
      'pill.miniOver': 'Score {score}',
      'pill.canvasLabel': 'Mini snake, score {score}',
    }

    /** Neutral state before any projection arrives. */
    /** Stable empty feed so unchanged snapshots keep the same reference. */
    // ---------------------------------------------------------------------
    // §2 Monitor projection fold. Pure logic: log events -> snapshot state.
    // Tested via test/fold.test.js through the __monitor export.
    // ---------------------------------------------------------------------
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
      pendingDetail: '',
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
        left.pendingDetail === right.pendingDetail &&
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
     * Short human-readable detail for one pending interaction: the approval's
     * tool name, or the first question's text (D28: question / plan-review).
     */
    function pendingDetailOf(pending) {
      if (pending === undefined || pending === null) return ''
      if (typeof pending.toolName === 'string' && pending.toolName.trim() !== '') {
        return pending.toolName
      }
      const questions = Array.isArray(pending.questions) ? pending.questions : []
      const first = questions[0]
      if (first !== null && typeof first === 'object') {
        for (const field of ['question', 'text', 'title', 'detail', 'prompt']) {
          const value = first[field]
          if (typeof value === 'string' && value.trim() !== '') {
            return value.replace(/\s+/gu, ' ').trim().slice(0, 120)
          }
        }
      } else if (typeof first === 'string' && first.trim() !== '') {
        return first.replace(/\s+/gu, ' ').trim().slice(0, 120)
      }
      return ''
    }

    /**
     * Pure state reconciliation between the durable Host projection and the
     * process-local session status. `status` stays within the M0 six-value
     * enum; `health` / `pendingKind` / `pendingKey` are client-only metadata.
     * D28: every blocking pending interaction (approval, question,
     * plan-review, and unknown future kinds) claims the pending state — the
     * host only exposes the single highest-priority request, so dropping
     * non-approval kinds would hide a blocked agent entirely.
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
      const pendingKind =
        pending !== undefined &&
        pending !== null &&
        typeof pending.kind === 'string' &&
        pending.kind !== ''
          ? pending.kind
          : ''
      const blocked = pendingKind !== ''
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
      if (blocked) nextStatus = 'pending_approval'
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
          pendingKind === 'approval' && typeof pending.toolName === 'string' ? pending.toolName : '',
        pendingKind,
        pendingKey: blocked && typeof pending.key === 'string' ? pending.key : '',
        pendingDetail: blocked ? pendingDetailOf(pending) : '',
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
        detail: next.pendingDetail,
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

    // ---------------------------------------------------------------------
    // §3 Status copy & formatting. Pure functions over the snapshot state.
    // ---------------------------------------------------------------------
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
          // D28: copy follows the blocking kind; unknown future kinds get the
          // generic "agent is waiting" line instead of an approval claim.
          if (state.pendingKind === 'question') return t('status.question')
          if (state.pendingKind === 'plan-review') return t('status.planReview')
          if (state.pendingKind !== 'approval') return t('status.pending')
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

    /**
     * One-key hide cycle (D29 §8.6, D31): normal ↔ quiet. Entering quiet
     * pauses the game via the `hidden` reason; returning to normal releases it
     * (the round stays paused, manual-resume).
     */
    // ---------------------------------------------------------------------
    // §5 Presence (pill / quiet), settings persistence, system notifications.
    // ---------------------------------------------------------------------
    function createPresenceStore(settings, game) {
      let quiet = false
      const listeners = new Set()
      const notify = () => {
        for (const listener of [...listeners]) listener()
      }
      const effective = () => (quiet ? 'quiet' : settings.getSnapshot().presence)
      return {
        getSnapshot: () => ({ stage: quiet ? 1 : 0, effective: effective(), base: settings.getSnapshot().presence }),
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        cycle() {
          quiet = !quiet
          game.setHidden(quiet)
          notify()
        },
      }
    }

    /** `M:SS` (or `H:MM:SS`) elapsed label for the status dot. */
    function formatElapsed(ms) {
      const total = Math.max(0, Math.floor(ms / 1000))
      const seconds = total % 60
      const minutes = Math.floor(total / 60) % 60
      const hours = Math.floor(total / 3600)
      const mm = String(minutes).padStart(2, '0')
      const ss = String(seconds).padStart(2, '0')
      return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`
    }

    /**
     * Live elapsed-since-running label. Approximate from mount when the session
     * is already running (the projection carries no start time); no timer
     * while not running (low-key, §8.2).
     */
    function useRunningElapsed(status) {
      const runningSince = React.useRef(null)
      const [, tick] = React.useState(0)
      React.useEffect(() => {
        if (status !== 'running') {
          runningSince.current = null
          return undefined
        }
        if (runningSince.current === null) runningSince.current = Date.now()
        const timer = setInterval(() => tick((n) => n + 1), 1000)
        return () => clearInterval(timer)
      }, [status])
      return status === 'running'
        ? formatElapsed(Date.now() - (runningSince.current ?? Date.now()))
        : ''
    }

    /** Short pending label key for the dot, mirroring D28's pendingKind copy. */
    function pendingLabelKey(kind) {
      if (kind === 'question') return 'presence.pendingQuestion'
      if (kind === 'plan-review') return 'presence.pendingPlanReview'
      if (kind === '' || kind === 'approval') return 'presence.pendingApproval'
      return 'presence.pendingGeneric'
    }

    /**
     * System-notification consumer (D29 §8.5, L0). Only approval / success /
     * failed / aborted, only while the window is unfocused, one notification
     * per signal key, and never any command text (D27 privacy posture).
     */
    function createNotifier(deps) {
      const seen = new Set()
      const kindOf = (signal) => {
        if (signal === undefined || signal === null) return null
        if (signal.type === 'agent:approval_enter') return 'approval'
        if (signal.type === 'agent:task_finish') {
          const status = signal.detail === undefined ? '' : signal.detail.status
          if (status === 'success' || status === 'aborted') return status
          return 'failed'
        }
        return null
      }
      const onSignal = (signal) => {
        const kind = kindOf(signal)
        if (kind === null) return
        const id = `${signal.type}:${signal.sessionId}:${signal.key}`
        if (seen.has(id)) return
        seen.add(id)
        if (deps.getSettings().notify !== true) return
        if (deps.hasFocus()) return
        if (deps.permission() !== 'granted') return
        deps.show({
          title: deps.t('notify.title'),
          body: deps.t(`notify.${kind}`, { session: deps.sessionTitle(signal.sessionId) }),
        })
      }
      const stop = deps.subscribe(onSignal)
      return {
        dispose() {
          stop()
          seen.clear()
        },
      }
    }


    /** Logical 324x324 board drawn into a 2x backing store for crisp edges. */
    // ---------------------------------------------------------------------
    // §6 Canvas drawing. Imperative painting shared by the full view and the
    // floating panel; never holds module-level DOM refs (D8).
    // ---------------------------------------------------------------------
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
    /**
     * D36: Space is the single control for every snake state — idle starts,
     * running pauses, paused resumes, over restarts. Approval pauses stay
     * immune (manualResume already refuses while approval reasons exist).
     */
    function snakeSpaceAction(store, speedId) {
      const snapshot = store.getSnapshot()
      if (snapshot.status === 'idle' || snapshot.status === 'over') {
        store.start(speedId)
        return
      }
      store.togglePause()
    }

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
        snakeSpace()
        return
      }
      const dir = ARROW_DIRECTIONS[event.key]
      if (dir === undefined) return
      event.preventDefault()
      gameStore.turn(dir)
    }

    function snakeSpace() {
      snakeSpaceAction(gameStore, settingsStore.getSnapshot().speed)
    }

    /** Per-kind copy for a blocking pause (approval / question / plan-review). */
    function blockedPauseCopyKey(pendingKind, base) {
      if (pendingKind === 'question') return `game.questionPaused${base}`
      if (pendingKind === 'plan-review') return `game.planPaused${base}`
      return `game.approvalPaused${base}`
    }

    /** Centred overlay shown whenever the round is not running. */
    function gameOverlay(t, state, focusRoot, pendingKind) {
      if (state.pauseReason === 'approval') {
        // D35: no disabled Resume button — the copy explains the wait; resume
        // stays keyboard/click-gated and is blocked while approval pends.
        return h(
          'div',
          { className: 'wb-overlay' },
          h('div', { className: 'wb-overlayTitle' }, t(blockedPauseCopyKey(pendingKind, 'Title'))),
          h('div', { className: 'wb-overlayBody' }, t(blockedPauseCopyKey(pendingKind, 'Body'))),
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
            ? t(blockedPauseCopyKey(pendingKind, 'Body'))
            : state.pauseReason === 'session-switch'
              ? t('game.sessionPausedBody')
              : state.pauseReason === 'view-inactive'
                ? t('game.viewPausedBody')
                : state.pauseReason === 'manual'
                  ? t('game.manualPausedBody')
                  : state.pauseReason === 'hidden'
                    ? t('game.hiddenPausedBody')
                    : state.hiddenResumed === true
                      ? t('game.hiddenResumeBody')
                      : state.resumeReason === 'approval' && state.resumeReady
                    ? t('game.resumeReadyBody')
                    : null
        // D35: the paused overlay carries no button — Space or clicking the
        // overlay/board resumes (approval-wait pauses never resume on click).
        return h(
          'div',
          {
            className: 'wb-overlay',
            onClick: () => {
              if (waiting) return
              gameStore.togglePause()
              focusRoot()
            },
          },
          h('div', { className: 'wb-overlayTitle' }, waiting ? t('game.approvalPausedTitle') : t('game.pausedTitle')),
          body === null ? null : h('div', { className: 'wb-overlayBody' }, body),
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

    const gomokuStore = createGomokuStore()

    const SETTINGS_KEY = 'dsh-wait-buddy.settings.v1'
    const DEFAULT_SETTINGS = {
      speed: 'normal',
      level: 'medium',
      // 低调模式（D29 §8.7 / D31）：默认胶囊 + 系统通知开。
      presence: 'pill',
      notify: true,
      pillCorner: 'top-right',
      // Floating-panel position {x,y} (D30); null = use the corner origin.
      pillPos: null,
    }
    const PRESENCE_MODES = ['quiet', 'pill']
    const PILL_CORNERS = ['top-right', 'bottom-right', 'top-left']
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
          presence: PRESENCE_MODES.includes(parsed.presence) ? parsed.presence : DEFAULT_SETTINGS.presence,
          notify: typeof parsed.notify === 'boolean' ? parsed.notify : DEFAULT_SETTINGS.notify,
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
        setPresence(id) {
          if (!PRESENCE_MODES.includes(id) || state.presence === id) return
          publish({ ...state, presence: id })
        },
        setNotify(enabled) {
          if (typeof enabled !== 'boolean' || state.notify === enabled) return
          publish({ ...state, notify: enabled })
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
              gameOverlay(t, snake, focusRoot, pendingKind),
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
                // D35: no Pause/Resume button — Space toggles, clicking the
                // paused overlay resumes.
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

      // Presence mode control (D29 §8.7 / D31): quiet / pill.
      const presenceSetting = h(
        'div',
        { className: 'wb-setting' },
        h('span', { className: 'wb-settingLabel' }, t('presence.mode')),
        h(
          'div',
          { className: 'wb-seg' },
          segButton(t('presence.quiet'), 'quiet', settings.presence === 'quiet', () =>
            settingsStore.setPresence('quiet'),
          ),
          segButton(t('presence.pill'), 'pill', settings.presence === 'pill', () =>
            settingsStore.setPresence('pill'),
          ),
        ),
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
          presenceSetting,
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
@container (max-width:480px){.wb-inner{padding:8px 12px 176px}.wb-top{gap:12px}.wb-status{min-width:0}.wb-setting{display:none}.wb-hint{display:none}.wb-disclaimer{display:none}.wb-caption{font-size:13px}.wb-gameFoot{gap:10px}.wb-boardWrap{height:140px;min-height:140px;max-height:140px}.wb-alert{padding:8px 10px;margin:12px 12px 0}.wb-statusText{overflow-wrap:anywhere}}
`

    // ---------------------------------------------------------------------
    // §9 Shared stores & UI components (full view, floating panel, pill).
    // ---------------------------------------------------------------------
    /** WaitBuddy status board (M1: monitoring only, no game). */
    function useMonitorState(sessionId, initialState) {
      const [state, setState] = React.useState(() =>
        initialState === undefined ? { ...EMPTY_STATE } : initialState,
      )
      React.useEffect(() => {
        if (initialState !== undefined) return undefined
        if (clientCtx === null) return undefined
        // A null sessionId (global overlay before any session is followed)
        // renders the empty state without creating a session binding.
        if (sessionId === null || sessionId === undefined) return undefined
        const source = createMonitorSource(clientCtx, sessionId, signalHub)
        const sync = () => setState(source.getSnapshot())
        sync()
        return source.subscribe(sync)
      }, [sessionId])
      return state
    }


    /**
     * Session picker for the presence pill (D29 §8.4; the L1 status dot was
     * removed by D31, the sidebar panel by D32). The utilities slot provides
     * `sessionId`; "open the panel" is delegated to `ctx.sidebarRight.openTab`
     * when present.
     */
    /** The session currently shown in the main view; the pill follows it (§8.4). */
    function pickMainViewSession(snapshot) {
      const byId = snapshot === undefined || snapshot === null ? undefined : snapshot.byId
      if (byId === undefined || byId === null) return null
      for (const [id, row] of Object.entries(byId)) {
        const retained = row === undefined || row === null ? undefined : row.retainedBy
        const weight = retained === undefined || retained === null ? 0 : retained.mainView
        if (typeof weight === 'number' && weight > 0) return id
      }
      return null
    }

    /** Stylesheet for the presence pill + floating panel (D30 §8.4). */
    const PILL_CSS = `
.wb-pill{position:fixed;z-index:60;display:flex;flex-direction:column;gap:0;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-2);box-shadow:0 4px 16px rgba(0,0,0,0.18);font:12px/1.4 inherit;color:var(--dsw-alias-label-primary);pointer-events:auto}
.wb-pill[data-corner="top-right"]{top:14px;right:16px}
.wb-pill[data-corner="top-left"]{top:14px;left:16px}
.wb-pill[data-corner="bottom-right"]{bottom:14px;right:16px}
.wb-pill[data-expanded="true"]{width:300px}
.wb-pillBar{display:flex;align-items:center;gap:8px;padding:5px 10px;cursor:grab;user-select:none}
.wb-pillBar:focus-visible{outline:1px solid var(--dsw-alias-border-l2)}
.wb-pillBar:active{cursor:grabbing}
.wb-pillDrag{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:2px 8px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.wb-pillDot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-state-idle-primary)}
.wb-pillDot[data-state="running"]{background:var(--dsw-alias-label-secondary)}
.wb-pillDot[data-state="pending_approval"]{background:var(--dsw-alias-state-warn-primary)}
.wb-pillDot[data-state="success"]{background:var(--dsw-alias-state-success-primary)}
.wb-pillDot[data-state="failed"]{background:var(--dsw-alias-state-error-primary)}
.wb-pillText{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;flex:1 1 auto;min-width:0;text-align:left}
.wb-pillToggle{flex:none;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:3px 6px;font-size:13px}
.wb-pillBody{display:flex;flex-direction:column;gap:6px;padding:6px 10px 10px;border-top:1px solid var(--dsw-alias-border-l1)}
.wb-pillAct{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-pillMini{width:100%;height:112px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden;position:relative;outline:none}
.wb-pillMini canvas{width:100%;height:100%;display:block}
.wb-pillMiniOverlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:rgba(13,22,36,0.55)}
.wb-pillMiniBtn{border:none;border-radius:8px;padding:3px 12px;font-size:12px;font-weight:600;cursor:pointer;background:#7bd4a8;color:#0d1624}
.wb-pillMiniScore{font-size:11px;color:var(--dsw-alias-label-secondary)}
.wb-pillCtl{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.wb-pillCtlBtn{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:6px;cursor:pointer;font-size:11px;padding:1px 8px}
.wb-pillCtlBtn:disabled{opacity:0.5;cursor:default}
.wb-pillTabs{display:flex;gap:4px;align-items:center}
.wb-pillTabBtn{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:6px;cursor:pointer;font-size:11px;padding:1px 10px}
.wb-pillTabBtn[data-active="true"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.wb-hdMenuBtn{border:none;background:transparent;color:inherit;font:inherit;cursor:pointer;padding:6px 10px;width:100%;text-align:left}
.wb-pillGomoku{position:relative;width:184px;height:184px;margin:0 auto;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden}
.wb-pillGomoku canvas{width:100%;height:100%;display:block;cursor:pointer}
`

    /** Panel width (px) for the expanded floating window (D30). */
    const PILL_PANEL_W = 300
    /** Rough expanded height used for viewport clamping while dragging. */
    const PILL_PANEL_H = 280

    /**
     * Clamp a floating-panel position so the panel stays inside the viewport.
     * Pure; exported for unit tests.
     */
    function clampToViewport(x, y, width, height, viewportW, viewportH) {
        const maxX = Math.max(0, viewportW - width)
        const maxY = Math.max(0, viewportH - height)
        return { x: Math.min(Math.max(0, x), maxX), y: Math.min(Math.max(0, y), maxY) }
    }

    /**
     * The floating panel's game (D30 §8.4): an independent lightweight snake —
     * fixed 32×12 grid, no settings, no persistence, no signal consumption
     * (the M3 link stays with the main round only). The store comes from the
     * host panel so mouse-leave pausing can act on the same round.
     */
    const MINI_COLS = 32
    const MINI_ROWS = 12

    function FloatGame({ t, store }) {
      const [state, setState] = React.useState(() => store.getSnapshot())
      React.useEffect(() => {
        const sync = () => setState(store.getSnapshot())
        sync()
        return store.subscribe(sync)
      }, [store])
      const canvasRef = React.useRef(null)
      const boardRef = React.useRef(null)
      React.useEffect(() => {
        drawGame(canvasRef.current, state)
      }, [state])
      const focusBoard = () => {
        if (boardRef.current !== null && typeof boardRef.current.focus === 'function') {
          boardRef.current.focus({ preventScroll: true })
        }
      }
      const ensureGrid = () => store.setGrid(MINI_COLS, MINI_ROWS)
      const onKeyDown = (event) => {
        const moves = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right',
        }
        if (moves[event.key] !== undefined) {
          event.preventDefault()
          store.turn(moves[event.key])
          return
        }
        if (event.key === ' ') {
          event.preventDefault()
          // D36: Space starts from idle/over too (see snakeSpaceAction).
          snakeSpaceAction(store, 'normal')
        }
      }
      const overlay =
        state.status === 'idle'
          ? h(
              'div',
              { className: 'wb-pillMiniOverlay' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'wb-pillMiniBtn',
                  onClick: () => {
                    ensureGrid()
                    store.start('normal')
                    focusBoard()
                  },
                },
                t('pill.miniStart'),
              ),
            )
          : state.status === 'over'
            ? h(
                'div',
                { className: 'wb-pillMiniOverlay' },
                h('span', { className: 'wb-pillMiniScore' }, t('pill.miniOver', { score: state.score })),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'wb-pillMiniBtn',
                    onClick: () => {
                      ensureGrid()
                      store.reset('normal')
                      focusBoard()
                    },
                  },
                  t('pill.miniAgain'),
                ),
              )
            : state.status === 'paused'
              ? h(
                  'div',
                  {
                    className: 'wb-pillMiniOverlay',
                    // D35: no Resume button — click the overlay or press Space.
                    onClick: () => {
                      store.resume()
                      focusBoard()
                    },
                  },
                  h('span', { className: 'wb-pillMiniScore' }, t('pill.miniPaused')),
                )
              : null
      return h(
        'div',
        {
          className: 'wb-pillMini',
          tabIndex: 0,
          role: 'img',
          'aria-label': t('pill.canvasLabel', { score: state.score }),
          ref: boardRef,
          onKeyDown,
        },
        h('canvas', { ref: canvasRef }),
        overlay,
      )
    }

    /**
     * L2 presence pill + floating panel on the global overlay (D29 §8.4,
     * revised by D30). Collapsed: a corner pill following the main-view
     * session; clicking the bar opens the L3 sidebar tab. Expanded: the whole
     * WaitBuddy in a draggable panel (status + latest activity + snake);
     * pointer leaving the panel auto-pauses the round, re-entering resumes it
     * (only when that pause came from the leave — manual/approval/hidden
     * pauses keep their manual-resume semantics). The overlay layer itself is
     * click-through; only this element receives pointer events.
     */
    /**
     * Pill gomoku (D33): an independent round on a square mini board (~184px).
     * Turn-based — no tick, so mouse-leave pausing does not apply. Difficulty
     * follows the global setting; placement clicks resolve through the same
     * heuristic as the full view.
     */
    function FloatGomoku({ t, store }) {
      const [state, setState] = React.useState(() => store.getSnapshot())
      React.useEffect(() => {
        const sync = () => setState(store.getSnapshot())
        sync()
        return store.subscribe(sync)
      }, [store])
      const canvasRef = React.useRef(null)
      React.useEffect(() => {
        drawGomoku(canvasRef.current, state)
      }, [state])
      const playing = state.status === 'playing'
      const overlay = playing
        ? null
        : h(
            'div',
            { className: 'wb-pillMiniOverlay' },
            h(
              'span',
              { className: 'wb-pillMiniScore' },
              state.status === 'won'
                ? t('gomoku.won')
                : state.status === 'lost'
                  ? t('gomoku.lost')
                  : t('gomoku.draw'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'wb-pillMiniBtn',
                onClick: () => store.reset(),
              },
              t('gomoku.again'),
            ),
          )
      return h(
        'div',
        { className: 'wb-pillGomoku' },
        h('canvas', {
          ref: canvasRef,
          role: 'img',
          'aria-label': t('gomoku.canvasLabel', { moves: state.moves }),
          onClick: (event) => {
            if (!playing || canvasRef.current === null) return
            const index = gomokuPointAt(canvasRef.current, event.clientX, event.clientY)
            if (index >= 0) store.place(index, settingsStore.getSnapshot().level)
          },
        }),
        overlay,
      )
    }

    let viewOpener = null

    /**
     * D36: open the WaitBuddy conversation view. No public service exists
     * (activateView depends on host-internal store actions), so this drives
     * the same UI a user would: the WaitBuddy tab in the session header, or
     * the More-views menu entry when the tab is collapsed into it.
     */
    async function openFullView() {
      if (viewOpener !== null) {
        // Preferred: a captured onOpen from the views-actions menu entry
        // (available once that menu has been opened at least once).
        try {
          viewOpener('waitbuddy')
          return true
        } catch (error) {
          console.warn('[wait-buddy] openView failed', error)
        }
      }
      const findTab = () => {
        const tabs = Array.from(document.querySelectorAll('[role="tab"]'))
        return tabs.find((el) => (el.textContent || '').trim().startsWith('WaitBuddy'))
      }
      const tab = findTab()
      if (tab !== undefined) {
        tab.click()
        return true
      }
      const more = Array.from(document.querySelectorAll('button')).find((el) => {
        const label = el.getAttribute('aria-label') || el.textContent || ''
        return label.includes('更多会话视图') || label.includes('session views')
      })
      if (more === undefined) return false
      more.click()
      await new Promise((resolve) => setTimeout(resolve, 120))
      const items = Array.from(document.querySelectorAll('button, [role="menuitem"]'))
      const item = items.find((el) => (el.textContent || '').trim().startsWith('WaitBuddy'))
      if (item === undefined) return false
      item.click()
      return true
    }

    function ViewMenuEntry(props) {
      const t = typeof props.t === 'function' ? props.t : boundT
      React.useEffect(() => {
        viewOpener = typeof props.onOpen === 'function' ? props.onOpen : null
        return () => {
          if (viewOpener === props.onOpen) viewOpener = null
        }
      }, [props.onOpen])
      return h(
        'button',
        {
          type: 'button',
          className: 'wb-hdMenuBtn',
          onClick: () => {
            try {
              props.onOpen('waitbuddy')
            } catch (error) {
              console.warn('[wait-buddy] open view failed', error)
            }
          },
        },
        t('view.openLabel'),
      )
    }

    function PresencePill() {
      const t = boundT
      const [settings, setSettings] = React.useState(() => settingsStore.getSnapshot())
      const [presence, setPresence] = React.useState(() => presenceStore.getSnapshot())
      React.useEffect(() => {
        const sync = () => {
          setSettings(settingsStore.getSnapshot())
          setPresence(presenceStore.getSnapshot())
        }
        const stopA = settingsStore.subscribe(sync)
        const stopB = presenceStore.subscribe(sync)
        sync()
        return () => {
          stopA()
          stopB()
        }
      }, [])
      const [sessionId, setSessionId] = React.useState(null)
      React.useEffect(() => {
        const list =
          clientCtx !== null && clientCtx.sessions !== undefined ? clientCtx.sessions.list : undefined
        if (list === undefined) return undefined
        const sync = () => setSessionId(pickMainViewSession(list.getSnapshot()))
        sync()
        return typeof list.subscribe === 'function' ? list.subscribe(sync) : undefined
      }, [])
      const state = useMonitorState(sessionId)
      const [expanded, setExpanded] = React.useState(false)
      const status = state.status
      // Hooks must all run before the early return below (React hook rules).
      const elapsed = useRunningElapsed(status)
      // D34: the pill plays the GLOBAL rounds — same snake/gomoku as the full
      // view. `view-inactive` pausing is subscriber-count driven, so the round
      // keeps running while any surface (pill or view) is rendering it.
      const store = gameStore
      const [game, setGame] = React.useState(() => store.getSnapshot())
      React.useEffect(() => {
        const sync = () => setGame(store.getSnapshot())
        sync()
        return store.subscribe(sync)
      }, [])
      const gomoku = gomokuStore
      const [gomokuState, setGomokuState] = React.useState(() => gomoku.getSnapshot())
      React.useEffect(() => {
        const sync = () => setGomokuState(gomoku.getSnapshot())
        sync()
        return gomoku.subscribe(sync)
      }, [])
      const [pillMode, setPillMode] = React.useState('snake')
      const cornerOrigin = () => {
        if (typeof window === 'undefined') return { x: 16, y: 14 }
        const vw = window.innerWidth
        const vh = window.innerHeight
        const corner = settingsStore.getSnapshot().pillCorner
        const pos =
          corner === 'top-left'
            ? { x: 16, y: 14 }
            : corner === 'bottom-right'
              ? { x: vw - PILL_PANEL_W - 16, y: vh - PILL_PANEL_H - 14 }
              : { x: vw - PILL_PANEL_W - 16, y: 14 }
        return clampToViewport(pos.x, pos.y, PILL_PANEL_W, PILL_PANEL_H, vw, vh)
      }
      const [pos, setPos] = React.useState(() => {
        const saved = settingsStore.getSnapshot().pillPos
        if (
          saved !== null &&
          typeof saved.x === 'number' &&
          typeof saved.y === 'number' &&
          typeof window !== 'undefined'
        ) {
          return clampToViewport(saved.x, saved.y, PILL_PANEL_W, PILL_PANEL_H, window.innerWidth, window.innerHeight)
        }
        return cornerOrigin()
      })
      const posRef = React.useRef(pos)
      const rootRef = React.useRef(null)
      const applyPos = (next) => {
        // Keep the ref in sync immediately: the drag's mouseup handler may run
        // in the same synchronous sequence as the last mousemove, before
        // React re-renders the component.
        posRef.current = next
        setPos(next)
      }
      // Press-and-hold drag in both collapsed and expanded states; a move
      // beyond DRAG_THRESHOLD px counts as a drag and suppresses the click.
      const DRAG_THRESHOLD = 4
      const dragState = React.useRef(null)
      const suppressClick = React.useRef(false)
      const startDrag = (event) => {
        if (event.button !== 0 || typeof window === 'undefined') return
        // Clamp against the pill's *measured* size: the collapsed pill is much
        // narrower than the expanded panel, and clamping both at 300px made
        // the rightmost strip of the viewport unreachable (D33).
        const rect =
          rootRef.current !== null && typeof rootRef.current.getBoundingClientRect === 'function'
            ? rootRef.current.getBoundingClientRect()
            : null
        const sizeW = rect !== null && rect.width > 0 ? rect.width : PILL_PANEL_W
        const sizeH = rect !== null && rect.height > 0 ? rect.height : PILL_PANEL_H
        const drag = { originX: event.clientX, originY: event.clientY, base: posRef.current, moved: false, sizeW, sizeH }
        dragState.current = drag
        const onMove = (move) => {
          if (dragState.current !== drag) return
          const dx = move.clientX - drag.originX
          const dy = move.clientY - drag.originY
          if (!drag.moved && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return
          drag.moved = true
          applyPos(
            clampToViewport(
              drag.base.x + dx,
              drag.base.y + dy,
              drag.sizeW,
              drag.sizeH,
              window.innerWidth,
              window.innerHeight,
            ),
          )
        }
        const onUp = () => {
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
          if (dragState.current !== drag) return
          if (drag.moved) settingsStore.setPillPos(posRef.current)
          suppressClick.current = drag.moved
          dragState.current = null
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      }
      const toggleExpanded = () => {
        if (suppressClick.current) {
          suppressClick.current = false
          return
        }
        setExpanded((value) => !value)
      }
      // D36: hide all UI (notifications only) and jump to the full view.
      const goBackground = async () => {
        settingsStore.setPresence('quiet')
        await openFullView()
      }
      // Expanding near a viewport edge re-clamps so the panel stays visible.
      React.useEffect(() => {
        if (!expanded || typeof window === 'undefined') return
        applyPos(
          clampToViewport(
            posRef.current.x,
            posRef.current.y,
            PILL_PANEL_W,
            PILL_PANEL_H,
            window.innerWidth,
            window.innerHeight,
          ),
        )
      }, [expanded])
      // D30: pointer leaving the panel pauses the round. Coming back does NOT
      // resume it — space or the overlay's Resume button does (manual-resume
      // semantics, aligned with M0 §9).
      const onPanelLeave = () => {
        if (store.getSnapshot().status === 'running') store.pause()
      }
      if (presence.effective !== 'pill') return null

      const isPending = status === 'pending_approval'
      // While an approval is pending the panel never expands a game (red line).
      const showGame = expanded && !isPending
      const summary =
        status === 'running'
          ? t('presence.steps', { count: state.stepCount, elapsed })
          : isPending
            ? t(pendingLabelKey(state.pendingKind))
            : status === 'success'
              ? t('presence.successSteps', { count: state.stepCount })
              : status === 'failed'
                ? t('presence.failed')
                : status === 'aborted'
                  ? t('presence.aborted')
                  : status === 'idle'
                    ? t('presence.idle')
                    : t('view.label')
      const latest =
        state.activity.length === 0
          ? null
          : `${t(FEED_LABEL[state.activity[0].kind] || FEED_LABEL.tool)} ${state.activity[0].text}`

      return h(
        'div',
        {
          className: 'wb-pill',
          ref: rootRef,
          'data-corner': settings.pillCorner,
          'data-waitbuddy-pill': status,
          'data-expanded': showGame ? 'true' : 'false',
          style: { left: `${pos.x}px`, top: `${pos.y}px`, right: 'auto', bottom: 'auto' },
          onMouseLeave: showGame ? onPanelLeave : undefined,
        },
        h('style', { key: 'wb-pill-style' }, PILL_CSS),
        h(
          'div',
          {
            className: 'wb-pillBar',
            role: 'button',
            tabIndex: 0,
            onClick: toggleExpanded,
            onKeyDown: (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              setExpanded((value) => !value)
            },
            onMouseDown: startDrag,
            'aria-label': `${t('view.label')}: ${summary}`,
            'aria-expanded': showGame ? 'true' : 'false',
            title: showGame ? t('pill.collapse') : t('pill.expand'),
          },
          h('span', { className: 'wb-pillDot', 'data-state': status, 'aria-hidden': true }),
          h('span', { className: 'wb-pillText' }, summary),
          showGame
            ? null
            : h(
                'button',
                {
                  type: 'button',
                  className: 'wb-pillToggle',
                  'aria-label': t('pill.background'),
                  title: t('pill.background'),
                  onClick: (event) => {
                    event.stopPropagation()
                    goBackground()
                  },
                },
                '⏻',
              ),
        ),
        showGame
          ? h(
              'div',
              { className: 'wb-pillBody' },
              latest === null ? null : h('div', { className: 'wb-pillAct', title: latest }, latest),
              h(
                'div',
                { className: 'wb-pillTabs' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'wb-pillTabBtn',
                    'data-active': pillMode === 'snake' ? 'true' : 'false',
                    onClick: () => setPillMode('snake'),
                  },
                  t('game.title'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'wb-pillTabBtn',
                    'data-active': pillMode === 'gomoku' ? 'true' : 'false',
                    onClick: () => {
                      setPillMode('gomoku')
                      // Same rule as the full view: switching to gomoku pauses
                      // the (shared) snake round.
                      store.pause()
                    },
                  },
                  t('gomoku.title'),
                ),
              ),
              pillMode === 'snake'
                ? h(FloatGame, { t, store })
                : h(FloatGomoku, { t, store: gomoku }),
              pillMode === 'snake'
                ? h(
                    'div',
                    { className: 'wb-pillCtl' },
                    h('span', null, t('game.score', { score: game.score })),
                    // D35: no Pause/Resume button — Space or clicking the
                    // paused overlay handles both.
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'wb-pillCtlBtn',
                        onClick: () => {
                          store.setGrid(MINI_COLS, MINI_ROWS)
                          store.reset('normal')
                        },
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
                : h(
                    'div',
                    { className: 'wb-pillCtl' },
                    h('span', null, t('gomoku.moves', { you: Math.ceil(gomokuState.moves / 2), ai: Math.floor(gomokuState.moves / 2) })),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'wb-pillCtlBtn',
                        onClick: () => gomoku.reset(),
                      },
                      t('gomoku.again'),
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
                  ),
            )
          : null,
      )
    }

    function WaitBuddyView(props) {
      const t = typeof props.t === 'function' ? props.t : boundT
      const rootRef = React.useRef(null)
      const innerRef = React.useRef(null)
      React.useEffect(() => {
        const scrollTop = () => {
          if (innerRef.current !== null) innerRef.current.scrollTop = 0
          // The host conversation view scrolls an ancestor container (the
          // session scroll body), not `.wb-inner`; on layouts where the panel
          // grows past the viewport, a view switch must also reset that
          // ancestor or the status row / alert area stay scrolled away (F6).
          let el = innerRef.current === null ? null : innerRef.current.parentElement
          for (let depth = 0; el !== null && el !== document.body && depth < 6; depth += 1) {
            const style = window.getComputedStyle(el)
            if (
              el.scrollTop > 0 &&
              (style.overflowY === 'auto' || style.overflowY === 'scroll')
            ) {
              el.scrollTop = 0
            }
            el = el.parentElement
          }
        }
        scrollTop()
        const root = rootRef.current
        let visible = true
        // Distinguishes "hidden by a view switch" (zero-sized, e.g. display:
        // none) from "scrolled out of the viewport by the user": only the
        // former re-resets the scroll position on re-entry.
        let zeroSizedWhenHidden = false
        let observer
        if (root !== null && typeof IntersectionObserver === 'function') {
          observer = new IntersectionObserver(
            (entries) => {
              const next = entries[0] !== undefined && entries[0].isIntersecting
              if (!next) {
                const rect = root.getBoundingClientRect()
                zeroSizedWhenHidden = rect.width === 0 || rect.height === 0
              }
              if (next && !visible && zeroSizedWhenHidden) scrollTop()
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
          h(GameArea, { t, sessionId: props.sessionId, focusRoot, pendingKind: state.pendingKind }),
        ),
      )
    }

    // ---------------------------------------------------------------------
    // §10 Module registration. The host injects these three services before
    // apply(); missing optional slots degrade per docs/compat.md.
    // ---------------------------------------------------------------------
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
        // L2: global presence pill on the shell overlay (D29 §8.4). The layer
        // itself is click-through; the pill opts into pointer events. Hosts
        // without the overlay slot skip this registration entirely.
        try {
          ctx.slots.inject('shell.overlay', () =>
            ctx.slots.register(
              {
                name: 'shell.overlay',
                id: 'waitbuddy',
                order: 20,
                locale: NS,
              },
              PresencePill,
            ),
          )
        } catch (error) {
          console.warn('[wait-buddy] shell overlay unavailable on this host', error)
        }
        // D36: views-actions menu entry — a visible "open the board" row, and
        // the mounted entry's `onOpen` powers the pill's background button.
        try {
          ctx.slots.inject('conversation.session.header.views.actions', () =>
            ctx.slots.register(
              {
                name: 'conversation.session.header.views.actions',
                id: 'waitbuddy-open',
                order: 20,
                locale: NS,
              },
              ViewMenuEntry,
            ),
          )
        } catch (error) {
          console.warn('[wait-buddy] views actions slot unavailable on this host', error)
        }
        // L0: system notifications, only while the window is unfocused (§8.5).
        ctx.effect(() => {
          if (typeof Notification === 'undefined') return () => {}
          if (Notification.permission === 'default') {
            try {
              const request = Notification.requestPermission()
              if (request !== undefined && typeof request.catch === 'function') {
                request.catch(() => {})
              }
            } catch (error) {
              console.warn('[wait-buddy] notification permission request failed', error)
            }
          }
          const sessionTitleOf = (sessionId) => {
            let title = ''
            try {
              const snapshot = ctx.sessions?.list?.getSnapshot?.()
              const row = snapshot === undefined ? undefined : snapshot.byId?.[sessionId]
              title = row?.title ?? row?.name ?? ''
            } catch (error) {
              title = ''
            }
            return title === '' ? String(sessionId).slice(0, 8) : title
          }
          const notifier = createNotifier({
            subscribe: (listener) => signalHub.subscribe(listener),
            getSettings: () => settingsStore.getSnapshot(),
            hasFocus: () => typeof document !== 'undefined' && document.hasFocus(),
            permission: () => (typeof Notification === 'undefined' ? 'denied' : Notification.permission),
            show: ({ title: head, body }) => {
              try {
                new Notification(head, { body })
              } catch (error) {
                console.warn('[wait-buddy] notification failed', error)
              }
            },
            t,
            sessionTitle: sessionTitleOf,
          })
          return () => notifier.dispose()
        }, 'wait-buddy: system notifications')
        // One-key hide: Ctrl/Cmd+Shift+W cycles the presence stages (§8.6).
        // Implemented as a window listener: the host shortcut catalog resolves
        // command ids only, a binding contract plugins cannot rely on yet.
        ctx.effect(() => {
          if (typeof window === 'undefined') return () => {}
          const onKeyDown = (event) => {
            if (event.code !== 'KeyW') return
            if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey) return
            const target = event.target
            if (target !== null && typeof target === 'object') {
              const tag = target.tagName
              if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
                return
              }
            }
            event.preventDefault()
            presenceStore.cycle()
          }
          window.addEventListener('keydown', onKeyDown)
          return () => window.removeEventListener('keydown', onKeyDown)
        }, 'wait-buddy: hide shortcut')
      },
      /** Pure monitor reconciliation, exported for unit testing. */
      __monitor: { composeMonitor, sameMonitor, createMonitorSource },
      /** Pure signal conversion, exported for unit testing. */
      __signals: { createSignalHub, diffMonitorSignals },
      /** Pure copy helpers, exported for unit testing. */
      __ui: { statusText, metaText },
      /** Low-key presence (D29): store, notifier and pure helpers for tests. */
      __presence: {
        presenceStore,
        settingsStore,
        createPresenceStore,
        createNotifier,
        formatElapsed,
        pendingLabelKey,
        PresencePill,
        pickMainViewSession,
        clampToViewport,
      },
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
        gomokuIsMajorThreat,
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
