# WaitBuddy 评审汇总与后续迭代计划（2026-11-05）

> **状态**：已按默认决策定稿（2026-11-05），准备 `v0.4.0` 发布。
> **基线**：[M0 原文](baseline-m0.md) · [M0 对照与偏差](m0-compliance.md)
> **输入**：[Claude 评审](reviews/2026-11-05-claude.md) · [GPT 评审](reviews/2026-11-05-gpt.md) · [Gemini 评审](reviews/2026-11-05-gemini.md)
> **方法**：逐条对照 `client.js` / `index.js` 当前实现，并核对 DSH `0.2.1-rc.5` 的 `ui-session`、`ui-approval`、`ui-user-questions`、`projection-store` 源码。未做真实桌面端视觉回归，凡属视觉/时序的判断均标注"需实测"。
> **一句话结论**：底座方向是对的，但当前版本的优先级不应该是"再加游戏"，而是**先让面板不撒谎、不漏掉审批，再补 M3 的审批暂停与 +5/+50 奖励闭环**。
>
> **实施进度（2026-11-05）**：M1 第一批修复 + M3 核心联动已落地：`fold`/`composeMonitor`、未知终态、告警吸顶、步数展示、`agent:*` 信号、审批暂停、+5/+50。验收见 [M1 验收](m1-acceptance.md) 与 [M3 实现](m3-implementation.md)。软按钮/五子棋/设置/question、多实例回归、五子棋重绘仍待处理。
>
> **M0 更新（2026-11-05）**：M0 原文已补录。由此关闭 3 个决策：游戏全局单局、切会话只暂停不重置（§8）；审批后手动恢复（§9）；M3 必须做 step +5 / success +50 / 失败提示（§9）。同时暴露 5 个基线问题：D7 软按钮、D9 隐藏步数、D16/D17 五子棋/设置、question/plan-review 扩展、unknown 状态是否新增，详见 [M0 对照](m0-compliance.md) 第 3 节。

---

## 1. 执行摘要

三份评审的重合度很高。去掉重复项后，共 **39 个评审问题（11 个 P0、18 个 P1、10 个 P2）**，另有 **4 个 M0/M3 基线项**（信号命名、step 奖励、success/failed 反馈、步数展示），其中真正需要立即处理的是 **5 个主题 + 2 项横切工作（测试、文档）**：

1. **状态真实性**：durable 投影与进程内 `running` 的合成规则有洞，新轮启动会短暂/长期显示上一轮终态；Host 断开后可能永久显示"正在执行"。
2. **阻塞交互可见性**：`approval` 可见但告警不吸顶；`question` / `plan-review` 不在 M0 §6 最小事件集，属范围扩展（见 3.1）。另外 DSH 只暴露优先级最高的那一条，approval 的优先级最低（0），存在被遮蔽的契约风险。
3. **注意力可见性**：告警条在普通滚动流里，滚到棋盘后审批会滚出视口；审批出现时游戏不暂停、画布内也没有提示。
4. **暂停/恢复状态机**：没有 `pauseReasons`、没有 `manualPaused`，直接加 `if (approval) pause()` 会错误恢复用户手动暂停的局，也会在连续审批时抖动。
5. **实例与生命周期**：模块级 canvas/root/store 假设"只渲染一个视图"，多实例会互相覆盖；插件重载后 `visibilitychange` 监听不会重新绑定。

建议的节奏：

| 阶段 | 版本 | 目标 | 估时 |
|---|---|---|---|
| 迭代 0 | 无代码 | 定剩余决策、M1 对照验收、修文档漂移 | 1–2 人日 |
| 迭代 1 | `v0.3.1` | **不撒谎、不漏看**：状态真实性 + approval 告警 + 告警吸顶 + 回归测试 | 2–3 人日 |
| 迭代 2 | `v0.4.0` | **M3 闭环**：`agent:*` 信号层 + 审批暂停 + step +5 / success +50 + 切会话暂停 + 多实例隔离 | 4–6 人日 |
| 迭代 3 | `v0.5.0` | **架构与体验**：拆文件、GameAdapter、标准 hooks、窄窗/主题/可访问性 | 5–7 人日 |
| 迭代 4 | `v0.6+` | 生态：日志导出、统计、自定义规则、第三方游戏、审批解锁 | 按需 |

> 估时按"熟悉该代码库的 1 名开发者"计算，不含设计评审与发布等待。若只能发一次版，把迭代 1 + 2 合并为 `v0.4.0`，但回归范围会明显变大。

---

## 2. 三方评审的共识、分歧与核验

### 2.1 三方一致同意的（直接进入 P0/P1）

| 结论 | 证据 | 来源 |
|---|---|---|
| M3「Agent → 游戏单向联动 / 审批暂停」完全未实现 | `client.js:342-346` 明确写"Fully decoupled ... M3" | C/G/M |
| 告警条不是吸顶的，"不依赖滚动可见"的规范未落实 | `.wb-root` 是 `overflow:auto`，`.wb-alert` 在普通流中（`client.js:1430/1435/1526`） | C/G/M |
| durable 与 live 的状态合成有错误，会显示旧终态或永久 running | `client.js:219-222` 只在 `idle` 时接受 `running=true` | C/G/M |
| 未知 `turn/end` 原因被默认判成功 | `index.js:157-178` 的 `default` 与 `completed` 合并 | C/G |
| 模块级单例导致多实例/多会话互相干扰 | `gameCanvas/boardEl/rootEl/gameStore`（`client.js:505-610`） | C/G/M |
| 没有自动化测试，`__game` 导出未使用 | `package.json` 无 test script；`client.js:1612-1631` | C/G/M |
| Client 单文件 1600+ 行、`mode === 'snake'` 硬编码，扩展成本高 | `client.js:1289-1317` | C/G/M |
| 文档与代码多处漂移 | 棋盘高度、步数、软按钮、D16/D17 等 | C/G/M |

### 2.2 分歧裁定

