/**
 * WaitBuddy — Host half.
 *
 * Registers one client-visible session projection (`waitbuddy`) that folds the
 * committed session log into the monitoring state the view renders:
 *
 *   status       idle | running | success | failed | aborted
 *   activity     last N real activities (command / tool), newest first,
 *                each carrying its own result status and duration
 *   stepCount    completed steps of the current turn; shown as
 *                "N steps completed" (no total, no fake percentage)
 *   timing       turnStartedAt / lastActivityAt / lastToolAt / endedAt
 *
 * Mapping to the M0 baseline event table (extended per decisions D1/D9):
 *   session.task.start            <- turn/start (also clears the activity feed)
 *   session.step.update           <- step/end
 *   session.task.success          <- turn/end reason=completed
 *   session.task.failed           <- turn/end reason=error|max-tokens|blocked
 *   session.task.abort            <- turn/end reason=aborted|interrupted
 *   session.tool.pending_approval <- process-local, resolved on the Client
 *   activity feed                 <- tool/call + tool/result
 *
 * D51 privacy: the projection never stores a full shell command. It stores
 * the executable, the argument count, and (for other tools) a basename/host
 * hint — never raw arguments, queries, or URLs with credentials.
 *
 * The projection is the only Host behaviour: it is read-only, never writes the
 * session log, and never touches approval flow.
 */
import { z } from 'zod'

const STATUS = ['idle', 'running', 'success', 'failed', 'aborted']
const ACTIVITY_KINDS = ['command', 'tool']
const ACTIVITY_STATUS = ['running', 'ok', 'error']
// D41: the Host writes a locale-neutral reason code; the Client translates.
const REASON_CODES = [
  '',
  'error',
  'max-tokens',
  'blocked',
  'aborted',
  'interrupted',
  'forked',
  'completed',
  'unknown',
]

/** Newest-first feed length. */
const ACTIVITY_LIMIT = 8
/** Longest activity snippet kept in state; the panel is a summary, not a log. */
const TEXT_LIMIT = 120

const activitySchema = z.object({
  kind: z.enum(ACTIVITY_KINDS),
  /** Safe summary: tool name, or the executable for a shell command. */
  text: z.string(),
  /** Safe secondary hint: basename (paths) or hostname (URLs). */
  hint: z.string().optional(),
  /** Shell command argument count; locale-neutral. */
  argCount: z.number().int().nonnegative().optional(),
  /** Folded run length: consecutive same-tool calls collapse to "Read ×N". */
  count: z.number().int().positive().optional(),
  /** Tool-call id, used to attach the matching tool/result. */
  callId: z.string().optional(),
  /** Opaque hash used for run folding; never reversible to the raw command. */
  foldKey: z.string().optional(),
  status: z.enum(ACTIVITY_STATUS),
  startedAt: z.number(),
  endedAt: z.number().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  /** Locale-neutral error code/name, never the raw error text. */
  errorCode: z.string().optional(),
}).strict()

const stateSchema = z.object({
  status: z.enum(STATUS),
  turn: z.number().int().nonnegative(),
  stepCount: z.number().int().nonnegative(),
  reasonCode: z.enum(REASON_CODES),
  errorMessage: z.string(),
  updatedAt: z.number(),
  revision: z.number().int().nonnegative(),
  turnStartedAt: z.number(),
  lastActivityAt: z.number(),
  lastToolAt: z.number(),
  endedAt: z.number(),
  activity: z.array(activitySchema).max(ACTIVITY_LIMIT),
}).strict()

/** Argument fields, in priority order, that describe what a tool is acting on. */
const HINT_FIELDS = ['file_path', 'path', 'url']

