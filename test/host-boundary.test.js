import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('client.js', 'utf8')

const forbidden = [
  'stopImmediatePropagation',
  'new WheelEvent',
  '更多会话视图',
  'session views',
  'depth < 6',
  "window.addEventListener('keydown', onWindowKeyDown, true)",
]

test('client bundle does not capture host input or hardcode host copy', () => {
  for (const needle of forbidden) {
    assert.equal(source.includes(needle), false, `client.js still contains ${needle}`)
  }
})

test('the view-switch fallback is label-driven, not hardcoded host copy', () => {
  assert.match(source, /\[data-conversation-tabs\]/u)
  assert.match(source, /aria-haspopup="menu"/u)
  assert.equal(source.includes("startsWith('WaitBuddy')"), false)
})

test('view-switch failure is a persistent notice, not a timed toast', () => {
  assert.match(source, /persistent: true/u)
  assert.match(source, /adapterNotice\.clear\(\)/u)
})
