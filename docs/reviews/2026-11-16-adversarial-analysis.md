# 对抗性评审复核与 0.13.0 规划依据（2026-11-16）

> **复核对象**：[2026-11-16-adversarial.md](2026-11-16-adversarial.md)
> **代码基线**：0.12.0；`client.js` 5903 行（`src/client/` 12 个片段）、`index.js` 299 行。
> **宿主基线**：DSH Desktop `0.2.1-rc.5`（`hostProtocolVersion 4`），桌面端 `Info.plist`、`app.asar/dsh/package.json` 与 `docs/compat.md` 三处一致。
> **方法**：逐条读当前源码；对照 `app.asar` 内 `dsh-api-session-controller`、`dsh-session-projection`、`dsh-client-ui-conversation`、`dsh-client-modules` 的实现；运行 `node --test`（119 通过）与 `npm run test:visual`（4 场景）。
> **结论**：评审的大部分工程风险成立，但**有 4 条关键事实误判**；这些误判如果照单全收，会把预算花在错误的地方。0.13.0 应先撤输入劫持、修监控真实性、收隐私与 compat，而不是先拆游戏插件。
> **实施状态（2026-11-16）**：0.13.0 已按第 6 节落地（`stateVersion` 7、146 单测 + 4 visual + live smoke）；见 [CHANGELOG](../../CHANGELOG.md) 与 [iteration-plan §12](../iteration-plan.md#L694)。
> **实机回归补充**：仅靠 `onOpen` 在“从未打开过 More 菜单”时不可用（胶囊后台按钮首次点击失败）。最终保留**语义 tab/More + 插件自身 `t('view.label')`** 的最后兜底；不再硬编码宿主人文案，失败仍有持久提示。

---

## 1. 总判断

| 维度 | 评审判断 | 复核结论 |
|---|---|---|
| 产品范围失控 | 游戏代码占 60%+，0.10→0.12 主要在做美术 | **成立**。按片段计，游戏相关约 3658/5901 ≈ 62%；0.12.0 changelog 全部是抓精灵。 |
| 与宿主耦合 | DOM 文案匹配、window 捕获、合成 wheel、逐层猜滚动容器 | **成立**，且是当前最高风险。 |
| 监控真实性 | 活动流只记调用、脉冲只看活动头条、无结果/时长 | **成立**。宿主 `tool/result` 已存在，插件未消费。 |
| 状态语义 | unknown 伪装成 aborted、forked 静默归零、缺 turn 事件照单全收 | **部分成立**。unknown 的界面文案已区分；通知路径仍写成“已中断”。 |
| 隐私 | shell 命令进持久投影并一键复制 | **成立**。命令截 120 字写入投影；`pendingDetail` 是 Client 内存态，不持久化。 |
| 供应链 | GitHub 浮动源、zod 过重 | **浮动源成立**；**zod 不成立/低价值**（宿主 API 要求 `.parse`，宿主本身已依赖 zod 4.4.3）。 |
| 测试 | 119 单测 + 4 视觉，live harness 未进 CI，mock 与真机脱节 | **成立**；但“dock mock 38px”是旧结论，当前 harness 已是 150px。 |
| 结构 | 拼接工厂超过 D38 阈值、schema 两份、immediately 全量加载 | **成立**；但 `immediately: true` 是胶囊/通知的刚需，不能简单改 false。 |

**一句话**：评审的诊断大体可信，处方需要重排。先做“不再对宿主动粗 + 不再对用户说谎 + 不再把命令写进缓存”，再谈多会话、游戏拆分和包体优化。

---

## 2. 逐条核验

### 2.1 产品与范围

| # | 评审断言 | 当前源码证据 | 判定 |
|---|---|---|---|
| P1 | 游戏代码占 `client.js` 60% 以上 | `04-snake` 519 + `06-canvas` 80 + `07-input-overlays` 200 + `08-gomoku` 778 + `08b-game-adapter` 314 + `08b5-sprite-atlas` 247 + `08c-safari` 1520 = 3658 行；总 5901 行 | **成立**（62%） |
| P2 | 0.10→0.12 全部条目都是游戏美术与按键 | 0.12 全是抓精灵；0.11 还包含 `fitBoard` 根因修复、看板可扫读性、活动流折叠 ×N | **基本成立**，不是“全部” |
| P3 | 活动流只留 3 条、只记调用不记结果 | `index.js:42` `ACTIVITY_LIMIT = 3`；`fold` 只处理 `tool/call`，`tool/result` 未处理 | **成立** |
| P4 | 没有 turn 时长、token、失败聚类、多会话总览 | `updatedAt` 只记最后事件；`fold` 不读 `assistant/message.usage`；无历史环；胶囊只跟 `props.sessionId` | **成立** |
| P5 | 只有贪吃蛇消费 Agent 信号 | `10-registration.mjs:59` 只 `signalHub.subscribe((signal) => gameStore.handleSignal(signal))`；`04-snake.mjs:441` 处理 approval/step/finish；五子棋、抓精灵未实现 `handleSignal` | **成立** |
| P6 | 人在五子棋/抓精灵时审批仍会暂停 | 实际只有贪吃蛇有 approval pause；`GameArea` 把 `pendingKind` 传给 Board，但 `08-gomoku`/`08c-safari` 不消费 | **不成立**（审批只暂停贪吃蛇；全局告警仍可见） |
| P7 | 奖励发生在用户没看的那一局 | 五子棋/抓精灵不领奖；贪吃蛇在后台被暂停/计分，用户看不到 +5/+50 | **成立**（但表述应改为“奖励只进贪吃蛇”） |

### 2.2 宿主集成

| # | 评审断言 | 当前源码证据 | 判定 |
|---|---|---|---|
| H1 | `openFullView` 用 `[role="tab"]` + 文案 `startsWith('WaitBuddy')` | `09-components.mjs:328-330` | **成立** |
| H2 | 硬编码「更多会话视图」/「session views」 | `09-components.mjs:338` | **成立** |
| H3 | 120ms `setTimeout` 等菜单 | `09-components.mjs:342` | **成立** |
| H4 | 向 `document` 派发合成 `wheel` | `09-components.mjs:791-793` | **成立** |
| H5 | `stopImmediatePropagation` 掐断同节点其他监听者 | `09-components.mjs:783` | **成立** |
| H6 | `depth < 6` 逐层 `getComputedStyle` 猜滚动容器 | `09-components.mjs:809-818` | **成立** |
| H7 | 插件已捕获 `onOpen`，但仍保留 DOM fallback | `09-components.mjs:318-324` 优先 `viewOpener`；失败才扫 DOM | **成立**；硬编码文案的 fallback 应删，语义 fallback 可保留 |
| H8 | 宿主没有公开 `openView` API | 0.2.1-rc.5 的 `activateView` 是 `dsh-client-ui-conversation` 内部函数；对插件公开的只有 `conversation.session` 注入里的 `openView` 与 header actions 的 `onOpen` | **成立**（D15 结论仍有效） |

**补充**：`onOpen` 是 `ViewsMoreMenu` 渲染 header actions 时注入的 `selectView`，只在菜单挂载时存在；胶囊没有这个 prop。0.13.0 实机回归证明“只走 onOpen”在首次打开前不可用，最终保留**语义 tab/More + 插件自身 label** 的兜底；硬编码宿主人文案的部分已删除。

### 2.3 状态与正确性

| # | 评审断言 | 当前源码证据 | 判定 |
|---|---|---|---|
| S1 | `unknown → aborted` 让用户看到“已中断” | `index.js:189-196` 映射 `status:'aborted'` + `reasonCode:'unknown'`；`03-status-copy.mjs:46` 对 `reasonCode === 'unknown'` 显示 `status.endedUnknown`（“本轮已结束（未知原因）”）；`test/ui.test.js:66` 锁定该行为 | **不成立（界面）**；**通知路径部分成立**（`notify.aborted` 仍说“任务已中断”） |
| S2 | `forked → idle` 丢信息 | `index.js:183-184` 返回 `idle` + `reasonCode:'forked'`；`statusText` 的 `idle` 分支忽略 `reasonCode`，界面没有任何分叉提示 | **成立** |
| S3 | `belongsToTurn` 对缺失 `turn` 照单全收 | `index.js:200-203`：`turn === undefined` 返回 true | **成立**（低概率，但 malformed 事件可污染活动流） |
| S4 | `stateVersion` 连跳没有迁移测试 | 复核时 `index.js:291` 为 6；测试中无 `stateVersion` 断言（0.13.0 已升 7，并加 `check-compat`） | **成立** |
| S5 | `stateSchema` 与 `viewSchema` 两份同形 | `index.js:53-73` 两份字段完全重复 | **成立** |
| S6 | 客户端把 `status` 写成 `pending_approval`，成为第七个值 | M0 基线 `baseline-m0.md:84` 的六值本来就含 `pending_approval`；Host 投影只有五值，Client 由 `composeMonitor` 合成第六值（`02-monitor.mjs:126`） | **不成立**；不是“第七个值”，也不应删 |

### 2.4 依赖、分发与文档

| # | 评审断言 | 当前源码证据 | 判定 |
|---|---|---|---|
| D1 | zod 只用于两个内部 schema，是杀鸡用牛刀 | 宿主 `dsh-session-projection` 在 `register` 后调用 `stateSchema.parse(row.val)`；`dsh-api-session-controller` 自身依赖 `zod 4.4.3`。插件删 zod 需要自己实现带 `.parse` 的兼容对象 | **不成立/低价值**；删它省不下 Client 245KB，也省不下宿主已装的 zod |
| D2 | GitHub 浮动源没有版本锁定 | 复核时 `README.md:97` 推荐裸 `github:CelineHuangdz/dsh-wait-buddy`（跟随 HEAD） | **成立**；0.13.0 已改为 `github:...#v0.13.0` 固定 tag，不需要新机制 |
| D3 | `window.__WB_BUILD_ID__` 污染全局 | `09-components.mjs:930/939` | **成立**，P3；可挂 `document.documentElement.dataset` |
| D4 | `compat.md` 过期：stateVersion 4、NS `wait-buddy` | `docs/compat.md:11/22` 原为 4；`:21` 原为 `wait-buddy`；代码 `index.js:291` 为 6，`00-prologue.mjs:45` 为 `waitBuddy` | **成立**，且不止两处：H1 的 `name` 应为 `key`、C1 漏 `uiSession`、C8 把 Client 展示字段写进 Host schema、§2 的 79 单测已过时。本次已修正文档，自动化检查列入 0.13.0 |
| D5 | `files` 不含 `src/`，装出去的人看不到源码 | `package.json` `files` 只有 `index.js/client.js/...` | **成立**，但这是 D44 的既定取舍（发布物单文件），不是缺陷；若要改，需同时考虑宿主加载 |

### 2.5 性能、测试与可访问性

| # | 评审断言 | 当前源码证据 | 判定 |
|---|---|---|---|
| T1 | `immediately: true` 每次启动全量解析 245KB | `package.json:32`；`client.js` 244974 字节 | **成立（解析成本）**；但 `immediately` 是胶囊/通知在“未打开视图”时仍工作的前提，改 false 会丢 presence |
| T2 | `ActivityPulse` 每 5 秒无条件重渲染，哪怕不可见 | `09-components.mjs:729` `setInterval`；组件只在 `running && health==='ready'` 时挂载，但 tab 切走后组件仍挂载（display:none），interval 仍在跑 | **部分成立**；不是“永远”，是“隐藏但挂载时” |
| T3 | 脉冲只对活动流 `kind:text` 变化打点；推理、重复命令、step/end 都不亮 | `09-components.mjs:718-727` `headKey = kind:text`；`fold` 的 `step/end` 不写 activity | **成立** |
| T4 | Todo dock mock 是 38px，真机 150px | `tools/visual-layout.mjs` 当前 `.host-todo{height:150px}`，注释明确“old 38px stub”；插件 CSS 仍是 `176px`（`08-gomoku.mjs:705/768`） | **不成立（mock 已修）**；硬编码预留仍成立 |
| T5 | 119 单测 + 4 视觉，live harness 没进 CI | `node --test` 119；`tools/visual-layout.mjs` 4 场景；`.github/workflows/ci.yml` 跑 `npm test` + `test:visual`，不跑 `safari-live`/`view-live` | **成立** |
| T6 | 视觉 harness 不跑 effect，抓不到 `fitBoard` 时序 | `visual-layout.mjs` 用 `renderToStaticMarkup`；`safari-live.mjs` 才是真实 DOM | **成立** |
| T7 | 脉冲 `aria-hidden`，Canvas 无读屏支持 | `09-components.mjs:750`；Canvas 有 `game.canvasLabel`/`gomoku.canvasLabel` 静态标签，但棋盘状态、遇怪弹窗无 `role="dialog"`/无动态文本 | **部分成立**；不是“零”，是“只有静态标签” |
| T8 | `prefers-reduced-motion` 只停了脉冲和水面 | `08-gomoku.mjs:777` 停 pulse/reward/notice；`08c-safari.mjs:1293/1440` 停水面/行走；五子棋落子、寻路、浮字未全部覆盖 | **成立** |

---

## 3. 必须纠正的 4 条误判

### 3.1 “unknown 被伪装成已中断”

界面不是这样。`03-status-copy.mjs:46` 明确对 `reasonCode === 'unknown'` 返回 `status.endedUnknown`，词典是“本轮已结束（未知原因）”；`test/ui.test.js:66` 还专门锁定了“不是 cancel”。

真正有问题的是**通知路径**：`05-presence.mjs` 的 `kindOf` 把 `status === 'aborted'` 一律映射为 `aborted`，通知文案 `notify.aborted` 是“任务已中断”。未知终态会收到“已中断”的通知，这才是需要修的。**不要新增 `unknown` status**：D22 已明确冻结 M0 六值，新增会牵动 `stateVersion`、Host/Client schema、所有消费者；正确做法是让通知按 `reasonCode` 细分。

### 3.2 “`pending_approval` 是第七个值”

M0 基线的六值就是 `idle / running / pending_approval / success / failed / aborted`（`baseline-m0.md:84`）。Host 投影只存五值，`composeMonitor` 把进程内 pending 合成第六值；这是 D23/D28 的既定设计，不是“撑破枚举”。`pendingKind` 负责细分 approval/question/plan-review，也不需要再改 `status`。

**保留** `pending_approval`；如果要解决“审批出现后看不到底层 failed/running”的边角，可在 Client 快照里加 `durableStatus`（展示字段），而不是改 `status`。

### 3.3 “zod 是杀鸡用牛刀，删掉”

宿主契约不是“随便一个 schema 对象”，而是注册后真的调用 `stateSchema.parse(row.val)`（`dsh-session-projection/lib/types/index.js:268/318`）。宿主自身依赖 `zod 4.4.3`（`dsh-api-session-controller/package.json`）。本工作区 pnpm 只装了一份 zod（6.3MB，含源码/类型/测试），但它**不进 245KB 的 `client.js`**；删它对 Client 体积与启动解析没有帮助，宿主侧是否复用插件依赖也取决于安装器解析，不能假定。删 zod 需要自己实现带 `.parse` 的兼容校验器，收益接近零，风险是边界行为不一致。**不做**；如果将来要瘦身，优先用 `zod/mini` 并先确认宿主接受。

### 3.4 “dock mock 还是 38px”

当前 `tools/visual-layout.mjs` 的 mock 已经是 `height:150px`，注释还写了“old 38px stub let the 56px reserve pass”。这条是旧结论。真正残留的问题是插件 CSS 仍写死 `176px` 预留：dock 收起时空白过大，dock 更高时仍可能盖住控制行。但“测量 dock 真实高度”本身又是在猜宿主 DOM；在没有稳定 `data-*`/API 之前，不建议再加一层 DOM 探测。0.13.0 只做保守修正（见 §5），把“精确适配”留到宿主提供 dock 高度契约之后。

---

## 4. 真正的高风险排序

| 级别 | 问题 | 为什么现在要修 | 对应评审项 |
|---|---|---|---|
| **P0** | window 捕获 + `stopImmediatePropagation` + 合成 wheel + 祖先滚动重置 | 会吃掉同页其他插件/宿主的按键与滚轮；宿主一改实现就误伤。四轮空格战争已证明对抗路线不可持续 | 二.3/二.4、§8 第 2 项 |
| **P0** | `openFullView` 扫 `[role="tab"]` + 中英文案 | 非中英文界面已是活 bug；多一个同名按钮就点错。已有 `onOpen` 正路，硬编码 fallback 应删；语义 fallback 保留 | 二.1/二.2、§8 第 7 项 |
| **P0** | `compat.md` 与源码常量漂移 | 这份文档就是升级验收清单；清单错会放过破坏性升级，也会误报兼容 | 六、§8 第 4 项 |
| **P1** | shell 命令进持久投影 + 一键复制 | 120 字足够泄露 token/密钥路径；投影会留在宿主缓存 | 四、§8 第 3 项 |
| **P1** | 脉冲/活动流不真实 | 用户会误判“推理中=卡住”；工具失败看不见，看板回答不了“做成了没有” | 三、§8 第 1 项 |
| **P1** | 去重 500 上限 | 长回合超过 500 个不重复信号后旧键可再次加分，双视图防重保证只在短回合成立 | 三、§8 第 6 项 |
| **P2** | `forked` 不可见、unknown 通知文案 | 信息丢失/误导，但影响面小于 P0/P1 | 三、§8 第 6 项 |
| **P2** | `immediately` 全量加载 / dock 176px / a11y | 真实成本，但受宿主契约限制；拆包是 0.15 的结构工作，不是 0.13 的止血 | 五/六/七、§8 第 5 项 |
| **P3** | zod、`__WB_BUILD_ID__`、`files` 不含 src | 低收益或既定取舍 | 四、五 |

---

## 5. 对评审方 3 个问题的答复

### Q1：下一轮只允许动监控，还是给明确版本预算？

**建议：0.13.0 只做监控 + 宿主边界 + 隐私 + 契约；游戏冻结，不做新内容/新美术。**

理由：

1. 评审自己列的 P0 里，输入劫持、DOM 文案、compat 漂移、命令持久化都不需要动游戏美术。
2. 游戏的正确性问题只有“奖励只进贪吃蛇”与“按键劫持”；前者用文案说明，后者在撤掉 window 捕获时顺带解决，不需要新玩法。
3. 拆游戏插件/懒加载不是止血，是结构手术；`immediately: true` 是胶囊与通知的刚需，单文件 bundle 也不能靠一个 `import()` 解决。放到 0.15 做 spike 更稳。

**版本预算**：0.13.0 约 **9–11 人日**（1 名熟悉代码的开发者），不包含发版等待与真机验收。若只能给 5 人日，砍掉 P1 的“活动流扩容/结果行”和 P2 的 `forked` 文案，保留 P0 四项 + 命令脱敏。

**明确不做**（0.13.0）：新游戏、新区域、新物种、新难度、新精灵、新主题色板；五子棋/抓精灵的 Agent 联动；多会话总览；token 统计；游戏拆包。

### Q2：shell 命令是否允许进入会话投影缓存？

**建议：不允许完整命令进入投影。**

投影是 Host 写、Host 缓存、Client 读的持久状态；命令里出现 `curl -H "Authorization: Bearer …"`、带 token 的 URL、密钥路径，120 字截断救不了。建议改成：

- `tool` 条目：工具名 + 参数**字段名** + 路径的 basename（例如 `read_file · index.js`）。
- `command` 条目：可执行文件名 + 参数个数/安全摘要（例如 `bash · 3 args`），或只保留 `bash`；**不保留完整命令行**。
- 完整命令仍在宿主自己的会话日志/对话流里，用户点“查看对话”即可看到；插件不复制、不持久化、不一键复制。
- `pendingDetail` 的提问正文目前只在 Client 内存（`02-monitor.mjs:67`），不写入投影；保留现状，但复制按钮只复制活动流摘要，不复制提问正文。
- 若产品负责人坚持要看命令，退一步的方案是“只存可执行文件 + 白名单 flag”，并在 README 明确写“投影可能含命令摘要”；不推荐。

这条会 bump `stateVersion` 到 7（`activity` 条目形状变化），需要 Host/Client 同步更新，旧缓存按既有机制失效重算。

### Q3：当前桌面端 DSH 版本号？

**`0.2.1-rc.5`**。

- 桌面端 `Info.plist` 的 `CFBundleShortVersionString` = `0.2.1-rc.5`；
- `app.asar/dsh/package.json` 的 `@deepseek-ai/dsh-desktop-runtime` = `0.2.1-rc.5`；
- `compat.md` §2 记录的实测版本也是 `0.2.1-rc.5`。

所以**不是宿主版本过期，而是文档里的插件常量过期**：`stateVersion` 4→6、NS `wait-buddy`→`waitBuddy`、`name`→`key`、C1 漏 `uiSession`、C8 把 `health/pendingKind` 写进 Host schema、§2 的 79 单测。这些已在本次复核中修正；0.13.0 再加 `check-compat` 防再次漂移。

---

## 6. 0.13.0 规划摘要

完整工作包、验收与估时见 [iteration-plan.md §12](../iteration-plan.md#12-0120-对抗性评审复核与-0130-规划2026-11-16)。这里只列顺序与理由：

| 顺序 | 工作 | 理由 |
|---|---|---|
| 1 | 撤 window 捕获、`stopImmediatePropagation`、合成 wheel、祖先滚动重置 | 当前最可能在宿主升级时误伤输入/滚动；也是四轮按键战争的终点 |
| 2 | `openFullView` 去掉硬编码文案：优先捕获 `openView`，最后按语义 tab + 插件 label 兜底，失败给持久提示 | 非中英文界面已是活 bug；纯 onOpen 在首次打开前不可用，故保留语义兜底但不再硬编码宿主人文案 |
| 3 | `compat.md` 与源码常量锁死（`check-compat` + CI） | 兼容流程的清单本身必须先可信 |
| 4 | 接 `tool/result` + turn 时长/最后活动时间 + 活动流结果状态 | 让看板回答“做成了没有”，而不是“刚才喊了什么” |
| 5 | 活动流/脉冲改由 `revision`/`lastActivityAt` 驱动 + 文本年龄 | 不再把“推理中”画成“卡住”；step/end 也算活动 |
| 6 | 命令不进投影，复制只复制摘要 | 投影是持久缓存，120 字命令比推理文本更像密钥 |
| 7 | 信号去重按 turn 分桶，轮次结束丢弃 | 长回合双倍加分是真实边界 bug |
| 8 | `forked` 可见、unknown 通知文案、缺 turn 的 `tool/call` 守卫 | 状态语义收口；不改 M0 六值 |
| 9 | live harness 进 CI + 隐私/结果/去重回归测试 | 视觉 harness 不跑 effect，真机事故两类都防不住 |
| 10 | 文档/决策/CHANGELOG/README 同步 | 仓库红线“文档是当前事实” |

**0.13.0 发布门槛**：

- `client.js` 中不再出现 `stopImmediatePropagation`、`new WheelEvent`、`querySelectorAll('[role="tab"]')`、`更多会话视图`、`session views`、`window.addEventListener('keydown', …, true)`。
- `stateVersion` 7；`compat.md` 与源码常量一致；`check-compat` 在 CI meta 中通过。
- 新增 fixture：含 `curl -H "Authorization: Bearer sk-…"` 的 `tool/call` 投影中不含 token；`tool/result` 失败行可见；`step/end` 能点亮脉冲；缺 `turn` 的 `tool/call` 被忽略。
- 119 个既有单测 + 新增测试全绿；4 个视觉场景全绿；`view-live`/`safari-live` CI 冒烟通过。
- 真机：在对话页按 F/Q/WASD 不被插件拦截；从胶囊打开看板失败时看到“请点击顶部 WaitBuddy 标签”；审批告警显示已等待时长；工具失败行出现在活动流。

**0.14.0 方向**（不在本轮承诺）：多会话只读总览（running/pending 优先）、最近 5 轮结果与时长、审批等待时长、token usage（只读、不存正文）、可访问性批次。

**0.15.0 方向**（结构）：游戏拆独立插件或真实模块边界、单文件 bundle 的懒加载 spike、state→view 单 schema、`files`/源码分发决策。

---

## 7. 仍未解决的问题

### 7.1 建议的宿主 API（upstream 提案素材）

这些问题在插件侧只能绕，不能根治。建议和 0.13.0 并行提给 DSH：

1. **`ctx.sessions.openView(sessionId, viewId)`**：幂等、返回 boolean；胶囊/通知就能直达看板，不必扫 `[role="tab"]`。
2. **稳定的 `data-view-id`**：`[role="tab"]` 与 views-actions 菜单项都带 view id；不依赖本地化文案。
3. **键盘作用域契约**：插件视图获得焦点时，宿主尊重 `defaultPrevented`；或提供 `consumeKeys(scope)`，避免 `stopImmediatePropagation`。
4. **dock/composer 高度**：提供 CSS 变量（如 `--dsh-conversation-dock-height`）或 overlay inset，插件不再写死 176px。
5. **`pendingInteraction` 列表/优先级**：现在只暴露最高优先一条；若能看到全部，审批被 question 遮蔽时至少能显示“还有审批排队”。

0.13.0 在不依赖这些 API 的前提下先止血；API 到位后再删适配层。

### 7.2 其他未决

1. **宿主没有稳定的视图/按键/dock 契约**。0.13.0 只能“少用 DOM 念力 + 失败可见”，不能根治。
2. **多会话总览的点击跳转**需要 `openSession`/`openView` 的公开面；0.14.0 先做只读列表，点击跳转等 API。
3. **`immediately: true` 的 245KB 解析成本**在单文件 bundle 下无解；除非宿主支持懒加载边界，或游戏拆成独立插件。0.13.0 **未改** `immediately`，也未拆包（游戏 store/图集仍在 apply 时初始化）；0.15 再做懒加载/拆包 spike。
4. **活动流命令摘要的可用性**需要产品确认：只留工具名可能太素；可执行文件 + 参数个数是折中，但仍可能暴露“用了什么工具”。Q2 需要产品负责人拍板。
