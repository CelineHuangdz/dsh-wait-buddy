# DSH 兼容性契约（compat contract）

> **用途**：WaitBuddy 只在 DSH `0.2.1-rc.5`（hostProtocolVersion 4）上实测过。本文档把插件依赖的**全部宿主 API 面**列成清单，供在新版本 DSH 上做兼容核对：新版本发布后逐条对照，全部命中即可视为"预期兼容"，再进入真机 smoke。
>
> **维护规则**：插件每次新增/移除宿主 API 使用，必须同步更新本文档（含 decisions 对应条目编号）。

## 1. 依赖面总览

| # | 层 | API / 契约 | 必需性 | 缺失时行为 |
|---|---|---|---|---|
| H1 | Host | `inject: ['sessionProjections']` + `ctx.sessionProjections.register({ name:'waitbuddy', …, stateVersion: 4 })` | **硬依赖** | 插件加载失败，无降级可能 |
| H2 | Host | 会话事件：`turn/start`、`step/end`、`turn/end`（reason ∈ completed/error/max-tokens/blocked/aborted/interrupted，未知 reason → `aborted`+原因文本） | **硬依赖** | 投影状态停留在 `idle`；未知终态有兜底（D22） |
| H3 | Host | `pendingInteraction`（任意非空 `kind`，含 question / plan-review / 未来未知 kind） | 可选 | 只影响"待审批"告警与文案细分（D28）；缺失则不显示阻塞告警 |
| H4 | Host | `tool/call` 事件（命令 / 工具名 + 参数摘要） | 可选 | 活动流为空，其余功能不受影响 |
| C1 | Client | 注入 `['slots', 'sessions', 'locale']` 三服务 | **硬依赖** | 插件无法渲染任何形态 |
| C2 | Client | `ctx.slots.inject('conversation.view')` → 注册 `waitbuddy` 会话视图 tab | **硬依赖** | 无完整视图；胶囊/小窗仍可工作 |
| C3 | Client | `ctx.slots.inject('shell.overlay')` → 注册全局胶囊 | 可选（try/catch 包裹） | 宿主无 overlay 槽位则静默跳过（D29 预案） |
| C4 | Client | `ctx.slots.inject('conversation.session.header.views.actions')` → 「打开 WaitBuddy 看板」菜单项 | 可选（try/catch 包裹） | 菜单入口消失；胶囊「后台」按钮退化为仅 `presence=quiet` 不跳视图（D36 已知限制） |
| C5 | Client | `ctx.sessions.binding`（跟随主视图会话） | 可选 | 胶囊无法跟随会话，状态可能为空 |
| C6 | Client | `ctx.sessions.refreshProjections` | 可选 | 首次数据拉取依赖宿主自动刷新；可能初始为 `loading/degraded` |
| C7 | Client | `ctx.locale.register` / `ctx.locale.bind`（NS `wait-buddy`） | 可选 | 词典缺失会显示键名；建议宿主必有 locale 服务 |
| C8 | Client | 投影状态 schema（`index.js` `stateSchema`，`stateVersion: 4`：status/activity/stepCount/health/pendingKind 等） | **硬依赖** | Host/Client 版本错配时视图显示同步中断提示 |
| B1 | Bundle | `package.json` `dsh.client.inject: ['@deepseek-ai/dsh-client-ui-conversation']`、`dsh.bundle.patch: cordis.patch.yml` | **硬依赖** | 宿主加载器不识别该字段则插件不生效 |
| W1 | Web 平台 | `Notification`（窗口失焦时系统通知） | 可选（`notify` 设置可关） | 无通知能力时静默失败 |
| W2 | Web 平台 | `localStorage`（`dsh-wait-buddy.settings.v1`、`pillPos`） | 可选 | 设置不持久化，回落默认值 |

## 2. 已知版本事实

| DSH 版本 | 结论 | 依据 |
|---|---|---|
| `0.2.1-rc.5` | ✅ 全量验证（79 单测 + 4 visual + 真机验收；question/plan-review 真机链路 2026-11-10 产品负责人确认已验） | 本文档 §1 全部条目实测 |
| 其他版本 | ❓ 未验证 | 新版本发布后按 §3 流程核对 |

`activateView`（编程式视图切换）在宿主仍非公开 API（D15 结论，rc.5 复核成立）——D36 的视图跳转因此走等价 UI 驱动；宿主未来若公开该服务可替换实现。

## 3. 新版本核对流程

1. 对照 §1：逐条确认 API 存在且语义未变（重点：H2 事件 reason 枚举、C2 槽位名、C8 schema/stateVersion）。
2. 安装插件，跑 runbook 里的 smoke（tab 出现、胶囊渲染、状态更新、审批暂停、游戏可玩）。
3. 结果记入 §2 表格；若有 API 变动，先在 decisions 立项再改代码。

## 4. 发布声明措辞约定

- README 只写**实测过的版本**，不做预测性兼容声明。
- **不加 `engines.dsh`**（release.md §7 结论）：管理器会做安装前校验，范围写错会直接挡住安装；靠文档声明 + 能力探测降级代替。
