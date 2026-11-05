# M1 对照验收记录（2026-11-05）

> **范围**：按 [M0 基线](baseline-m0.md) §1–§8、§11 验收 M1「最小可用监控面板」。
> **方式**：对照 `v0.4.0` 代码 + `node --test` 自动化结果；未做桌面端截图/录屏，视觉项标注"待人工验收"。
> **结论**：**M1 监控核心通过**。Session View、投影、状态看板、审批告警、步数展示、异常终态已满足或已修正；D7/D16/D17/D28/D22 已按 2026-11-05 默认决策登记，不再作为未决项。

---

## 1. 本次 M1 补丁做了什么

| 改动 | 文件 | 说明 |
|---|---|---|
| `fold` / `endedWith` 可测试化 | `index.js` | 导出纯函数；`node --test` 可直接覆盖 |
| 未知 `turn/end` 不再判成功 | `index.js` | 显式 `completed` → `success`；未知 reason → `aborted` + 「未知结束原因：kind」；`stateVersion` 升到 4（D27） |
| 事件 turn 守卫 | `index.js` | `tool/call` 只在 running 且 turn 匹配时更新；`turn/end` 忽略迟到/重复 turn |
| 工具活动二次截断 | `index.js` | 工具名 + 参数摘要拼接后再 `clip()`，避免超过 120 字 |
| 状态协调矩阵 | `client.js` | 新增纯函数 `composeMonitor`：新轮 running 覆盖旧终态；`running=false` + durable running 5 秒后 `health=stale`；投影缺失走 `loading`/`degraded` |
| M0 六值 status 保持 | `client.js` | 不新增 `awaiting_user`/`unknown`/`degraded`/`stale`；扩展放 `health`/`pendingKind`/`pendingKey` |
| 审批 key | `client.js` | 快照带 `pendingKey`；`sameMonitor` 比较，避免同名工具连续审批被去重 |
| 告警吸顶 | `client.js` | `.wb-alert` sticky + `.wb-inner` min-height:100%；标题允许换行 |
| 步数展示 | `client.js` | 状态行显示「更新于 HH:MM:SS · 已完成 N 步」；总步数/百分比仍不显示 |
| 未知终态文案 | `client.js` | `aborted` 且有 `errorMessage` 时显示「本轮已结束（未知原因）」 |
| 测试 | `test/*.test.js` | M1 子集 34 个用例（当前全量 59，含 M3）：Host fold、compose 矩阵、审批 key 去重、UI 文案 |

---

## 2. 逐条验收

| M0 条款 | 验收项 | 结果 | 证据/备注 |
|---|---|---|---|
| §1 | Session View 内看板、监控优先、只读 | ✅ | `conversation.view` 注册；无反向控制 |
| §2 | 只读事件、Canvas 游戏、单向驱动 | ✅ | M1 只读；M3 核心信号已落地 |
| §3 | 状态/审批/失败可见 | ✅（视觉待验） | 告警吸顶已实现 |
| §4 | M1 纯状态看板、可独立使用 | 🟡 | M1 监控能力已具备；但仓库是 M1+M2 合体，没有 M1-only 构建/开关，"无游戏"不成立 |
| §5 | 贪吃蛇 Canvas、键盘、软按钮 | 🟡 **软按钮偏离** | D7 移除软按钮；M0 §5 要求，待确认 |
| §6 | `task.start` / `step.update` / `approval` / `success` / `failed` / `abort` / `active.change` | ✅（step 展示已恢复） | `fold` 映射；未知 reason 走 `aborted` |
| §6 | 仅显示 stepCount，不显示总数/百分比 | ✅ | D21；`metaText` |
| §6 | 脉冲条只表示新进展，不代表比例 | 🟡 | 当前脉冲仅 running 时显示；尚未按 step 触发，属实现细节，不阻塞 M1 |
| §7 | 高告警 approval/failed、仅当前会话、辅助不拦截 | ✅ | `isAlerting`；`AlertBanner`；无审批写操作 |
| §7 | 告警不依赖滚动可见 | ✅（视觉待验） | 告警在 `.wb-inner` 滚动容器外，作为独立顶部区域 |
| §8 | `status` 六值 | ✅ | 未新增 status；`health`/`pendingKind` 为 Client 展示字段 |
| §8 | 任务启动/切会话重置监控；游戏保留 | ✅（切会话暂停待验） | 投影按 sessionId；游戏全局单局 |
| §8 | 跨会话奖励叠加 | ✅ | 全局单局 + 跨会话测试 |
| §9 | M3 `agent:*` 信号 + +5/+50/失败提示/审批暂停 | ✅（核心） | [M3 实现](m3-implementation.md)；桌面端 TC-01/02/21/22 待验 |
| §10 | 五子棋/设置属 M4 | 🟡 **提前实现** | D16/D17；待确认偏离 |
| §11 | 只做显示/布局调整，不改基线 | 🟡 | D7/D9/D16/D17 需登记 |

