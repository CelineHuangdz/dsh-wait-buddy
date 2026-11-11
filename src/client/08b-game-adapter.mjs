
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