| # | 分歧 | 裁定 | 依据 |
|---|---|---|---|
| 1 | 审批会不会被更高优先级交互遮蔽？Claude 说会；GPT/Gemini 未强调 | **Claude 的契约判断成立，但插件内无法可靠修复**。DSH `registerPendingInteraction(precedence)` 的规则是"larger values win"；approval 注册 `0`，question 注册 `1`，plan-review 注册 `2`，所以审批是最低优先级。`SessionStatus.pendingInteraction` 只暴露最高的一条，插件拿到 winner 后看不到被遮蔽的审批。**结论：能修的是"question/plan-review 可见"，不是"被遮蔽的审批可见"；后者记为 DSH 契约限制，需实测共存场景并考虑上游反馈。另：M0 §6 最小事件集只含 approval，question/plan-review 的可见性是范围扩展，需 D28 批准，不作为 M1/M2/M3 基线验收项。** | `dsh-client-ui-session/lib/client.js` `registerPendingInteraction` 注释与 `publishPendingInteractions`；`ui-approval` 注册 `() => 0`；`ui-user-questions` 注册 `kind === "plan-review" ? 2 : 1` |
| 2 | Gemini 说 `faceOf('waitbuddy')` 冷启动可能返回 `undefined`，导致漏订阅 | **不成立（rc.5）**。`ProjectionValueStore.faceOf()` 的注释与实现明确："Always defined — absence is an `undefined` snapshot, never a missing face"，且 face 身份稳定。真正残留的问题是 `ensureProjection()` 失败不重试、`binding` 晚到不重订。 | `dsh-api-session-controller/lib/types/client/sessions/projection-store.js:22-31` |
| 3 | 审批消失后自动恢复还是手动恢复？Claude 推荐手动，Gemini 倾向一键继续，GPT 用 `pauseReasons` | **自动暂停 + 手动恢复（M0 §9 已明确）**。审批出现时自动暂停；审批消失后不自动跑，浮层提示"已处理，按空格或点击继续"。用 `pauseReasons: Set` 防连续审批抖动，用 `manualPaused` 防覆盖用户手动暂停。 | M0 §9："审批处理完毕、告警状态清除后，由用户手动恢复游戏" |
| 4 | 切会话时游戏保留、暂停还是按会话存档？ | **M0 §8 已关闭：全局单局；切会话只重置监控状态，游戏独立保留、不重置；跨会话奖励叠加到当前局。** 不做 per-session 存档。切走时暂停来自 ui-spec（不是 M0 明文），作为交互约束保留。 | M0 §8："仅重置监控状态，贪吃蛇游戏状态独立保留，不会被自动重置"；"新会话任务的奖励会叠加到当前本局游戏" |
| 5 | 要不要恢复"已完成 N 步"？Gemini 建议恢复，Claude 反对 | **按 M0 §6 应恢复"已完成 N 步"**（总步数仍不显示）。M0 明确"仅展示 stepCount"；D1 也保留"已完成 N 步"。D9 的"完全隐藏步数"是与 M0 §6 冲突的偏离，需要产品负责人正式确认。默认：恢复元信息，活动流作为补充。 | M0 §6 与 §8；D1；D9（待确认偏离） |
| 6 | 是否迁移到 `useProjection` / `useSessionStatus`？Claude 推荐，GPT/Gemini 未坚持 | **先做 1 天 spike，再决定**。DSH 的 `practices.md` 明确建议"通过 slot props 的 selector hooks 读取会话数据"，`ui-session` 也确实提供了 `projection` keyed hook 与 root `sessionStatus`。但迁移会改数据通路，必须用冷启动、切会话、Host 断开三组用例回归；不成功则保留现路径 + 能力探测。 | `practices.md`；`ui-session` `provideRoot({hooks:{sessionStatus}})` 与 `keyedHooks:{projection}` |
| 7 | 活动流超出基线事件集（`assistant/message`）怎么办？ | **D27 已移除 reasoning 原文**：Host 不再订阅/折叠 `assistant/message`，活动流只显示 `tool/call`。M0 §6 最小集恢复一致。 | M0 §6/§11；D27 |
| 8 | 多实例优先级 | **P0，但排在状态真实性之后**。主视图 + 分屏/嵌入是真实场景；不过"审批漏看"比"第二个画布不刷新"更紧急。 | 三份评审一致 |

### 2.3 各家最有价值的独特贡献

| 评审 | 独特贡献 | 在计划中的落点 |
|---|---|---|
| Claude | 发现 `question` / `plan-review` 的可见性缺口；指出 approval precedence 最低；提出信号层的 baseline/key/挂载时间三规则；给出 UI 层级与红线的完整清单 | ST-03、AR-01、AT-07、2.2 #1/#6 |
| GPT | 把"双源状态"写成可执行的协调矩阵；提出 `pauseReasons` + `wasRunningBeforeAttention`；强调多实例隔离与"同一工具连续审批"去重；给出最完整的 P0 测试清单 | ST-01、AT-03、RT-02、ST-07、QA-01 |
| Gemini | 抓到了最多可复现的 UI/交互细节：五子棋 `ResizeObserver`、终局遮罩错位、`setGrid` 丢速度、暂停改速度、插件重载后监听丢失、Host 硬编码中文 | GM-04、GM-05、RT-04、ST-06、AT-04 |

### 2.4 评审中需要降级或纠正的说法

- **Gemini「`faceOf` 冷启动返回 undefined」**：rc.5 不成立，见 2.2 #2。它给出的"惰性补订"代码仍有价值（防未来版本 + binding 晚到），但不应作为当前 P0 的理由。
- **Claude「审批被更高优先级请求遮蔽」**：契约方向对，但"插件能修"是过度承诺。插件只能看到 winner；要看到所有 domain 需要绕过 `uiSession`，属于侵入式改动，不做。
- **GPT「当前版本未达到完整 M0 基线」**：现在有 M0 原文，可以判定：M1/M2 大部分符合，M3 缺失；D7/D9/D16/D17 是已实现但未登记的偏离。详见 [M0 对照](m0-compliance.md)。
- **Gemini「恢复步数显示」**：M0 §6 明确要求展示 `stepCount`，Gemini 的方向与基线一致；真正需要确认的是 D9 的"完全隐藏步数"是否作为正式偏离。默认按 M0 恢复「已完成 N 步」。
- **Gemini「五子棋 AI 延迟 120–180ms」**：体验上合理，但会引入新的 timer/清理路径，放 P2，不和 P0 抢时间。
- **Claude「切会话/任务启动不重置游戏是基线偏离」**：M0 §8 明确要求"游戏状态独立保留，不会被自动重置"，所以"不重置"本身不是偏离；需要修的是"切会话是否暂停"（ui-spec 要求暂停）和"监控是否重置"。
- **D7（软按钮）/ D9（隐藏步数）/ D16（五子棋）/ D17（设置持久化）**：按 M0 都属基线外或偏离项。功能已存在，推荐保留并登记为产品负责人批准的偏离；但它们不能作为 M1/M2 基线达标证据。详见 [M0 对照](m0-compliance.md) 第 3 节。
- **各家对视觉跳动/多实例的严重度**：方向可信，但都未实机验证。统一标"需实测"，验收时用截图/录屏确认。

### 2.5 本次核验的置信度

| 类别 | 数量 | 说明 |
|---|---|---|
| ✅ 已核对代码/契约 | 31 | 行号、状态机、DSH precedence、`faceOf` 语义、CSS 变量等 |
| ⚠️ 需实机验证 | 6 | 告警吸顶后的滚动行为、棋盘跳动误触、多实例绘制、切会话是否复用组件、子 Agent 冒泡、窄窗布局 |
| ❓ 待基线/产品决策 | 2 | 子 Agent 是否冒泡、标准 hooks 迁移是否为可行路径（另有 5 个全局决策见第 8 节） |

---

## 3. 问题总表（去重后的 canonical backlog）

> 优先级定义：**P0** = 会让用户漏审批、看到假状态、或数据错误；**P1** = 明显体验/可维护性问题；**P2** = 打磨或远期。
> "状态"：✅ 已核对；⚠️ 需实测；❓ 待决策。**它表示评审事实的核验方式，不是修复进度**；已修项见 [M1 验收记录](m1-acceptance.md)。

### 3.1 状态与告警