---

## 3. 自动化结果

```text
$ npm test
# tests 59
# pass 59（M1 子集 35）
# fail 0
```

覆盖：

- `test/fold.test.js`：turn/start、step/end、活动流、terminal、未知 reason、迟到/重复 turn、工具截断。
- `test/compose.test.js`：running/旧终态、stale 宽限、loading/degraded、approval key、非 approval 不误报、M0 六值枚举。
- `test/ui.test.js`：health 文案优先级、approval/failed 不被 health 覆盖、未知终态文案、步数元信息。
- `test/components.test.js`：告警/暂停浮层文案、按钮 disabled、独立告警区/窄窗 CSS。
- `npm run test:visual`：无头浏览器 4 个布局场景（1200/320、success/failed/approval），并模拟宿主 tab bar / Todo dock / composer，断言顶部/底部间距。
- `test-support/load-client.mjs`：用 `vm` + 最小 `window/document/localStorage/React` stub 加载 `client.js`，取 `__monitor` / `__ui` / `__game`。

---

## 4. 待人工验收（桌面端）

> 完整触发步骤、截图点和判定标准见 [验收 Runbook](acceptance-runbook.md)。

| # | 场景 | 期望 |
|---|---|---|
| 1 | 滚到棋盘底部后触发审批 | 告警仍在视口内（独立注意力层） |
| 2 | 冷启动进入 WaitBuddy | 先显示「正在读取监控数据…」，1.5s 内不闪「空闲」 |
| 3 | Host 半缺失/投影失败 | 显示「监控数据不可用」，不显示「空闲」 |
| 4 | 运行中杀 Host 且 `running` 变 false | 5s 后显示「状态同步中断」，不永久「正在执行」 |
| 5 | 上一轮失败后立即发新消息 | 立即显示「正在执行任务」，不保留红色失败横幅 |
| 6 | 未知 `turn/end` reason | 显示「本轮已结束（未知原因）」，无 ✅ |
| 7 | 连续同名工具审批 | 每次都出现提醒，不被 `sameMonitor` 去重 |
| 8 | 正常任务 | 状态行出现「已完成 N 步」，总步数不出现 |
| 9 | 英文界面 | loading/degraded/stale/step 文案无中文残留（错误 reason 文本可能仍为中文，见已知限制） |
| 10 | 320px 宽 | 告警标题换行、状态列不撑破；设置行仍可能换行（AT-06 部分修） |

---

## 5. 已知偏离/未完成

| 项 | 状态 | 影响 | 建议 |
|---|---|---|---|
| 软按钮（M0 §5 vs D7） | 已批准偏离 | 触屏/纯鼠标无法控制方向 | 保留 D7，发布说明标注 |
| 五子棋/设置（M0 §10 vs D16/D17） | 已批准偏离 | 提前实现 M4 范围 | 保留，不计入 M1-M3 达标 |
| question/plan-review | 未纳入（D28） | 这两类阻塞请求仍不可见 | 留待下一迭代评审 |
| 未知 reason 的 `aborted` 承载 | 已实现 | 内部 status 是 `aborted`，UI 文案已区分 | 若要求枚举完全诚实，批准新增 `unknown` |
| Host 完全失联 | 仅活动年龄提示 | 无法可靠区分"长工具"与"Host 死了" | 保持"不伪造 stale"；后续可加连接状态探测 |
| 窄窗 320px | 已加容器查询 | 宽度 <480px 隐藏设置/提示、缩小内边距；仍需实机确认 | 桌面端 AT-06 验收 |
| 切会话暂停 | 基础修 | `GameArea` 监听 `sessionId` 并 pause；多实例/存档未做 | 双实例回归 |
| 告警插入导致棋盘位移 | 未修 | 五子棋可能点偏 | 迭代 3（AT-04） |
| 五子棋缩放 | 已修 | 容器改为正方形 + ResizeObserver 重绘 | 桌面端视觉确认 |

---

## 6. 结论与下一步

- **M1 监控核心可以认为通过**：状态看板、事件映射、审批/失败告警、未知终态、步数展示、会话隔离、只读边界。
- **M1-only 交付形态未实现**：当前构建始终带游戏区；若验收严格要求"M1 无游戏"，需要额外的展示开关/分支。
- **不能声称"完全符合 M0"**：D7/D9/D16/D17 仍是待确认偏离；M1 的视觉项（sticky、loading/degraded、320px）需要桌面端人工验收。
- **下一步**：
  1. 产品负责人确认 D7/D9/D16/D17（见 `docs/m0-compliance.md` 第 3 节）。
  2. 桌面端逐条跑第 4 节 10 个场景，补截图/录屏。
  3. M3 核心与 GM-05/RT-02 代码已落地；下一步按 [M3 实现](m3-implementation.md) 做桌面端验收与双实例/窄窗回归。
