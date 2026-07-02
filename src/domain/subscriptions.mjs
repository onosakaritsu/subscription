export const categories = [
  "影音娱乐",
  "效率工具",
  "云服务",
  "学习",
  "健康",
  "财务",
  "其他"
];

export const currencies = ["CNY", "USD", "EUR", "HKD", "JPY", "GBP"];

export const billingCycles = ["weekly", "monthly", "quarterly", "semiannual", "yearly", "oneTime"];

export const billingCycleLabels = {
  weekly: "每周",
  monthly: "每月",
  quarterly: "每季度",
  semiannual: "每半年",
  yearly: "每年",
  oneTime: "一次性"
};

export const currencySymbols = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
  HKD: "HK$",
  JPY: "¥",
  GBP: "£"
};

export const renewalStatusLabels = {
  disabled: "已停用",
  overdue: "已过期",
  today: "今日续费",
  within3Days: "3日内",
  within7Days: "7日内",
  thisMonth: "本月内",
  normal: "正常"
};

export function todayISO(referenceDate = new Date()) {
  return dateToISO(referenceDate);
}

export function exportSubscriptionFileName(now = new Date()) {
  return `subscriptions-backup-${todayISO(now)}.json`;
}

export function dateToISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("日期必须是 YYYY-MM-DD 格式");
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error("日期不存在");
  }

  return date;
}

export function daysBetween(startISO, endISO) {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUTC - startUTC) / 86_400_000);
}

export function addCycle(dateISO, billingCycle) {
  const date = parseISODate(dateISO);

  switch (billingCycle) {
    case "weekly":
      date.setDate(date.getDate() + 7);
      return dateToISO(date);
    case "monthly":
      return addMonths(dateISO, 1);
    case "quarterly":
      return addMonths(dateISO, 3);
    case "semiannual":
      return addMonths(dateISO, 6);
    case "yearly":
      return addMonths(dateISO, 12);
    case "oneTime":
      return dateISO;
    default:
      throw new Error("不支持的计费周期");
  }
}

export function calculateNextRenewalDate(startDate, billingCycle, referenceDate = todayISO()) {
  if (billingCycle === "oneTime") {
    return startDate;
  }

  let candidate = addCycle(startDate, billingCycle);

  while (candidate < referenceDate) {
    candidate = addCycle(candidate, billingCycle);
  }

  return candidate;
}

export function normalizeSubscription(input, existing = null, now = new Date()) {
  const name = String(input.name ?? "").trim();
  if (!name) {
    throw new Error("订阅名称不能为空");
  }

  const category = categories.includes(input.category) ? input.category : "其他";
  const currency = currencies.includes(input.currency) ? input.currency : "CNY";
  const billingCycle = billingCycles.includes(input.billingCycle) ? input.billingCycle : "monthly";
  const startDate = input.startDate || todayISO(now);
  parseISODate(startDate);

  const amount = Number(input.amount ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("金额必须是大于或等于 0 的数字");
  }

  const isRenewalDateManuallyAdjusted = Boolean(input.isRenewalDateManuallyAdjusted);
  let nextRenewalDate = input.nextRenewalDate;
  if (isRenewalDateManuallyAdjusted && nextRenewalDate) {
    parseISODate(nextRenewalDate);
  } else {
    nextRenewalDate = calculateNextRenewalDate(startDate, billingCycle, todayISO(now));
  }

  return {
    id: existing?.id ?? input.id,
    name,
    category,
    amount: Number(amount.toFixed(2)),
    currency,
    billingCycle,
    startDate,
    nextRenewalDate,
    isEnabled: input.isEnabled !== false,
    notes: String(input.notes ?? "").trim(),
    isRenewalDateManuallyAdjusted,
    createdAt: existing?.createdAt ?? input.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString()
  };
}

export function renewalStatus(item, referenceDate = todayISO()) {
  if (!item.isEnabled) {
    return statusResult("disabled", 0);
  }

  const daysUntilRenewal = daysBetween(referenceDate, item.nextRenewalDate);
  if (daysUntilRenewal < 0) {
    return statusResult("overdue", daysUntilRenewal);
  }
  if (daysUntilRenewal === 0) {
    return statusResult("today", daysUntilRenewal);
  }
  if (daysUntilRenewal <= 3) {
    return statusResult("within3Days", daysUntilRenewal);
  }
  if (daysUntilRenewal <= 7) {
    return statusResult("within7Days", daysUntilRenewal);
  }

  const reference = parseISODate(referenceDate);
  const renewal = parseISODate(item.nextRenewalDate);
  if (
    renewal.getFullYear() === reference.getFullYear() &&
    renewal.getMonth() === reference.getMonth()
  ) {
    return statusResult("thisMonth", daysUntilRenewal);
  }

  return statusResult("normal", daysUntilRenewal);
}

export function statusText(status) {
  if (status.key === "overdue") {
    return `已过期 ${Math.abs(status.daysUntilRenewal)} 天`;
  }
  if (status.key === "today") {
    return "今日续费";
  }
  if (status.daysUntilRenewal > 0) {
    return `还有 ${status.daysUntilRenewal} 天续费`;
  }
  return renewalStatusLabels[status.key] || "正常";
}

