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

返回按管理规则排序后的订阅列表，并附带摘要统计。每条订阅会包含以下派生续费状态字段：

- `renewalStatus.key`
- `renewalStatus.label`
- `renewalStatus.daysUntilRenewal`
- `renewalStatusText`

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

请求体必须是订阅对象数组。导入会替换现有本地数据；导入成功后会触发一次自动备份。
