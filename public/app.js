const categories = ["影音娱乐", "效率工具", "云服务", "学习", "健康", "财务", "其他"];
const currencies = ["CNY", "USD", "EUR", "HKD", "JPY", "GBP"];
const billingCycles = [
  ["weekly", "每周"],
  ["monthly", "每月"],
  ["quarterly", "每季度"],
  ["semiannual", "每半年"],
  ["yearly", "每年"],
  ["oneTime", "一次性"]
];

const currencySymbols = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
  HKD: "HK$",
  JPY: "¥",
  GBP: "£"
};

const statusClass = {
  disabled: "is-disabled",
  overdue: "is-overdue",
  today: "is-today",
  within3Days: "is-soon",
  within7Days: "is-watch",
  thisMonth: "is-month",
  normal: "is-normal"
};

const state = {
  items: [],
  summary: null,
  calendar: { currentMonth: [], nextMonth: [] },
  backups: [],
  selectedBackupFileName: null,
  selectedId: null,
  filters: {
    search: "",
    category: "all",
    enabled: "all"
  }
};

const els = {
  statusText: document.querySelector("#statusText"),
  thisMonthCount: document.querySelector("#thisMonthCount"),
  within7Count: document.querySelector("#within7Count"),
  enabledCount: document.querySelector("#enabledCount"),
  disabledCount: document.querySelector("#disabledCount"),
  monthlySummary: document.querySelector("#monthlySummary"),
  yearlySummary: document.querySelector("#yearlySummary"),
  upcomingSummaryList: document.querySelector("#upcomingSummaryList"),
  renewalCalendarCurrent: document.querySelector("#renewalCalendarCurrent"),
  renewalCalendarNext: document.querySelector("#renewalCalendarNext"),
  subscriptionList: document.querySelector("#subscriptionList"),
  emptyList: document.querySelector("#emptyList"),
  form: document.querySelector("#subscriptionForm"),
  formTitle: document.querySelector("#formTitle"),
  formHint: document.querySelector("#formHint"),
  nameInput: document.querySelector("#nameInput"),
  categoryInput: document.querySelector("#categoryInput"),
  amountInput: document.querySelector("#amountInput"),
  currencyInput: document.querySelector("#currencyInput"),
  billingCycleInput: document.querySelector("#billingCycleInput"),
  startDateInput: document.querySelector("#startDateInput"),
  nextRenewalInput: document.querySelector("#nextRenewalInput"),
  manualRenewalInput: document.querySelector("#manualRenewalInput"),
  enabledInput: document.querySelector("#enabledInput"),
  notesInput: document.querySelector("#notesInput"),
  deleteButton: document.querySelector("#deleteButton"),
  resetButton: document.querySelector("#resetButton"),
  newButton: document.querySelector("#newButton"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  refreshBackupsButton: document.querySelector("#refreshBackupsButton"),
  backupList: document.querySelector("#backupList"),
  emptyBackups: document.querySelector("#emptyBackups"),
  backupPreview: document.querySelector("#backupPreview"),
  searchInput: document.querySelector("#searchInput"),
  categoryFilter: document.querySelector("#categoryFilter"),
  enabledFilter: document.querySelector("#enabledFilter"),
  toast: document.querySelector("#toast")
};

init();

async function init() {
  fillSelect(els.categoryInput, categories.map((value) => [value, value]));
  fillSelect(els.currencyInput, currencies.map((value) => [value, value]));
  fillSelect(els.billingCycleInput, billingCycles);
  fillSelect(els.categoryFilter, [["all", "全部分类"], ...categories.map((value) => [value, value])]);

  bindEvents();
  setBlankForm();
  await loadSubscriptions();
  await loadBackups();
}

function bindEvents() {
  els.newButton.addEventListener("click", setBlankForm);
  els.resetButton.addEventListener("click", setBlankForm);
  els.deleteButton.addEventListener("click", deleteSelected);
  els.form.addEventListener("submit", saveForm);
  els.exportButton.addEventListener("click", exportJSON);
  els.importInput.addEventListener("change", importJSON);
  els.refreshBackupsButton.addEventListener("click", loadBackups);
  els.backupList.addEventListener("click", handleBackupAction);

  els.searchInput.addEventListener("input", () => {
    state.filters.search = els.searchInput.value.trim().toLowerCase();
    renderList();
  });
  els.categoryFilter.addEventListener("change", () => {
    state.filters.category = els.categoryFilter.value;
    renderList();
  });
  els.enabledFilter.addEventListener("change", () => {
    state.filters.enabled = els.enabledFilter.value;
    renderList();
  });

  for (const input of [els.startDateInput, els.billingCycleInput]) {
    input.addEventListener("change", () => {
      if (!els.manualRenewalInput.checked) {
        els.nextRenewalInput.value = calculateNextRenewalDate(
          els.startDateInput.value,
          els.billingCycleInput.value
        );
      }
    });
  }

  els.nextRenewalInput.addEventListener("change", () => {
    els.manualRenewalInput.checked = true;
  });

  els.manualRenewalInput.addEventListener("change", () => {
    if (!els.manualRenewalInput.checked) {
      els.nextRenewalInput.value = calculateNextRenewalDate(
        els.startDateInput.value,
        els.billingCycleInput.value
      );
    }
  });
}

async function loadSubscriptions(selectId = state.selectedId) {
  const data = await api("/api/subscriptions");
  state.items = data.items;
  state.summary = data.summary;
  state.calendar = data.calendar || data.summary?.calendar || { currentMonth: [], nextMonth: [] };
  state.selectedId = state.items.some((item) => item.id === selectId) ? selectId : null;
  renderAll();
}

function renderAll() {
  renderSummary();
  renderList();
  renderUpcomingSummary();
  renderCalendar();

  if (state.selectedId) {
    const item = state.items.find((entry) => entry.id === state.selectedId);
    if (item) {
      fillForm(item);
    }
  }
}

function renderSummary() {
  const summary = state.summary || emptySummary();
  els.thisMonthCount.textContent = summary.thisMonthRenewalCount || 0;
  els.within7Count.textContent = summary.within7DaysRenewalCount || 0;
  els.enabledCount.textContent = summary.enabled || 0;
  els.disabledCount.textContent = summary.disabled || 0;
  els.statusText.textContent = summary.total ? "管理 " + summary.total + " 项订阅" : "本地 JSON 存储已就绪";
  els.monthlySummary.innerHTML = formatCurrencyTotals(summary.monthlyByCurrency);
  els.yearlySummary.innerHTML = formatCurrencyTotals(summary.yearlyByCurrency);
}

function renderUpcomingSummary() {
  const items = state.summary?.urgentUpcoming || [];
  if (!items.length) {
    els.upcomingSummaryList.innerHTML = '<div class="empty-state compact"><strong>暂无近期续费</strong><span>7 日内没有需要处理的启用订阅。</span></div>';
    return;
  }

  els.upcomingSummaryList.innerHTML = "";
  for (const item of items.slice(0, 5)) {
    const row = document.createElement("div");
    row.className = "upcoming-item";
    row.innerHTML = [
      '<span class="status-badge ', statusClassFor(item), '">', escapeHTML(item.renewalStatus.label), '</span>',
      '<strong>', escapeHTML(item.name || "未命名订阅"), '</strong>',
      '<span>', escapeHTML(formatDate(item.nextRenewalDate)), ' · ', escapeHTML(item.renewalStatusText), '</span>',
      '<span class="amount-text">', escapeHTML(formatMoney(item.amount, item.currency)), '</span>'
    ].join("");
    els.upcomingSummaryList.append(row);
  }
}

function renderCalendar() {
  renderCalendarGroup(els.renewalCalendarCurrent, state.calendar?.currentMonth || []);
  renderCalendarGroup(els.renewalCalendarNext, state.calendar?.nextMonth || []);
}

function renderCalendarGroup(container, items) {
  if (!items.length) {
    container.innerHTML = '<div class="empty-state compact"><strong>暂无续费</strong><span>该月份没有启用订阅需要续费。</span></div>';
    return;
  }

  container.innerHTML = "";
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "calendar-item";
    row.innerHTML = [
      '<strong>', escapeHTML(formatDate(item.nextRenewalDate)), '</strong>',
      '<span class="calendar-name">', escapeHTML(item.name || "未命名订阅"), '</span>',
      '<span class="status-badge ', statusClassFor(item), '">', escapeHTML(item.renewalStatus?.label || "正常"), '</span>',
      '<span class="amount-text">', escapeHTML(formatMoney(item.amount, item.currency)), '</span>'
    ].join("");
    container.append(row);
  }
}
function renderList() {
  const items = filteredItems();
  els.subscriptionList.innerHTML = "";
  els.emptyList.classList.toggle("hidden", items.length > 0);

  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "subscription-row";
    button.setAttribute("aria-selected", String(item.id === state.selectedId));
    button.innerHTML = [
      '<span class="row-flag ', item.isEnabled ? "" : "disabled", '"></span>',
      '<span class="row-main">',
        '<span class="row-title-line">',
          '<strong>', escapeHTML(item.name || "未命名订阅"), '</strong>',
          '<span class="status-badge ', statusClassFor(item), '">', escapeHTML(item.renewalStatus?.label || "正常"), '</span>',
        '</span>',
        '<span class="row-meta">', escapeHTML(item.category), ' · ', escapeHTML(formatMoney(item.amount, item.currency)), ' · ', escapeHTML(cycleLabel(item.billingCycle)), '</span>',
      '</span>',
      '<span class="row-date">',
        '<span>', escapeHTML(item.renewalStatusText || "续费"), '</span>',
        '<strong>', escapeHTML(formatDate(item.nextRenewalDate)), '</strong>',
      '</span>'
    ].join("");
    button.addEventListener("click", () => {
      state.selectedId = item.id;
      fillForm(item);
      renderList();
    });
    els.subscriptionList.append(button);
  }
}

