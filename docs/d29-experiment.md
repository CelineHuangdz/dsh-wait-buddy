# D29 最小实验：静态核实与实测清单（2026-11-09）

> 目的：在实现 P1 前验证 D29 的三个未知数——系统通知权限、`ctx.sidebarRight.openTab`、`shell.overlay`。
> 方法：直接核实本机 DSH 桌面版（0.2.1-rc.5，hostProtocolVersion 4）产物：Electron 主进程 `lib/main.js`（自 `app.asar` 解出）与正在运行的 web bundle（`/plugins/??…client.js`，约 9.1MB）。

## 1. 静态核实结果（全部通过）

| # | 假设 | 证据 | 结论 |
|---|---|---|---|
| 1 | 渲染进程 `Notification` 不会被宿主拦截 | `installMicrophonePermissions(session, primary)`：`setPermissionCheckHandler` 对 `permission !== "media"` 一律返回 `true`；`setPermissionRequestHandler` 对非 media 一律 `callback(true)` | **放行**。deny-all 的 `setPermissionRequestHandler` 只挂在登录/策略等辅助窗口的独立 session 上，不作用于主窗口 |
| 2 | `ctx.sidebarRight.openTab` 存在 | bundle 中有 `openTab(selected.kind, { replaceTab: true })`；`ctx.sidebarRight`（含 `focus` 等）上下文存在 | 可用；P1 状态点点击跳转、P2 注册 tab 均有依据 |
| 3 | `sidebar.right.pane.tab` 槽位存在 | bundle 中出现 `'sidebar.right.pane.tab' (client-ui-deliverables)` 的注册与占用说明 | 可用 |
| 4 | `shell.overlay` 槽位存在 | `"shell.overlay", () => ctx.slots.register({…})`（desktop-onboarding 等在用） | 可用，P3 有依据 |
| 5 | `conversation.session.header.utilities` 槽位存在 | `"conversation.session.header.utilities"` 注册（open-in-app，`order: -10`） | 可用，L1 状态点落点成立 |
| 6 | `ctx.shortcuts.register` 存在 | `shortcuts.register({ id, label, aliases, … })`（workspace.openLocal 等） | 可用，`Ctrl+Shift+W` 有依据 |

附：`sidebar.session.row.*` 的 hover/状态槽确实存在，但按 D29 红线 2 不使用，维持不变。

## 2. 剩余实测项（实现 P1 时顺带验证，约 15 分钟）

| # | 项目 | 步骤 | 通过标准 | 失败时降级 |
|---|---|---|---|---|
| T1 | 系统通知端到端 | 在 DSH **桌面版**（Electron 主窗口，非浏览器）控制台执行 `Notification.requestPermission().then(console.log)` | 返回 `granted`，且 `new Notification('WaitBuddy 测试')` 在 macOS 通知中心出现 | 若 `denied`/无弹窗：按 D29 红线 4 退化为页面内提醒（状态点 + 告警条），`notify` 设置保留但标注「桌面版受限」 |
| T2 | macOS 系统权限首启 | 首次 `requestPermission` 观察 macOS 是否弹「允许通知」系统对话框 | 弹出且允许后 `granted` | 若被系统拒绝：同 T1 降级 |
| T3 | `openTab` 实际效果 | 装载含 P2 的插件后从控制台调用 `ctx.sidebarRight.openTab('waitbuddy')` | 右侧栏展开且切到 WaitBuddy tab | 若宿主版本无此方法：状态点点击退化为仅悬停卡片（D29 红线 3 已预案） |
| T4 | 失焦判定 | 切到其它应用后触发 `approval_enter` | 仅 `document.hasFocus() === false` 时发通知 | — |

## 3. 结论

静态层面 D29 的全部宿主落点均成立，无阻塞性风险；T1/T2 的 macOS 系统级弹窗只能在桌面版真机验证，实现 P1 时先做 T1（它是唯一可能触发降级路径的项）。P1 可开工。