function initial() {
  return {
    status: 'idle',
    turn: 0,
    stepCount: 0,
    reasonCode: '',
    errorMessage: '',
    updatedAt: 0,
    revision: 0,
    turnStartedAt: 0,
    lastActivityAt: 0,
    lastToolAt: 0,
    endedAt: 0,
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

/** Last path segment; keeps only the basename so directories do not leak. */
function basenameOf(value) {
  const text = String(value).replace(/\\/gu, '/')
  const parts = text.split('/').filter((part) => part !== '')
  return parts.length === 0 ? '' : parts[parts.length - 1]
}

/** Host part of a URL, never its path/query (which often carries credentials). */
function hostOf(value) {
  try {
    const url = new URL(String(value))
    return url.hostname
  } catch {
    return ''
  }
}

/** Short, safe hint for one tool call's serialized arguments. */
function hintOf(args) {
  if (args === undefined) return ''
  for (const field of HINT_FIELDS) {
    const value = args[field]
    if (typeof value !== 'string' || value.trim() === '') continue
    if (field === 'url') return hostOf(value)
    return basenameOf(value)
  }
  return ''
}

/**
 * Split a shell command into approximate tokens and keep only the executable
 * plus an argument count. Quoted strings are treated as one token; the raw
 * text never leaves this function.
 */
function commandSummary(command) {
  const flat = String(command).replace(/\s+/gu, ' ').trim()
  const parts = flat.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/gu) ?? []
  const first = (parts[0] ?? '').replace(/^["']|["']$/gu, '')
  const executable = basenameOf(first)
  const safe =
    executable === '' || executable.startsWith('-') || executable.includes('=')
      ? 'command'
      : executable
  return { text: clip(safe), argCount: Math.max(0, parts.length - 1) }
}

/** Classify one tool call into a safe activity entry. */
function toolActivity(name, argsText, callId, time) {
  const tool = clip(name === undefined || name === '' ? 'tool' : name)
  const args = parseArguments(argsText)
  if (args !== undefined && typeof args.command === 'string' && args.command.trim() !== '') {
    const summary = commandSummary(args.command)
    return {
      kind: 'command',
      text: summary.text,
      argCount: summary.argCount,
      // Commands are not folded: a fast hash of the raw command is still a
      // brute-forceable fingerprint of a secret token, and the summary alone
      // is too coarse to merge different commands safely.
      callId: typeof callId === 'string' && callId !== '' ? callId : undefined,
      status: 'running',
      startedAt: time,
    }
  }
  const hint = hintOf(args)
  return {
    kind: 'tool',
    text: tool,
    hint: hint === '' ? undefined : clip(hint),
    // Same tool in a row folds into a counted run; a different tool breaks it.
    foldKey: `tool:${tool}`,
    callId: typeof callId === 'string' && callId !== '' ? callId : undefined,
    status: 'running',
    startedAt: time,
  }
}

/** Newest-first feed; run folding happens when a result completes the entry. */
function pushActivity(activity, entry) {
  const next = [entry, ...activity]
  return next.length > ACTIVITY_LIMIT ? next.slice(0, ACTIVITY_LIMIT) : next
}

/** Merge a completed entry into the completed run directly below it. */
function mergeCompleted(activity, index) {
  const current = activity[index]
  const older = activity[index + 1]
  if (current === undefined || older === undefined) return activity
  if (current.status === 'running' || older.status === 'running') return activity
  if (current.foldKey === undefined || current.foldKey !== older.foldKey) return activity
  const merged = { ...current, count: (older.count ?? 1) + 1 }
  const next = [...activity]
  next.splice(index, 2, merged)
  return next
}

/** Close calls that never received a result when the turn ends. */
function closeOpenActivity(activity, time) {
  let changed = false
  const next = activity.map((entry) => {
    if (entry.status !== 'running') return entry
    changed = true
    return {
      ...entry,
      status: 'error',
      endedAt: time,
      durationMs: Math.max(0, Math.round(time - entry.startedAt)),
      errorCode: entry.errorCode ?? 'no-result',
    }
  })
  return changed ? next : activity
}

/**
 * Map one `turn/end` reason onto the baseline status vocabulary (D41).
 * `errorMessage` carries only upstream raw text (the model's error message,
 * or the raw kind for unknown reasons) — never plugin-authored copy; the
 * Client translates `reasonCode` into localized copy.
 */
export function endedWith(reason) {
  const kind = reason !== null && typeof reason === 'object' ? reason.kind : undefined
  switch (kind) {
    case 'error':
      return {
        status: 'failed',
        reasonCode: 'error',
        errorMessage: clip(reason.error?.message ?? ''),
      }
    case 'max-tokens':
      return { status: 'failed', reasonCode: 'max-tokens', errorMessage: '' }
    case 'blocked':
      return { status: 'failed', reasonCode: 'blocked', errorMessage: '' }
    case 'aborted':
      return { status: 'aborted', reasonCode: 'aborted', errorMessage: '' }
    case 'interrupted':
      return { status: 'aborted', reasonCode: 'interrupted', errorMessage: '' }
    case 'forked':
      return { status: 'idle', reasonCode: 'forked', errorMessage: '' }
    case 'completed':
      return { status: 'success', reasonCode: 'completed', errorMessage: '' }
    default:
      // The baseline status enum has no "unknown" value. Map an unknown
      // reason to the neutral terminal state and keep the raw kind as data;
      // never report it as success.
      return {
        status: 'aborted',
        reasonCode: 'unknown',
        errorMessage: clip(kind === undefined || kind === '' ? 'unknown' : String(kind)),
      }
  }
}

/** Numeric turn carried by a committed event, or undefined when malformed. */
function eventTurn(event) {
  const data = event.data
  const turn = data === undefined || data === null ? undefined : data.turn
  return Number.isInteger(turn) ? turn : undefined
}

/** Attach one `tool/result` to the call entry it answers. */
function applyToolResult(state, event) {
  const message = event.data === undefined || event.data === null ? undefined : event.data.message
  const callId = message === undefined || message === null ? undefined : message.toolCallId
  if (typeof callId !== 'string' || callId === '') return state
  const index = state.activity.findIndex((entry) => entry.callId === callId && entry.status === 'running')
  if (index < 0) return state
  const entry = state.activity[index]
  const isError = message.isError === true || event.data.error !== undefined
  const updated = {
    ...entry,
    status: isError ? 'error' : 'ok',
    endedAt: event.time,
    durationMs: Math.max(0, Math.round(event.time - entry.startedAt)),
  }
  if (isError) {
    const code = event.data.error === undefined ? undefined : event.data.error.code
    const name = event.data.error === undefined ? undefined : event.data.error.name
    updated.errorCode = clip(typeof code === 'string' && code !== '' ? code : name ?? 'error')
  }
  let activity = [...state.activity]
  activity[index] = updated
  activity = mergeCompleted(activity, index)
  return {
    ...state,
    activity,
    updatedAt: event.time,
    lastActivityAt: event.time,
    revision: state.revision + 1,
  }
}

/**
 * Pure, synchronous fold over committed session events. Every event that this
 * unit does not care about returns the same state reference (zero downstream
 * work); a state-carrying event returns a fresh whole state.
 */
export function fold(state, event) {
  switch (event.type) {
    case 'turn/start': {
      const turn = eventTurn(event)
      if (turn === undefined) return state
      if (state.status === 'running' && state.turn === turn) return state
      return {
        status: 'running',
        turn,
        stepCount: 0,
        reasonCode: '',
        errorMessage: '',
        updatedAt: event.time,
        revision: state.revision + 1,
        turnStartedAt: event.time,
        lastActivityAt: event.time,
        lastToolAt: 0,
        endedAt: 0,
        activity: [],
      }
    }
    case 'step/end': {
      if (state.status !== 'running' || eventTurn(event) !== state.turn) return state
      return {
        ...state,
        stepCount: state.stepCount + 1,
        updatedAt: event.time,
        lastActivityAt: event.time,
        revision: state.revision + 1,
      }
    }
    case 'tool/call': {
      const turn = eventTurn(event)
      if (state.status !== 'running' || turn === undefined || turn !== state.turn) return state
      const entry = toolActivity(event.data.name, event.data.arguments, event.data.callId, event.time)
      return {
        ...state,
        activity: pushActivity(state.activity, entry),
        updatedAt: event.time,
        lastActivityAt: event.time,
        lastToolAt: event.time,
        revision: state.revision + 1,
      }
    }
    case 'tool/result': {
      const turn = eventTurn(event)
      if (state.status !== 'running' || turn === undefined || turn !== state.turn) return state
      return applyToolResult(state, event)
    }
    case 'turn/end': {
      const turn = eventTurn(event)
      // Late/duplicate ends for an older turn must not overwrite the current
      // turn. A missing turn on the wire is accepted for forward compatibility.
      if (turn !== undefined) {
        if (state.status === 'running' && turn !== state.turn) return state
        if (state.status !== 'running' && turn <= state.turn) return state
      }
      const ended = endedWith(
        event.data === undefined || event.data === null ? undefined : event.data.reason,
      )
      return {
        ...state,
        status: ended.status,
        reasonCode: ended.reasonCode,
        errorMessage: ended.errorMessage,
        updatedAt: event.time,
        lastActivityAt: event.time,
        endedAt: event.time,
        activity: closeOpenActivity(state.activity, event.time),
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
    reasonCode: state.reasonCode,
    errorMessage: state.errorMessage,
    updatedAt: state.updatedAt,
    revision: state.revision,
    turnStartedAt: state.turnStartedAt,
    lastActivityAt: state.lastActivityAt,
    lastToolAt: state.lastToolAt,
    endedAt: state.endedAt,
    activity: state.activity,
  }
  views.set(state, view)
  return view
}

export { stateSchema }

export const inject = ['sessionProjections']

export function apply(ctx) {
  // Registration is an effect on this plugin's fiber: unloading the plugin
  // removes the key and its cached cells.
  ctx.sessionProjections.register({
    key: 'waitbuddy',
    stateSchema,
    stateVersion: 7,
    init: () => initial(),
    apply: fold,
    wire: {
      // The wire view is the full state; one schema keeps Host/Client honest.
      viewSchema: stateSchema,
      view: viewOf,
    },
  })
}
