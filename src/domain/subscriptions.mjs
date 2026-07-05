export const categories = [
  "影音娱乐",
  "效率工具",
  "云服务",
  "学习",
  "健康",
  "财务",
  "其他"
];

export const currencyMetadata = {
  CNY: { code: "CNY", symbol: "¥", nameZh: "人民币", nameEn: "Chinese Yuan", displayName: "¥ / CNY / 人民币", compactLabel: "¥" },
  USD: { code: "USD", symbol: "$", nameZh: "美元", nameEn: "US Dollar", displayName: "$ / USD / 美元", compactLabel: "$" },
  JPY: { code: "JPY", symbol: "¥", nameZh: "日元", nameEn: "Japanese Yen", displayName: "¥ / JPY / 日元", compactLabel: "¥" },
  EUR: { code: "EUR", symbol: "€", nameZh: "欧元", nameEn: "Euro", displayName: "€ / EUR / 欧元", compactLabel: "€" },
  HKD: { code: "HKD", symbol: "HK$", nameZh: "港币", nameEn: "Hong Kong Dollar", displayName: "HK$ / HKD / 港币", compactLabel: "HK$" },
  GBP: { code: "GBP", symbol: "£", nameZh: "英镑", nameEn: "British Pound", displayName: "£ / GBP / 英镑", compactLabel: "£" },
  KRW: { code: "KRW", symbol: "₩", nameZh: "韩元", nameEn: "South Korean Won", displayName: "₩ / KRW / 韩元", compactLabel: "₩" },
  TWD: { code: "TWD", symbol: "NT$", nameZh: "新台币", nameEn: "New Taiwan Dollar", displayName: "NT$ / TWD / 新台币", compactLabel: "NT$" },
  AUD: { code: "AUD", symbol: "A$", nameZh: "澳元", nameEn: "Australian Dollar", displayName: "A$ / AUD / 澳元", compactLabel: "A$" },
  CAD: { code: "CAD", symbol: "C$", nameZh: "加元", nameEn: "Canadian Dollar", displayName: "C$ / CAD / 加元", compactLabel: "C$" },
  SGD: { code: "SGD", symbol: "S$", nameZh: "新加坡元", nameEn: "Singapore Dollar", displayName: "S$ / SGD / 新加坡元", compactLabel: "S$" }
};

export const currencies = Object.keys(currencyMetadata);

export const billingCycles = ["weekly", "monthly", "quarterly", "semiannual", "yearly", "oneTime"];

export const billingCycleLabels = {
  weekly: "每周",
  monthly: "每月",
  quarterly: "每季度",
  semiannual: "每半年",
  yearly: "每年",
  oneTime: "一次性"
};

export const currencySymbols = Object.fromEntries(
  Object.entries(currencyMetadata).map(([code, meta]) => [code, meta.symbol])
);

const zeroDecimalCurrencies = new Set(["JPY", "KRW"]);

export function normalizeCurrencyCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function isKnownCurrency(code) {
  return Boolean(currencyMetadata[normalizeCurrencyCode(code)]);
}

export function getCurrencyMeta(code) {
  const normalized = normalizeCurrencyCode(code);
  const known = currencyMetadata[normalized];
  if (known) {
    return { ...known, isKnown: true };
  }

  const fallbackCode = normalized || "UNKNOWN";
  return {
    code: fallbackCode,
    symbol: normalized,
    nameZh: "其他币种",
    nameEn: "Other Currency",
    displayName: normalized ? `${normalized} / 其他币种` : "未知币种",
    compactLabel: normalized,
    isKnown: false
  };
}

export function formatCurrencyLabel(currencyCode) {
  return getCurrencyMeta(currencyCode).displayName;
}

export function formatCurrencyAmount(amount, currencyCode, options = {}) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  const meta = getCurrencyMeta(currencyCode);
  const fractionDigits = zeroDecimalCurrencies.has(meta.code) ? 0 : 2;
  const value = numeric.toLocaleString("zh-CN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });

  if (options.style === "compact") {
    return `${meta.compactLabel || meta.code}${value}`;
  }

  if (options.style === "meta") {
    return `${meta.code} · ${meta.nameZh}`;
  }

  const prefix = meta.symbol ? `${meta.symbol} ` : "";
  return `${prefix}${value} · ${meta.code} · ${meta.nameZh}`;
}

