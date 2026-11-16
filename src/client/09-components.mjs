
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
     * Coarse clock for the status row/pulse. One timer while a turn is
     * running or blocked; inactive views pay nothing.
     */
    function useNow(active, intervalMs = 5000) {
      const [, setTick] = React.useState(0)
      React.useEffect(() => {
        if (!active) return undefined
        const id = setInterval(() => setTick((value) => value + 1), intervalMs)
        return () => clearInterval(id)
      }, [active, intervalMs])
      return Date.now()
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
.wb-pillNotice{display:flex;align-items:flex-start;gap:8px;padding:5px 10px;border-top:1px solid var(--dsw-alias-border-l2);font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);white-space:normal}
.wb-pillNoticeText{flex:1 1 auto;min-width:0}
.wb-pillNoticeClose{flex:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:14px;line-height:16px;padding:0 2px;border-radius:4px}
.wb-pillNoticeClose:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
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
    let viewOpenerSession = null

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
      const clear = () => {
        if (timer !== null) {
          clearTimeout(timer)
          timer = null
        }
        if (text === '') return
        text = ''
        push()
      }
      return {
        get: () => text,
        show(next, options) {
          text = next
          if (timer !== null) clearTimeout(timer)
          timer = null
          // A failed view switch is persistent: the user needs the instruction
          // until they act or dismiss it, not a 4-second toast.
          if (options === undefined || options.persistent !== true) {
            timer = setTimeout(() => {
              text = ''
              timer = null
              push()
            }, 4000)
          }
          push()
        },
        clear,
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      }
    })()

    /** Does this element's visible/ARIA label name the WaitBuddy view? */
    function matchesViewLabel(element, label) {
      if (label === '') return false
      const text = (element.textContent || '').replace(/\s+/gu, ' ').trim()
      const aria = (element.getAttribute('aria-label') || '').trim()
      return text === label || text.includes(label) || aria === label || aria.includes(label)
    }

    /** Exact label wins; substring matching is only a second pass. */
    function pickByLabel(elements, label) {
      const exact = elements.find((element) => {
        const text = (element.textContent || '').replace(/\s+/gu, ' ').trim()
        const aria = (element.getAttribute('aria-label') || '').trim()
        return text === label || aria === label
      })
      return exact ?? elements.find((element) => matchesViewLabel(element, label))
    }

    /** The first visible conversation tablist, or the document as a fallback. */
    function viewTabScope() {
      if (typeof document === 'undefined') return undefined
      const lists = Array.from(document.querySelectorAll('[data-conversation-tabs]'))
      return lists.find((element) => element.offsetParent !== null) ?? lists[0] ?? document
    }

    /** Last-resort semantic tab lookup; the visible label is our own i18n. */
    function findViewTab(label) {
      const scope = viewTabScope()
      if (scope === undefined) return undefined
      return pickByLabel(Array.from(scope.querySelectorAll('[role="tab"]')), label)
    }

    /** Poll for the More-views menu item; bounded, never an unbounded delay. */
    async function findViewMenuItem(label, timeoutMs = 500) {
      const startedAt = Date.now()
      while (Date.now() - startedAt < timeoutMs) {
        const menu = document.querySelector('[role="menu"]')
        const scope = menu ?? document
        const item = pickByLabel(
          Array.from(scope.querySelectorAll('[role="menuitem"], button')),
          label,
        )
        if (item !== undefined) return item
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
      return undefined
    }

    /**
     * D36/D42/D53 (hostAdapter): open the WaitBuddy conversation view.
     * Primary: the host-provided `openView` captured from the mounted view or
     * the views-actions entry. Last resort: the visible tab / More-views item,
     * matched by our own localized label (never hardcoded host copy).
     * Callers must surface a `false` result — never fail silently.
     */
    async function openFullView(sessionId, label) {
      // Primary: the host-provided openView, captured from the mounted view or
      // the views-actions entry (persists after its menu unmounts).
      if (viewOpener !== null) {
        if (viewOpenerSession === null || sessionId === undefined || viewOpenerSession === sessionId) {
          try {
            viewOpener('waitbuddy')
            return true
          } catch (error) {
            console.warn('[wait-buddy] openView failed', error)
          }
        }
      }
      // Last resort: the visible tab / More-views item, matched by our own
      // localized label (never hardcoded host copy). Bounded polling, and a
      // false result still produces the persistent user instruction.
      const tab = findViewTab(label)
      if (tab !== undefined) {
        tab.click()
        return true
      }
      const scope = viewTabScope()
      if (scope === undefined) return false
      const more = scope.querySelector('button[aria-haspopup="menu"]')
      if (more !== null) {
        // Do not toggle an already-open menu closed.
        if (document.querySelector('[role="menu"]') === null) more.click()
        const item = await findViewMenuItem(label)
        if (item !== undefined) {
          item.click()
          return true
        }
      }
      return false
    }

    function ViewMenuEntry(props) {
      const t = typeof props.t === 'function' ? props.t : boundT
      React.useEffect(() => {
        // Capture persistently: the host renders this entry inside a menu that
        // unmounts when closed. The old cleanup made `onOpen` available only
        // while the menu was open, so the pill's background button always fell
        // back to a failure. A captured opener stays valid for its session.
        viewOpener = typeof props.onOpen === 'function' ? props.onOpen : null
        viewOpenerSession = typeof props.sessionId === 'string' ? props.sessionId : null
      }, [props.onOpen, props.sessionId])
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
        const opened = await openFullView(sessionId, t('view.label'))
        if (opened) {
          adapterNotice.clear()
          settingsStore.setPresence('quiet')
          return
        }
        // Keep the pill visible on failure: going quiet first would hide the
        // only surface that can tell the user what to click.
        console.warn('[wait-buddy] openFullView failed on this host')
        adapterNotice.show(t('adapter.openViewFailed'), { persistent: true })
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
          : h(
              'div',
              { className: 'wb-pillNotice', role: 'status' },
              h('span', { className: 'wb-pillNoticeText' }, notice),
              h(
                'button',
                {
                  type: 'button',
                  className: 'wb-pillNoticeClose',
                  'aria-label': t('notice.dismiss'),
                  onClick: (event) => {
                    event.stopPropagation()
                    adapterNotice.clear()
                  },
                },
                '×',
              ),
            ),
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

    /** Compact duration (locale-neutral units). */
    function formatDuration(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms)) return ''
      return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
    }

    /** Collapsed glance rows; the projection keeps up to ACTIVITY_LIMIT. */
    const FEED_COLLAPSED = 3

    /** Pure collapsed/expanded slice, exported for tests. */
    function visibleActivity(activity, expanded) {
      if (expanded || activity.length <= FEED_COLLAPSED) return activity
      return activity.slice(0, FEED_COLLAPSED)
    }

    /**
     * One activity feed row. The Host folds consecutive same-tool calls into
     * `count` and attaches the matching result; render the safe summary plus
     * status/duration, and copy only that summary (never a raw command).
     */
    function FeedRow({ t, item }) {
      const [copied, setCopied] = React.useState(false)
      React.useEffect(() => {
        if (!copied) return undefined
        const id = setTimeout(() => setCopied(false), 1400)
        return () => clearTimeout(id)
      }, [copied])
      const status = item.status === 'error' ? 'error' : item.status === 'ok' ? 'ok' : 'running'
      const summary = `${item.text}${item.hint ? ` · ${item.hint}` : ''}${
        item.argCount > 0 ? ` · ${t('feed.args', { count: item.argCount })}` : ''
      }`
      const label = item.count > 1 ? `${summary} ×${item.count}` : summary
      const title = item.errorCode ? `${summary} · ${item.errorCode}` : summary
      const mark = status === 'error' ? '✕' : status === 'ok' ? '✓' : '·'
      const statusLabel = t(`feed.${status}`)
      const duration = formatDuration(item.durationMs)
      const copy = async () => {
        try {
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(summary)
          setCopied(true)
        } catch (error) {
          console.warn('[wait-buddy] copy failed', error)
        }
      }
      return h(
        'div',
        { className: 'wb-feedRow', 'data-status': status },
        h(
          'span',
          {
            className: 'wb-feedStatus',
            'data-status': status,
            title: statusLabel,
            'aria-label': statusLabel,
          },
          mark,
        ),
        h(
          'span',
          { className: 'wb-feedKind', 'data-kind': item.kind },
          t(FEED_LABEL[item.kind] || FEED_LABEL.tool),
        ),
        h('span', { className: 'wb-feedText', title }, label),
        duration === '' ? null : h('span', { className: 'wb-feedDur' }, duration),
        copied
          ? h('span', { className: 'wb-feedCopied', role: 'status' }, t('feed.copied'))
          : h(
              'button',
              {
                type: 'button',
                className: 'wb-feedCopy',
                'aria-label': t('feed.copySummary'),
                title: t('feed.copySummary'),
                onClick: copy,
              },
              '⧉',
            ),
      )
    }

    /** Glanceable feed: three rows by default, expandable to the projection cap. */
    function ActivityFeed({ t, activity, turn }) {
      const [expanded, setExpanded] = React.useState(false)
      React.useEffect(() => {
        setExpanded(false)
      }, [turn])
      const shown = visibleActivity(activity, expanded)
      const hidden = activity.length - shown.length
      return h(
        'div',
        { className: 'wb-feed', 'data-card': 'feed' },
        shown.length === 0
          ? h('div', { className: 'wb-feedEmpty' }, t('feed.empty'))
          : shown.map((item, index) =>
              h(FeedRow, { key: item.callId ?? `${item.kind}-${index}`, t, item }),
            ),
        activity.length > FEED_COLLAPSED
          ? h(
              'button',
              {
                type: 'button',
                className: 'wb-feedMore',
                onClick: () => setExpanded((value) => !value),
              },
              expanded ? t('feed.less') : t('feed.more', { count: hidden }),
            )
          : null,
      )
    }

    /** 12 segments × 5s: which recent buckets saw tool activity. */
    const PULSE_SEGMENTS = 12
    const PULSE_BUCKET_MS = 5000

    /**
     * Activity pulse strip: a real sparkline over the last minute. It is
     * driven by `revision`/`lastActivityAt`, so step/end and result events
     * count — not just a change of the feed head text.
     */
    function ActivityPulse({ t, revision, lastActivityAt, now }) {
      const pulses = React.useRef([])
      React.useEffect(() => {
        if (typeof lastActivityAt !== 'number' || lastActivityAt <= 0) return
        const cutoff = Date.now() - 60000
        pulses.current = [...pulses.current.filter((at) => at >= cutoff), lastActivityAt].slice(-60)
      }, [revision, lastActivityAt])
      const current = typeof now === 'number' ? now : Date.now()
      const marks = pulses.current.filter((at) => current - at < 60000)
      const segments = []
      for (let i = 0; i < PULSE_SEGMENTS; i += 1) {
        const from = current - (PULSE_SEGMENTS - i) * PULSE_BUCKET_MS
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
      const live =
        typeof lastActivityAt === 'number' &&
        lastActivityAt > 0 &&
        current - lastActivityAt < 60000
      const label = t(live ? 'feed.pulseLive' : 'feed.pulseIdle')
      return h(
        'div',
        { className: 'wb-pulse', role: 'img', 'aria-label': label, title: label },
        segments,
      )
    }

    function WaitBuddyView(props) {
      const t = typeof props.t === 'function' ? props.t : boundT
      const rootRef = React.useRef(null)
      const innerRef = React.useRef(null)
      // Keep the host's openView for the pill: the view may unmount when the
      // user is in Chat, but the closure stays valid for its session.
      React.useEffect(() => {
        if (typeof props.openView !== 'function') return
        viewOpener = props.openView
        viewOpenerSession = typeof props.sessionId === 'string' ? props.sessionId : null
      }, [props.openView, props.sessionId])
      // Game keys are handled by the view's own onKeyDown only. There is no
      // capture-phase key handling, no propagation stop and no synthetic wheel:
      // consuming a key outside this view is the host's and other plugins'
      // business, and the follow-tail animation must not be faked away.
      React.useEffect(() => {
        const scrollTop = () => {
          // Only this view's own scrollport is reset. Walking ancestors and
          // guessing which one the host scrolls was another DOM-mind-reading
          // hack; if the host keeps an outer scroll offset, that is its state.
          if (innerRef.current !== null) innerRef.current.scrollTop = 0
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
      const now = useNow(status === 'running' || status === 'pending_approval', 5000)
      const meta = metaText(t, state, now)
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
          now,
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
                ? h(ActivityPulse, {
                    t,
                    revision: state.revision,
                    lastActivityAt: state.lastActivityAt,
                    now,
                  })
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
            h(ActivityFeed, { t, activity: state.activity, turn: state.turn }),
          ),
          h(GameArea, { t, sessionId: props.sessionId, focusRoot, pendingKind: state.pendingKind }),
        ),
      )
    }
