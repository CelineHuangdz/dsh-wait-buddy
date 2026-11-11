
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
        this.state = { failed: false }
      }

      static getDerivedStateFromError() {
        return { failed: true }
      }

      componentDidCatch(error) {
        console.error('[wait-buddy] view crashed', error)
      }

      render() {
        if (this.state.failed) {
          return h(
            'div',
            { className: 'wb-crash', role: 'alert' },
            this.props.t('ui.crashed'),
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
        SF_SPECIES_TOTAL,
        drawSafariMap,
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
