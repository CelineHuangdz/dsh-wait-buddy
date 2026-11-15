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
 * Generated file: client.js is the ordered concatenation of src/client/*.mjs
 * (D44, the D38 concat plan — no bundler). Edit the fragments, then run
 * `npm run build:client`; CI rejects drift between the fragments and the
 * committed client.js. The fragments are slices of one factory function, not
 * standalone modules: order matters, and they share the factory's scope.
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
      'status.fail.error': '模型请求失败',
      'status.fail.maxTokens': '本轮达到模型输出上限',
      'status.fail.blocked': '本轮被阻止，未继续执行',
      'status.aborted': '任务已中断',
      'status.loading': '正在读取监控数据…',
      'status.degraded': '监控数据不可用',
      'status.stale': '状态同步中断（可能已断开）',
      'status.endedUnknown': '本轮已结束（未知原因）',
      'status.steps': '已完成 {count} 步',
      'status.openChat': '查看对话',
      'status.updated': '更新于 {time}',
      'shortcut.label': '快捷键',
      'shortcut.on': '开',
      'shortcut.off': '关',
      'notify.enable': '启用系统通知',
      'adapter.openViewFailed': '无法自动切换视图，请手动点击 WaitBuddy 标签',
      'ui.crashed': 'WaitBuddy 渲染出错，请刷新页面；若持续出现请禁用插件后反馈。',
      'feed.command': '命令',
      'feed.tool': '工具',
      'feed.empty': '等待 Agent 活动',
      'feed.copy': '复制全文',
      'feed.copied': '已复制',
      'feed.pulseIdle': '近 1 分钟无工具活动',
      'feed.pulseLive': '近 1 分钟工具活动',
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
      'sf.title': '抓精灵',
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
      'sf.rarity.common': '常见',
      'sf.rarity.rare': '稀有',
      'sf.rarity.very': '珍稀',
      'sf.catchRate': '捕获率 {rate}%',
      'sf.hint.move': '移动',
      'sf.hint.throw': '投球',
      'sf.hint.region': '换区域',
      'sf.hint.grass': '点击自动寻路；踩草可能遇到精灵',
      'sf.throw': '精灵球',
      'sf.release': '放过',
      'sf.dex': '图鉴 {caught}/{total}',
      'sf.dexEmpty': '还没有收集到精灵，去草地看看',
      'sf.dexClose': '关闭',
      'sf.dexBtn': '图鉴',
      'sf.dexCount': '图鉴 {caught}/{total}',
      'sf.region': '区域 {n}',
      'sf.theme.grass': '草原',
      'sf.theme.snow': '雪原',
      'sf.theme.desert': '沙漠',
      'sf.theme.volcano': '火山',
      'sf.nextRegion': '换区域',
      'sf.result.caught': '捕获成功！',
      'sf.result.fled': '逃跑了…',
      'sf.result.released': '已放过',
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
      'status.fail.error': 'The model request failed',
      'status.fail.maxTokens': 'The model hit its output limit this turn',
      'status.fail.blocked': 'This turn was blocked before continuing',
      'status.aborted': 'Task was interrupted',
      'status.loading': 'Loading monitoring data…',
      'status.degraded': 'Monitoring data unavailable',
      'status.stale': 'Status sync interrupted (possibly disconnected)',
      'status.endedUnknown': 'Turn ended (unknown reason)',
      'status.steps': '{count} steps completed',
      'status.openChat': 'Open chat',
      'status.updated': 'Updated {time}',
      'shortcut.label': 'Shortcut',
      'shortcut.on': 'On',
      'shortcut.off': 'Off',
      'notify.enable': 'Enable notifications',
      'adapter.openViewFailed': 'Could not switch views automatically — click the WaitBuddy tab',
      'ui.crashed': 'WaitBuddy crashed while rendering. Refresh the page; if it persists, disable the plugin and report.',
      'feed.command': 'Command',
      'feed.tool': 'Tool',
      'feed.empty': 'Waiting for agent activity',
      'feed.copy': 'Copy full text',
      'feed.copied': 'Copied',
      'feed.pulseIdle': 'No tool activity in the last minute',
      'feed.pulseLive': 'Tool activity in the last minute',
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
      'sf.title': 'Sprite Safari',
      'sf.name': '{color} {pattern} {body}',
      'sf.color.red': 'Red',
      'sf.color.blue': 'Blue',
      'sf.color.green': 'Green',
      'sf.color.yellow': 'Yellow',
      'sf.color.purple': 'Purple',
      'sf.color.cyan': 'Cyan',
      'sf.pattern.plain': 'Plain',
      'sf.pattern.spots': 'Spotted',
      'sf.pattern.stripes': 'Striped',
      'sf.body.round': 'Orb',
      'sf.body.block': 'Block',
      'sf.body.tall': 'Bean',
      'sf.rarity.common': 'Common',
      'sf.rarity.rare': 'Rare',
      'sf.rarity.very': 'Very rare',
      'sf.catchRate': 'Catch rate {rate}%',
      'sf.hint.move': 'Move',
      'sf.hint.throw': 'Throw',
      'sf.hint.region': 'Next region',
      'sf.hint.grass': 'Click to auto-walk; grass hides sprites.',
      'sf.throw': 'Throw ball',
      'sf.release': 'Release',
      'sf.dex': 'Dex {caught}/{total}',
      'sf.dexEmpty': 'Nothing caught yet — try the grass',
      'sf.dexClose': 'Close',
      'sf.dexBtn': 'Dex',
      'sf.dexCount': 'Dex {caught}/{total}',
      'sf.region': 'Region {n}',
      'sf.theme.grass': 'Grassland',
      'sf.theme.snow': 'Snowfield',
      'sf.theme.desert': 'Desert',
      'sf.theme.volcano': 'Volcano',
      'sf.nextRegion': 'New region',
      'sf.result.caught': 'Caught!',
      'sf.result.fled': 'It fled…',
      'sf.result.released': 'Released',
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
      reasonCode: '',
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
        left.reasonCode === right.reasonCode &&
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
        reasonCode: base.reasonCode === undefined ? '' : base.reasonCode,
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
            reasonCode: next.reasonCode,
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
      let hasBaseline = false
      // RT-05: projection refresh attempts (cap 3) and late-binding retries.
      let projectionAttempts = 0
      let bindRetryTimer = null
      const BIND_RETRY_DELAY = 500
      const BIND_RETRY_LIMIT = 6

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

      /** RT-05: retry a projection refresh a few times before giving up. */
      const ensureProjection = () => {
        if (readDurable() !== undefined) return
        if (projectionAttempts >= 3) return
        projectionAttempts += 1
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
                // Still missing after a successful refresh: one more round.
                if (readDurable() === undefined && projectionAttempts < 3) ensureProjection()
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
        projectionAttempts = 0
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
        // RT-05: a session binding or the projection face may arrive after the
        // first render (host applies plugins before the session wire is up).
        // Retry the missing subscriptions for a few rounds instead of staying
        // deaf; every piece is subscribed exactly once.
        const subscribed = {
          face: binding !== undefined && binding.session.projections.faceOf('waitbuddy') !== undefined,
          session: binding !== undefined,
          ui: uiSession !== undefined && uiSession.sessionStatus !== undefined,
        }
        let attempts = 0
        const retry = () => {
          bindRetryTimer = null
          attempts += 1
          const lateBinding = bindingOf()
          if (!subscribed.session && lateBinding !== undefined) {
            disposers.push(lateBinding.session.subscribe(refresh))
            subscribed.session = true
          }
          if (!subscribed.face && lateBinding !== undefined) {
            const lateFace = lateBinding.session.projections.faceOf('waitbuddy')
            if (lateFace !== undefined) {
              disposers.push(lateFace.subscribe(refresh))
              subscribed.face = true
            }
          }
          if (!subscribed.ui) {
            const lateUi = ctx.get('uiSession')
            if (lateUi !== undefined && lateUi.sessionStatus !== undefined) {
              disposers.push(lateUi.sessionStatus.subscribe(refresh))
              subscribed.ui = true
            }
          }
          refresh()
          const wired = subscribed.face && subscribed.session
          if (!wired && attempts < BIND_RETRY_LIMIT) {
            bindRetryTimer = setTimeout(retry, BIND_RETRY_DELAY)
          }
        }
        if (!subscribed.face || !subscribed.session || !subscribed.ui) {
          bindRetryTimer = setTimeout(retry, BIND_RETRY_DELAY)
        }
        disposers = disposersNext
        refresh()
      }

      const stop = () => {
        if (bindRetryTimer !== null) {
          clearTimeout(bindRetryTimer)
          bindRetryTimer = null
        }
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

    /**
     * D41: localized failure copy from the Host's locale-neutral reasonCode;
     * `errorMessage` (upstream raw text) is shown as secondary detail only.
     */
    function failureText(t, state) {
      if (state.status !== 'failed') return t('status.failed')
      if (state.reasonCode === 'error') return t('status.fail.error')
      if (state.reasonCode === 'max-tokens') return t('status.fail.maxTokens')
      if (state.reasonCode === 'blocked') return t('status.fail.blocked')
      return t('status.failed')
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
          return failureText(t, state)
        case 'aborted':
          return state.reasonCode === 'unknown' ? t('status.endedUnknown') : t('status.aborted')
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

    /**
     * Returns true when the key was consumed (prevented / handled) so the
     * window-capture fallback knows to stop the host's own key handlers —
     * a host that scrolls the page from a capture-phase listener would
     * otherwise race ahead of our bubble-phase preventDefault.
     */
    function onGameKeyDown(event) {
      // D45: only keyboard-driven games (see GAMES.keyboard) consume keys.
      const mode = modeStore.getSnapshot()
      if (!GAMES[mode].keyboard) return false
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return false
      const target = event.target
      if (
        target !== null &&
        target !== undefined &&
        typeof target.closest === 'function' &&
        target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]') !== null
      ) {
        return false
      }
      if (event.key === ' ' || event.key === 'Spacebar') {
        // Space stays snake-only: start / pause / resume.
        if (mode !== 'snake') return false
        if (
          target !== null &&
          target !== undefined &&
          typeof target.closest === 'function' &&
          target.closest('button, a[href], [role="button"]') !== null
        ) {
          return false
        }
        event.preventDefault()
        snakeSpace()
        return true
      }
      if (mode === 'safari') {
        // D48: arrows/WASD steer the explorer one cell, and an open encounter
        // window is keyboard-operable: Space/Enter throws, Escape releases.
        // Space and arrows NEVER fall through to the browser inside the
        // safari view — the default would scroll the page mid-play.
        const isSpace =
          event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space'
        const snap = safariStore.getSnapshot()
        if (snap.encounter !== null) {
          const action = sfEncounterKey(event.key, event.code)
          const steering =
            SF_KEY_DIRECTIONS[event.code] !== undefined || SF_KEY_DIRECTIONS[event.key] !== undefined
          if (action === null) {
            if (isSpace || steering) event.preventDefault()
            return isSpace || steering
          }
          const onButton =
            target !== null &&
            target !== undefined &&
            typeof target.closest === 'function' &&
            target.closest('button, a[href], [role="button"]') !== null
          if (onButton && event.key !== 'Escape') return false
          event.preventDefault()
          if (action === 'throw') safariStore.throwBall()
          else safariStore.release()
          return true
        }
        if (isSpace) {
          // No encounter yet: swallow the scroll default.
          event.preventDefault()
          return true
        }
        // N = next region (换区域), matching the board's key-hint chips.
        if (event.code === 'KeyN' || event.key === 'n' || event.key === 'N') {
          event.preventDefault()
          safariStore.nextRegion()
          return true
        }
        const dir = SF_KEY_DIRECTIONS[event.code] ?? SF_KEY_DIRECTIONS[event.key]
        if (dir === undefined) return false
        event.preventDefault()
        safariStore.stepDir(dir)
        return true
      }
      const dir = ARROW_DIRECTIONS[event.key]
      if (dir === undefined) return false
      event.preventDefault()
      gameStore.turn(dir)
      return true
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

    const gomokuStore = forwardStore(() => gomokuStoreImpl)

    const SETTINGS_KEY = 'dsh-wait-buddy.settings.v1'
    const DEFAULT_SETTINGS = {
      speed: 'normal',
      level: 'medium',
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
.wb-pulse{display:flex;gap:2px;height:3px;align-items:stretch;border-radius:999px}
.wb-pulseSeg{flex:1;min-width:2px;border-radius:999px;background:var(--dsw-alias-bg-layer-2)}
.wb-pulseSeg[data-on="true"]{background:var(--dsw-alias-state-warn-primary)}
.wb-pulseFill{position:absolute;top:0;bottom:0;width:32%;border-radius:999px;background:linear-gradient(90deg,transparent,var(--dsw-alias-state-warn-primary),transparent);animation:wb-sweep 1.6s linear infinite}
@keyframes wb-sweep{0%{transform:translateX(-110%)}100%{transform:translateX(320%)}}
.wb-feed{flex:1 1 420px;min-width:0;display:flex;flex-direction:column;gap:4px;padding-top:2px}
.wb-feedRow{display:flex;align-items:baseline;gap:8px;min-width:0}
.wb-feedKind{flex:none;width:30px;font-size:10px;line-height:16px;color:var(--dsw-alias-label-secondary)}
.wb-feedText{flex:1;min-width:0;font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary)}
.wb-feedCopy{flex:none;appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;padding:0 2px;cursor:pointer;border-radius:4px}
.wb-feedCopy:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.wb-feedCopy:focus-visible{outline:2px solid var(--dsw-alias-brand-primary)}
.wb-feedCopied{flex:none;font-size:10px;line-height:16px;color:var(--dsw-alias-state-success-primary)}
.wb-dexGrid{display:flex;flex-wrap:wrap;gap:6px;max-width:300px;max-height:44vh;overflow:auto;whiteSpace:normal}
.wb-dexItem{display:flex;flex-direction:column;align-items:center;gap:2px;padding:3px;border-radius:6px;background:rgba(255,255,255,0.04)}
.wb-dexCount{font-size:9px;line-height:11px;color:rgba(230,242,255,.76)}
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
.wb-crash{box-sizing:border-box;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:24px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-state-error-primary);border-radius:10px;margin:12px}
.wb-keyHints{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center}
.wb-keyHint{display:inline-flex;align-items:center;gap:5px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary)}
.wb-kbd{display:inline-block;min-width:18px;padding:1px 7px;border:1px solid var(--dsw-alias-border-l2);border-bottom-width:2px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:11px;line-height:17px;text-align:center}
.wb-overlay .wb-keyHint{color:#e6f2ff}
.wb-hintNote{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.wb-buildId{color:var(--dsw-alias-label-tertiary,rgba(230,242,255,.45));font-variant-numeric:tabular-nums}
.wb-crashDetail{max-width:100%;overflow-wrap:anywhere;font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:11px;line-height:15px;color:var(--dsw-alias-state-error-primary);text-align:center}
@media (prefers-reduced-motion: reduce){.wb-pulseFill{animation:none}.wb-reward{animation:none;opacity:1}.wb-notice{animation:none;opacity:1}}
`

    // ---------------------------------------------------------------------
    // §8b GameAdapter (D45): one entry per game. The full view and the
    // floating panel render exclusively through this registry — adding a
    // third game means adding an adapter object, not new mode branches.
    // Components are hoisted function declarations, so the registry may be
    // textually earlier than some of them (FloatGame & friends live in §9).
    // ---------------------------------------------------------------------

    /** Segmented-control button (shared by games and the board footer). */
    function gameSegButton(label, key, active, onPick) {
      return h(
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
    }

    function gameSettingButtons(t, labels, activeId, onPick) {
      return Object.keys(labels).map((id) =>
        gameSegButton(t(labels[id]), id, activeId === id, () => onPick(id)),
      )
    }

    /** Snake: speed presets (§4 settings row). */
    function SnakeSetting({ t, settings }) {
      return h(
        'div',
        { className: 'wb-setting' },
        h('span', { className: 'wb-settingLabel' }, t('game.speed')),
        h(
          'div',
          { className: 'wb-seg' },
          gameSettingButtons(t, SPEED_LABEL, settings.speed, (id) => {
            settingsStore.setSpeed(id)
            gameStore.setSpeed(id)
          }),
        ),
      )
    }

    /** Gomoku: difficulty presets. */
    function GomokuSetting({ t, settings }) {
      return h(
        'div',
        { className: 'wb-setting' },
        h('span', { className: 'wb-settingLabel' }, t('gomoku.level')),
        h(
          'div',
          { className: 'wb-seg' },
          gameSettingButtons(t, LEVEL_LABEL, settings.level, (id) => settingsStore.setLevel(id)),
        ),
      )
    }

    /** Snake board: canvas + overlay + reward/notice floats (§7). */
    function SnakeBoard({ t, snake, focusRoot, pendingKind, boardRef, canvasRef }) {
      React.useEffect(() => {
        drawGame(canvasRef.current, snake)
      }, [snake])
      React.useEffect(() => {
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
      }, [])
      return h(
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
    }

    /** Gomoku board: square canvas, click-to-place, terminal overlay. */
    function GomokuBoard({ t, gomoku, focusRoot, boardRef, canvasRef }) {
      React.useEffect(() => {
        drawGomoku(canvasRef.current, gomoku)
      }, [gomoku])
      React.useEffect(() => {
        const element = boardRef.current
        if (element === null) return undefined
        const measure = () => drawGomoku(canvasRef.current, gomokuStore.getSnapshot())
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
          'aria-label': t('gomoku.canvasLabel', { moves: gomoku.moves }),
          onClick: (event) => {
            if (canvasRef.current === null) return
            const index = gomokuPointAt(canvasRef.current, event.clientX, event.clientY)
            if (index >= 0) gomokuStore.place(index, settingsStore.getSnapshot().level)
          },
        }),
        gomokuOverlay(t, gomoku, focusRoot),
      )
    }

    /** Snake foot: score caption, reset, keyboard hint. */
    function SnakeControls({ t, snake }) {
      return h(
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
    }

    /** Gomoku foot: move counters, reset, hint. */
    function GomokuControls({ t, gomoku }) {
      return h(
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
    }

    /** Floating-panel control row (snake): score, reset, background. */
    function PillSnakeCtl({ t, store, goBackground }) {
      const [game, setGame] = React.useState(() => store.getSnapshot())
      React.useEffect(() => {
        const sync = () => setGame(store.getSnapshot())
        sync()
        return store.subscribe(sync)
      }, [store])
      return h(
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
    }

    /** Floating-panel control row (gomoku): moves, play again, background. */
    function PillGomokuCtl({ t, store, goBackground }) {
      const [state, setState] = React.useState(() => store.getSnapshot())
      React.useEffect(() => {
        const sync = () => setState(store.getSnapshot())
        sync()
        return store.subscribe(sync)
      }, [store])
      return h(
        'div',
        { className: 'wb-pillCtl' },
        h(
          'span',
          null,
          t('gomoku.moves', {
            you: Math.ceil(state.moves / 2),
            ai: Math.floor(state.moves / 2),
          }),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'wb-pillCtlBtn',
            onClick: () => store.reset(),
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
      )
    }

    /**
     * The registry (D45). `pauseOnLeave`: switching away from this game must
     * pause its round (snake ticks; gomoku is turn-based and does not).
     * `keyboard`: the game consumes arrow/space keys in the full view.
     * `store` is a getter because store impls live per-apply (RT-04).
     */
    const GAMES = {
      snake: {
        id: 'snake',
        titleKey: 'game.title',
        store: () => gameStore,
        pauseOnLeave: true,
        keyboard: true,
        Board: SnakeBoard,
        Setting: SnakeSetting,
        Controls: SnakeControls,
        Float: FloatGame,
        FloatCtl: PillSnakeCtl,
      },
      gomoku: {
        id: 'gomoku',
        titleKey: 'gomoku.title',
        store: () => gomokuStore,
        pauseOnLeave: false,
        keyboard: false,
        Board: GomokuBoard,
        Setting: GomokuSetting,
        Controls: GomokuControls,
        Float: FloatGomoku,
        FloatCtl: PillGomokuCtl,
      },
    }

    const GAME_ORDER = ['snake', 'gomoku']

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

    function sfPaintSprite(ctx, species, u) {
      const body = Math.floor(species / (SF_PALETTES * SF_PATTERNS))
      const palette = Math.floor((species % (SF_PALETTES * SF_PATTERNS)) / SF_PATTERNS)
      const pattern = species % SF_PATTERNS
      const tone = sfTones(SF_PALETTE_COLORS[palette])
      const put = (fx, fy, fw, fh, fill) => {
        // Clamped to the canvas: outline rects grow one pixel past the
        // silhouette and must be cropped, not drawn off-canvas.
        const x0 = Math.max(0, Math.round(fx * u))
        const y0 = Math.max(0, Math.round(fy * u))
        const x1 = Math.min(u, Math.round((fx + fw) * u))
        const y1 = Math.min(u, Math.round((fy + fh) * u))
        if (x1 <= x0 || y1 <= y0) return
        ctx.fillStyle = fill
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
      }
      // steps. Each entry: [x, y, w, h].
      let rects
      if (body === 0) {
        // Round blob: two upright ears on a wide head.
        rects = [
          [0.19, 0.0, 0.12, 0.19], [0.44, 0.0, 0.12, 0.19],
          [0.12, 0.16, 0.5, 0.31], [0.06, 0.38, 0.62, 0.34], [0.19, 0.7, 0.38, 0.14],
        ]
      } else if (body === 1) {
        // Squat block: a curled tail on the right.
        rects = [
          [0.82, 0.24, 0.12, 0.12], [0.88, 0.34, 0.1, 0.14], [0.8, 0.46, 0.14, 0.1],
          [0.12, 0.2, 0.62, 0.16], [0.06, 0.34, 0.74, 0.42], [0.12, 0.72, 0.62, 0.12],
        ]
      } else {
        // Tall bean: a crest fin on top.
        rects = [
          [0.44, 0.0, 0.12, 0.12], [0.38, 0.08, 0.24, 0.06],
          [0.31, 0.12, 0.38, 0.66], [0.25, 0.2, 0.5, 0.5],
        ]
      }
      // Feet (shared silhouette base).
      rects.push([0.28, 0.84, 0.16, 0.14], [0.56, 0.84, 0.16, 0.14])
      const pad = 1 / 16
      // 1) Outline pass: every silhouette rect expanded by one pixel (D48 S1).
      for (const [x, y, w, hh] of rects) {
        put(x - pad, y - pad, w + pad * 2, hh + pad * 2, tone.outline)
      }
      // 2) Base pass.
      for (const [x, y, w, hh] of rects) {
        put(x, y, w, hh, tone.base)
      }
      // 3) Light top (upper ~30% of the body block) and dark under-edge.
      if (body === 0) {
        put(0.12, 0.16, 0.5, 0.12, tone.light)
        put(0.06, 0.66, 0.62, 0.06, tone.dark)
      } else if (body === 1) {
        put(0.12, 0.2, 0.62, 0.1, tone.light)
        put(0.06, 0.7, 0.74, 0.06, tone.dark)
      } else {
        put(0.31, 0.12, 0.38, 0.16, tone.light)
        put(0.25, 0.64, 0.5, 0.06, tone.dark)
      }
      // Feet in the dark tone so the creature "stands".
      put(0.28, 0.84, 0.16, 0.14, tone.dark)
      put(0.56, 0.84, 0.16, 0.14, tone.dark)
      // 4) Pattern coverage ~35% of the body (D48 S2), solid tones.
      if (pattern === 0) {
        // Belly patch.
        if (body === 2) put(0.31, 0.42, 0.38, 0.3, tone.light)
        else put(0.19, 0.48, 0.44, 0.26, tone.light)
      } else if (pattern === 1) {
        // Spots.
        put(0.22, 0.34, 0.14, 0.14, tone.dark)
        put(0.56, 0.44, 0.13, 0.13, tone.dark)
        put(0.34, 0.58, 0.12, 0.12, tone.dark)
        put(0.6, 0.26, 0.1, 0.1, tone.dark)
      } else {
        // Stripes.
        put(0.25, 0.28, 0.09, 0.44, tone.dark)
        put(0.45, 0.26, 0.09, 0.46, tone.dark)
        put(0.63, 0.32, 0.09, 0.38, tone.dark)
      }
      // 5) Eyes: bigger whites, pupil and a catch-light pixel (S1).
      const eyeY = body === 1 ? 0.36 : body === 2 ? 0.3 : 0.28
      const eyeXs = body === 2 ? [0.36, 0.5] : body === 1 ? [0.22, 0.5] : [0.22, 0.44]
      for (const ex of eyeXs) {
        put(ex, eyeY, 0.15, 0.14, '#ffffff')
        put(ex + 0.04, eyeY + 0.03, 0.08, 0.08, '#101014')
        put(ex + 0.02, eyeY + 0.02, 0.04, 0.04, '#e8f4ff')
      }
      // 5b) Face details (D48c): blush cheeks, a tiny mouth, lighter ear
      // inners — the last bits of "cute" come from these micro-accents.
      const blush = sfMixHex(SF_PALETTE_COLORS[palette], 255, 0.5)
      const cheekY = eyeY + 0.14
      const cheekXs = body === 2 ? [0.31, 0.58] : body === 1 ? [0.16, 0.68] : [0.14, 0.6]
      for (const cxp of cheekXs) {
        put(cxp, cheekY, 0.09, 0.06, blush)
      }
      const mouthX = body === 2 ? 0.44 : body === 1 ? 0.38 : 0.36
      put(mouthX, eyeY + 0.1, 0.1, 0.05, tone.dark)
      if (body === 0) {
        // Ear inners.
        put(0.21, 0.03, 0.08, 0.1, tone.light)
        put(0.46, 0.03, 0.08, 0.1, tone.light)
      } else if (body === 1) {
        // Tail tip highlight.
        put(0.82, 0.24, 0.12, 0.06, tone.light)
      } else {
        // Crest stripe.
        put(0.44, 0.0, 0.06, 0.1, tone.light)
      }
      // 6) Rarity flourish (D48 S3): deterministic from the species number.
      const rarity = sfRarityOf(species)
      if (rarity === 'very') {
        // Star sparkle, top-right.
        put(0.7, 0.0, 0.08, 0.24, '#ffd23f')
        put(0.62, 0.08, 0.24, 0.08, '#ffd23f')
        put(0.7, 0.08, 0.08, 0.08, '#fff6c9')
      } else if (rarity === 'rare') {
        // Light aura dots.
        put(0.06, 0.06, 0.08, 0.08, tone.light)
        put(0.84, 0.16, 0.07, 0.07, tone.light)
        put(0.14, 0.0, 0.05, 0.05, tone.light)
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
        : h(SfSpriteIcon, { species, size: 64 })
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
          ctx.clearRect(0, 0, 16, 16)
          sfPaintSprite(ctx, species, 16)
        })
      }, [species])
      // 16×16 pixel buffer, integer-scaled by CSS (pixelated) — crisp blocks.
      return h('canvas', {
        ref: canvasRef,
        width: 16,
        height: 16,
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
                  h(SfSpriteIcon, { species: Number(id), size: 32 }),
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
.wb-pillNotice{padding:5px 10px;border-top:1px solid var(--dsw-alias-border-l2);font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);white-space:normal}
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
     * D42: transient visible feedback when a host-coupling workaround fails
     * (instead of a silent `false`). The pill renders it; quiet mode falls
     * back to a system notification when permission allows.
     */
    const adapterNotice = (() => {
      let text = ''
      let timer = null
      const listeners = new Set()
      const push = () => {
        for (const listener of [...listeners]) listener()
      }
      return {
        get: () => text,
        show(next) {
          text = next
          if (timer !== null) clearTimeout(timer)
          timer = setTimeout(() => {
            text = ''
            timer = null
            push()
          }, 4000)
          push()
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      }
    })()

    /**
     * D36/D42 (hostAdapter): open the WaitBuddy conversation view. No public
     * service exists (activateView depends on host-internal store actions),
     * so this drives the same UI a user would: the WaitBuddy tab in the
     * session header, or the More-views menu entry when the tab is collapsed
     * into it. Callers must surface a `false` result — never fail silently.
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
      // D42: host-adapter failure feedback (auto-dismisses).
      const [notice, setNotice] = React.useState(() => adapterNotice.get())
      React.useEffect(() => adapterNotice.subscribe(() => setNotice(adapterNotice.get())), [])
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
      const [pillMode, setPillMode] = React.useState(GAME_ORDER[0])
      // D45: the pill renders games exclusively through the adapter registry.
      const pillGame = GAMES[pillMode]
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
      // D42: a failed view switch is never silent — pill notice + optional
      // system notification (quiet mode has no UI left to show it in).
      const goBackground = async () => {
        settingsStore.setPresence('quiet')
        const opened = await openFullView()
        if (opened) return
        console.warn('[wait-buddy] openFullView failed on this host')
        adapterNotice.show(t('adapter.openViewFailed'))
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(t('notify.title'), { body: t('adapter.openViewFailed') })
          } catch (error) {
            console.warn('[wait-buddy] adapter feedback notification failed', error)
          }
        }
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
        notice === ''
          ? null
          : h('div', { className: 'wb-pillNotice', role: 'status' }, notice),
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
                ...GAME_ORDER.map((id) =>
                  h(
                    'button',
                    {
                      key: id,
                      type: 'button',
                      className: 'wb-pillTabBtn',
                      'data-active': pillMode === id ? 'true' : 'false',
                      onClick: () => {
                        if (pillMode === id) return
                        // Same rule as the full view: leaving a ticking game
                        // pauses its round (D45 pauseOnLeave).
                        if (GAMES[pillMode].pauseOnLeave) GAMES[pillMode].store().pause()
                        setPillMode(id)
                      },
                    },
                    t(GAMES[id].titleKey),
                  ),
                ),
              ),
              h(pillGame.Float, { t, store: pillGame.store() }),
              h(pillGame.FloatCtl, { t, store: pillGame.store(), goBackground }),
            )
          : null,
      )
    }

    /**
     * One activity feed row. The Host folds consecutive same-tool calls into
     * `count`; render "text ×N" and offer one-click copy of the full text
     * (feedback P1: a wall of tool lines is unscannable).
     */
    function FeedRow({ t, item }) {
      const [copied, setCopied] = React.useState(false)
      React.useEffect(() => {
        if (!copied) return undefined
        const id = setTimeout(() => setCopied(false), 1400)
        return () => clearTimeout(id)
      }, [copied])
      const copy = async () => {
        try {
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(item.text)
          setCopied(true)
        } catch (error) {
          console.warn('[wait-buddy] copy failed', error)
        }
      }
      const label = item.count > 1 ? `${item.text} ×${item.count}` : item.text
      return h(
        'div',
        { className: 'wb-feedRow' },
        h(
          'span',
          { className: 'wb-feedKind', 'data-kind': item.kind },
          t(FEED_LABEL[item.kind] || FEED_LABEL.tool),
        ),
        h('span', { className: 'wb-feedText', title: item.text }, label),
        copied
          ? h('span', { className: 'wb-feedCopied', role: 'status' }, t('feed.copied'))
          : h(
              'button',
              {
                type: 'button',
                className: 'wb-feedCopy',
                'aria-label': t('feed.copy'),
                title: t('feed.copy'),
                onClick: copy,
              },
              '⧉',
            ),
      )
    }

    /** 12 segments × 5s: which recent buckets saw tool activity. */
    const PULSE_SEGMENTS = 12
    const PULSE_BUCKET_MS = 5000

    /**
     * Activity pulse strip (feedback P1): a real sparkline over the last
     * minute — lit segments mean the feed head changed in that bucket, so
     * "quiet but working" and "stuck" are distinguishable at a glance.
     */
    function ActivityPulse({ t, activity }) {
      const pulses = React.useRef([])
      const [, bump] = React.useState(0)
      const head = activity[0]
      const headKey = head === undefined ? '' : `${head.kind}:${head.text}`
      React.useEffect(() => {
        if (headKey === '') return
        const now = Date.now()
        pulses.current = [...pulses.current, now].filter((at) => now - at < 60000).slice(-40)
      }, [headKey])
      React.useEffect(() => {
        const id = setInterval(() => bump((value) => value + 1), PULSE_BUCKET_MS)
        return () => clearInterval(id)
      }, [])
      const now = Date.now()
      const marks = pulses.current
      const segments = []
      for (let i = 0; i < PULSE_SEGMENTS; i += 1) {
        const from = now - (PULSE_SEGMENTS - i) * PULSE_BUCKET_MS
        const to = from + PULSE_BUCKET_MS
        const on = marks.some((at) => at >= from && at < to)
        segments.push(
          h('span', {
            key: i,
            className: 'wb-pulseSeg',
            'data-on': on ? 'true' : 'false',
          }),
        )
      }
      const live = marks.some((at) => now - at < 60000)
      return h(
        'div',
        { className: 'wb-pulse', 'aria-hidden': true, title: t(live ? 'feed.pulseLive' : 'feed.pulseIdle') },
        segments,
      )
    }

    function WaitBuddyView(props) {
      const t = typeof props.t === 'function' ? props.t : boundT
      const rootRef = React.useRef(null)
      const innerRef = React.useRef(null)
      // Window-level fallback for game keys (feedback: Space scrolled the
      // page). The React onKeyDown only fires while focus is inside the view
      // — after an encounter closes, focus falls back to <body> and the
      // browser scrolls instead of playing. Two more details make it stick:
      //   1. capture phase — a host that scrolls from its own capture
      //      listener would otherwise act before our bubble-phase handler;
      //   2. stopPropagation on consumed keys — the host's handlers must not
      //      run at all for a key the game consumed.
      React.useEffect(() => {
        const onWindowKeyDown = (event) => {
          const root = rootRef.current
          let visible = false
          if (root !== null) {
            const rect = root.getBoundingClientRect()
            visible = rect.width !== 0 && rect.height !== 0
          }
          if (event.defaultPrevented) return
          if (root === null) return
          if (!visible) return
          const consumed = onGameKeyDown(event)
          if (!consumed) return
          event.preventDefault()
          // stopImmediate: same-node host listeners registered earlier must
          // not act on a key the game consumed either.
          event.stopImmediatePropagation()
          // The conversation's follow-tail animation interrupts on Space /
          // arrows "unless a child has prevented the key's default action" —
          // our preventDefault would silently KEEP the tail following, i.e.
          // the page keeps scrolling while a session streams. The host
          // interrupts unconditionally on wheel: dispatch a synthetic wheel
          // pulse (untrusted → no native scroll of its own) to release it.
          try {
            document.dispatchEvent(
              new WheelEvent('wheel', { deltaY: 1, bubbles: true, cancelable: true }),
            )
          } catch (error) {
            void error
          }
        }
        window.addEventListener('keydown', onWindowKeyDown, true)
        return () => window.removeEventListener('keydown', onWindowKeyDown, true)
      }, [])
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
                ? h(ActivityPulse, { t, activity: state.activity })
                : null,
              h(
                'div',
                {
                  className: 'wb-disclaimer',
                  title:
                    typeof window !== 'undefined' && window.__WB_BUILD_ID__ !== undefined
                      ? `build ${window.__WB_BUILD_ID__}`
                      : undefined,
                },
                t('footer.line'),
                // Visible build id: the host serves plugin clients from an
                // activation-time snapshot, so a page refresh can deliver a
                // stale bundle — the footer must tell which build is live.
                typeof window !== 'undefined' && window.__WB_BUILD_ID__ !== undefined
                  ? h('span', { className: 'wb-buildId' }, ` · ${window.__WB_BUILD_ID__}`)
                  : null,
              ),
            ),
            h(
              'div',
              { className: 'wb-feed', 'data-card': 'feed' },
              state.activity.length === 0
                ? h('div', { className: 'wb-feedEmpty' }, t('feed.empty'))
                : state.activity.map((item, index) =>
                    h(FeedRow, { key: `${item.kind}-${index}`, t, item }),
                  ),
            ),
          ),
          h(GameArea, { t, sessionId: props.sessionId, focusRoot, pendingKind: state.pendingKind }),
        ),
      )
    }

    // ---------------------------------------------------------------------
    // §10 Module registration. The host injects these services before
    // apply(); missing optional slots degrade per docs/compat.md.
    // D43 (RT-03/AR-02): every registered surface is wrapped in an error
    // boundary — a render crash shows a fallback line instead of a blank
    // pane, and never propagates into the host tree.
    // ---------------------------------------------------------------------
    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false, message: '' }
      }

      static getDerivedStateFromError(error) {
        return { failed: true, message: String((error !== null && error !== undefined && error.message) || error) }
      }

      componentDidCatch(error) {
        console.error('[wait-buddy] view crashed', error)
      }

      render() {
        if (this.state.failed) {
          return h(
            'div',
            { className: 'wb-crash', role: 'alert' },
            h('div', null, this.props.t('ui.crashed')),
            // Surface the cause so a screenshot is actionable (a bare
            // fallback hid every crash's root cause from reports).
            h('div', { className: 'wb-crashDetail' }, this.state.message),
          )
        }
        return this.props.children
      }
    }

    function ViewWithBoundary(props) {
      return h(ErrorBoundary, { t: boundT }, h(WaitBuddyView, props))
    }

    function PillWithBoundary(props) {
      return h(ErrorBoundary, { t: boundT }, h(PresencePill, props))
    }

    return {
      // RT-05: `uiSession` is declared (not just ctx.get) so the host binds it
      // before apply(); the monitor source still tolerates a late binding.
      inject: ['slots', 'sessions', 'locale', 'uiSession'],
      apply(ctx) {
        clientCtx = ctx
        ctx.effect(() => {
          // RT-04: impls live per-apply; dispose clears the DOM listener and a
          // later re-apply rebuilds everything (the forwarding objects above
          // keep older references pointing at the fresh impls).
          gameStoreImpl = createGameStore()
          gomokuStoreImpl = createGomokuStore()
          safariStoreImpl = createSafariStore()
          const stopSignals = signalHub.subscribe((signal) => gameStore.handleSignal(signal))
          return () => {
            stopSignals()
            gameStoreImpl?.dispose()
            safariStoreImpl?.dispose()
            gameStoreImpl = null
            gomokuStoreImpl = null
            safariStoreImpl = null
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
            ViewWithBoundary,
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
              PillWithBoundary,
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
        // D42: permission is never requested here — only from the board's
        // "Enable notifications" button (user gesture). Without permission
        // the notifier simply never fires.
        ctx.effect(() => {
          if (typeof Notification === 'undefined') return () => {}
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
        // D42: the shortcut can be disabled in the board footer; when off it
        // never intercepts the key (no preventDefault).
        ctx.effect(() => {
          if (typeof window === 'undefined') return () => {}
          const onKeyDown = (event) => {
            if (event.code !== 'KeyW') return
            if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey) return
            if (!settingsStore.getSnapshot().shortcut) return
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
      __ui: { statusText, metaText, failureText },
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
        adapterNotice,
      },
      /** Static UI pieces + stylesheet, exported for component tests. */
      __components: { AlertBanner, gameOverlay, gomokuOverlay, ErrorBoundary },
      /** GameAdapter registry (D45), exported for tests and future games. */
      __games: { GAMES, GAME_ORDER },
      __css: CSS,
      /** Full view, exported for static layout tests only. */
      __view: WaitBuddyView,
      __gameStore: gameStore,
      /** Safari store forwarder, exported for live-DOM harnesses. */
      __safariStore: safariStore,
      /**
       * Test/visual-harness hook (RT-04): installs a store runtime without a
       * host apply(); production code never calls this.
       */
      __installRuntime() {
        if (gameStoreImpl === null) gameStoreImpl = createGameStore()
        if (gomokuStoreImpl === null) gomokuStoreImpl = createGomokuStore()
        if (safariStoreImpl === null) safariStoreImpl = createSafariStore()
      },
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
        sfSpawnOf,
        sfMigratePos,
        sfEncounterKey,
        SF_CATCH_RATE,
        SF_RUSTLE_MS,
        SF_SPECIES_TOTAL,
        drawSafariMap,
        sfPaintPixels,
        sfPaintSprite,
        sfThemeOf,
        sfTones,
        sfEncounterOverlay,
        sfDexOverlay,
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

;window.__WB_BUILD_ID__ = 'add7c7e8';
