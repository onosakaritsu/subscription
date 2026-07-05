# API 参考

本地运行时的基础地址：

```text
http://127.0.0.1:5173
```

## 健康检查

`GET /api/health`

返回：

```json
{"ok":true}
```

## 获取订阅列表

`GET /api/subscriptions`

返回按管理规则排序后的订阅列表、摘要统计和续费日历分组。每条订阅包含 `renewalStatus`，其中包括 `key`、`label`、`tone`、`priority`、`description` 和 `daysUntilRenewal`。

`calendar.currentMonth` 和 `calendar.nextMonth` 分别表示本月和下月即将续费的启用订阅。金额相关字段仍使用 ISO 币种代码；前端会统一显示为“符号 / ISO 代码 / 中文名称”。

## 新增订阅

`POST /api/subscriptions`

请求体示例：

```json
{
  "name": "iCloud+",
  "category": "云服务",
  "amount": 6,
  "currency": "CNY",
  "billingCycle": "monthly",
  "startDate": "2026-07-02",
  "nextRenewalDate": "2026-08-02",
  "isRenewalDateManuallyAdjusted": false,
  "isEnabled": true,
  "notes": ""
}
```

支持的计费周期：`weekly`、`monthly`、`quarterly`、`semiannual`、`yearly`、`oneTime`。

## 更新订阅

`PUT /api/subscriptions/:id`

请求体与新增订阅一致。服务端会校验名称、金额、币种、计费周期、日期和启用状态。

## 快速启用 / 停用

`PATCH /api/subscriptions/:id`

请求体：

```json
{"isEnabled":false}
```

## 确认已续费

`POST /api/subscriptions/:id/renew`

将周期性订阅的下次续费日推进到今天之后的下一个有效续费日。一次性项目会被拒绝。

## 删除订阅

`DELETE /api/subscriptions/:id`

## 导出

`GET /api/export`

以 JSON 文件下载全部订阅。默认下载文件名为：

```text
subscriptions-export-YYYY-MM-DD.json
```

## 导入

`POST /api/import`

请求体必须是订阅对象数组。导入前会先校验 JSON 格式和订阅数据结构；导入成功前会自动创建一份导入前备份。导入失败不会覆盖当前数据。

## 获取备份列表

`GET /api/backups`

返回 `data/backups/` 中受管理的 JSON 备份文件。接口只暴露安全文件名，不暴露本地绝对路径。损坏备份会保留在列表中，并标记为不可恢复。

备份类型根据文件名识别：自动备份、手动备份、恢复前备份、导入前备份。

## 数据完整性检查

`GET /api/integrity`

只读检查当前 `data/subscriptions.json`，不会修改、修复或覆盖数据。返回 `ok`、`checkedAt`、`summary` 和 `issues`。检查项包括空名称、负金额、空币种、未知币种 warning、非法计费周期、非法日期、非布尔启用状态、缺失 id、重复 id 和启用订阅缺少下次续费日。

## 续费日历 ICS 导出

`GET /api/calendar.ics`

返回未来 12 个月内启用订阅的续费事件。停用订阅不会导出，一次性项目会在标题中标记“一次性”。响应头：

```text
Content-Type: text/calendar; charset=utf-8
Content-Disposition: attachment; filename="subscriptions-renewals.ics"
```

该接口只生成 `.ics` 文件，不做云同步或系统日历同步。

## 立即手动备份

`POST /api/backups`

立即为当前 `data/subscriptions.json` 创建手动备份。文件名格式：

```text
subscriptions-manual-backup-YYYY-MM-DD-HH-mm-ss.json
```

## 预览备份

`GET /api/backups/:fileName`

返回指定备份的摘要和订阅列表预览。`fileName` 必须是合法备份文件名，禁止 `../` 等路径穿越。损坏备份会返回明确错误，不会修改主数据文件。

## 下载备份

`GET /api/backups/:fileName/download`

下载指定备份 JSON。损坏备份也允许下载。响应头包含 `Content-Type: application/json` 和 `Content-Disposition`，不会暴露服务器绝对路径。

## 恢复备份

`POST /api/backups/:fileName/restore`

从指定备份恢复当前 `data/subscriptions.json`。恢复前会自动创建：

```text
subscriptions-before-restore-YYYY-MM-DD-HH-mm-ss.json
```

恢复流程会先校验目标备份 JSON 和订阅数据结构。目标备份损坏或路径不合法时不会覆盖当前数据。

## 从外部备份恢复

`POST /api/backups/restore-uploaded`

通过 JSON body 传入前端解析后的订阅数组，不使用 multipart 上传。服务端会再次校验结构，恢复前自动备份当前数据；失败时不会覆盖当前数据。

## 许可证

项目代码按 Apache License 2.0 发布。API 文档仅描述本地接口行为，详细许可和免责声明见根目录 `LICENSE` 与 `DISCLAIMER.md`。
