# 社区发布清单

本文档把「发到社区」拆成可执行步骤。仓库地址、作者名和 npm 账号已按确认的 GitHub 账号 `douzhihao` 填写。

## 0. 发布前检查

- [x] `package.json` 声明了 `dsh.bundle.patch`
- [x] 发布包包含 `cordis.patch.yml`、`lib/index.js`、`lib/client.js`
- [x] 许可证：MIT（`LICENSE` 文件 + `package.json` 的 `license` 字段）
- [x] 真实可运行的代码，无构建步骤
- [x] 实际使用截图：`preview.png`，并通过 `screenshots.json` 声明
- [x] `package.json` 填写 `repository`、`homepage`、`bugs`
- [ ] GitHub 仓库添加 `dsh-plugin` topic
- [ ] 仓库创建满 1 天（`awesome-dsh-plugin` 的自动检查；`dshopen.org` 无此要求）
- [ ] 如果发布 npm：包名可用（`dsh-gold-price` 目前未被占用）且已 `npm login`

## 1. 建仓库并打标签

```bash
cd dsh-gold-price
git init -b main
git add .
git commit -m "feat: real-time domestic gold price panel"
git remote add origin https://github.com/douzhihao/dsh-gold-price.git
git push -u origin main
```

然后：

1. 在 GitHub 仓库 **Settings → Topics** 添加 `dsh-plugin`。
2. 在 `package.json` 增加：

```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/douzhihao/dsh-gold-price.git"
},
"homepage": "https://github.com/douzhihao/dsh-gold-price#readme",
"bugs": {
  "url": "https://github.com/douzhihao/dsh-gold-price/issues"
}
```

3. 打 tag 并创建 GitHub Release：

```bash
git tag v0.1.0
git push origin v0.1.0
```

## 2. 发布 npm（推荐）

npm 版本能让插件市场显示下载量，也能让 `dsh plugin add dsh-gold-price` 直接安装。

手动发布：

```bash
npm login
cd dsh-gold-price
npm publish --access public
```

发布前可先 dry-run：

```bash
npm pack --dry-run
```

预期发布内容：`package.json`、`cordis.patch.yml`、`lib/index.js`、`lib/client.js`、`README.md`、`README.en.md`、`CHANGELOG.md`、`LICENSE`、`icon.png`、`preview.png`、`screenshots.json`。

也可以用仓库里的 `.github/workflows/publish.yml`：在 GitHub 仓库 **Settings → Secrets and variables → Actions** 添加 `NPM_TOKEN`（npm 的 Automation token），然后发布一个 Release；工作流会先校验再 `npm publish --access public`。

## 3. 提交到开放插件市场（dshopen.org）

打开 [插件收录申请](https://github.com/polang233/dsh-plugin-index/issues/new?template=plugin-add.yml)，标题保持 `[plugin-add] ` 前缀，正文可填：

### 插件地址

```text
https://github.com/douzhihao/dsh-gold-price
```

### 简短说明

```text
在 DSH 侧栏常驻显示上海黄金交易所 Au99.99、黄金 T+D、上海金与上期所沪金主连的实时价格，并提供带日内分时图的「国内金价」面板；每 5 秒刷新报价，页面隐藏时暂停请求。
```

### 插件实际效果

拖入 `preview.png`，说明写：

```text
「国内金价」面板：主报价、三张合约卡与 Au99.99 日内分时图；侧栏底部为常驻行情。
```

### 补充信息

```text
npm: dsh-gold-price@0.1.0
DSH 版本: 0.2.1-rc.5
系统: macOS (Apple Silicon)
安装: dsh plugin --profile desktop add dsh-gold-price
数据源: 东方财富公开行情接口（SGE AU9999/AUTD/SHAU，SHFE aum）
```

## 4. 提交到 awesome-dsh-plugin

该列表要求**仓库创建满 1 天**，所以新仓库请第二天再提 PR。

在 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 新建一个文件：

`data/plugins/douzhihao__dsh-gold-price.yml`

```yaml
url: https://github.com/douzhihao/dsh-gold-price
name: douzhihao/dsh-gold-price
category: ui
description:
  en: Real-time domestic gold price ticker and panel for the DSH sidebar, covering SGE Au99.99, Gold T+D, Shanghai Gold and SHFE gold front-month, with an intraday chart.
  zh: 在 DSH 侧栏常驻显示国内金价，并提供覆盖上金所 Au99.99、黄金 T+D、上海金与上期所沪金主连的实时面板和日内分时图。
icon: https://raw.githubusercontent.com/douzhihao/dsh-gold-price/main/preview.png
```

注意：

- 只改自己新增的 YAML 文件，不要手工编辑生成的 README。
- `description.en` 中不要出现未加引号的 `: `（冒号+空格）。
- PR 标题可用：`Add dsh-gold-price (UI)`。
- 如果之后发布 npm，`package.json` 的 `repository` 必须指回同一个 GitHub 仓库。

## 5. 可选：dshbase.com

[dshbase.com](https://dshbase.com/) 也收录 DSH 插件；如果它的提交入口要求 GitHub 登录或表单，使用同一份简介与截图即可。

## 6. 发布后

- 在 README 顶部加入开放市场徽章（把 `dsh-gold-price` 换成实际包名）：

```md
[![开放插件市场](https://img.shields.io/endpoint?url=https%3A%2F%2Fdshopen.org%2Fbadge%2Fdsh-gold-price.json)](https://dshopen.org/zh/plugins/dsh-gold-price/)
```

- 关注 Issue/PR 的复查意见；`dshopen.org` 超过 7 天不回复会先关闭 Issue，之后仍可重新提交。
- 新版本发布后，`dshopen.org` 默认跟随 npm `latest`；`awesome-dsh-plugin` 的条目跟随仓库数据。

## 当前阻塞

本机没有检测到 GitHub CLI 登录、npm 登录或 Git 提交身份。要直接完成第 1–4 步，需要：

1. 提供 GitHub 仓库地址（`douzhihao/dsh-gold-price`），或先在本机完成 `gh auth login` / 配置 Git 用户；
2. 如要发布 npm，在本机执行 `npm login`（需要 npm 账号与 2FA）；
3. 确认是以个人账号还是组织账号发布。