function filteredItems() {
  return state.items.filter((item) => {
    if (state.filters.category !== "all" && item.category !== state.filters.category) {
      return false;
    }
    if (state.filters.enabled === "enabled" && !item.isEnabled) {
      return false;
    }
    if (state.filters.enabled === "disabled" && item.isEnabled) {
      return false;
    }
    if (!state.filters.search) {
      return true;
    }

    const haystack = (item.name + " " + item.notes + " " + item.category).toLowerCase();
    return haystack.includes(state.filters.search);
  });
}

function fillForm(item) {
  state.selectedId = item.id;
  els.formTitle.textContent = "编辑订阅";
  els.formHint.textContent = formatMoney(item.amount, item.currency) + " · " + cycleLabel(item.billingCycle) + " · " + (item.renewalStatus?.label || "正常");
  els.nameInput.value = item.name;
  els.categoryInput.value = item.category;
  els.amountInput.value = item.amount;
  els.currencyInput.value = item.currency;
  els.billingCycleInput.value = item.billingCycle;
  els.startDateInput.value = item.startDate;
  els.nextRenewalInput.value = item.nextRenewalDate;
  els.manualRenewalInput.checked = item.isRenewalDateManuallyAdjusted;
  els.enabledInput.checked = item.isEnabled;
  els.notesInput.value = item.notes || "";
  els.deleteButton.classList.remove("hidden");
}

