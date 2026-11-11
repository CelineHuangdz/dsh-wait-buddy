import test from 'node:test'
import assert from 'node:assert/strict'
import { loadClient } from '../test-support/load-client.mjs'

const client = loadClient()
const {
  settingsStore,
  createPresenceStore,
  createNotifier,
  formatElapsed,
  pendingLabelKey,
  pickMainViewSession,
  clampToViewport,
} = client.__presence
const createGameStore = client.__game.createGameStore

const dict = {
  'notify.title': 'WaitBuddy',
  'notify.approval': 'session {session} waiting for approval',
  'notify.success': 'session {session} done',
  'notify.failed': 'session {session} failed',
  'notify.aborted': 'session {session} interrupted',
}
const t = (key, params = {}) =>
  String(dict[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''))

function fakeNotifierEnv(over = {}) {
  const shown = []
  const deps = {
    subscribe(listener) {
      notifierListener = listener
      return () => {
        notifierListener = null
      }
    },
    getSettings: () => ({ notify: true, ...over.settings }),
    hasFocus: () => over.hasFocus?.() ?? false,
    permission: () => over.permission ?? 'granted',
    show: (entry) => shown.push(entry),
    t,
    sessionTitle: (id) => `sess-${id}`,
    ...over.deps,
  }
  let notifierListener = null
  const notifier = createNotifier(deps)
  return {
    notifier,
    emit: (signal) => {
      if (notifierListener !== null) notifierListener(signal)
    },
    shown,
  }
}

test('settings default to the low-key presence (pill + notifications on, D31)', () => {
  const snapshot = settingsStore.getSnapshot()
  assert.equal(snapshot.presence, 'pill')
  assert.equal(snapshot.notify, true)
  assert.equal(snapshot.pillCorner, 'top-right')
})

test('settings setters validate and persist presence fields', () => {
  settingsStore.setPresence('quiet')
  assert.equal(settingsStore.getSnapshot().presence, 'quiet')
  // The removed `dot` mode (D31) falls back to the stored value.
  settingsStore.setPresence('dot')
  assert.equal(settingsStore.getSnapshot().presence, 'quiet')
  settingsStore.setPresence('nonsense')
  assert.equal(settingsStore.getSnapshot().presence, 'quiet')
  settingsStore.setPresence('pill')
  assert.equal(settingsStore.getSnapshot().presence, 'pill')
  settingsStore.setNotify(false)
  assert.equal(settingsStore.getSnapshot().notify, false)
  settingsStore.setNotify('yes')
  assert.equal(settingsStore.getSnapshot().notify, false)
  settingsStore.setPillCorner('top-left')
  assert.equal(settingsStore.getSnapshot().pillCorner, 'top-left')
  settingsStore.setPillCorner('bottom-center')
  assert.equal(settingsStore.getSnapshot().pillCorner, 'top-left')
  settingsStore.setNotify(true)
  settingsStore.setPillCorner('top-right')
})

test('one-key hide pauses via the hidden reason and releasing keeps the round paused', (t) => {
  const store = createGameStore()
  t.after(() => store.dispose())
  store.start('normal')
  assert.equal(store.getSnapshot().status, 'running')

  store.setHidden(true)
  let state = store.getSnapshot()
  assert.equal(state.status, 'paused')
  assert.equal(state.pauseReason, 'hidden')

  store.setHidden(false)
  state = store.getSnapshot()
  assert.equal(state.status, 'paused')
  assert.equal(state.pauseReason, '')
  assert.equal(state.hiddenResumed, true)

  store.resume()
  assert.equal(store.getSnapshot().status, 'running')
  assert.equal(store.getSnapshot().hiddenResumed, false)
})

test('presence cycle toggles normal ↔ quiet and crosses the hidden boundary (D31)', () => {
  const settings = { getSnapshot: () => ({ presence: 'pill' }) }
  const calls = []
  const game = {
    setHidden(hidden) {
      calls.push(hidden)
    },
  }
  const presence = createPresenceStore(settings, game)
  assert.equal(presence.getSnapshot().effective, 'pill')
  presence.cycle()
  assert.equal(presence.getSnapshot().effective, 'quiet')
  presence.cycle()
  assert.equal(presence.getSnapshot().effective, 'pill')
  presence.cycle()
  assert.equal(presence.getSnapshot().effective, 'quiet')
  presence.cycle()
  assert.equal(presence.getSnapshot().effective, 'pill')
  assert.deepEqual(calls, [true, false, true, false])
})

test('notifications fire only for approval and terminal finishes while unfocused', () => {
  const env = fakeNotifierEnv()
  env.emit({ type: 'agent:approval_enter', sessionId: 's1', key: 'k1' })
  env.emit({ type: 'agent:task_finish', sessionId: 's1', key: '1:success', detail: { status: 'success' } })
  env.emit({ type: 'agent:task_finish', sessionId: 's1', key: '1:failed', detail: { status: 'failed' } })
  env.emit({ type: 'agent:task_finish', sessionId: 's1', key: '1:aborted', detail: { status: 'aborted' } })
  env.emit({ type: 'agent:step_advance', sessionId: 's1', key: '1:2' })
  env.emit({ type: 'agent:approval_leave', sessionId: 's1', key: 'k1' })
  assert.deepEqual(
    env.shown.map((entry) => entry.body),
    [
      'session sess-s1 waiting for approval',
      'session sess-s1 done',
      'session sess-s1 failed',
      'session sess-s1 interrupted',
    ],
  )
})

