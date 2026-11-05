import test from 'node:test'
import assert from 'node:assert/strict'
import { loadClient } from '../test-support/load-client.mjs'

const client = loadClient()
const { statusText, metaText } = client.__ui

const dict = {
  'status.idle': 'idle',
  'status.runningStart': 'running-start',
  'status.running': 'running',
  'status.approval': 'approval',
  'status.success': 'success',
  'status.failed': 'failed',
  'status.aborted': 'aborted',
  'status.loading': 'loading',
  'status.degraded': 'degraded',
  'status.stale': 'stale',
  'status.endedUnknown': 'ended-unknown',
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
  stepCount: 3,
  ...over,
})

test('health copy takes precedence over a running status', () => {
  assert.equal(statusText(t, state({ health: 'loading' })), 'loading')
  assert.equal(statusText(t, state({ health: 'degraded' })), 'degraded')
  assert.equal(statusText(t, state({ health: 'stale' })), 'stale')
})

test('approval and failure are never hidden by health', () => {
  assert.equal(statusText(t, state({ status: 'pending_approval', health: 'degraded' })), 'approval')
  assert.equal(statusText(t, state({ status: 'failed', health: 'degraded' })), 'failed')
})

test('aborted with a reason is shown as an unknown end, not a cancel', () => {
  assert.equal(statusText(t, state({ status: 'aborted', errorMessage: '' })), 'aborted')
  assert.equal(statusText(t, state({ status: 'aborted', errorMessage: '未知结束原因：x' })), 'ended-unknown')
})

test('meta includes the real step count when present', () => {
  const text = metaText(t, state())
  assert.match(text, /updated \d{2}:\d{2}:\d{2}/)
  assert.match(text, /steps 3/)
})

test('meta omits step count at zero', () => {
  const text = metaText(t, state({ stepCount: 0 }))
  assert.doesNotMatch(text, /steps/)
})
