# M3 单向联动实现记录（2026-11-05）

> **状态**：核心已实现，桌面端视觉/交互验收待做。
> **范围**：按 [M0 基线](baseline-m0.md) §9 实现 `agent:*` 信号、审批自动暂停、step +5、success +50、failed/abort 提示。
> **不在本次范围**：question/plan 扩展（D28）、按会话存档、桌面端视觉验收。RT-01/RT-02/GM-01/GM-05 已落地；AT-06 已加容器查询，仍需实机确认。

---

## 1. 信号契约

监控层只做"事件 → 信号"的转换，不定义奖励；游戏层消费信号。

| 信号 | 触发 | `key` | `detail` |
|---|---|---|---|
| `agent:task_start` | 进入新一轮 / 从 idle 开始 | `${turn}` | `{ turn }` |
| `agent:step_advance` | `stepCount` 增加 | `${turn}:${stepCount}` | `{ delta, stepCount }` |
| `agent:approval_enter` | 出现 approval，或 approval key 变化 | `pendingInteraction.key` | `{ kind, tool }` |
| `agent:approval_leave` | approval 消失 / key 变化前的旧 approval | 旧 `pendingInteraction.key` | `{ kind }` |
| `agent:task_finish` | 进入 success / failed / aborted | `${turn}:${status}` | `{ status, reasonKind }` |

实现位置：[client.js](../client.js) 的 `diffMonitorSignals`、`createSignalHub`、`createMonitorSource.publish`。

### 基线规则

- 第一个 ready 快照只作为 baseline：不补发历史 task/step/finish 奖励；
- 但 baseline 上如果已有 approval，会发一次 `agent:approval_enter`，保证"打开视图时审批已存在"也能暂停；
- 同一 `type + sessionId + key` 全局只发一次（`SignalHub` 去重，上限 500）；
- 两个视图看同一会话时，不会重复奖励/暂停；
- 信号只从 `publish()` 发出，不反向修改监控状态。

---

## 2. 暂停状态机

游戏 store 维护：

```js
manualPaused: boolean
pauseReasons: Set<'approval:<key>' | 'hidden' | 'view-inactive'>
resumeReason: '' | 'approval'
resumeReady: boolean
```

规则：

- `agent:approval_enter`：若游戏 running，自动暂停并记录 `approval:<key>`；若游戏 idle，记录原因，之后 `start()` 会直接以 paused 状态开始。
- `agent:approval_leave`：移除对应 reason；**不自动恢复**。若没有其他 reason，浮层显示「已处理，按空格或点击继续」。
- 连续审批：每个 key 一个 reason，最后一个清除后才允许继续。
- 用户手动暂停：`manualPaused = true`，审批结束后仍然保持暂停，不会被自动恢复。
- 视图隐藏 / 卸载：`hidden` / `view-inactive`；切会话：`session-switch`。这三类用 `pauseWithHint()` 生成暂停原因文案（「视图切换后已暂停」/「切换会话后已暂停」）；手动暂停显示「已手动暂停，点击继续恢复」，不追加阻塞 reason，用户可直接继续。
- 恢复可见/重新订阅不自动跑；浮层保留暂停原因，避免用户误以为游戏卡死。
- `togglePause()`：有 approval reason 时不能继续（按钮 disabled，Space 也无效）；reason 清空后由用户手动继续。
- 五子棋不消费暂停信号（回合制）；M3 的 +5/+50 只作用于贪吃蛇。

实现位置：`createGameStore` 的 `addPause` / `releasePause` / `manualPause` / `manualResume` / `handleSignal`。

---

## 3. 贪吃蛇预设奖励（M0 §9）