test('each event notifies at most once even when the signal repeats', () => {
  const env = fakeNotifierEnv()
  const signal = { type: 'agent:approval_enter', sessionId: 's1', key: 'k1' }
  env.emit(signal)
  env.emit({ ...signal })
  assert.equal(env.shown.length, 1)
})

test('notifications stay silent while the window is focused or the setting is off', () => {
  const focused = fakeNotifierEnv({ hasFocus: () => true })
  focused.emit({ type: 'agent:approval_enter', sessionId: 's1', key: 'k1' })
  assert.equal(focused.shown.length, 0)

  const muted = fakeNotifierEnv({ settings: { notify: false } })
  muted.emit({ type: 'agent:approval_enter', sessionId: 's1', key: 'k1' })
  assert.equal(muted.shown.length, 0)
})

test('notification bodies never carry command or activity text', () => {
  const env = fakeNotifierEnv()
  env.emit({
    type: 'agent:approval_enter',
    sessionId: 's1',
    key: 'k1',
    detail: { kind: 'approval', tool: 'bash', detail: 'rm -rf /secret' },
  })
  assert.equal(env.shown.length, 1)
  assert.equal(env.shown[0].body, 'session sess-s1 waiting for approval')
  assert.equal(env.shown[0].body.includes('rm -rf'), false)
})

test('formatElapsed renders M:SS and H:MM:SS', () => {
  assert.equal(formatElapsed(0), '0:00')
  assert.equal(formatElapsed(59_000), '0:59')
  assert.equal(formatElapsed(61_000), '1:01')
  assert.equal(formatElapsed(3_661_000), '1:01:01')
})

test('pending label keys follow the D28 kinds', () => {
  assert.equal(pendingLabelKey('approval'), 'presence.pendingApproval')
  assert.equal(pendingLabelKey(''), 'presence.pendingApproval')
  assert.equal(pendingLabelKey('question'), 'presence.pendingQuestion')
  assert.equal(pendingLabelKey('plan-review'), 'presence.pendingPlanReview')
  assert.equal(pendingLabelKey('future-kind'), 'presence.pendingGeneric')
})

test('the pill follows the main-view session only (D29 §8.4)', () => {
  assert.equal(pickMainViewSession(undefined), null)
  assert.equal(
    pickMainViewSession({
      byId: {
        a: { retainedBy: { mainView: 0 } },
        b: { retainedBy: { mainView: 2 } },
        c: {},
      },
    }),
    'b',
  )
  assert.equal(pickMainViewSession({ byId: { a: {}, c: { retainedBy: {} } } }), null)
})

test('the floating panel position clamps inside the viewport (D30)', () => {
  const at = (x, y) => ({ x: clampToViewport(x, y, 300, 280, 1280, 800).x, y: clampToViewport(x, y, 300, 280, 1280, 800).y })
  assert.deepEqual(at(-50, -20), { x: 0, y: 0 })
  assert.deepEqual(at(2000, 900), { x: 980, y: 520 })
  assert.deepEqual(at(100, 100), { x: 100, y: 100 })
  // A viewport smaller than the panel pins it at the origin.
  const tiny = clampToViewport(50, 50, 300, 280, 200, 150)
  assert.equal(`${tiny.x},${tiny.y}`, '0,0')
})

test('pillPos persists and round-trips through the settings store (D30)', () => {
  assert.equal(settingsStore.getSnapshot().pillPos, null)
  settingsStore.setPillPos({ x: 120, y: 60 })
  assert.deepEqual(settingsStore.getSnapshot().pillPos, { x: 120, y: 60 })
  settingsStore.setPillPos('nonsense')
  assert.deepEqual(settingsStore.getSnapshot().pillPos, { x: 120, y: 60 })
  settingsStore.setPillPos(null)
  assert.equal(settingsStore.getSnapshot().pillPos, null)
})

test('mouse-leave pause in the floating panel stays paused until manual resume (D30)', (t) => {
  // The floating panel owns an independent store; emulate the D30 handlers.
  const store = createGameStore()
  t.after(() => store.dispose())
  store.setGrid(32, 12)
  store.start('normal')
  assert.equal(store.getSnapshot().status, 'running')

  // leave: pause; the overlay offers Space / Resume (manual-resume only)
  if (store.getSnapshot().status === 'running') store.pause()
  assert.equal(store.getSnapshot().status, 'paused')

  // coming back does NOT resume; only space / the Resume button does
  assert.equal(store.getSnapshot().status, 'paused')
  store.resume()
  assert.equal(store.getSnapshot().status, 'running')
})

test('D42: the presence shortcut defaults on and can be disabled', () => {
  assert.equal(settingsStore.getSnapshot().shortcut, true)
  settingsStore.setShortcut(false)
  assert.equal(settingsStore.getSnapshot().shortcut, false)
  settingsStore.setShortcut(true)
  assert.equal(settingsStore.getSnapshot().shortcut, true)
})

test('D42: adapterNotice shows host-workaround failures and notifies subscribers', async () => {
  const { adapterNotice } = client.__presence
  assert.equal(adapterNotice.get(), '')
  const seen = []
  const stop = adapterNotice.subscribe(() => seen.push(adapterNotice.get()))
  adapterNotice.show('switch failed')
  assert.equal(adapterNotice.get(), 'switch failed')
  assert.deepEqual(seen, ['switch failed'])
  stop()
})
