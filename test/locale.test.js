import test from 'node:test'
import assert from 'node:assert/strict'
import { loadClient } from '../test-support/load-client.mjs'

const { zh, en } = loadClient().__locale

test('zh and en dictionaries expose the same key set', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort())
})

test('every dictionary value is a non-empty string', () => {
  for (const [locale, dict] of [['zh', zh], ['en', en]]) {
    for (const [key, value] of Object.entries(dict)) {
      assert.equal(typeof value, 'string', `${locale} ${key}`)
      assert.notEqual(value.trim(), '', `${locale} ${key}`)
    }
  }
})

test('zh and en use the same interpolation placeholders', () => {
  const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/gu)].map((match) => match[1]).sort()
  for (const key of Object.keys(zh)) {
    assert.deepEqual(placeholders(en[key]), placeholders(zh[key]), key)
  }
})