| ID | 优先级 | 问题 | 代码证据 | 来源 | 状态 |
|---|---|---|---|---|---|
| ST-01 | P0 | 双源状态协调错误：上一轮 `success/failed` 时新任务启动仍显示旧终态；`running=false` + durable `running` 会永久假运行 | `client.js:219-222` | C/G/M | ✅ |
| ST-02 | P0 | 未知 `turn/end.reason.kind` 落入 `default`，显示"任务执行成功 ✅" | `index.js:157-178` | C/G | ✅ |
| ST-03 | P0 | approval 告警是基线内要求，但当前没有吸顶、没有 `key`；DSH 只暴露最高优先级，approval precedence 最低，存在被 question/plan-review 遮蔽的契约风险 | `client.js:208-236`；DSH precedence 见 2.2 #1 | C | ✅ 契约 |
| ST-03b | P1（需批准） | `question` / `plan-review` 不可见；M0 §6 最小集不含这两类，属范围扩展，需 D28 批准 | `client.js:208-236` | C | ❓ 需 D28 |
| ST-04 | P0 | `ready` 算出来但 UI 不用；投影刷新失败只写 console，界面仍显示"空闲"。**建议用 `health` 字段承载 loading/degraded/stale，不新增 `status` 值（M0 §8 六值封闭）** | `client.js:235/249-259` | C/G/M | ✅ |
| ST-05 | P1 | `tool/call`、`turn/end` 缺 `status === running` / `turn` 守卫 | `index.js` | G/M | ✅ |
| ST-06 | P1 | 错误文案硬编码中文并写入持久化投影；切英文后中英混杂 | `index.js:160-168` | M | ✅ 0.7.0 已落地（D41 原因码 + stateVersion 5） |
| ST-07 | P1 | 快照只带 `approvalTool`，不带 `pendingInteraction.key`；同名工具连续审批可能被 `sameMonitor()` 去重 | `client.js:148-163/232-234` | C/G | ✅ |
| ST-08 | P1 | 只有绝对时间"更新于 HH:MM:SS"，没有运行时长/活动年龄 | `client.js:331-340` | C | ✅ |
| ST-09 | P2 | goal 续跑轮间会闪"成功" | DSH goal continuation；未在本仓库验证 | C | ⚠️ |
| ST-10 | P2 | 子 Agent 的审批/提问是否冒泡到父会话未知 | 当前只查 `sessionId` | C | ❓ 实测 |

### 3.2 注意力与告警

| ID | 优先级 | 问题 | 代码证据 | 来源 | 状态 |
|---|---|---|---|---|---|
| AT-01 | P0 | 告警条在滚动流里，滚到棋盘后可能滚出视口；与 ui-spec "不依赖滚动可见"冲突 | `client.js` | C/G/M | ✅ 已改为独立顶部区域（视觉待验） |
| AT-02 | P0 | 审批进入时游戏不暂停、画布内无提示（M3 缺失） | `client.js:342-346` | C/G/M | ✅ |
| AT-03 | P0 | 没有暂停/恢复状态机：无 `manualPaused`、无 `pauseReasons`，连续审批会抖动/错误恢复 | `client.js:486-493` | G/M | ✅ |
| AT-04 | P1 | 告警插入/消失会把棋盘向下推，五子棋落子可能点偏 | `client.js:1434-1435/1526` | G/M | ⚠️ 实测 |
| AT-05 | P1 | 成功没有"到达感"；running 与 success 用同一个绿色点 | `client.js:1443-1445` | C/M | ✅ |
| AT-06 | P1 | 窄窗口：`min-width:260px` + 24px padding、`.wb-alertTitle` 不换行，可能横向溢出 | `client.js:1437/1440` | C/G/M | ⚠️ 实测 |
| AT-07 | P2 | 视觉重心被棋盘抢走；运行脉冲用告警橙；无 `prefers-reduced-motion`；棋盘/浮层硬编码深色 | `client.js:630/664/1452/1460` | C/G/M | ⚠️ 视觉（reduced-motion 已于 0.7.0 落地，D43；深色主题仍待） |

### 3.3 游戏正确性

| ID | 优先级 | 问题 | 代码证据 | 来源 | 状态 |
|---|---|---|---|---|---|
| GM-01 | P1 | 单 tick 内连按"上、左"会覆盖 `nextDir`，下一帧直接反向撞自己 | `client.js:436-441` | C/G/M | ✅ |
| GM-02 | P1 | 每次 `set()` 都重建 `setInterval`，连按方向键会把 tick 一直往后推，蛇停住 | `client.js:522-535` | C | ✅ |
| GM-03 | P1 | 「再来一局」调用 `reset()` 回 idle，还要再点一次「开始游戏」 | `client.js:755-773` | G/M | ✅ |
| GM-04 | P1 | paused 时改速度不更新 `tickMs`；`setGrid` 重建状态时丢掉当前速度 | `client.js:558-576` | G/M | ✅ |
| GM-05 | P1 | 五子棋没有 ResizeObserver，窗口缩放后画布不重绘；终局遮罩铺满宽屏容器；`lastMove` 只标 AI | `client.js:1221-1236/1482/1140-1145` | M | ✅ |
| GM-06 | P2 | 五子棋 AI 同步落两子，玩家看不清自己/AI 各下在哪；无键盘落子 | `client.js:944-968` | M/G | ⚠️ 体验 |
| GM-07 | P2 | 底部按钮点击后不 `focusRoot()`；重置后按钮 disabled 导致焦点回 body；缺空格暂停 | `client.js:1338/1347` | M | ⚠️ |
| GM-08 | P2 | 文案仍写"方向键或软按钮控制"，软按钮已被 D7 移除；但 M0 §5 要求软按钮，需先解决 D7 偏离 | `client.js:52/104` | C/G/M | ✅ |

### 3.4 实例与生命周期

| ID | 优先级 | 问题 | 代码证据 | 来源 | 状态 |
|---|---|---|---|---|---|
| RT-01 | P0 | 切会话时 `WaitBuddyView` 被复用、`GameArea` 不卸载，游戏继续跑；违反 ui-spec「切会话自动暂停」 | `client.js` `GameArea` | G/M | ✅ 已加 `sessionId` 变化 pause；双实例回归待做 |
| RT-02 | P0 | `gameCanvas/boardEl/rootEl/gomokuCanvas` 是模块级单例；两个视图会互相覆盖，卸载一个会把引用置 null | `client.js:586-610/993/1067` | C/G/M | ✅ |
| RT-03 | P1 | 没有错误边界；游戏绘制抛异常会连监控区一起崩 | `client.js:1498-1582` | C/G | ✅ 0.7.0 已落地（视图/胶囊错误边界，D43） |
| RT-04 | P1 | `gameStore` 在模块工厂创建；dispose 移除 `visibilitychange` 后，插件重载不会重新绑定；`clientCtx/boundT` 残留旧 ctx | `client.js:505-586/1578` | C/G/M | ✅ 0.7.0 已落地（store 生命周期迁入 apply，D43） |
| RT-05 | P1 | `uiSession` 用 `ctx.get` 读取但未声明 inject；`binding` 晚到不会重订；`refreshProjections` 失败只试一次 | `client.js:193-197/262-277` | C/G/M | ✅ 0.7.0 已落地（inject 声明 + 限时重订 + 刷新重试，D43） |
| RT-06 | P2 | 标准 hooks（`useProjection`/`useSessionStatus`）迁移未验证 | `client.js:184-197` | C/G | ❓ spike |

