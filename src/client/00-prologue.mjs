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
