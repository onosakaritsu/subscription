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

返回按管理规则排序后的订阅列表、摘要统计和续费日历分组。每条订阅会包含以下派生续费状态字段：

- `renewalStatus.key`
- `renewalStatus.label`
- `renewalStatus.daysUntilRenewal`
- `renewalStatusText`

响应中的 `calendar.currentMonth` 和 `calendar.nextMonth` 分别表示本月和下月即将续费的启用订阅。

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

支持的计费周期：

- `weekly`
- `monthly`
- `quarterly`
- `semiannual`
- `yearly`
- `oneTime`

## 更新订阅

`PUT /api/subscriptions/:id`

请求体与新增订阅一致。

## 删除订阅

`DELETE /api/subscriptions/:id`

## 导出

`GET /api/export`

以 JSON 文件下载全部订阅。默认下载文件名为：

```text
subscriptions-backup-YYYY-MM-DD.json
```

## 导入

`POST /api/import`

请求体必须是订阅对象数组。导入前会先校验 JSON 格式和订阅数据结构；导入成功前会自动创建一份导入前备份。导入失败不会覆盖当前数据。

## 获取备份列表

`GET /api/backups`

返回 `data/backups/` 中受管理的 JSON 备份文件。接口只暴露安全文件名，不暴露本地绝对路径。损坏备份会保留在列表中，并标记为不可恢复。

返回字段包括：

- `fileName`：备份文件名。
- `createdAt`：从文件名解析出的创建时间。
- `size`：文件大小，单位为字节。
- `subscriptionCount`：备份内订阅数量；损坏备份为 0。
- `isValid`：是否可恢复。
- `error`：不可恢复原因。

## 预览备份

`GET /api/backups/:fileName`

返回指定备份的摘要和订阅列表预览。`fileName` 必须是合法备份文件名，禁止 `../` 等路径穿越。损坏备份会返回明确错误，不会修改主数据文件。

## 恢复备份

`POST /api/backups/:fileName/restore`

从指定备份恢复当前 `data/subscriptions.json`。恢复前会自动创建：

```text
subscriptions-before-restore-YYYY-MM-DD-HH-mm-ss.json
```

恢复流程会先校验目标备份 JSON 和订阅数据结构。目标备份损坏或路径不合法时不会覆盖当前数据。
