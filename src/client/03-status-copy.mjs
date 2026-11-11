
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