### 3.5 架构、质量与文档

| ID | 优先级 | 问题 | 代码证据 | 来源 | 状态 |
|---|---|---|---|---|---|
| AR-01 | P1 | 没有信号层，只有电平快照；无法表达"进入审批/本轮结束"这类边沿 | `client.js:342-346` | C/G/M | ✅ |
| AR-02 | P1 | 单文件 1634 行；`mode === 'snake'` 三元分支；无 GameAdapter | `client.js:1289-1317` | C/G/M | ✅ |
| QA-01 | P0 | 零测试；`__game` 导出未使用；`fold` 未导出，无法单测 | `package.json`；`client.js:1612-1631` | C/G/M | ✅ |
| QA-02 | P2 | 无 `test` script/CI/文档一致性检查 | `package.json` | G/M | ✅ |
| DOC-01 | P0 | M0 原文已补录（[baseline-m0.md](baseline-m0.md)），但 README/ui-spec/locale/decisions 与 M0 仍有多处漂移 | `README.md:18/24/35/89`；`ui-spec.md:10/36/125`；D16/D17 | C/G/M | ✅ |
| DOC-02 | P1 | 铁律"不订阅基线之外的事件" vs D9 新增 `assistant/message`，自相矛盾 | `README.md`；D9/D27 | C/G | ✅ 已移除 reasoning 事件 |
| CP-01 | P2 | 无 DSH 版本兼容声明/能力探测；`zod` 精确锁 `4.4.3` | `package.json` | C/G | ✅ |
| PR-01 | P2 | 工具参数/命令可能包含敏感路径或查询词，当前无脱敏/开关 | `index.js` tool/call | C/G/M | ✅ |

### 3.6 M0 / M3 基线补充项

| ID | 优先级 | 问题 | M0 依据 | 状态 |
|---|---|---|---|---|
| M3-01 | P0（迭代 2） | 信号契约按 M0 的 `agent:*` 命名落地；监控只广播、游戏消费 | §9：固定 `agent:*` 信号集；监控不定义奖励 | ✅ 已实现（核心） |
| M3-02 | P0（迭代 2） | M3 奖励：step +5 / success +50 / failed·abort 提示 / 审批暂停后手动恢复 | §9 四条预设联动 | ✅ 已实现（核心） |
| M3-03 | P1（迭代 2） | 跨会话奖励归属：M0 明确"新会话奖励叠加到当前本局游戏" | §8 备注 | ✅ 已实现并有测试 |
| BL-04 | P0（迭代 1） | M0 §6 要求展示 stepCount，当前 D9 隐藏；默认恢复「已完成 N 步」，总步数仍不显示 | §6/§8；D1；D9（待确认偏离） | ❓ 待确认 |

> 这四项不计入前面的 39 个评审问题；它们是 M0 冻结后新增的验收项。M3-01/M3-02 已实现核心，`v0.4.0` 仍以桌面端 TC-01/02/21/22 验收为准；BL-04 是 `v0.4.0` 的验收项（除非 D9 被正式批准为偏离）。

---

## 4. 迭代计划

### 4.0 依赖关系

```
决策/基线（迭代 0）
      │
      ▼
状态真实性（ST-01..04）──► 信号层（AR-01）──► 暂停状态机（AT-02/03）
      │                          │
      ▼                          ▼
告警吸顶/阻塞交互（AT-01/ST-03）   游戏运行时（RT-01/02）
      │                          │
      └──────────┬───────────────┘
                 ▼
        架构拆分/GameAdapter（AR-02）──► 自定义规则/生态（迭代 4）
```

原则：**先让状态可信，再让信号可信，最后才让游戏消费信号。** 否则会把"假状态"直接变成"假事件"。

---

### 迭代 0：决策、基线与 M1 对照（1–2 人日，无代码行为变更）

**目标**：M0 已补录；把剩余基线冲突定掉，并产出第一份 M1 对照验收记录，避免边写边改。

**任务**

1. ~~补 `docs/baseline-m0.md`~~：已完成（2026-11-05）。
2. 确认第 8 节剩下的 5 个基线问题（4/5/9/10/11），写入 `docs/decisions.md`（新增 D28）。
3. 按 [M0 对照](m0-compliance.md) 逐条打勾，产出 `docs/m1-acceptance.md`（M1 验收记录，引用 M0 §x）。
4. 修正文档漂移（见 4.5 的 DOC 清单），把 D7/D9/D16/D17 标注为"待确认偏离"或"已批准偏离"。
5. `package.json` 加 `"test": "node --test"`，先建空测试目录与约定。
6. 给 `client.js` 的 `__game` 和 `index.js` 的 `fold` 确定测试加载方式（见 5.2）。

**交付物**：`docs/baseline-m0.md`（已）、`docs/m0-compliance.md`（已）、`docs/m1-acceptance.md`、D28、修正后的 README/ui-spec/locale、测试脚本骨架。

**验收**：文档中不再出现互相矛盾的规格；M1 对照记录能逐条回答"符合 / 偏离 / 不适用"；每个 P0 项都能指向一条决策或一个待确认问题。

---

### 迭代 1：`v0.3.1` 止血——"不撒谎、不漏看"（2–3 人日）

**目标**：即使还不做 M3，也要保证面板不会显示假状态、不会漏掉审批、告警始终可见。question/plan-review 的可见性作为 D28 提案，不阻塞本迭代基线验收。

**范围**

- ST-01 状态协调矩阵
- ST-02 未知终态
- ST-03 approval 告警（基线）；ST-03b question/plan 可见性（需 D28，非基线）
- BL-04 步数展示（M0 §6 默认恢复「已完成 N 步」；D9 例外需确认）
- ST-04 degraded / ready 上屏
- AT-01 告警吸顶（先做最小版：sticky + 不透明背景）
- ST-05 turn/status 守卫
- ST-07 approval key + `sameMonitor` 比较
- ST-06 错误文案结构化（可选，若时间允许）
- QA-01 第一批单测（fold + compose + pending）
- DOC-01/DOC-02 文档与决策

**关键设计**

