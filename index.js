/**
 * WaitBuddy — Host half.
 *
 * Registers one client-visible session projection (`waitbuddy`) that folds the
 * committed session log into the monitoring state the view renders:
 *
 *   status       idle | running | success | failed | aborted
 *   activity     last N real activities (command / tool), newest first
 *   stepCount    completed steps of the current turn (kept for M3 scoring,
 *                never displayed: an agent loop has no reliable total)
 *
 * Mapping to the M0 baseline event table (extended per decisions D1/D9):
 *   session.task.start            <- turn/start (also clears the activity feed)
 *   session.step.update           <- step/end
 *   session.task.success          <- turn/end reason=completed
 *   session.task.failed           <- turn/end reason=error|max-tokens|blocked
 *   session.task.abort            <- turn/end reason=aborted|interrupted
 *   session.tool.pending_approval <- process-local, resolved on the Client
 *   activity feed                 <- tool/call (command / tool name + argument hint)
 *
 * The projection is the only Host behaviour: it is read-only, never writes the
 * session log, and never touches approval flow.
 */
import { z } from 'zod'

const STATUS = ['idle', 'running', 'success', 'failed', 'aborted']
const ACTIVITY_KINDS = ['command', 'tool']

/** Newest-first feed length. */
const ACTIVITY_LIMIT = 3
/** Longest activity snippet kept in state; the panel is a summary, not a log. */
const TEXT_LIMIT = 120

const activitySchema = z.object({
  kind: z.enum(ACTIVITY_KINDS),
  text: z.string(),
})

const stateSchema = z.object({
  status: z.enum(STATUS),
  turn: z.number().int().nonnegative(),
  stepCount: z.number().int().nonnegative(),
  errorMessage: z.string(),
  updatedAt: z.number(),
  revision: z.number().int().nonnegative(),
  activity: z.array(activitySchema).max(ACTIVITY_LIMIT),
})

const viewSchema = z.object({
  status: z.enum(STATUS),
  turn: z.number().int().nonnegative(),
  stepCount: z.number().int().nonnegative(),
  errorMessage: z.string(),
  updatedAt: z.number(),
  revision: z.number().int().nonnegative(),
  activity: z.array(activitySchema).max(ACTIVITY_LIMIT),
})

/** Argument fields, in priority order, that describe what a tool is acting on. */
const HINT_FIELDS = [
  'file_path',
  'path',
  'pattern',
  'query',
  'url',
  'name',
  'skill',
  'agent_id',
  'job_id',
  'workspace_id',
]

function initial() {
  return {
    status: 'idle',
    turn: 0,
    stepCount: 0,
    errorMessage: '',
    updatedAt: 0,
    revision: 0,
    activity: [],
  }
}

/** Collapse whitespace and cap the snippet. */
function clip(text) {
  const flat = String(text).replace(/\s+/gu, ' ').trim()
  if (flat.length <= TEXT_LIMIT) return flat
  return `${flat.slice(0, TEXT_LIMIT - 1)}…`
}

function parseArguments(text) {
  if (typeof text !== 'string' || text.length === 0) return undefined
  try {
    const value = JSON.parse(text)
    return value !== null && typeof value === 'object' ? value : undefined
  } catch {
    return undefined
  }
}

/** Short, human-readable hint for one tool call's serialized arguments. */
function hintOf(args) {
  if (args === undefined) return ''
  for (const field of HINT_FIELDS) {
    const value = args[field]
    if (typeof value === 'string' && value.trim() !== '') return clip(value)
  }
  return ''
}

/** Newest-first feed with adjacent-duplicate suppression. */
function pushActivity(activity, kind, text) {
  const value = typeof text === 'string' ? text.trim() : ''
  if (value === '') return activity
  const head = activity[0]
  if (head !== undefined && head.kind === kind && head.text === value) return activity
  const next = [{ kind, text: value }, ...activity]
  return next.length > ACTIVITY_LIMIT ? next.slice(0, ACTIVITY_LIMIT) : next
}

/** Classify one tool call: a shell command when it carries `command`, else a tool. */
function toolActivity(name, argsText) {
  const tool = clip(name)
  const args = parseArguments(argsText)
  if (args !== undefined && typeof args.command === 'string' && args.command.trim() !== '') {
    return { kind: 'command', text: clip(args.command) }
  }
  const hint = hintOf(args)
  return { kind: 'tool', text: hint === '' ? tool : clip(`${tool} ${hint}`) }
}

