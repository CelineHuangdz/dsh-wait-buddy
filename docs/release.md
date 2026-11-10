# 发布与分发

> 目标：让别人能在自己的 DSH 里装上 WaitBuddy，并且能升级、卸载、排障。
> 本文是发布 runbook；界面/行为规格见 [ui-spec.md](ui-spec.md)，决策见 [decisions.md](decisions.md)，变更见 [CHANGELOG](../CHANGELOG.md)。

> **分发渠道（2026-11-10 产品决策）：仅 GitHub。** 不发布 npm——下文 npm 相关章节保留作参考，不再执行；发布 = git push + tag。安装方式见 README「Install」。

## 0. 本次发布决定（2026-11-05，v0.4.1）

- 包名：**`dsh-wait-buddy`**（不带 scope）。包名仍是 Client 模块 id，必须与 `cordis.patch.yml` / `client.js` 三处一致。
- ~~发布形态：公共 npm 包~~（2026-11-10 起裁撤，仅 GitHub）。
- 三处标识一致：`package.json` / `cordis.patch.yml` / `client.js` 均为 `dsh-wait-buddy`。

## 1. 先选分发形态

DSH 的「插件」页（侧边栏 → Plugins → **Add plugin**）接受与 `pnpm add` 相同的 spec，所以有三种分发方式：

| 形态 | 用户填什么 | 适合 |
|---|---|---|
| npm 包（推荐） | `dsh-wait-buddy` 或 `@scope/dsh-wait-buddy` | 公开分享、可搜索、可锁定版本 |
| Git 仓库 | `github:用户名/仓库` 或 Git URL | 不想发 npm、想直接用最新代码 |
| 本地目录 / tarball | 绝对路径，或 `npm pack` 出来的 `.tgz` | 团队内分发、内网 |

三种都走同一套安装流程：Host 先 inspect spec → pnpm 安装 → 校验 bundle patch → 选中并启用。

## 2. 发布前检查清单

1. **包名一致性（最容易错）**——包名同时是 Client 模块 id，必须三处完全一致：
   - `package.json` → `name`
   - `cordis.patch.yml` → `- id: wait-buddy` 下的 `name:`
   - `client.js` → `window.__ModuleLoader__.load({ id: ... })`
   改名就三处一起改，否则视图注册不上。
2. **去掉 `private: true`**（`package.json`），否则 `npm publish` 会被拒绝。
3. **补齐元数据**：`license`、`repository`、`author`、`keywords`、`homepage`（可选），以及 `LICENSE` 文件。
4. **`files` 必须覆盖运行时所需**：`index.js`、`client.js`、`cordis.patch.yml`、`locale/*.json`、`icon.svg`、`README.md`、`LICENSE`。
   用 `npm pack --dry-run` 核对，不要依赖“本地能跑”。
5. **依赖声明**：Host 半用到 `zod`，必须留在 `dependencies`（不能是 devDependencies），发布后由用户的 pnpm 安装。
6. **版本号**：目标发布版本 `0.4.1`（0.4.0 的 320px 修复 patch，待提交/打 tag）。之后遵循 semver。
7. **兼容性**：当前针对 DSH `0.2.1-rc.5` 开发；先在 README 写清"测试过的 DSH 版本"。
   是否加 `engines.dsh` 要谨慎——管理器会用它做安装前校验，范围写错会直接挡住安装。

## 3. 发布

> ⚠️ 本机 `npm` / `pnpm` 的默认 registry 是 `registry.npmmirror.com`（只读镜像，**不能发布**）。
> 因此 `package.json` 里已固定 `publishConfig.registry = https://registry.npmjs.org/`，发布只会走官方源；安装仍可走镜像。

```bash
# 1) 登录官方源（本机默认是镜像，必须显式指定）
npm login --registry https://registry.npmjs.org/
npm whoami --registry https://registry.npmjs.org/

# 2) 核对产物（可选）
npm pack --dry-run

# 3) 发布（publishConfig 已指向官方源）
npm publish
# 若未生效：npm publish --registry https://registry.npmjs.org/ --access public
```

### 3.1 两个本机环境坑

1. **默认 registry 是镜像**：`npm config get registry` 为 `registry.npmmirror.com`，镜像只读。已在 `package.json` 固定 `publishConfig.registry = https://registry.npmjs.org/`；登录也必须显式指向官方源。
2. **`~/.npm` 缓存里有 root 文件**：直接跑 `npm` 会报 "cache folder contains root-owned files"。两种解法：
   - 修权限：`sudo chown -R 501:20 ~/.npm`（一次性）
   - 或换缓存目录：`npm publish --cache /tmp/dsh-npm-cache`

发布后镜像同步通常需要几分钟：用户如果装不上，让他在安装对话框把 Registry 选成官方 npm 源，或等镜像同步。



发布后先在**另一台机器或另一个 profile** 上验证，不要只在本机 link 环境里测：

1. 侧边栏 → Plugins → **Add plugin** → 填包名 → 安装。
2. 启用后刷新页面，确认会话视图出现 **WaitBuddy** 标签。
3. 跑一轮 Agent 任务，确认状态/活动流/告警正常；两个游戏能开、能暂停、设置能保存。
4. 卸载：Plugins 里 Remove，确认依赖被移除、标签消失。

> 本机的 link 安装与 registry 安装是两个来源。要在本机验证 registry 版本，先 Remove 现有 bundle，再按包名安装（管理器会拒绝"已安装同名包"的二次安装）。

