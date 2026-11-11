# WaitBuddy

<p align="center">
  <img src="icon.svg" width="76" alt="WaitBuddy icon" />
</p>

<p align="center">
  <strong>An Agent long-task monitor for the DSH session view, with lightweight games</strong><br />
  Monitoring first · read-only · one-way Agent → game signals
</p>

<p align="center">
  <a href="README_CN.md">中文</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="docs/acceptance-runbook.md">Acceptance Runbook</a> ·
  <a href="https://github.com/CelineHuangdz/dsh-wait-buddy">GitHub</a>
</p>

![Version](https://img.shields.io/badge/version-0.7.0-blue)
![DSH](https://img.shields.io/badge/DSH-0.2.1--rc.5-lightgrey)
![Tests](https://img.shields.io/badge/tests-90%20%2B%204%20visual-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

> Current version **0.7.0**: M1 status board + M2 games + M3 one-way signals + low-key presence, hardened — locale-neutral failure reason codes, notification permission on user gesture, disableable shortcut, visible fallback when the view-switch workaround fails, error boundaries. Tested on DSH `0.2.1-rc.5`.

## Table of Contents

- [What is this](#what-is-this)
- [Features](#features)
- [Quick start](#quick-start)
- [Usage](#usage)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Compatibility and known deviations](#compatibility-and-known-deviations)
- [Development](#development)
- [Project layout](#project-layout)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Security and privacy](#security-and-privacy)
- [Contributing](#contributing)
- [License](#license)

## What is this

WaitBuddy is a **session-view plugin for DSH Desktop**. It adds a **WaitBuddy** tab next to Chat / Trajectory in the current session and lets you:

- see what the Agent is doing: status, completed steps, latest commands/tool calls;
- get a visible secondary reminder for pending approvals and task failures;
- play Snake or Gomoku while waiting for a long task;
- in M3, let Agent events **one-way drive** the game: pause on approval, +5 per step, +50 on success.

It never controls the Agent, never intercepts the native approval dialog, and never writes to the session log.

## Features

### Monitoring

- **Session view**: registered on `conversation.view`, next to Chat / Trajectory.
- **Honest status**: loading / ready / degraded / stale; a missing projection is never shown as “idle”.
- **Real step count**: “N steps completed”; no total steps, no fake percentage.
- **Activity feed**: only `tool/call` command/tool entries (max 3); **no raw model reasoning** (D27).
- **Dedicated alert rail**: approval/failure alerts live outside the scrolling content and stay visible.

### Low-key presence (v0.5.0)

- Two surfaces: the **full view** (WaitBuddy tab) and the **pill** (default) — a small corner capsule that expands into a draggable floating panel (status + latest activity + games) **sharing the same rounds** as the full view. Moving the pointer out of the panel auto-pauses the snake; Space or clicking the overlay resumes.
- `Ctrl/Cmd+Shift+W` toggles pill ↔ background (no UI, system notifications only). Notifications fire only while the window is unfocused, for approval/finish/failure, and never contain command text.
- Presence is configured in the board footer like speed/difficulty and stored in localStorage.

### Games

- **Snake**: Canvas, no external assets, keyboard arrows; direction queue, Space pause/resume, reset, speed presets.
- **Gomoku**: 15×15, human black vs heuristic AI; difficulty presets; redraws on resize.
- Both games keep their own state; switching view/session pauses but does not reset.

### One-way signals (M3)

- Approval appears → the game pauses automatically with “Waiting for approval”.
- Approval is resolved → **no auto-resume**; the overlay shows “Handled — press Space or click Resume”.
- step +5, success +50, failed/abort only show a notice; the current round is not reset.
- Signals are published as `agent:*`; the game only consumes them. The monitor layer defines no rewards.

## Quick start

### Requirements

- DSH Desktop `0.2.1-rc.5` (the only tested version)
- Node.js 22+ and pnpm for local development

### Install

In DSH: sidebar → **Plugins** → **Add plugin**, then use one of:

| Method | Value | Notes |
|---|---|---|
| Git (recommended) | `github:CelineHuangdz/dsh-wait-buddy` | Follows the latest commit; the only published channel |
| Local directory | `/abs/path/to/dsh-wait-buddy` | For development; run `pnpm install` first |
| Tarball | absolute path to `dist/dsh-wait-buddy-x.y.z.tgz` | Create with `npm pack --pack-destination dist` |

After installing, enable the plugin and refresh the page, then select **WaitBuddy** in the session view tabs.

> For a local directory, run `pnpm install` first (the Host half uses `zod` for projection schema validation).

## Usage

1. Open a session and switch to **WaitBuddy**.
2. Send a task: status, steps and activity update from `turn/start` / `step/end` / `tool/call`.
3. Click **Start game** to play Snake; arrow keys require focus inside the view (click the board once).
4. When approval appears, the game pauses; handle it in the native approval panel, then resume manually.
5. On success, +50 points; switching views does not replay the toast.

> Arrow keys only act inside the view and never steal composer keys. Touch/pointer-only devices cannot control direction (D7, approved deviation).

## Configuration

| Item | Storage | Values |
|---|---|---|
| Snake speed | `localStorage` → `dsh-wait-buddy.settings.v1` | Slow / Normal / Fast |
| Gomoku difficulty | Same | Easy / Medium / Hard |

- Settings are local only; no upload, no cross-device sync.
- Best score and the current round are in memory only (M4 candidate).
- No environment variables or remote configuration.

## Architecture

```text
Host (index.js)
  session log ── pure fold ──> waitbuddy projection (stateVersion 4)
                                      │
Client (client.js)                    ▼
  projection + sessionStatus ──> composeMonitor ──> TrackState ──> WaitBuddyView
                                      │
                                      └── diffMonitorSignals ──> agent:* SignalHub
                                                                     │
                                                                     ▼
                                                              gameStore (snake)
```

- **Host**: registers the `waitbuddy` session projection; pure fold, read-only, never writes logs.
- **Client**: `conversation.view` entry; merges the durable projection with process-local `running` / `pendingInteraction`.
- **M3 signal layer**: `task_start` / `step_advance` / `approval_enter` / `approval_leave` / `task_finish`.
- **Game layer**: consumes signals only; no direct monitor reads, no reverse-control API.

## Compatibility and known deviations

| Capability | Status |
|---|---|
| M1 status board | ✅ |
| M2 Snake / Gomoku | ✅ |
| M3 signals / approval pause / +5/+50 | ✅ core; real approval pause + manual resume verified |
| D7 soft buttons | Approved deviation: keyboard arrows only |
| D16/D17 Gomoku/settings | Approved deviation: M4 scope shipped early |
| D28 question / plan-review | ✅ visible since 0.5.0: per-kind alert copy + game auto-pause |
| D22 unknown terminal | `aborted` + reason text; no new enum |

- Verified on DSH `0.2.1-rc.5`; other versions are not promised. The full host API surface and the per-version checklist live in [docs/compat.md](docs/compat.md).
- 320px is covered by visual regression; run a real double-instance smoke before release.
- Real DSH Canvas drawing and the native approval chain are outside automated coverage (see the Runbook).

## Development

```bash
pnpm install
npx playwright install chromium   # required for visual tests the first time

npm run build:client  # regenerate client.js from src/client/ fragments (required after editing them)
npm run test:meta    # version consistency + node --check + fragment/artifact drift check
npm test             # 90 unit/component cases
npm run test:visual  # 4 headless layout scenarios (with host tabs / Todo dock / composer)
npm run test:all     # all of the above
```

- CI: `.github/workflows/ci.yml` runs `npm test` + `npm run test:visual` on push/PR.
- Tests: `test/*.test.js`; visual script: `tools/visual-layout.mjs`.
- Visual tests render the real view with React server rendering and inspect spacing, horizontal overflow, alert position and pause copy in Chromium.

### Change process

1. Update docs first: UI/copy → [docs/ui-spec.md](docs/ui-spec.md); boundaries/trade-offs → [docs/decisions.md](docs/decisions.md).
2. Then change code so implementation matches docs.
3. The M0 baseline is frozen; semantic changes must be recorded in decisions.

## Project layout

```text
index.js            Host half: waitbuddy session projection (pure fold, read-only)
client.js           Client half (generated: ordered concat of src/client/*.mjs)
src/client/         Client source fragments (§1–§10 slices of the factory; build with npm run build:client)
cordis.patch.yml    Bundler entry: id = wait-buddy
locale/*.json       Plugin manager title/description
icon.svg            Plugin icon
docs/               Baseline, UI spec, decisions, reviews, acceptance, release docs
test/               node:test unit/component tests
test-support/       Test loader (VM + minimal browser stubs)
tools/              Build script, headless visual layout checks
CHANGELOG.md        Release notes
```

## Documentation

| Document | Content |
|---|---|
| [M0 baseline](docs/baseline-m0.md) | Frozen product baseline |
| [M0 compliance](docs/m0-compliance.md) | Implementation vs baseline, deviations |
| [M1 acceptance](docs/m1-acceptance.md) | M1 acceptance record |
| [M3 implementation](docs/m3-implementation.md) | Signals, pause, rewards |
| [UI spec](docs/ui-spec.md) | Layout, copy, interaction spec |
| [Decisions](docs/decisions.md) | ADR-lite, D1–D28 |
| [Acceptance Runbook](docs/acceptance-runbook.md) | Manual checks and pass criteria |
| [Reviews](docs/reviews/README.md) | 2026-11-05 review archive |
| [Iteration plan](docs/iteration-plan.md) | Backlog and iteration plan |
| [Release Runbook](docs/release.md) | Packaging, npm, Git distribution |
| [CHANGELOG](CHANGELOG.md) | Version history |

## Roadmap

- **0.5.0**: low-key presence — pill, draggable floating panel, `Ctrl/Cmd+Shift+W` background mode, unfocused-window system notifications (D28–D35).
- **0.6.0**: background button on the pill, Space controls all states (D36).
- **0.6.1**: gomoku hard-AI fork/double-three blocking (D39), Todo-dock-aware bottom spacing (D40), GitHub-only distribution (D37), docs and acceptance realigned with code.
- **0.7.0**: hardening — locale-neutral reason codes + `stateVersion` 5 (D41), host-adapter feedback for the view switch, notification permission on user gesture, disableable shortcut, store lifecycle per apply, late-binding retries, error boundaries, reduced-motion (D42/D43).
- **Next**: DSH multi-version compatibility — host API contract + per-version checklist in [docs/compat.md](docs/compat.md); verify against new DSH releases as they ship. Hardening backlog (host-coupling adapter layer, notification permission on user gesture, RT-04/RT-05, error boundary) tracked in [docs/iteration-plan.md](docs/iteration-plan.md).
- **Never**: in-game approval, auto-approval, or any reverse control over the Agent.

## Security and privacy

- The plugin runs inside the DSH process with the current user's permissions; **there is no sandbox**.
- Read-only session events; no session-log writes; no network requests; no telemetry.
- Settings are stored only in local `localStorage`.
- The activity feed may show tool/command arguments (paths, queries); raw model reasoning was removed by D27.
- The plugin never registers, replaces, or intercepts the native approval panel.

## Contributing

- Open an issue/discussion first; for UI/behavior changes, update docs first.
- Run `npm run test:all` before submitting a PR.
- Do not add reverse control, composer replacement, or fake progress (see [decisions.md](docs/decisions.md)).

## License

[MIT](LICENSE)
