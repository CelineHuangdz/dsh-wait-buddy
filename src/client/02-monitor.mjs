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
