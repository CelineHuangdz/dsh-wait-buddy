# dsh-wait-buddy

DSH 桌面版 · Agent 长任务陪伴监控面板。本仓库当前完成 **M1（状态看板）+ M2（内嵌贪吃蛇，游戏与任务解耦）**。

- 插件标识：`dsh-wait-buddy`
- 会话视图标签：**WaitBuddy**
- 定位：监控优先、游戏为辅；只做 Agent → 界面单向信号，不提供任何反向控制
- 文档：[界面规范](docs/ui-spec.md) · [决策记录](docs/decisions.md)

> **变更流程**：先改文档（`docs/` 或本 README），再改代码；实现必须与文档一致。

## M1 交付内容

| 能力 | 实现 |
|---|---|
| Session View | 在 `conversation.view` 槽注册 `waitbuddy` 视图，与 Chat / Trajectory 并列为会话视图标签 |
| 状态看板 | 状态点 + 状态文案 + 已完成步数 + 脉冲条 + 最近动作 |
| 告警 | 等待审批 / 任务失败时显示辅助提醒横幅，明确标注不拦截、不替代原生审批弹窗 |
| 会话隔离 | 视图按 `sessionId` 绑定；切换会话即切换监控上下文，互不影响 |

## M2：内嵌贪吃蛇

- Canvas 实现，无外部图片资源、无第三方游戏 SDK；棋盘宽度 100%、高度 `min(40vh, 360px)`，格数按实测像素推导（约 18px/格，列 16–120、行 ≥8），格子保持近似正方形。
- 操作：**仅键盘方向键**（焦点在视图内才生效，不会抢输入框的键）；不提供软方向键，保留「暂停 / 重置」按钮（决策 D7）。
- 第二款游戏：**五子棋**（15×15，人执黑 vs 简单启发式电脑），与贪吃蛇通过说明行左侧页签切换，两局各自保留（决策 D16）。
- 设置：贪吃蛇可选起始速度（慢 / 标准 / 快），五子棋可选难度（初级 / 中级 / 高级）；选择存于本地 `dsh-wait-buddy.settings.v1`，刷新后保留（决策 D17）。
- 状态：得分、最高分、长度、暂停、结束、重置；每吃一个果实 +10 分并轻微加速（140ms → 最低 70ms）。
- 解耦：M2 阶段游戏不读取任何监控状态，监控也不读取游戏状态；**等待审批不会暂停游戏**（那是 M3）。
- 生命周期：视图切到 Chat 或切换会话时游戏自动暂停、进度保留（模块级单局）；页面隐藏（`visibilitychange`）同样暂停。最高分与当前局仅存内存，不做持久化（持久化属于 M4/备选池）。

### 一屏布局

- 上下分区、整宽铺满（决策 D10）：状态区在上（状态行 + 更新时间 + 免责说明 + 活动流），游戏区在下（棋盘 + 说明 + 操作），两段都占满视图宽度；不设 max-width，也不做左右分栏。
- 棋盘吃满横向空间（`width:100%`），高度固定 `min(40vh,360px)`；对局中窗口缩放只拉伸绘制、不改格数，避免蛇出界（决策 D12）。
- 游戏浮层的「开始 / 继续 / 再来一局」使用游戏配色（薄荷绿 + 深色文字），不依赖 `brand-primary`（该 token 在深色主题下是浅色，白字会不可见）。
- 下方输入框属于 Conversation shell，**插件不替换、不隐藏它**：替换 `conversation.composer.bar` 会 shadow 原生 composer，影响输入、队列与审批接管。若需要完全无 chrome 的界面，应走备选池里的“悬浮独立浮窗”。

## 事件映射

