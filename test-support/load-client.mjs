import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const sourcePath = path.join(here, '..', 'client.js')

/**
 * Load the DSH client bundle in a VM with just enough browser globals for the
 * module factory to run. The returned value is the object passed to the
 * Slot registry (it exposes `__monitor` and `__game` for pure-function tests).
 */
export function loadClient(options = {}) {
  const code = fs.readFileSync(sourcePath, 'utf8')
  let definition
  const window = {
    __ModuleLoader__: {
      load(value) {
        definition = value
      },
    },
    localStorage: {
      getItem() {
        return null
      },
      setItem() {},
      removeItem() {},
    },
  }
  const document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  }
  const React = options.react ?? {
    createElement() {
      return null
    },
  }
  const context = {
    window,
    document,
    console,
    React,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Math,
    JSON,
    Object,
    Array,
    Set,
    Map,
    WeakMap,
    Promise,
    Number,
    String,
    Boolean,
    RegExp,
    Error,
    parseInt,
    isNaN,
    queueMicrotask,
  }
  vm.createContext(context)
  vm.runInContext(code, context, { filename: sourcePath })
  if (definition === undefined) throw new Error('client.js did not register a module')
  const requireStub = (id) => {
    if (id === 'react') return React
    throw new Error(`unexpected require(${String(id)})`)
  }
  return definition.factory(requireStub)
}
