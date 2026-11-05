# dsh-gold-price 收录申请文案

用于 [dshopen.org 插件收录申请](https://github.com/polang233/dsh-plugin-index/issues/new?template=plugin-add.yml)。表单字段如下，直接复制。

## 标题

```text
[plugin-add] dsh-gold-price
```

## 插件地址

```text
https://github.com/douzhihao/dsh-gold-price
```

## 简短说明

```text
在 DSH 侧栏常驻显示上海黄金交易所 Au99.99、黄金 T+D、上海金与上期所沪金主连的实时价格，并提供带日内分时图的「国内金价」面板；每 5 秒刷新报价，页面隐藏时暂停请求。
```

## 插件实际效果

上传仓库中的 `preview.png`，说明：

```text
「国内金价」面板：主报价、三张合约卡与 Au99.99 日内分时图；侧栏底部为常驻行情。
```

## 补充信息

```text
npm: dsh-gold-price@0.1.0
固定提交: 见 `git rev-parse v0.1.0^{commit}` 的输出
DSH 版本: 0.2.1-rc.5
系统: macOS (Apple Silicon)
安装: dsh plugin --profile desktop add dsh-gold-price
数据源: 东方财富公开行情接口（SGE AU9999/AUTD/SHAU，SHFE aum）
许可证: MIT
```

## 说明

- 如果 npm 尚未发布，也可以先用固定 GitHub 提交收录；请把完整 40 位 SHA 填入 Issue。
- dshopen.org 要求公开源码仓库、明确的 LICENSE、`dsh.bundle.patch` 和发布包内包含补丁文件；本仓库均已满足。