## 3.4 Git 仓库（本机已初始化）

仓库已 `git init -b main` 并完成首个提交（14 个受版本控制的文件，`node_modules/`、`dist/`、`*.tgz` 已忽略）。

**当前仓库**：<https://github.com/CelineHuangdz/dsh-wait-buddy>（public，已推 `main`；待发布 `v0.4.1`）。

**推送到远端**（首次流程，已执行过一遍）：

```bash
# GitHub
git remote add origin https://github.com/<你的用户名>/dsh-wait-buddy.git
git push -u origin main
git tag v0.4.1 && git push --tags

# 或 Gitee（国内网络更稳）
git remote add origin https://gitee.com/<你的用户名>/dsh-wait-buddy.git
git push -u origin main
git tag v0.4.1 && git push --tags
```

**对方安装**（Plugins → Add plugin 里填）：

| 平台 | 填什么 |
|---|---|
| GitHub | `github:<用户名>/dsh-wait-buddy` 或 `https://github.com/<用户名>/dsh-wait-buddy.git` |
| Gitee / GitLab / 自建 | 完整 URL：`https://gitee.com/<用户名>/dsh-wait-buddy.git` |

**验证过的事实**（2026-11-04）：

- `pnpm add git+ssh://git@github.com/CelineHuangdz/dsh-wait-buddy.git` 成功，装出来的包含 `index.js` / `client.js` / `cordis.patch.yml` / `locale` / `icon.svg`，`dsh.bundle` 与 `dsh.client` 声明完好（耗时约 2 分钟）。
- 本机网络：`github.com:443`（HTTPS）不可达（8s 超时），但 `api.github.com`、`codeload.github.com` 与 **SSH 22 端口可用**。

**注意**：

- 对方机器上要装有 `git`（安装过程是 git clone + pack）。
- `github:` 简写与 `https://github.com/...` 都走 **HTTPS 443**；如果对方网络和本机一样屏蔽了 github.com 的 443，安装会在预检阶段超时（`failedAt: 'spec-host'`）。这类环境要么改用 SSH spec（需要对方的 GitHub 账号与密钥），要么改用 Gitee 镜像。
- 仓库要**公开**。私有仓库需要 git 凭据，而管理器对 GitHub 的预检会禁用凭据提示，很容易装不上。
- 更新：`git push` 新提交后，对方重新安装一次（git 安装锁定的是提交，不是版本号语义）。
- 打 tag 只是给人看的版本标记；DSH 安装以提交为准。

## 3.5 没有 npm 账号 / 网络受限时的分发

npm 不是唯一通道。以下三种都不需要注册任何账号：

| 方式 | 你做什么 | 对方填什么 |
|---|---|---|
| **tarball（最简单）** | `npm pack --pack-destination dist` 生成 `dist/dsh-wait-buddy-0.4.1.tgz`，把文件发给对方 | Plugins → Add plugin → 填该 `.tgz` 的**绝对路径**（或上传到任意可访问 URL 后填 URL） |
| **源码目录** | 把整个目录打包成 zip 发给对方，对方解压 | 填解压后的**目录绝对路径** |
| **Git 仓库** | 推送到 GitHub / Gitee / GitLab | 填完整 Git URL（`github:用户/仓库` 只对 GitHub 有效；其他站用 `https://...git`） |

注意：

- tarball / 目录方式是**静态副本**，之后每次更新都要重新打包、重新安装；npm 与 Git 才能"更新版本"。
- tarball 的 `.tgz` 里就是明文源码（`client.js` 无编译），发给别人等于公开源码。
- `dist/` 不在 `files` 里，不会被打进下一个包。

生成 tarball：

```bash
npm pack --pack-destination dist
tar -tzf dist/dsh-wait-buddy-0.4.1.tgz   # 核对内容
```

## 4. 用户怎么装

**普通用户（图形界面）**：侧边栏 → **Plugins** → **Add plugin** → 粘贴包名 → Install → 启用 → 刷新页面。

**Agent / 自动化**：`plugin_manager` 的 `install_bundle`，`target` 填包名（如 `dsh-wait-buddy`）或 Git 地址。

**从源码**（团队内）：

```bash
git clone <repo> dsh-wait-buddy
cd dsh-wait-buddy && pnpm install
# Plugins → Add plugin → 填该目录的绝对路径
```

## 5. 升级、回滚与数据

- **升级**：registry 安装以 `saveExact` 记录精确版本；升级 = 卸载后安装新版本（管理器对"已安装同名包"不会原地覆盖）。
- **回滚**：安装上一个版本号即可。
- **数据**：游戏设置存在浏览器 `localStorage`（`dsh-wait-buddy.settings.v1`）；卸载插件不会自动清除，但重建后会用默认值。
- **版本兼容注意**：Host 投影的 `stateVersion` 变更（`index.js`）会让旧的投影缓存失效并重算，这是预期行为；改动事件映射或状态字段时必须同步 bump。

## 6. 发布前自检命令

```bash
node --check index.js && node --check client.js
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"
xmllint --noout icon.svg
npm pack --dry-run
```

## 7. 安全与隐私声明（建议写进 README）

- 插件代码在 DSH 进程内以当前用户权限运行，**没有沙箱**；发布前应让使用者知道这一点。
- WaitBuddy 只读取当前会话的事件（投影 fold），不写会话日志、不注册审批应答、不发送网络请求。
- 活动流中的"思考"是模型 reasoning 的截断文本，只在本地面板显示。
- 设置只存本机 localStorage，不上传。