| 信号 | 行为 |
|---|---|
| `agent:step_advance` | +5 分；画布浮字 `+5`；不打断游玩 |
| `agent:task_finish` success | +50 分；toast「任务完成！+50 分」；不重置本局 |
| `agent:task_finish` failed | toast「任务失败」；不重置、不结束本局 |
| `agent:task_finish` aborted（有未知原因） | toast「本轮已结束」；不重置本局 |
| `agent:approval_enter` | 自动暂停 + 浮层「等待审批」 |
| `agent:approval_leave` | 保持暂停，提示手动继续 |

- 奖励只在游戏非 idle 时生效；未开局不累计。
- 奖励不改变 `tickMs`，避免"Agent 越跑越快"。
- `reward` / `notice` 是游戏内展示字段，不写入 Host 投影。

---

## 4. 代码落点

- `client.js` `diffMonitorSignals` / `createSignalHub`
- `client.js` `createMonitorSource(..., signalHub)`：每次 `publish` 后发信号
- `client.js` `createGameStore().handleSignal`
- `client.js` `apply(ctx)`：把 `signalHub` 订阅到 `gameStore`，随插件 effect 清理
- `client.js` `gameOverlay`：等待审批/可继续/手动暂停三种文案
- `client.js` `GameArea`：`+5` 浮字、success/failed toast、Space 暂停
- `test/signals.test.js`：信号边沿、baseline、去重
- `test/game-signals.test.js`：暂停原因、手动暂停、连续审批、奖励/提示

---

## 5. 测试

```text
$ npm test
# tests 59
# pass 59
# fail 0
```

M3 相关 21 个用例（组件测试另计）：

- 信号：baseline 不发奖励；baseline 发 approval；approval enter/leave/key 替换；task start/step/finish；非 ready 不发；late ready 当 baseline；hub 去重。
- 游戏：step +5；success +50；failed/abort 不重置；idle 不奖励；审批自动暂停；手动暂停不被自动恢复；连续审批；开局时审批已存在；setGrid 保速；暂停改速度；卸载暂停不自动恢复。

---

## 6. M0 §9 对照

| M0 要求 | 结果 |
|---|---|
| 监控只广播固定 `agent:*` 信号，不定义奖励 | ✅ 信号层无奖励逻辑 |
| 游戏自主消费信号 | ✅ `handleSignal` |
| step +5，浮字 `+5` | ✅ |
| success +50 + 提示 | ✅ |
| failed/abort 提示，不重置/不结束 | ✅ |
| approval 自动暂停，处理后用户手动恢复 | ✅ |
| 新增顶层信号需评审 | ✅ 当前只实现 M0 列出的五类 |

---

## 7. 已知限制

- **question / plan-review** 仍未接入（M0 §6 不含，需 D28）。
- **跨会话暂停**：游戏是全局单局；如果分屏中另一个会话的 approval 出现，会暂停当前局（M0 §8 的全局单局语义）。是否需要按会话隔离，需产品确认。
- **切会话暂停**（RT-01）已做基础处理：`GameArea` 监听 `sessionId` 变化并暂停；按会话存档仍未做。
- **模块级 canvas/ref**（RT-02）已改为组件 `useRef`；但两个视图共享同一游戏状态（M0 全局单局），多实例绘制回归仍需实机验证。
- **方向队列/连按自杀**（GM-01）已修（最长 2 的方向队列，队列尾校验）；**五子棋 ResizeObserver**（GM-05）已修，棋盘容器改为正方形容器，缩放时重绘。
- **通知动画**依赖 CSS；`prefers-reduced-motion` 尚未处理。
- 桌面端视觉验收（浮字位置、toast 遮挡、审批浮层按钮）未做。

---

## 8. 下一步

1. 按 [验收 Runbook](acceptance-runbook.md) 跑 TC-01/02/21/22（审批暂停、连续审批、奖励、跨会话奖励）。
2. 补 RT-02 双实例回归（两个画布都绘制）与 AT-06 窄窗实机验收（容器查询已实现）。
3. 产品确认 question/plan 扩展（D28）后，再决定是否纳入 `agent:approval_*`。
