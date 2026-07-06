# 发布检查清单

用于正式发布前确认仓库、功能、数据和文档状态。

## 基础验证

- [ ] `npm test` 全部通过。
- [ ] `node --check src/domain/subscriptions.mjs` 通过。
- [ ] `node --check src/server.mjs` 通过。
- [ ] `node --check public/app.js` 通过。
- [ ] `git diff --check` 通过。

## API 验证

- [ ] `GET /api/health` 正常，并返回版本号。
- [ ] `GET /api/subscriptions` 正常。
- [ ] `GET /api/backups` 正常。
- [ ] `GET /api/integrity` 正常。
- [ ] `GET /api/calendar.ics` 正常。
- [ ] 首页 `/` 正常。
- [ ] favicon 可访问。

## 浏览器验收

- [ ] 桌面宽屏首页无明显布局问题。
- [ ] 窄窗口首页无严重横向滚动。
- [ ] 新增/编辑弹窗可滚动、可保存、可取消。
- [ ] 导入预览和恢复预览清晰可读。
- [ ] 数据完整性检查区域清晰可读。
- [ ] 备份与恢复区域清晰可读。
- [ ] 深色模式状态色标可读。

## 仓库安全

- [ ] 未提交真实 `data/subscriptions.json`。
- [ ] 未提交真实 `data/backups/*.json`。
- [ ] 未提交真实个人订阅截图。
- [ ] 未提交 token、密钥、cookie、账号密码。
- [ ] 未提交 `node_modules/`。
- [ ] 未提交临时日志、缓存、Playwright 报告或测试结果。

## 开源文件

- [ ] `LICENSE` 为 Apache License 2.0 标准全文。
- [ ] `DISCLAIMER.md` 存在。
- [ ] `PRIVACY.md` 存在。
- [ ] README 完整，并链接 LICENSE、DISCLAIMER、PRIVACY。
- [ ] `CHANGELOG.md` 已更新。
- [ ] `package.json` version 正确。
- [ ] `package.json` license 为 `Apache-2.0`。

## 发布动作

- [ ] Release PR 已合并。
- [ ] `v1.0.0` tag 已创建并推送。
- [ ] GitHub Release 已创建。