1. **状态协调矩阵（M0 §8 兼容）**：`status` 保持六值；新增 `health` 与 `pendingKind` 作为展示字段，不新增 status。

   | 条件 | `status` | `health` / 展示 |
   |---|---|---|
   | `pending != null` | `pending_approval` | `pendingKind` = `approval` / `question` / `plan-review` / `unknown`；approval 是基线，其余需 D28 |
   | `ready === false` 且无 pending | 保持 durable 或 `idle` | `loading`（首 1–1.5 秒）/ `degraded`；UI 显示"监控数据不可用"，不显示空闲 |
   | `live.running === true` 且 durable 非 running | `running` | `ready` |
   | `live.running === false` 且 durable `running` | 保持 `running` | 5 秒后 `stale`；UI 显示"状态同步中断"，不猜 `aborted` |
   | 两者一致 | durable 状态 | `ready` |

   - `health` / `pendingKind` / `endReason` 只存在于 **Client 快照**，不写入 Host 投影；M0 的 `TrackState` 持久化结构不变。`health` 不是 M0 `status`，UI 在 `health !== 'ready'` 时覆盖状态行。
   - `pendingKind` 不改变 `status`；approval 是 M0 §6 基线，question/plan-review 需 D28 批准。
   - `stale` 的 5 秒宽限用组件内 `setTimeout`；纯函数 `composeMonitor(input, now)` 接受 `mismatchSince`，便于单测。
   - **Host 完全失联且 live 仍为 true**：只显示"已 N 分钟无新活动"（ST-08），不伪造 `stale`；只有 `running === false` 的明确矛盾才升级为"状态同步中断"。
   - 文案：`loading` → "正在读取监控数据…"；`degraded` → "监控数据不可用"；`stale` → "状态同步中断（可能已断开）"。

2. **未知终态（M0 §8 兼容）**：不新增 `status`。`endedWith` 只把显式 `completed` 映射为 `success`；`default` 映射为 `aborted` + `endReason = reason.kind`，UI 文案"本轮已结束（未知原因）"，不显示 ✅。M1 补丁已因 fold 语义变化把 `stateVersion` 升到 3；D27 移除 reasoning 后升到 4；若产品负责人再批准 D22 新增 `unknown`，需继续升到 5。

3. **阻塞交互**：approval 是 M0 §6 基线；`compose()` 对 approval 设 `status = 'pending_approval'`、`pendingKind = 'approval'`。若 D28 批准，再对 `question` / `plan-review` 用同一 `status` + 不同 `pendingKind`，文案：
   - approval → "等待你审批工具调用"，附工具名
   - question → "Agent 在等你回答"
   - plan-review → "等待你确认计划"
   - unknown → "Agent 正在等待你处理"

   同时明确：**被更高优先级遮蔽的 approval 不在插件能力范围内**，不要为此写侵入式代码。

4. **降级展示**：`ready === false` 时状态行显示"监控数据未就绪"，副文案"原生审批弹窗仍然有效"；`refreshProjections` 失败后允许一次手动重试（按钮或下次重新进入视图），不做无限自动重试。首帧给 1–1.5 秒 `loading` 宽限，避免刚进视图就闪"未就绪"；宽限结束仍无投影才显示 `degraded`。

5. **告警吸顶（最小版）**：`.wb-alert { position: sticky; top: 0; z-index: 2; background: var(--dsw-alias-bg-base); }`，并允许 `flex-wrap: wrap`。更彻底的"独立注意力层"放迭代 3。

**验收**

- TC-04、TC-06、TC-07、TC-08、TC-09、TC-14 通过；TC-03 仅在 D28 批准后纳入验收（基线只要求 approval）。
- 新增单测：`fold` 的所有 reason（含未知）、turn 不匹配、重复 `turn/start`、活动去重；`composeMonitor` 的所有矩阵分支；`pendingKind` / `health` 映射；未知 reason 不再判 success。
- 若按 M0 默认：状态行显示「已完成 N 步」，总步数仍不显示；若 D9 被批准为偏离，验收改为活动流 + 文档记录。
- 手动：滚到棋盘底部时触发审批，告警仍在视口内；英文界面错误文案不再混中文（若选做 ST-06，则一并验收）。

**风险/取舍**

- 不新增 `status` 值；新增 `health` / `pendingKind` / `endReason` 三个展示字段，CSS/文案/测试要同步。D22（unknown status）单独审批，不在本迭代默认实现。
- 本迭代不解决审批暂停，核心痛点仍在；发布说明要写清楚"v0.4.0 补联动"。

---

### 迭代 2：`v0.4.0` 联动闭环——"审批必暂停 + M3 奖励"（4–6 人日）

**目标**：按 M0 §9 补上 M3：审批进入时游戏自动让位、处理后手动恢复；step +5、success +50、failed/abort 提示且不重置本局。

**范围**

- AR-01 信号层（边沿、key、baseline）
- M3-01 `agent:*` 信号契约（监控只广播、游戏消费）
- M3-02 M3 奖励：step +5 / success +50 / failed·abort 提示
- AT-02 审批自动暂停 + 画布内提示
- AT-03 `pauseReasons` / `manualPaused` 状态机
- RT-01 切会话暂停
- RT-02 模块级 canvas/root 改为组件实例 `useRef`
- GM-01/02/03/04/05 游戏手感与五子棋重绘
- AT-05 成功/失败画布内反馈（轻量）
- QA-01 第二批单测（信号差分、暂停 reducer、游戏输入）

**关键设计**

1. **信号契约 v1（M0 §9 的 `agent:*` 命名）**（纯客户端，只读）：

   ```js
   // { type, sessionId, key, at, detail }
   // agent:task_start    key = `${turn}`
   // agent:step_advance  key = `${turn}:${stepCount}`，detail = { delta, stepCount }
   // agent:approval_enter/leave  key = pendingInteraction.key + kind
   // agent:task_finish   key = `${turn}:${status}`，detail = { status, reasonKind }
   ```

   监控层只负责把事件映射为这组信号并广播；**不在监控层写 +5/+50**，奖励规则属于贪吃蛇适配器。

   规则：
   - 挂载/切会话后的第一帧只作为 baseline，不发信号；
   - 同一 `key` 只发一次（有上限的 `Set`，避免内存增长）；
   - `at` 早于挂载时间的信号丢弃；
   - `pendingKey` 为空 → 不发 `agent:approval_leave`；`pendingKey` 从 A 变成 B（非空→非空）时，先发 `approval_leave(A)` 再发 `approval_enter(B)`，否则连续审批会漏掉一次；
   - 信号从 `createMonitorSource` 的 `publish()` 之后发出，不反向修改监控状态。

2. **暂停状态机**：

   ```js
   runtime = {
     manualPaused: false,
     pauseReasons: new Set(),      // 'approval:<key>' | 'hidden' | 'view-inactive' | 'session-switch'
     resumePending: false,
   }
   ```

   - `agent:approval_enter`：若当前 running，记录 `resumePending = true`，加 reason，暂停；浮层"Agent 等待审批，已自动暂停"。
   - `agent:approval_leave`：移除对应 reason；若还有 reason → 保持暂停；若清空 → **不自动 resume**，浮层改为"已处理，按空格或点击继续"。
   - 用户手动暂停：`manualPaused = true`，清空 `resumePending`；手动继续：`manualPaused = false`，只有 `pauseReasons` 为空才恢复。
   - 连续审批：每个 `key` 一个 reason；最后一个消失才允许"可继续"。
   - `hidden` / `view-inactive` / `session-switch` 也走 reason；恢复可见时不自动跑。
   - 五子棋：只显示提示层，不锁盘（回合制）。

