# 订阅管理 Web App

本项目是一个本地优先的个人订阅管理 Web App，用于记录、统计和提醒软件、会员、云服务、AI 工具等周期性订阅。

当前项目已从早期 macOS SwiftUI / WidgetKit 方向迁移为纯网页应用。它不需要 Apple Development Team，不使用 App Group / WidgetKit，也不依赖原生 macOS 小组件。

英文文档：[README.en.md](README.en.md)

## 功能特性

- 新增、编辑、删除订阅。
- 记录订阅名称、分类、金额、币种、计费周期、开始日期、下次续费日、启用状态和备注。
- 根据开始日期和计费周期自动计算下次续费日。
- 支持手动指定下次续费日。
- 自动计算续费状态：已过期、今日续费、3 日内、7 日内、本月内、正常、已停用。
- 列表默认按启用优先、续费日期从近到远排序；停用订阅固定在底部。
- 搜索、分类筛选、启用/停用筛选。
- 首页统计卡片：本月需续费数量、7 日内续费数量、启用数、停用数、月度折算金额、年度折算金额。
- 多币种分别统计，不做自动汇率换算。
- 最近续费摘要优先显示已过期、今日续费、3 日内和 7 日内的启用订阅。
- JSON 导入/导出。
- 每次成功保存后自动生成本地备份，最多保留最近 20 份。
- 支持在页面中查看、预览和恢复本地备份。
- 恢复备份前会自动创建恢复前备份，导入 JSON 前也会保护当前数据。
- 轻量续费日历视图，展示本月和下月即将续费的启用订阅。
- 页面适合像桌面侧边小工具一样长期打开，支持 420px～600px 窄窗口。

## 当前技术栈

- Node.js 原生 HTTP 后端
- 静态 HTML/CSS/JS 前端
- 本地 JSON 存储
- 不依赖数据库
- 不依赖第三方框架
- 不需要 Apple Development Team
- 不使用 WidgetKit

## 文档语言

GitHub 默认显示中文版 `README.md`。除许可证原文、代码标识、API 路径、命令、配置字段和独立英文翻译外，项目文档中文优先。

- 中文贡献指南：[CONTRIBUTING.md](CONTRIBUTING.md)
- 中文安全说明：[SECURITY.md](SECURITY.md)
- 中文架构说明：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 英文 README：[README.en.md](README.en.md)

## 环境要求

- Node.js 20 或更新版本

## 本地启动

方式一：使用 npm

```bash
npm start
```

方式二：使用一键启动脚本

```bash
./start-subscription-manager.sh
```

访问地址：

```text
http://127.0.0.1:5173
```

可选环境变量：

```bash
HOST=127.0.0.1
PORT=5173
SUBSCRIPTIONS_DATA_FILE=./data/subscriptions.json
```

示例：

```bash
PORT=8080 npm start
```

## 数据文件位置

主数据文件：

```text
data/subscriptions.json
```

该文件会保存你的真实订阅数据，并已被 Git 忽略，不会提交到开源仓库。

## 自动备份

备份目录：

```text
data/backups/
```

规则：

- 每次成功保存订阅数据后自动生成一份备份。
- 备份文件名格式：`subscriptions-backup-YYYY-MM-DD-HH-mm-ss.json`。
- 最多保留最近 20 份备份。
- 超过 20 份时自动删除最旧备份。
- 如果备份失败，不影响主数据保存；服务端会输出错误日志。
- 页面“备份与恢复”区域可以列出、预览和恢复备份。
- 恢复前会自动创建 `subscriptions-before-restore-YYYY-MM-DD-HH-mm-ss.json`。
- 导入 JSON 前会自动创建 `subscriptions-before-import-YYYY-MM-DD-HH-mm-ss.json`。
- 损坏备份会显示为不可恢复，不会阻断备份列表读取。
- 真实备份 JSON 文件已被 Git 忽略。

## JSON 导入导出

- 点击页面右上角“导出”会下载当前订阅 JSON。
- 默认导出文件名：`subscriptions-backup-YYYY-MM-DD.json`。
- 点击“导入”可以选择之前导出的 JSON 文件。
- 导入接口要求 JSON 内容为订阅数组；导入会替换当前本地数据。
- 导入前会先校验 JSON 格式和订阅数据结构；失败时不会覆盖当前数据。
- 导入成功后会刷新订阅列表、统计卡片、续费日历和备份列表。

## 续费日历视图

页面会按“本月续费”和“下月续费”展示启用订阅，每条显示日期、订阅名称、状态、金额和币种。已过期项目继续保留在最近续费摘要中，不强行放入日历。

## 金额折算规则

不做自动汇率换算，多币种分别统计。

- 月付：月度金额 = 原金额；年度金额 = 原金额 × 12
- 季付：月度金额 = 原金额 ÷ 3；年度金额 = 原金额 × 4
- 半年付：月度金额 = 原金额 ÷ 6；年度金额 = 原金额 × 2
- 年付：月度金额 = 原金额 ÷ 12；年度金额 = 原金额
- 一次性：不计入周期性月度/年度折算，单独作为一次性支出统计
- 每周：保留兼容旧数据，按 52 周折算年度金额

## 测试

```bash
npm test
```

## API

详见 [docs/API.md](docs/API.md)。

主要接口：

- `GET /api/health`
- `GET /api/subscriptions`
- `POST /api/subscriptions`
- `PUT /api/subscriptions/:id`
- `DELETE /api/subscriptions/:id`
- `GET /api/export`
- `POST /api/import`
- `GET /api/backups`
- `GET /api/backups/:fileName`
- `POST /api/backups/:fileName/restore`

## 目录结构

- `src/server.mjs`：HTTP 服务、API 路由、静态资源服务、本地 JSON 持久化
- `src/domain/subscriptions.mjs`：订阅领域逻辑、状态计算、排序、统计
- `src/storage/backups.mjs`：本地自动备份与保留策略
- `public/`：浏览器界面
- `data/subscriptions.json`：本地订阅数据文件
- `data/backups/`：自动备份目录
- `tests/`：Node.js 内置测试

## 当前不做的内容

- 登录系统
- 多用户权限
- 数据库
- 云同步
- 原生 macOS Widget
- Electron 打包
- 自动汇率换算

## 开源与贡献

- 许可证：[MIT](LICENSE)
- 贡献指南：[CONTRIBUTING.md](CONTRIBUTING.md)
- 安全说明：[SECURITY.md](SECURITY.md)
- 架构说明：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