export const statusMeta = {
  overdue: { statusKey: "overdue", label: "已过期", tone: "danger", priority: 100, description: "续费日期早于今天" },
  today: { statusKey: "today", label: "今日续费", tone: "danger", priority: 95, description: "今天需要续费" },
  within3Days: { statusKey: "within3Days", label: "3日内", tone: "warning", priority: 90, description: "距离续费还有 1 到 3 天" },
  within7Days: { statusKey: "within7Days", label: "7日内", tone: "caution", priority: 80, description: "距离续费还有 4 到 7 天" },
  thisMonth: { statusKey: "thisMonth", label: "本月内", tone: "info", priority: 60, description: "本月内会续费" },
  normal: { statusKey: "normal", label: "正常", tone: "success", priority: 30, description: "启用中，近期无续费压力" },
  disabled: { statusKey: "disabled", label: "已停用", tone: "muted", priority: 10, description: "已停用，不参与提醒" },
  oneTime: { statusKey: "oneTime", label: "一次性", tone: "purple", priority: 20, description: "一次性项目，不参与周期折算" }
};

export function getStatusMeta(statusOrKey) {
  const key = typeof statusOrKey === "string" ? statusOrKey : statusOrKey?.key;
  return statusMeta[key] || statusMeta.normal;
}
export const renewalStatusLabels = {
  disabled: "已停用",
  overdue: "已过期",
  today: "今日续费",
  within3Days: "3日内",
  within7Days: "7日内",
  thisMonth: "本月内",
  normal: "正常",
  oneTime: "一次性"
};

export function todayISO(referenceDate = new Date()) {
  return dateToISO(referenceDate);
}

export function exportSubscriptionFileName(now = new Date()) {
  return `subscriptions-export-${todayISO(now)}.json`;
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
  const currency = normalizeCurrencyCode(input.currency);
  if (!currency) {
    throw new Error("币种不能为空");
  }

  const billingCycle = input.billingCycle;
  if (!billingCycles.includes(billingCycle)) {
    throw new Error("计费周期不符合要求");
  }
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
    isEnabled: typeof input.isActive === "boolean" ? input.isActive : input.isEnabled !== false,
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
  if (item.billingCycle === "oneTime") {
    return statusResult("oneTime", daysUntilRenewal);
  }
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
    .filter((item) => item.isEnabled && item.billingCycle !== "oneTime" && urgentOrder.has(item.renewalStatus.key))
    .sort((a, b) => {
      const statusDelta = urgentOrder.get(a.renewalStatus.key) - urgentOrder.get(b.renewalStatus.key);
      if (statusDelta !== 0) {
        return statusDelta;
      }
      return a.nextRenewalDate.localeCompare(b.nextRenewalDate) || a.name.localeCompare(b.name, "zh-Hans-CN");
    })
    .slice(0, limit);
}

export function renewalCalendarGroups(items, referenceDate = todayISO()) {
  const reference = parseISODate(referenceDate);
  const currentMonth = reference.getMonth();
  const currentYear = reference.getFullYear();
  const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
  const nextMonth = nextMonthDate.getMonth();
  const nextYear = nextMonthDate.getFullYear();
  const groups = {
    currentMonth: [],
    nextMonth: []
  };

  for (const item of sortForManagement(items, referenceDate)) {
    if (!item.isEnabled || item.nextRenewalDate < referenceDate) {
      continue;
    }

    const renewal = parseISODate(item.nextRenewalDate);
    if (renewal.getFullYear() === currentYear && renewal.getMonth() === currentMonth) {
      groups.currentMonth.push(item);
      continue;
    }

    if (renewal.getFullYear() === nextYear && renewal.getMonth() === nextMonth) {
      groups.nextMonth.push(item);
    }
  }

  return groups;
}
export function renewSubscription(item, referenceDate = todayISO(), now = new Date()) {
  if (item.billingCycle === "oneTime") {
    throw new Error("一次性项目不能确认续费");
  }

  let nextRenewalDate = addCycle(item.nextRenewalDate, item.billingCycle);
  while (nextRenewalDate <= referenceDate) {
    nextRenewalDate = addCycle(nextRenewalDate, item.billingCycle);
  }

  return normalizeSubscription({
    ...item,
    nextRenewalDate,
    isRenewalDateManuallyAdjusted: true
  }, item, now);
}

export function copySubscriptionDraft(item) {
  const { id, createdAt, updatedAt, renewalStatus, renewalStatusText, ...draft } = item;
  return {
    ...draft,
    name: `${item.name || "未命名订阅"} 副本`
  };
}