function setBlankForm() {
  const today = localDateISO();
  state.selectedId = null;
  els.formTitle.textContent = "新增订阅";
  els.formHint.textContent = "填写订阅信息后保存。";
  els.form.reset();
  els.categoryInput.value = "效率工具";
  els.currencyInput.value = "CNY";
  els.billingCycleInput.value = "monthly";
  els.startDateInput.value = today;
  els.nextRenewalInput.value = calculateNextRenewalDate(today, "monthly");
  els.enabledInput.checked = true;
  els.manualRenewalInput.checked = false;
  els.deleteButton.classList.add("hidden");
  renderList();
}

async function saveForm(event) {
  event.preventDefault();
  const payload = formPayload();
  const path = state.selectedId ? "/api/subscriptions/" + encodeURIComponent(state.selectedId) : "/api/subscriptions";
  const method = state.selectedId ? "PUT" : "POST";
  const result = await api(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  showToast("已保存订阅");
  await loadSubscriptions(result.item.id);
}

async function deleteSelected() {
  if (!state.selectedId) {
    return;
  }
  const item = state.items.find((entry) => entry.id === state.selectedId);
  if (!confirm("删除「" + (item?.name || "此订阅") + "」？")) {
    return;
  }

  await api("/api/subscriptions/" + encodeURIComponent(state.selectedId), { method: "DELETE" });
  showToast("已删除订阅");
  setBlankForm();
  await loadSubscriptions(null);
}

function formPayload() {
  return {
    name: els.nameInput.value,
    category: els.categoryInput.value,
    amount: Number(els.amountInput.value || 0),
    currency: els.currencyInput.value,
    billingCycle: els.billingCycleInput.value,
    startDate: els.startDateInput.value,
    nextRenewalDate: els.nextRenewalInput.value,
    isRenewalDateManuallyAdjusted: els.manualRenewalInput.checked,
    isEnabled: els.enabledInput.checked,
    notes: els.notesInput.value
  };
}

async function exportJSON() {
  const response = await fetch("/api/export");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName();
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function importJSON() {
  const file = els.importInput.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      showToast("JSON 格式无效", true);
      return;
    }

    try {
      const result = await api("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json)
      });
      showToast("已导入 " + result.items.length + " 项订阅");
      await loadSubscriptions(result.items[0]?.id ?? null);
      await loadBackups();
    } catch (error) {
      showToast(error.message || "导入失败，当前数据未被修改", true);
    }
  } finally {
    els.importInput.value = "";
  }
}