export function enrichSubscription(item, referenceDate = todayISO()) {
  const status = renewalStatus(item, referenceDate);
  return {
    ...item,
    renewalStatus: status,
    renewalStatusText: statusText(status)
  };
}

export function sortForManagement(items, referenceDate = todayISO()) {
  return [...items].sort((a, b) => {
    if (a.isEnabled !== b.isEnabled) {
      return a.isEnabled ? -1 : 1;
    }

    if (a.nextRenewalDate === b.nextRenewalDate) {
      return a.name.localeCompare(b.name, "zh-Hans-CN");
    }

    return a.nextRenewalDate.localeCompare(b.nextRenewalDate);
  }).map((item) => enrichSubscription(item, referenceDate));
}

export function upcomingRenewals(items, limit = 8, referenceDate = todayISO()) {
  return sortForManagement(items, referenceDate)
    .filter((item) => item.isEnabled)
    .slice(0, limit);
}

export function urgentRenewals(items, limit = 5, referenceDate = todayISO()) {
  const urgentOrder = new Map([
    ["overdue", 0],
    ["today", 1],
    ["within3Days", 2],
    ["within7Days", 3]
  ]);

  return sortForManagement(items, referenceDate)
    .filter((item) => item.isEnabled && urgentOrder.has(item.renewalStatus.key))
    .sort((a, b) => {
      const statusDelta = urgentOrder.get(a.renewalStatus.key) - urgentOrder.get(b.renewalStatus.key);
      if (statusDelta !== 0) {
        return statusDelta;
      }
      return a.nextRenewalDate.localeCompare(b.nextRenewalDate) || a.name.localeCompare(b.name, "zh-Hans-CN");
    })
    .slice(0, limit);
}

export function monthlyEquivalent(item) {
  const amount = Number(item.amount || 0);
  switch (item.billingCycle) {
    case "weekly":
      return amount * 52 / 12;
    case "monthly":
      return amount;
    case "quarterly":
      return amount / 3;
    case "semiannual":
      return amount / 6;
    case "yearly":
      return amount / 12;
    case "oneTime":
      return 0;
    default:
      return amount;
  }
}

export function yearlyEquivalent(item) {
  const amount = Number(item.amount || 0);
  switch (item.billingCycle) {
    case "weekly":
      return amount * 52;
    case "monthly":
      return amount * 12;
    case "quarterly":
      return amount * 4;
    case "semiannual":
      return amount * 2;
    case "yearly":
      return amount;
    case "oneTime":
      return 0;
    default:
      return amount * 12;
  }
}

export function summarizeSubscriptions(items, referenceDate = todayISO()) {
  const enriched = sortForManagement(items, referenceDate);
  const enabled = enriched.filter((item) => item.isEnabled);
  const monthlyByCurrency = new Map();
  const yearlyByCurrency = new Map();
  const oneTimeByCurrency = new Map();

  for (const item of enabled) {
    if (item.billingCycle === "oneTime") {
      oneTimeByCurrency.set(item.currency, rounded((oneTimeByCurrency.get(item.currency) || 0) + Number(item.amount || 0)));
      continue;
    }

    monthlyByCurrency.set(item.currency, rounded((monthlyByCurrency.get(item.currency) || 0) + monthlyEquivalent(item)));
    yearlyByCurrency.set(item.currency, rounded((yearlyByCurrency.get(item.currency) || 0) + yearlyEquivalent(item)));
  }

  const thisMonthRenewals = enabled.filter((item) => {
    const status = item.renewalStatus.key;
    return ["overdue", "today", "within3Days", "within7Days", "thisMonth"].includes(status);
  });
  const within7DaysRenewals = enabled.filter((item) => {
    const days = item.renewalStatus.daysUntilRenewal;
    return days >= 0 && days <= 7;
  });

  return {
    total: items.length,
    enabled: enabled.length,
    disabled: items.length - enabled.length,
    thisMonthRenewalCount: thisMonthRenewals.length,
    within7DaysRenewalCount: within7DaysRenewals.length,
    upcoming: upcomingRenewals(items, 5, referenceDate),
    urgentUpcoming: urgentRenewals(items, 5, referenceDate),
    monthlyByCurrency: mapToSortedObject(monthlyByCurrency),
    yearlyByCurrency: mapToSortedObject(yearlyByCurrency),
    oneTimeByCurrency: mapToSortedObject(oneTimeByCurrency)
  };
}

function statusResult(key, daysUntilRenewal) {
  return {
    key,
    label: renewalStatusLabels[key],
    daysUntilRenewal,
    priority: statusPriority(key)
  };
}

function statusPriority(key) {
  switch (key) {
    case "overdue": return 0;
    case "today": return 1;
    case "within3Days": return 2;
    case "within7Days": return 3;
    case "thisMonth": return 4;
    case "normal": return 5;
    case "disabled": return 6;
    default: return 9;
  }
}

function mapToSortedObject(map) {
  return Object.fromEntries([...map.entries()].sort());
}

function rounded(value) {
  return Number(value.toFixed(2));
}

function addMonths(dateISO, months) {
  const date = parseISODate(dateISO);
  const originalDay = date.getDate();
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth() + months;
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const result = new Date(targetYear, targetMonth, Math.min(originalDay, daysInTargetMonth));
  return dateToISO(result);
}