export function filterAndSortSubscriptions(items, options = {}, referenceDate = todayISO()) {
  const search = String(options.search || "").trim().toLowerCase();
  const category = options.category || "all";
  const enabled = options.enabled || "all";
  const status = options.status || "all";
  const currency = options.currency || "all";
  const sort = options.sort || "default";

  const filtered = sortForManagement(items, referenceDate).filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    if (enabled === "enabled" && !item.isEnabled) return false;
    if (enabled === "disabled" && item.isEnabled) return false;
    if (status !== "all" && item.renewalStatus.key !== status) return false;
    if (currency !== "all" && item.currency !== currency) return false;
    if (!search) return true;
    return [item.name, item.category, item.notes, item.currency].join(" ").toLowerCase().includes(search);
  });

  return filtered.sort((a, b) => compareSubscriptions(a, b, sort));
}

function compareSubscriptions(a, b, sort) {
  if (sort === "renewal-desc") return b.nextRenewalDate.localeCompare(a.nextRenewalDate) || a.name.localeCompare(b.name, "zh-Hans-CN");
  if (sort === "amount-desc") return Number(b.amount || 0) - Number(a.amount || 0) || a.name.localeCompare(b.name, "zh-Hans-CN");
  if (sort === "amount-asc") return Number(a.amount || 0) - Number(b.amount || 0) || a.name.localeCompare(b.name, "zh-Hans-CN");
  if (sort === "name-asc") return a.name.localeCompare(b.name, "zh-Hans-CN");
  if (sort === "updated-desc") return String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")) || a.name.localeCompare(b.name, "zh-Hans-CN");
  return 0;
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
    overdueCount: enabled.filter((item) => item.renewalStatus.key === "overdue").length,
    todayRenewalCount: enabled.filter((item) => item.renewalStatus.key === "today").length,
    oneTimeCount: enabled.filter((item) => item.renewalStatus.key === "oneTime").length,
    thisMonthRenewalCount: thisMonthRenewals.length,
    within7DaysRenewalCount: within7DaysRenewals.length,
    upcoming: upcomingRenewals(items, 5, referenceDate),
    urgentUpcoming: urgentRenewals(items, 5, referenceDate),
    calendar: renewalCalendarGroups(items, referenceDate),
    monthlyByCurrency: mapToSortedObject(monthlyByCurrency),
    yearlyByCurrency: mapToSortedObject(yearlyByCurrency),
    oneTimeByCurrency: mapToSortedObject(oneTimeByCurrency)
  };
}

export function diagnoseSubscriptions(input) {
  const issues = [];
  const errorIndexes = new Set();
  const idIndexes = new Map();

  if (!Array.isArray(input)) {
    return {
      ok: false,
      summary: { total: 0, valid: 0, warnings: 0, errors: 1 },
      issues: [{ level: "error", type: "invalid_root", message: "订阅数据结构不符合要求，根节点必须是数组" }]
    };
  }

  const addIssue = (index, level, type, item, message) => {
    if (level === "error") errorIndexes.add(index);
    issues.push({
      level,
      type,
      index,
      subscriptionId: typeof item?.id === "string" ? item.id : undefined,
      subscriptionName: typeof item?.name === "string" ? item.name : undefined,
      message
    });
  };

  input.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      addIssue(index, "error", "invalid_item", item, "订阅项必须是对象");
      return;
    }

    const id = String(item.id ?? "").trim();
    if (!id) {
      addIssue(index, "error", "missing_id", item, "订阅 id 缺失");
    } else {
      const indexes = idIndexes.get(id) || [];
      indexes.push(index);
      idIndexes.set(id, indexes);
    }

    if (!String(item.name ?? "").trim()) {
      addIssue(index, "error", "empty_name", item, "订阅名称不能为空");
    }

    const amount = Number(item.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      addIssue(index, "error", "invalid_amount", item, "金额不能为负数，且必须是数字");
    }

    const currency = normalizeCurrencyCode(item.currency);
    if (!currency) {
      addIssue(index, "error", "empty_currency", item, "币种不能为空");
    } else if (!isKnownCurrency(currency)) {
      addIssue(index, "warning", "unknown_currency", item, "未知币种会保留原代码，但显示为其他币种");
    }

    if (!billingCycles.includes(item.billingCycle)) {
      addIssue(index, "error", "invalid_billing_cycle", item, "计费周期不符合要求");
    }

    if (!isValidISODate(item.startDate)) {
      addIssue(index, "error", "invalid_start_date", item, "开始日期无效");
    }

    const activeValue = Object.hasOwn(item, "isEnabled") ? item.isEnabled : item.isActive;
    if (activeValue !== undefined && typeof activeValue !== "boolean") {
      addIssue(index, "error", "invalid_active_state", item, "启用状态必须是布尔值");
    }

    const isEnabled = activeValue !== false;
    if (isEnabled && !item.nextRenewalDate) {
      addIssue(index, "error", "missing_next_renewal_date", item, "已启用订阅缺少下次续费日");
    } else if (item.nextRenewalDate && !isValidISODate(item.nextRenewalDate)) {
      addIssue(index, "error", "invalid_next_renewal_date", item, "下次续费日无效");
    }

    if (isValidISODate(item.startDate) && isValidISODate(item.nextRenewalDate) && item.nextRenewalDate < item.startDate) {
      addIssue(index, "warning", "renewal_before_start", item, "下次续费日早于开始日期，请确认是否为手动调整");
    }
  });

  for (const [id, indexes] of idIndexes.entries()) {
    if (indexes.length <= 1) continue;
    for (const index of indexes) {
      addIssue(index, "error", "duplicate_id", input[index], `订阅 id 重复：${id}`);
    }
  }

  const errors = issues.filter((issue) => issue.level === "error").length;
  const warnings = issues.filter((issue) => issue.level === "warning").length;
  return {
    ok: errors === 0,
    summary: {
      total: input.length,
      valid: input.length - errorIndexes.size,
      warnings,
      errors
    },
    issues
  };
}

