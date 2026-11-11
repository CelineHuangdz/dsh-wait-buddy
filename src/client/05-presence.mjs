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