3. **实例隔离**：
   - `gameCanvas/boardEl/rootEl/gomokuCanvas` 全部改 `useRef`，放在 `GameArea` / `WaitBuddyView` 内；`focusRoot` 改为组件内函数。
   - `gameStore` 仍可全局共享（迭代 0 决策），但**绘制句柄必须按实例**；两个视图同时打开时各自绘制同一状态。
   - **已知代价**：全局单局意味着两个不同会话的 WaitBuddy 也共享同一局；在一个视图切会话会暂停另一个视图的游戏。v0.4 先接受并写进 ADR；如果产品要求跨会话隔离，再换 `Map<sessionId, store>`。
   - `GameArea` 接收 `sessionId`，`useEffect([sessionId])` 调用 `pause()` 并加 `session-switch` reason；返回该会话后不自动恢复。
   - 若最终选"按会话存档"，把 `gameStore` 换成 `Map<sessionId, store>` + 引用计数；接口不变，先不实现。

4. **M3 贪吃蛇预设响应（M0 §9）**：
   - `agent:step_advance` → +5 分，画布浮字 `+5`，不打断游玩。
   - `agent:task_finish` 且 status=`success` → +50 分，提示"任务完成！奖励分数"。
   - `agent:task_finish` 且 status=`failed` / `aborted` → 提示"任务失败/中断"，**不重置、不结束本局**。
   - `agent:approval_enter` → 自动暂停 + 浮层"等待审批，已自动暂停"；`agent:approval_leave` 后不自动恢复，提示"已处理，按空格/点击继续"。
   - 奖励归属当前本局游戏；切会话后新会话奖励继续叠加（M0 §8 预期行为）。

5. **游戏修复**：
   - `dirQueue: string[]`（最长 2），入队时和队尾比较；`tickGame` 消费队首、保留剩余。
   - `schedule()` 只在 `status` 或 `tickMs` 变化时重建计时器；方向键只改状态，不重置 interval。
   - 「再来一局」→ `start(settings.speed)`。
   - `setSpeed` 无论 running/paused/idle 都按 `score` 重算 `tickMs`；`setGrid` 传 `state.speed`。
   - 五子棋：`ResizeObserver` 同时服务两种模式；`.wb-squareBoard { aspect-ratio: 1/1; width: auto; max-width: 100%; }`；记录 `lastHumanMove` / `lastAiMove`。
   - 成功/失败/中断用画布内非模态提示；不自动重置、不结束本局。

**验收**

- TC-01、TC-02、TC-05、TC-12、TC-16、TC-17、TC-18、TC-19 通过。
- 手动：审批出现时蛇暂停且不撞墙；处理完不自动跑；手动暂停的局审批结束后仍暂停；连续 3 次审批只暂停一次、无抖动。
- M3 奖励：step +5 浮字、success +50、failed/abort 提示且不重置；切会话后奖励继续叠加到当前局。
- 单测：信号 baseline/去重/多审批/task 迁移；暂停 reducer 的所有分支；奖励只发一次；方向队列"右→上→左"回归；`setGrid` 保速。

**风险/取舍**

- 自动暂停会打断游戏，但这是产品定位决定的；用"手动恢复"把控制权还给用户。
- M3 基线已经明确要求 +5/+50/失败提示，必须做；但不要额外加"审批批准奖励/通关解锁"等 §9 之外的规则。
- M0 §8 已定全局单局；切会话暂停来自 ui-spec，不是 per-session 存档。若未来要按会话存档，属于基线变更，需评审。

---

### 迭代 3：`v0.5.0` 架构与体验（5–7 人日）

**目标**：把 1600 行单文件拆成可演进的层，补上多实例、生命周期、窄窗/主题/可访问性。

**范围**

- AR-02 拆文件 + GameAdapter
- RT-03 错误边界
- RT-04 store 生命周期迁入 `apply`
- RT-05 `uiSession` 声明 / `binding` 晚到 / 重试
- RT-06 标准 hooks spike 落地
- AT-04 告警不跳布局（独立注意力层）
- AT-06 窄窗适配
- AT-07 主题/降噪/reduced-motion
- ST-06 错误文案本地化
- ST-08 运行时长/活动年龄
- GM-06/07 五子棋节奏/焦点/空格
- PR-01 隐私开关（UI 层先做，Host 脱敏另立项）
- CP-01 能力探测/版本说明
- QA-02 CI + 文档一致性检查

**关键设计**

1. **模块拆分（先验证加载方式，不能假设相对 `require` 可用）**

   当前 `client.js` 是一个 `window.__ModuleLoader__.load({ factory(require) { ... } })` 单文件模块，`require` 只用于宿主包；仓库没有构建步骤。三份评审都建议"拆文件"，但都没有验证 DSH 的 Client loader 是否支持相对模块。**这是迭代 3 的第一个 spike（0.5 天）**：

   - **方案 A（首选）：加 esbuild，把 `src/**` 打成单文件 `client.js`。** 发布产物仍是单文件，开发时可以多文件；`lib/fold.js` 等纯函数可直接被 `index.js` 与 `node --test` 复用。代价是新增一个 devDependency 和 `pnpm build` 步骤，release 文档要写清"发布前必须 build"。
   - **方案 B（不加构建）：保持 `client.js` 单文件，只在文件内分区**（`// #region signals`、`// #region games` 等 + 工厂函数），Host 侧 `lib/fold.js` 可拆。测试用 `test/load-client.mjs` 加载 `client.js` 取 `__game`。这是风险最低的兜底。
   - **方案 C（未验证）：loader 支持相对模块时直接多文件。** 未验证前不写进计划。

   方案 A 的目标目录：

   ```
   src/fold.js          Host 纯函数（fold/endedWith/clip）
   src/compose.js       纯状态协调（composeMonitor）
   src/signals.js       diffSignals + createSignalBus
   src/pause.js         pause reducer
   src/games/snake.js   纯状态机（无 DOM）
   src/games/gomoku.js  纯状态机
   src/runtime.js       GameRuntimeRegistry / 引用计数
   src/client.js        React 组件、CSS、注册入口
   client.js            build 产物（发布用）
   ```

   **无论选 A 还是 B，先把纯函数抽出来并用 `node --test` 覆盖，再挪文件。** 不要在一个 PR 里同时改行为和挪文件。

2. **GameAdapter**：

   ```js
   {
     id: 'snake',
     titleKey: 'game.title',
     settings: [{ key: 'speed', options: [...] }],
     createStore(),
     Board,                  // React 组件，接收 store/refs
     pause(store, reason),
     resume(store),
     reset(store),
     onSignal?(signal, store), // 只改游戏内状态
   }
   ```

   `GameArea` 只负责页签、设置、容器；不再出现 `mode === 'snake' ? ... : ...`。

3. **标准 hooks**：用 `props.useProjection('waitbuddy')` 替代 `faceOf`；用 `props.useSessionStatus(selector)` 替代对 `uiSession.sessionStatus` 的直接订阅。保留 `createMonitorSource` 作为 fallback（能力探测失败时），但只保留一条路径，避免双源。

4. **生命周期**：`apply(ctx)` 创建 runtime；`ctx.effect(() => () => runtime.dispose())`；`WaitBuddyView` 通过闭包拿到 runtime，不读模块级 `clientCtx`。`visibilitychange` 绑定在 runtime 的 `start/stop`，随订阅数 0→1 / 1→0 启停。