export function createRenewalCalendarICS(items, options = {}) {
  const referenceDate = options.referenceDate || todayISO();
  const generatedAt = options.generatedAt || new Date();
  const horizonDate = addMonths(referenceDate, 12);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Subscription Manager Web//ZH-CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH"
  ];

  for (const item of sortForManagement(items, referenceDate)) {
    if (!item.isEnabled || !item.nextRenewalDate) continue;
    if (!isValidISODate(item.nextRenewalDate)) continue;

    if (item.billingCycle === "oneTime") {
      if (item.nextRenewalDate >= referenceDate && item.nextRenewalDate <= horizonDate) {
        appendICSEvent(lines, item, item.nextRenewalDate, generatedAt);
      }
      continue;
    }

    let eventDate = item.nextRenewalDate;
    while (eventDate < referenceDate) {
      eventDate = addCycle(eventDate, item.billingCycle);
    }
    while (eventDate <= horizonDate) {
      appendICSEvent(lines, item, eventDate, generatedAt);
      eventDate = addCycle(eventDate, item.billingCycle);
    }
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}


function appendICSEvent(lines, item, eventDate, generatedAt) {
  const isOneTime = item.billingCycle === "oneTime";
  const title = `订阅续费：${item.name || "未命名订阅"}${isOneTime ? "（一次性）" : ""}`;
  const description = [
    `名称：${item.name || "未命名订阅"}`,
    `金额：${formatCurrencyAmount(item.amount, item.currency)}`,
    `周期：${billingCycleLabels[item.billingCycle] || item.billingCycle}`,
    `分类：${item.category || "其他"}`,
    item.notes ? `备注：${item.notes}` : "备注：无"
  ].join("\n");

  lines.push(
    "BEGIN:VEVENT",
    `UID:${safeICSUID(item.id || item.name || "subscription")}-${formatICSDate(eventDate)}@subscription-manager-web`,
    `DTSTAMP:${formatICSTimestamp(generatedAt)}`,
    `DTSTART;VALUE=DATE:${formatICSDate(eventDate)}`,
    `DTEND;VALUE=DATE:${formatICSDate(addDays(eventDate, 1))}`,
    `SUMMARY:${escapeICSText(title)}`,
    `DESCRIPTION:${escapeICSText(description)}`,
    "END:VEVENT"
  );
}

function isValidISODate(value) {
  try {
    parseISODate(value);
    return true;
  } catch {
    return false;
  }
}

function addDays(dateISO, days) {
  const date = parseISODate(dateISO);
  date.setDate(date.getDate() + days);
  return dateToISO(date);
}

function formatICSDate(dateISO) {
  return dateISO.replaceAll("-", "");
}

function formatICSTimestamp(date) {
  return date.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

function escapeICSText(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replace(/\r?\n/g, "\\n");
}

function safeICSUID(value) {
  return String(value).replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80) || "subscription";
}

function statusResult(key, daysUntilRenewal) {
  const meta = getStatusMeta(key);
  return {
    key,
    label: meta.label,
    tone: meta.tone,
    description: meta.description,
    daysUntilRenewal,
    priority: meta.priority
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