async function loadBackups() {
  const data = await api("/api/backups");
  state.backups = data.backups || [];
  renderBackups();
}

function renderBackups() {
  els.backupList.innerHTML = "";
  els.emptyBackups.classList.toggle("hidden", state.backups.length > 0);

  for (const backup of state.backups) {
    const row = document.createElement("div");
    row.className = "backup-item";
    row.innerHTML = [
      '<div class="backup-main">',
        '<strong>', escapeHTML(formatDateTime(backup.createdAt)), '</strong>',
        '<span>', escapeHTML(backup.fileName), '</span>',
      '</div>',
      '<div class="backup-meta">',
        '<span>', escapeHTML(formatFileSize(backup.size)), '</span>',
        '<span>', escapeHTML(String(backup.subscriptionCount || 0) + " 项"), '</span>',
        backup.isValid === false ? '<span class="backup-invalid">不可恢复</span>' : '<span class="backup-valid">可恢复</span>',
      '</div>',
      '<div class="backup-actions">',
        '<button class="secondary" type="button" data-action="preview" data-file="', escapeHTML(backup.fileName), '">预览</button>',
        '<button class="danger" type="button" data-action="restore" data-file="', escapeHTML(backup.fileName), '" ', backup.isValid === false ? "disabled" : "", '>恢复此备份</button>',
      '</div>'
    ].join("");
    els.backupList.append(row);
  }
}

async function handleBackupAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const fileName = button.dataset.file;
  if (button.dataset.action === "preview") {
    await previewBackup(fileName);
    return;
  }

  if (button.dataset.action === "restore") {
    await restoreBackup(fileName);
  }
}

async function previewBackup(fileName) {
  try {
    const backup = await api("/api/backups/" + encodeURIComponent(fileName));
    state.selectedBackupFileName = fileName;
    renderBackupPreview(backup);
  } catch {
    els.backupPreview.classList.remove("hidden");
    els.backupPreview.innerHTML = '<strong>无法预览该备份</strong><span>备份文件可能已损坏。</span>';
  }
}

function renderBackupPreview(backup) {
  const rows = (backup.subscriptions || []).slice(0, 8).map((item) => [
    '<div class="preview-row">',
      '<strong>', escapeHTML(item.name || "未命名订阅"), '</strong>',
      '<span>', escapeHTML(formatDate(item.nextRenewalDate)), ' · ', escapeHTML(formatMoney(item.amount, item.currency)), '</span>',
    '</div>'
  ].join("")).join("");

  els.backupPreview.classList.remove("hidden");
  els.backupPreview.innerHTML = [
    '<div class="preview-heading">',
      '<strong>备份预览</strong>',
      '<span>', escapeHTML(backup.fileName), ' · ', escapeHTML(String(backup.subscriptionCount || 0) + " 项"), '</span>',
    '</div>',
    rows || '<div class="empty-state compact"><strong>空备份</strong><span>该备份内没有订阅。</span></div>'
  ].join("");
}

