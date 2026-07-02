# API Reference

Base URL when running locally:

```text
http://127.0.0.1:5173
```

## Health

`GET /api/health`

Returns:

```json
{"ok":true}
```

## List Subscriptions

`GET /api/subscriptions`

Returns all subscriptions sorted for management, plus summary metrics.

## Create Subscription

`POST /api/subscriptions`

JSON body:

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

## Update Subscription

`PUT /api/subscriptions/:id`

Uses the same JSON shape as create.

## Delete Subscription

`DELETE /api/subscriptions/:id`

## Export

`GET /api/export`

Downloads all subscriptions as JSON.

## Import

`POST /api/import`

Body must be an array of subscription objects. Existing local data is replaced.