/** Map one `turn/end` reason onto the baseline status vocabulary. */
export function endedWith(reason) {
  const kind = reason !== null && typeof reason === 'object' ? reason.kind : undefined
  switch (kind) {
    case 'error':
      return {
        status: 'failed',
        errorMessage: clip(reason.error?.message ?? '模型请求失败'),
      }
    case 'max-tokens':
      return { status: 'failed', errorMessage: '本轮达到模型输出上限' }
    case 'blocked':
      return { status: 'failed', errorMessage: '本轮被阻止，未继续执行' }
    case 'aborted':
      return { status: 'aborted', errorMessage: '' }
    case 'interrupted':
      return { status: 'aborted', errorMessage: '' }
    case 'forked':
      return { status: 'idle', errorMessage: '' }
    case 'completed':
      return { status: 'success', errorMessage: '' }
    default:
      // The baseline status enum has no "unknown" value. Map an unknown
      // reason to the neutral terminal state and keep the raw kind as the
      // human-readable reason; never report it as success.
      return {
        status: 'aborted',
        errorMessage: `未知结束原因：${clip(kind === undefined || kind === '' ? 'unknown' : String(kind))}`,
      }
  }
}

/** True when the event's `turn` is absent or belongs to the active turn. */
function belongsToTurn(state, event) {
  const turn = event.data === undefined ? undefined : event.data.turn
  return turn === undefined || turn === state.turn
}

/**
 * Pure, synchronous fold over committed session events. Every event that this
 * unit does not care about returns the same state reference (zero downstream
 * work); a state-carrying event returns a fresh whole state.
 */
export function fold(state, event) {
  switch (event.type) {
    case 'turn/start':
      if (state.status === 'running' && state.turn === event.data.turn) return state
      return {
        status: 'running',
        turn: event.data.turn,
        stepCount: 0,
        errorMessage: '',
        updatedAt: event.time,
        revision: state.revision + 1,
        activity: [],
      }
    case 'step/end': {
      if (state.status !== 'running' || event.data.turn !== state.turn) return state
      return {
        ...state,
        stepCount: state.stepCount + 1,
        updatedAt: event.time,
        revision: state.revision + 1,
      }
    }
    case 'tool/call': {
      if (state.status !== 'running' || !belongsToTurn(state, event)) return state
      const entry = toolActivity(event.data.name, event.data.arguments)
      const activity = pushActivity(state.activity, entry.kind, entry.text)
      if (activity === state.activity) return state
      return { ...state, activity, updatedAt: event.time, revision: state.revision + 1 }
    }
    case 'turn/end': {
      const turn = event.data === undefined ? undefined : event.data.turn
      // Late/duplicate ends for an older turn must not overwrite the current
      // turn. A missing turn on the wire is accepted for forward compatibility.
      if (turn !== undefined) {
        if (state.status === 'running' && turn !== state.turn) return state
        if (state.status !== 'running' && turn <= state.turn) return state
      }
      const ended = endedWith(event.data.reason)
      return {
        ...state,
        status: ended.status,
        errorMessage: ended.errorMessage,
        updatedAt: event.time,
        revision: state.revision + 1,
      }
    }
    default:
      return state
  }
}

/** One wire view per state object; an unchanged state never reallocates its view. */
const views = new WeakMap()

function viewOf(state) {
  const cached = views.get(state)
  if (cached !== undefined) return cached
  const view = {
    status: state.status,
    turn: state.turn,
    stepCount: state.stepCount,
    errorMessage: state.errorMessage,
    updatedAt: state.updatedAt,
    revision: state.revision,
    activity: state.activity,
  }
  views.set(state, view)
  return view
}

export const inject = ['sessionProjections']

export function apply(ctx) {
  // Registration is an effect on this plugin's fiber: unloading the plugin
  // removes the key and its cached cells.
  ctx.sessionProjections.register({
    key: 'waitbuddy',
    stateSchema,
    stateVersion: 4,
    init: () => initial(),
    apply: fold,
    wire: {
      viewSchema,
      view: viewOf,
    },
  })
}
