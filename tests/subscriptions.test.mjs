import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateNextRenewalDate,
  normalizeSubscription,
  sortForManagement,
  summarizeSubscriptions,
  upcomingRenewals
} from "../src/domain/subscriptions.mjs";

describe("subscription domain", () => {
  it("calculates the next monthly renewal after the reference date", () => {
    assert.equal(
      calculateNextRenewalDate("2026-01-31", "monthly", "2026-03-01"),
      "2026-03-28"
    );
  });

  it("keeps disabled subscriptions visible in management sorting", () => {
    const items = [
      normalizeSubscription({
        id: "later",
        name: "Enabled",
        category: "云服务",
        amount: 10,
        currency: "USD",
        billingCycle: "monthly",
        startDate: "2026-07-02",
        nextRenewalDate: "2026-07-09",
        isRenewalDateManuallyAdjusted: true,
        isEnabled: true
      }),
      normalizeSubscription({
        id: "sooner",
        name: "Disabled",
        category: "云服务",
        amount: 10,
        currency: "USD",
        billingCycle: "monthly",
        startDate: "2026-07-02",
        nextRenewalDate: "2026-07-04",
        isRenewalDateManuallyAdjusted: true,
        isEnabled: false
      })
    ];

    assert.deepEqual(sortForManagement(items).map((item) => item.name), ["Disabled", "Enabled"]);
    assert.deepEqual(upcomingRenewals(items, 5).map((item) => item.name), ["Enabled"]);
  });

  it("summarizes enabled subscription counts and monthly equivalents", () => {
    const items = [
      normalizeSubscription({
        id: "yearly",
        name: "Annual",
        category: "效率工具",
        amount: 120,
        currency: "USD",
        billingCycle: "yearly",
        startDate: "2026-07-02"
      }),
      normalizeSubscription({
        id: "disabled",
        name: "Paused",
        category: "学习",
        amount: 50,
        currency: "USD",
        billingCycle: "monthly",
        startDate: "2026-07-02",
        isEnabled: false
      })
    ];

    assert.deepEqual(summarizeSubscriptions(items).monthlyByCurrency, { USD: 10 });
    assert.equal(summarizeSubscriptions(items).enabled, 1);
  });
});
