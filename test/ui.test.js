import test from 'node:test'
import assert from 'node:assert/strict'
import { loadClient } from '../test-support/load-client.mjs'

const client = loadClient()
const { statusText, metaText, visibleActivity } = client.__ui

const dict = {
  'status.idle': 'idle',
  'status.runningStart': 'running-start',
  'status.running': 'running',
  'status.approval': 'approval',
  'status.question': 'question',
  'status.planReview': 'plan-review',
  'status.pending': 'pending-generic',
  'status.success': 'success',
  'status.failed': 'failed',
  'status.fail.error': 'fail-error',
  'status.fail.maxTokens': 'fail-max-tokens',
  'status.fail.blocked': 'fail-blocked',
  'status.aborted': 'aborted',
  'status.loading': 'loading',
  'status.degraded': 'degraded',
  'status.stale': 'stale',
  'status.endedUnknown': 'ended-unknown',
  'status.forked': 'forked',
  'status.lastActivity': 'last-activity {age}',
  'status.waiting': 'waiting {age}',
  'status.updated': 'updated {time}',
  'status.steps': 'steps {count}',
}

const t = (key, params = {}) =>
  String(dict[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''))

const state = (over = {}) => ({
  status: 'running',
  health: 'ready',
  activity: [],
  errorMessage: '',
  updatedAt: 1_700_000_000_000,
  lastActivityAt: 1_700_000_000_000,
  pendingSince: 0,
  stepCount: 3,
  ...over,
})

test('health copy takes precedence over a running status', () => {
  assert.equal(statusText(t, state({ health: 'loading' })), 'loading')
  assert.equal(statusText(t, state({ health: 'degraded' })), 'degraded')
  assert.equal(statusText(t, state({ health: 'stale' })), 'stale')
})

test('approval and failure are never hidden by health', () => {
  assert.equal(
    statusText(t, state({ status: 'pending_approval', pendingKind: 'approval', health: 'degraded' })),
    'approval',
  )
  assert.equal(statusText(t, state({ status: 'failed', health: 'degraded' })), 'failed')
})

test('pending copy follows the blocking kind (D28)', () => {
  const base = { status: 'pending_approval', health: 'degraded' }
  assert.equal(statusText(t, state({ ...base, pendingKind: 'question' })), 'question')
  assert.equal(statusText(t, state({ ...base, pendingKind: 'plan-review' })), 'plan-review')
  // Unknown future kinds fall back to the generic copy, never to approval.
  assert.equal(statusText(t, state({ ...base, pendingKind: 'future-kind' })), 'pending-generic')
  assert.equal(statusText(t, state({ ...base, pendingKind: 'approval' })), 'approval')
})

test('aborted with an unknown reason is shown as an unknown end, not a cancel', () => {
  assert.equal(statusText(t, state({ status: 'aborted', reasonCode: 'aborted' })), 'aborted')
  assert.equal(statusText(t, state({ status: 'aborted', reasonCode: 'unknown' })), 'ended-unknown')
})

test('D41: failed copy follows the reason code, not the raw message', () => {
  assert.equal(statusText(t, state({ status: 'failed', reasonCode: 'error', errorMessage: 'boom' })), 'fail-error')
  assert.equal(statusText(t, state({ status: 'failed', reasonCode: 'max-tokens' })), 'fail-max-tokens')
  assert.equal(statusText(t, state({ status: 'failed', reasonCode: 'blocked' })), 'fail-blocked')
  assert.equal(statusText(t, state({ status: 'failed', reasonCode: '' })), 'failed')
})

test('meta includes the real step count when present', () => {
  const text = metaText(t, state({ lastActivityAt: 0 }))
  assert.match(text, /updated \d{2}:\d{2}:\d{2}/)
  assert.match(text, /steps 3/)
})

test('meta omits step count at zero', () => {
  const text = metaText(t, state({ stepCount: 0, lastActivityAt: 0 }))
  assert.doesNotMatch(text, /steps/)
})

test('a forked session is visible instead of collapsing to idle', () => {
  assert.equal(statusText(t, state({ status: 'idle', reasonCode: 'forked' })), 'forked')
})

test('running meta reports age since the last event, not a frozen clock', () => {
  const text = metaText(t, state({ lastActivityAt: 1_000, updatedAt: 1_000 }), 51_000)
  assert.match(text, /last-activity 50s/)
  assert.doesNotMatch(text, /updated/)
})

test('formatAge uses compact locale-neutral units', () => {
  const { formatAge } = loadClient().__ui
  assert.equal(formatAge(0), '0s')
  assert.equal(formatAge(59_999), '59s')
  assert.equal(formatAge(60_000), '1m')
  assert.equal(formatAge(3_600_000), '1h')
})

test('activity feed collapses to three rows and expands on demand', () => {
  const activity = Array.from({ length: 8 }, (_, index) => ({ kind: 'tool', text: `t${index}` }))
  assert.equal(visibleActivity(activity, false).length, 3)
  assert.equal(visibleActivity(activity, true).length, 8)
  assert.equal(visibleActivity(activity.slice(0, 2), false).length, 2)
})