| 基线事件 | 数据来源 | 面板表现 |
|---|---|---|
| `session.task.start` | `turn/start` | 绿色 · 「任务开始，Agent 正在规划」，步数归零 |
| `session.step.update` | `step/end` | 仅内部计数（M3 计分用），界面不再显示步数 |
| 活动流（新增） | `assistant/message` 的 reasoning、`tool/call` | 思考 / 命令 / 工具调用，最多 3 条，最新在上 |
| `session.tool.pending_approval` | `ctx.uiSession.sessionStatus.pendingInteraction`（进程内，不入日志） | 橙红色 · 告警横幅「等待你审批工具调用」 |
| `session.task.success` | `turn/end`，reason=`completed` | 绿色 · 「任务执行成功 ✅」 |
| `session.task.failed` | `turn/end`，reason=`error` / `max-tokens` / `blocked` | 红色 · 「任务执行失败」+ 错误摘要 |
| `session.task.abort` | `turn/end`，reason=`aborted` / `interrupted` | 灰色 · 「任务已中断」 |
| `session.active.change` | 视图按 `sessionId` 重建 | 自动切换监控上下文，无跨会话串扰 |

> **为什么不显示步数**：DSH 的 Agent 循环是开放式循环——每一步由模型决定是否继续，会话日志里没有预先声明的总步数，Host 本身也没有这个分母。既然拿不到可靠分母，界面就不硬凑数字（决策 D1、D9）：改为展示真实发生的「思考 / 命令 / 工具调用」活动流，直接回答「它现在在干什么」。

## 发布给别人用

完整 runbook 见 [docs/release.md](docs/release.md)，最短路径：

1. 决定包名。包名同时是 Client 模块 id，**必须三处一致**：`package.json` 的 `name`、`cordis.patch.yml` 的 `name`、`client.js` 里的 `__ModuleLoader__.load({ id })`。
2. 去掉 `package.json` 的 `"private": true`，补 `repository` / `homepage`（`license`、`author`、`files` 已就绪）。
3. `npm pack --dry-run` 核对产物 → `npm publish --access public`。
4. 在另一台机器验证：侧边栏 → **Plugins** → **Add plugin** → 填包名 → 安装 → 启用 → 刷新页面。

也支持其他三种不需要 npm 账号的分发方式（同一套安装流程）：

- **tarball**：`npm pack --pack-destination dist` 生成 `dist/dsh-wait-buddy-0.3.0.tgz`，对方在 Add plugin 里填该文件的绝对路径；
- **源码目录**：直接填解压后目录的绝对路径；
- **Git 仓库**：填完整 Git URL（`github:用户/仓库` 仅对 GitHub 有效）。

tarball / 目录是静态副本（更新需重新打包），且 `.tgz` 内为明文源码。详见 [docs/release.md](docs/release.md)。

> ⚠️ 插件在 DSH 进程内以当前用户权限运行，没有沙箱；本插件只读会话事件、不写日志、不发网络请求，设置只存本机 localStorage。

## 安装（当前 profile）

```bash
# 1. 装 Host 依赖（zod，供会话投影的 schema 校验）
pnpm install

# 2. 以本地目录安装 bundle（会写入 profile 的 package.json / bundles 列表）
#    plugin_manager install_bundle → target: /abs/path/to/dsh-wait-buddy
```

安装完成后刷新页面，在会话视图标签栏选择 **WaitBuddy**。

## 结构

```
index.js          Host 半：注册 waitbuddy 会话投影（纯 fold，只读日志，不写日志）
client.js         Client 半：conversation.view 入口 + 监控数据源 + 看板 UI + 贪吃蛇（游戏 store / 渲染 / 软按钮）
cordis.patch.yml  Bundler 行：id = wait-buddy
locale/*.json     插件管理页展示用标题 / 描述
icon.svg          插件图标
```

数据流：Host 投影（日志派生，可 checkpoint）→ Client `createMonitorSource()` 合并
进程内的 `running` / `pendingInteraction` → `TrackState` → 看板。

## 变更流程

1. 先改文档：界面/文案 → [docs/ui-spec.md](docs/ui-spec.md)；边界/取舍 → [docs/decisions.md](docs/decisions.md)；能力范围 → 本 README。
2. 再改代码，使实现与文档一致。
3. M0 基线保持冻结：涉及基线语义的改动必须在 decisions 中显式标注。

## 铁律

1. 原生审批弹窗优先级最高：本插件只读 `pendingInteraction`，从不注册审批应答，不改变审批链路。
2. 不提供取消 / 重试 / 自动审批等反向控制。
3. 不订阅基线之外的事件；新增信号类型走需求评审（M0 §11）。