async function restoreBackup(fileName) {
  if (!confirm("恢复前会自动备份当前数据。确认要使用该备份覆盖当前订阅数据吗？")) {
    return;
  }

  try {
    const result = await api("/api/backups/" + encodeURIComponent(fileName) + "/restore", { method: "POST" });
    showToast("已从备份恢复订阅数据");
    setBlankForm();
    await loadSubscriptions(result.items[0]?.id ?? null);
    await loadBackups();
  } catch {
    showToast("恢复失败，请检查备份文件或查看服务端日志", true);
  }
}
async function api(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    showToast(data.error || "请求失败", true);
    throw new Error(data.error || "请求失败");
  }
  return data;
}

function fillSelect(select, options) {
  select.innerHTML = options.map(([value, label]) => (
    '<option value="' + escapeHTML(value) + '">' + escapeHTML(label) + '</option>'
  )).join("");
}

function calculateNextRenewalDate(startDate, cycle) {
  if (!startDate) {
    return "";
  }
  if (cycle === "oneTime") {
    return startDate;
  }

  let candidate = addCycle(startDate, cycle);
  const today = localDateISO();
  while (candidate < today) {
    candidate = addCycle(candidate, cycle);
  }
  return candidate;
}

function addCycle(dateISO, cycle) {
  const date = parseLocalDate(dateISO);
  if (cycle === "weekly") {
    date.setDate(date.getDate() + 7);
    return toISODate(date);
  }
  if (cycle === "quarterly") {
    return addMonths(dateISO, 3);
  }
  if (cycle === "semiannual") {
    return addMonths(dateISO, 6);
  }
  if (cycle === "yearly") {
    return addMonths(dateISO, 12);
  }
  return addMonths(dateISO, 1);
}

function addMonths(dateISO, months) {
  const date = parseLocalDate(dateISO);
  const day = date.getDate();
  const targetMonth = date.getMonth() + months;
  const daysInTargetMonth = new Date(date.getFullYear(), targetMonth + 1, 0).getDate();
  return toISODate(new Date(date.getFullYear(), targetMonth, Math.min(day, daysInTargetMonth)));
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function localDateISO(date = new Date()) {
  return toISODate(date);
}

function toISODate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function exportFileName(date = new Date()) {
  return "subscriptions-backup-" + localDateISO(date) + ".json";
}

function cycleLabel(value) {
  return billingCycles.find(([cycle]) => cycle === value)?.[1] || value;
}

function formatCurrencyTotals(totals = {}) {
  const entries = Object.entries(totals);
  if (!entries.length) {
    return '<span class="muted-value">暂无</span>';
  }
  return entries.map(([currency, amount]) => (
    '<span class="currency-line">' + escapeHTML(currency + " " + Number(amount || 0).toFixed(2)) + '</span>'
  )).join("");
}

function formatMoney(amount, currency) {
  return (currencySymbols[currency] || "") + Number(amount || 0).toLocaleString("zh-CN", {
    maximumFractionDigits: 2
  }) + " " + currency;
}

function formatDate(value) {
  if (!value) {
    return "--";
  }
  const [, month, day] = value.split("-");
  return month + "/" + day;
}

function formatDateTime(value) {
  if (!value) {
    return "--";
  }
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatFileSize(size) {
  const value = Number(size || 0);
  if (value < 1024) {
    return value + " B";
  }
  return (value / 1024).toFixed(1) + " KB";
}
function statusClassFor(item) {
  return statusClass[item.renewalStatus?.key] || "is-normal";
}

function emptySummary() {
  return {
    total: 0,
    enabled: 0,
    disabled: 0,
    thisMonthRenewalCount: 0,
    within7DaysRenewalCount: 0,
    monthlyByCurrency: {},
    yearlyByCurrency: {},
    urgentUpcoming: [],
    calendar: { currentMonth: [], nextMonth: [] }
  };
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.style.borderColor = isError ? "rgba(173, 52, 52, 0.35)" : "";
  els.toast.style.color = isError ? "#ad3434" : "";
  els.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.add("hidden"), 2600);
}
