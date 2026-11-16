
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
     * Returns true when the key was consumed (prevented / handled). This is
     * bound to the view root only: the plugin does not capture keys at the
     * window and does not stop propagation, so the host and other plugins
     * keep their own input handling.
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
