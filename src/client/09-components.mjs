
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