5. **注意力层**：`.wb-root` 改为 `display:flex; flex-direction:column`；告警区 `flex:none` 在滚动容器之外；状态+游戏放进 `.wb-scroll { flex:1; overflow:auto }`。告警出现时棋盘用 `pointer-events:none`（仅 approval 态）防误点；消失后恢复。

6. **窄窗**：`container-type: inline-size`；`@container (max-width: 480px)` 隐藏设置分组、padding 12、`min-width:0`；`@container (max-height: 360px)` 折叠游戏区为一行。用 `--dsh-conversation-viewport-height` / `--dsh-composer-height` 计算棋盘，不重复 `vh`。

**验收**

- TC-10、TC-11、TC-13、TC-15、TC-20 通过；TC-12 在双实例下稳定。
- 手动：320×400、200% 缩放无横向滚动；审批条不随滚动消失；`prefers-reduced-motion` 下无扫光；插件禁用/启用后 `visibilitychange` 仍生效。
- 代码：`client.js` 不再有模块级 canvas/store/ctx；`GameArea` 不再有 `mode === 'snake'` 分支。

**风险/取舍**

- 拆分是最大的一步，必须先用迭代 1/2 的测试兜底；不要在同一 PR 里同时改行为和挪文件。
- 标准 hooks 迁移如果失败，保留现路径 + 能力探测，不阻塞发布。
- 主题令牌化会改变棋盘观感，先做"降低饱和度 + 亮色兜底"，不追求完全换肤。

---

### 迭代 4：`v0.6+` 生态（按需，不排期）

只有迭代 1–3 稳定后才考虑：

- 信号层注册为 Cordis Client 服务，供第三方游戏订阅（先定契约，再暴露）。
- 用户自定义 `Signal → GameCommand` 映射（默认规则表先硬编码）。
- 等待日志导出、单会话统计、历史回放（回放建议独立视图/插件，不塞进 WaitBuddy）。
- 第三款游戏（2048 等），必须先有 GameAdapter。
- "审批后解锁"只做视觉奖励：原生审批完成后解锁皮肤/关卡；不允许在游戏内批准，不允许"通关才能处理审批"，奖励不与批准/拒绝挂钩，只与响应时长挂钩。
- 工具参数/命令的 Host 侧脱敏/开关（reasoning 已由 D27 移除，tool/call 仍可能含敏感路径）。

---

## 5. 验收与测试计划

### 5.1 用例到迭代的映射

| 用例 | 迭代 | 说明 |
|---|---|---|
| TC-01 审批暂停 | 2 | 核心 M3 |
| TC-02 连续审批 | 2 | `pauseReasons` |
| TC-03 提问/计划评审 | 1（需 D28） | `pending_approval` + `pendingKind`；D28 未批准则不纳入基线验收 |
| TC-04 审批被遮蔽 | 1 | 只验证"显示 winner"；被遮蔽部分记 DSH 限制 |
| TC-05 快速切会话 | 2 | 信号 baseline + 实例隔离 |
| TC-06 新任务启动 | 1 | 状态矩阵 |
| TC-07 中途终止 | 1 | 终态 |
| TC-08 Host 断开 | 1 | `health = degraded/stale`，不新增 status |
| TC-09 未知结束原因 | 1 | 默认 `aborted` + `endReason`，UI"本轮已结束"；D22 批准后才用 `unknown` |
| TC-10 长时间空闲 | 3 | 活动年龄 |
| TC-11 子 Agent 审批 | 3 | 先实测，再决定 |
| TC-12 双实例 | 2/3 | refs + runtime |
| TC-13 热重载 | 3 | store 生命周期 |
| TC-14 Host 半缺失 | 1 | degraded |
| TC-15 窄窗口 | 3 | container query |
| TC-16 掉头回归 | 2 | dirQueue |
| TC-17 狂按方向键 | 2 | scheduler |
| TC-18 目标续跑 | 2/3 | 终态防抖 |
| TC-19 游戏崩溃隔离 | 2/3 | error boundary |
| TC-20 隐私开关 | 3 | UI 层；Host 脱敏另立项 |
| TC-21 M3 奖励 | 2 | step +5 / success +50 / failed·abort 提示；不重置游戏 |
| TC-22 跨会话奖励 | 2 | 切会话后新任务奖励叠加到当前局（M0 §8） |

### 5.2 自动化测试

用 `node --test`，不引入框架。建议文件：

```
test/fold.test.js        // fold / endedWith / clip / activity
test/compose.test.js     // composeMonitor 状态矩阵 + pendingKind
test/signals.test.js     // baseline、去重、多审批、切会话
test/pause.test.js       // pause reducer 全分支
test/snake.test.js       // turnGame/tickGame/dirQueue/setGrid 保速
test/gomoku.test.js      // 胜负、堵五、候选、难度
test/load-client.mjs     // 用 window/document/localStorage stub 加载 client.js，取 __game
```

实现要点：

- `index.js` 先 `export { fold, endedWith }`（或抽到 `lib/fold.js`）；纯函数不依赖 `ctx`。
- `compose` 从 `createMonitorSource` 里抽成 `composeMonitor({ durable, status, session, pendingKey, mismatchSince }, now)`。
- `client.js` 的测试加载：在 Node 里设置 `global.window = { __ModuleLoader__: { load: (def) => { captured = def } } }`、`global.document = { addEventListener(){}, removeEventListener(){}, hidden:false }`、`global.window.localStorage = { getItem(){return null}, setItem(){} }`，再调用 `captured.factory(require)`；`__game` 从返回值取。这样可以测纯函数，不测 DOM。
- CI：`node --check index.js client.js` + `npm test`；文档一致性先用脚本检查关键字符串（可选）。

### 5.3 手动验收（必须截图/录屏的点）

1. 滚到棋盘底部 → 触发审批 → 告警仍在视口；截图。
2. 贪吃蛇快档 + 审批 → 暂停；处理完不自动跑；截图/录屏。
3. 连续 3 次审批（可用测试桩/模拟）→ 无抖动。
4. 双实例（分屏）→ 两个画布都绘制；关闭一个，另一个继续。
5. 切会话 A→B→A → 游戏暂停、监控状态不串。
6. 320×400 + 200% 缩放 → 无横向滚动。
7. 禁用/启用插件 → 页面隐藏仍暂停。
8. 英文界面 + max-tokens → 无中文残留。

### 5.4 Definition of Done

每个迭代合并前必须满足：

