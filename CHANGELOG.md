# Changelog

## 0.4.1 — 2026-11-05

### Fixed

- 320px 下游戏控制行被宿主 composer 覆盖：窄窗棋盘固定 190px、底部留白 100px，确保开始/继续/重置可见。
- 视觉回归新增 document / `.wb-root` / `.wb-inner` 三层横向溢出断言，并用长错误/长命令验证换行。
- README 改为英文默认 + `README_CN.md` 中文版；GitHub About 与 `package.json` 描述改为英文。

## 0.4.0 — 2026-11-05

### Added

- M3 单向联动：`agent:task_start` / `step_advance` / `approval_enter` / `approval_leave` / `task_finish` 信号层。
- 审批自动暂停；审批消失后**不自动恢复**，由用户点击继续或按空格恢复。
- 贪吃蛇奖励：step +5 浮字、success +50 提示、failed/aborted 提示；不重置本局。
- M1 `health`（loading/ready/degraded/stale）与 `pendingKind` 展示字段，保持 M0 六值 `status`。
- 独立顶部告警区域、窄窗容器查询、五子棋 ResizeObserver 重绘。
- 自动化：59 个纯逻辑/组件用例 + 4 个无头浏览器布局场景（含宿主 tab bar / Todo dock / composer）+ CI。

### Changed

- 未知 `turn/end` 原因不再判成功：映射为 `aborted` + 原因文本；`stateVersion` 4。
- 活动流移除模型推理原文（D27），只保留 `tool/call` 的命令/工具条目。
- 方向队列（最长 2）修复快速反向自杀；计时器不再因按键重置。
- 模块级 canvas/root 改为组件 `useRef`；切会话暂停；切视图/会话/页面恢复时滚动到顶部。
- 底部为宿主 Todo dock 预留 56px 间距，顶部状态区贴近标签栏。

### Fixed

- 任务完成后切视图重复播放「任务完成 +50」toast。
- 同名工具连续审批被去重、审批 key 缺失。
- `running=false` + 投影 `running` 的永久假运行。
- 「再来一局」需点两次、暂停态改速度不生效、`setGrid` 丢速度。
- 320px 横向溢出、告警条随滚动消失。

### Known deviations

- D7：M0 §5 的软按钮未恢复（已批准偏离）。
- D16/D17：五子棋/设置属 M0 §10 M4 范围，提前实现（已批准偏离）。
- D28：question / plan-review 暂不纳入基线，留待下一迭代。
- D22：未知终态用 `aborted` 承载，未新增 `unknown` 枚举。

## 0.3.0 — 2026-11-04

- 首个公开版本：M1 状态看板 + M2 贪吃蛇/五子棋。
- 本版本包含评审指出的状态真实性、告警、多实例和测试缺口，已在 0.4.0 修复。
