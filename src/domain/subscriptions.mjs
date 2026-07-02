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

export const billingCycles = ["weekly", "monthly", "quarterly", "yearly"];

export const billingCycleLabels = {
  weekly: "每周",
  monthly: "每月",
  quarterly: "每季度",
  yearly: "每年"
};

export const currencySymbols = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
  HKD: "HK$",
  JPY: "¥",
  GBP: "£"
};

export function todayISO(referenceDate = new Date()) {
  return dateToISO(referenceDate);
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
    case "yearly":
      return addMonths(dateISO, 12);
    default:
      throw new Error("不支持的计费周期");
  }
}

export function calculateNextRenewalDate(startDate, billingCycle, referenceDate = todayISO()) {
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

export function sortForManagement(items) {
  return [...items].sort((a, b) => {
    if (a.nextRenewalDate === b.nextRenewalDate) {
      return a.name.localeCompare(b.name, "zh-Hans-CN");
    }
    return a.nextRenewalDate.localeCompare(b.nextRenewalDate);
  });
}

export function upcomingRenewals(items, limit = 8) {
  return sortForManagement(items)
    .filter((item) => item.isEnabled)
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
    case "yearly":
      return amount / 12;
    default:
      return amount;
  }
}

export function summarizeSubscriptions(items) {
  const enabled = items.filter((item) => item.isEnabled);
  const monthlyByCurrency = new Map();

  for (const item of enabled) {
    monthlyByCurrency.set(
      item.currency,
      Number(((monthlyByCurrency.get(item.currency) || 0) + monthlyEquivalent(item)).toFixed(2))
    );
  }

  return {
    total: items.length,
    enabled: enabled.length,
    disabled: items.length - enabled.length,
    upcoming: upcomingRenewals(items, 5),
    monthlyByCurrency: Object.fromEntries([...monthlyByCurrency.entries()].sort())
  };
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