- 代码、`docs/ui-spec.md`、`docs/decisions.md`、README 四处一致；
- 新增/修改的纯逻辑有单测；
- P0 用例全部通过；
- 没有新增"数据不可用时显示空闲"或"未知→成功"的路径；
- 发布说明列出行为变化与已知限制。

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 自动暂停被用户认为"打断游戏" | 体验下降 | 自动暂停 + 手动恢复；浮层说明原因；后续可加"仅提醒不暂停"开关，但默认保持暂停 |
| 标准 hooks 迁移改变数据通路 | 冷启动/切会话回归 | 先 spike，保留 fallback；用 TC-05/08/14 回归 |
| 信号层把 baseline 当事件 | 误暂停/误奖励 | 第一帧不发信号；key 去重；挂载时间过滤 |
| 多实例共享 store 导致两个视图互相暂停 | 跨视图/跨会话干扰 | 绘制句柄按实例；`pauseReasons` 按 runtime；v0.4 接受全局单局的代价并写进 ADR，若产品要求隔离再改 per-session runtime |
| 拆分文件破坏 DSH 模块加载 | 插件直接不工作 | 先验证 `__ModuleLoader__` 是否支持相对 `require`；不支持则加 esbuild 打包，或保持单文件、只抽 Node 测试用的 `lib/` |
| 版本升级导致 `pendingInteraction`/`faceOf` 变化 | 静默失效 | 能力探测 + 降级文案；README 写清已验证版本；不做宽泛 `engines` 声明 |
| 文档继续漂移 | 评审反复 | 迭代 0 先修；CI 加关键字符串检查；D6 继续执行 |
| 范围再次倒挂（又去加游戏） | M3 继续拖延 | 迭代 1–3 冻结新游戏/新玩法；只允许 P0 修复 |

---

## 7. 红线（三方合并版）

1. **只读**：不调用 `prompt`、`cancel`、`retry`、`steer`、`approval.answer`；`openView('chat')` 是唯一允许的导航。
2. **不碰原生审批/输入**：不注册/不 shadow `conversation.composer*`，不遮挡、不延迟、不替代原生审批弹窗。
3. **游戏必须让位于告警**：不能"游戏进行中延迟提醒"，不能"通关才显示审批"；审批时游戏暂停/降噪。
4. **不写会话日志**：`fold` 纯函数、幂等、无副作用；状态只从现有事件派生。
5. **不做假进度**：不显示百分比、不伪造总步数；没有分母就不硬凑。
6. **不自动批准**：不能在游戏内提供"批准/拒绝"；审批解锁只能做原生处理后的视觉奖励，且奖励不与批准/拒绝绑定。
7. **不跨会话串监控**：监控状态只对绑定 session 生效；游戏按 M0 §8 是全局单局，跨会话奖励叠加是预期行为。不要把 A 会话的监控状态显示到 B 会话。
8. **不撒谎**：投影不可用时不显示"空闲"；未知终态不显示成功；`running=false` 超过宽限期不显示"正在执行"。
9. **不能让模块级 DOM 引用阻碍多实例**：canvas/root 只能由组件实例持有。
10. **不无评审扩展事件**：新增事件/信号要有 ADR 与隐私说明；`assistant/message` 的 reasoning 已按 D27 移除。

---

## 8. 待决策问题（需要产品负责人确认）

| # | 问题 | 结论 / 建议默认 | 影响 |
|---|---|---|---|
| 1 | M0 基线原文能否提供？ | ✅ 已提供并保存为 [baseline-m0.md](baseline-m0.md) | 关闭 |
| 2 | 切会话时游戏策略？ | ✅ M0 §8：全局单局；监控重置、游戏保留、不重置；切走暂停来自 ui-spec | RT-01 |
| 3 | 审批结束后是否自动恢复？ | ✅ M0 §9：手动恢复 | AT-03 |
| 4 | question / plan-review 是否纳入？ | 基线只要求 approval；建议作为 D28 扩展立项，需产品负责人批准 | ST-03b |
| 5 | 是否恢复步数显示？ | M0 §6 要求展示 `stepCount`；建议恢复「已完成 N 步」，D9 作为偏离需批准 | BL-04 |
| 6 | 活动流 reasoning 默认显示？ | ✅ D27：不显示；活动流只保留 tool/call | PR-01、隐私 |
| 7 | 是否迁移标准 hooks？ | 先 spike，成功则迁移 | RT-06、数据通路风险 |
| 8 | DSH 支持范围？ | 先只承诺 0.2.1-rc.5；多版本测试后再写兼容声明 | CP-01、发布说明 |
| 9 | 软按钮（D7）是否恢复？ | M0 §5 明确要求；D7 已移除。建议恢复软按钮，或把 D7 登记为批准的偏离 | GM-08、M1/M2 验收 |
| 10 | 五子棋（D16）/设置持久化（D17）是否保留？ | M0 §10 属 M4；已提前实现。建议保留 + 登记偏离，但不计入 M1-M3 达标 | 范围与验收 |
| 11 | 未知终态是否新增 `unknown`？ | 默认不改枚举：`aborted` + `endReason` + UI"本轮已结束"；若要完全诚实，批准 D22 新增 `unknown` | ST-02、stateVersion |

> 1–3 已由 M0 关闭；4/5/9/10/11 是当前真正待拍板的基线冲突；6/7/8 是技术/范围决策。迭代 1 可以先做 ST-01/02/04/AT-01/QA-01 这些不依赖产品取舍的部分。

---

## 9. 本轮明确不做

- 第三款游戏（2048 等）。
- 用户自定义联动规则 UI。
- 历史回放/多任务对比/统计看板。
- 审批关卡/游戏内审批按钮。
- composer 替换、独立插件市场功能。
  - 悬浮窗：**2026-11-09 由 D29 部分解禁**（右侧栏停靠面板 L3 + 固定胶囊 L2）；**同日 D30 进一步解禁**——胶囊展开为可拖拽浮动小窗（承载完整监控 + 游戏，鼠标移出自动暂停）。仍不做：独立 Electron 窗口、自由多窗。
- 为了"更炫"而重做棋盘视觉；先保证告警和状态。
- 在没有测试的情况下大规模拆文件。

---

## 10. 下一步（建议本周执行）

1. **默认决策已定稿**：D7 软按钮、D16/D17 五子棋/设置、D28 question/plan、D22 unknown 状态均已按默认登记；D9 保留步数。
2. **发布前门禁**：跑 `npm run test:all`（59 + 4 visual），确认 320px / 双实例 smoke。
3. **发布 `v0.4.0`**：按 [release.md](release.md) 更新版本、changelog、tag。
4. **发布后**：再评估 question/plan 扩展与 DSH 真机 E2E 自动化。

### 10.1 关于"M1 工程脚手架"

**不建议从零准备。** 当前 `v0.4.0` 已经包含 M1 的 Session View、Host 投影、状态看板，以及 M2 的贪吃蛇；缺的是按 M0 验收和 M3 剩余工程项。再从零搭 M1 会：

- 重复已有的投影/槽位/看板代码；
- 把已发现的告警、状态、步数、软按钮问题带进新骨架；
- 让现有 M2/M3 工作和用户设置迁移变成额外成本。

如果目标是"M1 可独立验收"，正确做法是给现有代码加一个 **M1-only 展示模式/feature flag**（隐藏游戏区），而不是重写。若确实要从零重写，应作为独立分支/新仓库立项，并明确 M2/M3 代码与 localStorage 设置的迁移方案。

> 如果只能做一件事：先做 **RT-02 双实例回归 + AT-06 窄窗实机验收**。代码侧已改 useRef/容器查询，剩下的是验证两个视图不互相覆盖、320px 下不溢出。
