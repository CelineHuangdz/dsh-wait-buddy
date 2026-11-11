# WaitBuddy

<p align="center">
  <img src="icon.svg" width="76" alt="WaitBuddy icon" />
</p>

<p align="center">
  <strong>DSH 会话视图里的 Agent 长任务监控面板 + 轻量小游戏</strong><br />
  监控优先、游戏为辅 · 只读 · Agent → 游戏单向联动
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="docs/acceptance-runbook.md">验收 Runbook</a> ·
  <a href="https://github.com/CelineHuangdz/dsh-wait-buddy">GitHub</a>
</p>

![Version](https://img.shields.io/badge/version-0.10.0-blue)
![DSH](https://img.shields.io/badge/DSH-0.2.1--rc.5-lightgrey)
![Tests](https://img.shields.io/badge/tests-100%20%2B%204%20visual-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

> 当前版本 **0.10.0**：M1 状态看板 + M2 贪吃蛇/五子棋 + M3 单向联动 + 低调模式，并完成加固——失败原因码本地化、通知权限改为用户手势触发、快捷键可关闭、视图跳转失败可见反馈、错误边界。已在 DSH `0.2.1-rc.5` 上测试。

## 目录

- [这是什么](#这是什么)
- [特性](#特性)
- [快速开始](#快速开始)
- [使用](#使用)
- [配置](#配置)
- [架构](#架构)
- [兼容性与已知偏离](#兼容性与已知偏离)
- [开发](#开发)
- [项目结构](#项目结构)
- [文档](#文档)
- [路线图](#路线图)
- [安全与隐私](#安全与隐私)
- [贡献](#贡献)
- [License](#license)

## 这是什么

WaitBuddy 是 DSH 桌面版的一个**会话视图插件**。它在当前会话的 Chat / Trajectory 旁边增加一个 **WaitBuddy** 标签，用来：

- 看 Agent 当前在做什么：状态、已完成步数、最近命令/工具调用；
- 在等待审批、任务失败时给出醒目的辅助提醒；
- 在长任务等待期间提供贪吃蛇/五子棋，消磨时间；
- 在 M3 中让 Agent 事件**单向驱动**游戏：审批暂停、step +5、success +50。

它不控制 Agent，不拦截原生审批，不写会话日志。

## 特性

### 监控

- **Session View**：注册到 `conversation.view`，与 Chat / Trajectory 并列。
- **状态真实性**：区分 loading / ready / degraded / stale；不把投影失败伪装成“空闲”。
- **真实步数**：显示「已完成 N 步」，不显示总步数、不显示百分比。
- **活动流**：只显示 `tool/call` 的命令/工具条目，最多 3 条；**不展示模型推理原文**（D27）。
- **独立告警区**：审批/失败告警在滚动容器外，不会被棋盘滚走。

### 低调模式（v0.5.0）

- 两种形态：**完整视图**（会话 WaitBuddy 标签页）与**胶囊**（默认）——屏幕角落小胶囊，点击展开为可拖拽浮动小窗（状态摘要 + 最新活动 + 游戏），与完整视图**共用同一局游戏**；鼠标移出小窗自动暂停，空格或点击浮层恢复。
- `Ctrl/Cmd+Shift+W` 在 胶囊 ↔ 后台（无界面，仅系统通知）间切换；系统通知仅在窗口失焦时对审批/完成/失败发送，文案不含命令内容。
- 存在感与速度/难度一样在看板脚注行设置，存本机 localStorage。

### 游戏

- **贪吃蛇**：Canvas、无外部资源、键盘方向键；方向队列、空格暂停/继续、重置、速度档位。
- **五子棋**：15×15，人执黑 vs 启发式电脑；难度档位；窗口缩放重绘。
- **抓精灵**（0.10.0）：12×12 网格地图探索，草地随机遇怪；54 种程序化精灵（体型×配色×花纹）；单击按稀有度捕获；图鉴存 localStorage，重开不丢。
- 两局独立保留；切换会话/视图时暂停，不重置进度。

### 单向联动（M3）

- 审批出现：游戏自动暂停，显示「等待审批」。
- 审批处理完：**不自动恢复**，提示「已处理，按空格或点击继续」，由用户手动继续。
- step +5、success +50、failed/abort 只提示，不重置本局。
- 信号按 `agent:*` 广播，游戏只消费信号；监控层不定义奖励。

## 快速开始

### 环境要求

- DSH 桌面版 `0.2.1-rc.5`（当前唯一验证版本）
- 本地开发需要 Node.js 22+ 与 pnpm

### 安装

DSH 侧边栏 → **Plugins** → **Add plugin**，任选一种：

| 方式 | 填入 | 说明 |
|---|---|---|
| Git（推荐） | `github:CelineHuangdz/dsh-wait-buddy` | 跟随仓库最新提交；唯一分发渠道 |
| 本地目录 | `/abs/path/to/dsh-wait-buddy` | 开发调试用，需先 `pnpm install` |
| tarball | `dist/dsh-wait-buddy-x.y.z.tgz` 的绝对路径 | `npm pack --pack-destination dist` 生成 |

安装后启用插件并刷新页面，在会话视图标签栏选择 **WaitBuddy**。

> 本地目录安装前先执行 `pnpm install`（Host 半使用 `zod` 做投影 schema 校验）。

## 使用

1. 打开一个会话，切到 **WaitBuddy**。
2. 发一个任务：状态、步数、活动流会随 `turn/start` / `step/end` / `tool/call` 更新。
3. 点「开始游戏」玩贪吃蛇；方向键需要焦点在视图内（点一下棋盘）。
4. 审批出现：游戏自动暂停，在原生审批面板处理；处理后手动继续。
5. 任务完成：+50 分提示；切视图不会重复播放。

> 方向键只在视图内生效，不会抢输入框的按键。触屏/纯鼠标设备无法控制方向（D7，已批准偏离）。

## 配置

| 项 | 存储 | 可选值 |
|---|---|---|
| 贪吃蛇速度 | `localStorage` → `dsh-wait-buddy.settings.v1` | 慢 / 标准 / 快 |
| 五子棋难度 | 同上 | 初级 / 中级 / 高级 |

- 设置只存本机，不上传、不跨设备同步。
- 最高分/当前局仅存内存，不做持久化（M4 备选池）。
- 没有环境变量、没有远程配置。

## 架构

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

- **Host**：注册 `waitbuddy` 会话投影，纯函数 fold，只读日志，不写日志。
- **Client**：`conversation.view` 入口；合并 durable 投影与进程内 `running` / `pendingInteraction`。
- **M3 信号层**：`task_start` / `step_advance` / `approval_enter` / `approval_leave` / `task_finish`。
- **游戏层**：只消费信号，不直接读监控状态；没有反向控制接口。

## 兼容性与已知偏离

| 能力 | 状态 |
|---|---|
| M1 状态看板 | ✅ |
| M2 贪吃蛇 / 五子棋 | ✅ |
| M3 信号 / 审批暂停 / +5/+50 | ✅ 核心；真机审批暂停/手动恢复已验证 |
| D7 软按钮 | 已批准偏离：仅键盘方向键 |
| D16/D17 五子棋/设置 | 已批准偏离：M4 范围提前实现 |
| D28 question / plan-review | ✅ 0.5.0 起可见：分 kind 告警文案 + 游戏自动暂停 |
| D22 unknown 终态 | 用 `aborted` + 原因文本，不新增枚举 |

- 已验证 DSH `0.2.1-rc.5`；未承诺其他版本。
- 320px 通过视觉回归；双实例建议发布前再做一次真机 smoke。
- 不覆盖真实 DSH Canvas 绘制与原生审批链路（自动化测试边界见 Runbook）。

## 开发

```bash
pnpm install
npx playwright install chromium   # 首次运行视觉测试需要

npm run build:client  # 由 src/client/ 片段重新生成 client.js（改片段后必须执行）
npm run test:meta    # 版本一致性 + node --check + 片段/产物漂移校验
npm test             # 100 个纯逻辑/组件用例
npm run test:visual  # 4 个无头布局场景（含宿主 tab bar / Todo dock / composer）
npm run test:all     # 以上全部
```

- CI：`.github/workflows/ci.yml`，push/PR 自动跑 `npm test` + `npm run test:visual`。
- 测试文件：`test/*.test.js`；视觉脚本：`tools/visual-layout.mjs`。
- 视觉测试用 React 服务端渲染真实视图 + Playwright/Chromium，检查间距、横向溢出、告警位置和暂停浮层文案。

### 变更流程

1. 先改文档：界面/文案 → [docs/ui-spec.md](docs/ui-spec.md)；边界/取舍 → [docs/decisions.md](docs/decisions.md)。
2. 再改代码，使实现与文档一致。
3. M0 基线保持冻结；涉及基线语义的改动必须在 decisions 中显式标注。

## 项目结构

```text
index.js            Host 半：注册 waitbuddy 会话投影（纯 fold，只读日志）
client.js           Client 半（生成产物：src/client/*.mjs 按序拼接）
src/client/         Client 源片段（工厂函数的 §1–§10 切片；npm run build:client 生成）
cordis.patch.yml    Bundler 行：id = wait-buddy
locale/*.json       插件管理页展示用标题/描述
icon.svg            插件图标
docs/               基线、界面规范、决策、评审、验收、发布文档
test/               node:test 单元/组件测试
test-support/       测试加载器（VM + 最小浏览器 stub）
tools/              构建脚本、无头视觉布局检查
CHANGELOG.md        版本变更
```

## 文档

| 文档 | 内容 |
|---|---|
| [M0 基线](docs/baseline-m0.md) | 冻结的产品基线 |
| [M0 对照](docs/m0-compliance.md) | 实现 vs 基线的逐条对照与偏离 |
| [M1 验收](docs/m1-acceptance.md) | M1 验收记录 |
| [M3 实现](docs/m3-implementation.md) | 信号、暂停、奖励的实现记录 |
| [界面规范](docs/ui-spec.md) | 布局、文案、交互规格 |
| [决策记录](docs/decisions.md) | ADR-lite，D1–D28 |
| [验收 Runbook](docs/acceptance-runbook.md) | 人工验收步骤与判定 |
| [三方评审](docs/reviews/README.md) | 2026-11-05 评审原文与汇总 |
| [迭代计划](docs/iteration-plan.md) | 问题总表与后续迭代 |
| [发布 Runbook](docs/release.md) | 打包、npm、Git 分发 |
| [CHANGELOG](CHANGELOG.md) | 版本变更 |

## 路线图

- **0.5.0**：低调模式——胶囊、可拖拽浮动小窗、`Ctrl/Cmd+Shift+W` 后台模式、窗口失焦系统通知（D28–D35）。
- **0.6.0**：胶囊后台按钮、空格全状态控制（D36）。
- **0.6.1**：五子棋高级难度封堵成四/双三（D39）、底部按 Todo dock 展开态预留（D40）、分发收敛为 GitHub-only（D37）、文档与验收对齐代码。
- **0.7.0**：加固——失败原因码本地化 + `stateVersion` 5（D41）、视图跳转失败可见反馈、通知权限用户手势触发、快捷键可关闭、store 生命周期随 apply、晚绑定重试、错误边界、reduced-motion（D42/D43）。
- **0.8.0**：架构——client.js 拆分为按序拼接的 src/client/ 片段 + 构建与漂移防护（D44）；GameAdapter 注册表消除全部 `mode === 'snake'` 分支，第三款游戏只需一个 adapter 对象（D45）。
- **下一步**：DSH 多版本兼容性——宿主 API 契约与逐版本核对清单见 [docs/compat.md](docs/compat.md)，新版本 DSH 发布后照单验证。加固 backlog（宿主耦合适配层、通知权限改为用户手势触发、RT-04/RT-05、错误边界）见 [docs/iteration-plan.md](docs/iteration-plan.md)。
- **不做**：游戏内审批、自动审批、任何反向控制 Agent 的能力。

## 安全与隐私

- 插件在 DSH 进程内以当前用户权限运行，**没有沙箱**。
- 只读会话事件；不写会话日志；不发网络请求；无遥测。
- 设置只存本机 `localStorage`。
- 活动流会显示工具/命令参数，可能包含路径或查询词；D27 已移除模型推理原文。
- 不注册、不替换、不拦截原生审批面板；审批仍由 DSH 处理。

## 贡献

- 先开 issue/讨论，再提 PR；涉及界面/行为变更先改文档。
- 提交前跑 `npm run test:all`。
- 不要引入反向控制 Agent、替换 composer、伪造进度等基线红线（见 [decisions.md](docs/decisions.md)）。

## License

[MIT](LICENSE)
