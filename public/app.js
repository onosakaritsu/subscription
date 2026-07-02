const categories = ["影音娱乐", "效率工具", "云服务", "学习", "健康", "财务", "其他"];
const currencies = ["CNY", "USD", "EUR", "HKD", "JPY", "GBP"];
const billingCycles = [
  ["weekly", "每周"],
  ["monthly", "每月"],
  ["quarterly", "每季度"],
  ["yearly", "每年"]
];

const currencySymbols = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
  HKD: "HK$",
  JPY: "¥",
  GBP: "£"
};

const state = {
  items: [],
  summary: null,
  selectedId: null,
  filters: {
    search: "",
    category: "all",
    enabled: "all"
  }
};

const els = {
  statusText: document.querySelector("#statusText"),
  totalCount: document.querySelector("#totalCount"),
  enabledCount: document.querySelector("#enabledCount"),
  disabledCount: document.querySelector("#disabledCount"),
  monthlySummary: document.querySelector("#monthlySummary"),
  nextRenewalSummary: document.querySelector("#nextRenewalSummary"),
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
}

function bindEvents() {
  els.newButton.addEventListener("click", setBlankForm);
  els.resetButton.addEventListener("click", setBlankForm);
  els.deleteButton.addEventListener("click", deleteSelected);
  els.form.addEventListener("submit", saveForm);
  els.exportButton.addEventListener("click", exportJSON);
  els.importInput.addEventListener("change", importJSON);

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
  state.selectedId = state.items.some((item) => item.id === selectId) ? selectId : null;
  renderAll();
}

function renderAll() {
  renderSummary();
  renderList();

  if (state.selectedId) {
    const item = state.items.find((entry) => entry.id === state.selectedId);
    if (item) {
      fillForm(item);
    }
  }
}

function renderSummary() {
  const summary = state.summary || { total: 0, enabled: 0, disabled: 0, monthlyByCurrency: {}, upcoming: [] };
  els.totalCount.textContent = summary.total;
  els.enabledCount.textContent = summary.enabled;
  els.disabledCount.textContent = summary.disabled;
  els.statusText.textContent = summary.total ? `管理 ${summary.total} 项订阅` : "本地 JSON 存储已就绪";

  const monthlyParts = Object.entries(summary.monthlyByCurrency).map(([currency, amount]) => (
    `${formatMoney(amount, currency)}`
  ));
  els.monthlySummary.textContent = monthlyParts.length ? monthlyParts.join(" / ") : "暂无启用订阅";

  const next = summary.upcoming?.[0];
  els.nextRenewalSummary.textContent = next ? `${next.name} · ${formatDate(next.nextRenewalDate)}` : "暂无";
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
    button.innerHTML = `
      <span class="row-flag ${item.isEnabled ? "" : "disabled"}"></span>
      <span class="row-main">
        <strong>${escapeHTML(item.name || "未命名订阅")}</strong>
        <span>${escapeHTML(item.category)} · ${escapeHTML(formatMoney(item.amount, item.currency))} · ${escapeHTML(cycleLabel(item.billingCycle))} · ${item.isEnabled ? "启用" : "停用"}</span>
      </span>
      <span class="row-date">
        <span>续费</span>
        <strong>${escapeHTML(formatDate(item.nextRenewalDate))}</strong>
      </span>
    `;
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

    const haystack = `${item.name} ${item.notes} ${item.category}`.toLowerCase();
    return haystack.includes(state.filters.search);
  });
}

function fillForm(item) {
  state.selectedId = item.id;
  els.formTitle.textContent = "编辑订阅";
  els.formHint.textContent = `${formatMoney(item.amount, item.currency)} · ${cycleLabel(item.billingCycle)}`;
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
  const today = new Date().toISOString().slice(0, 10);
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
  const path = state.selectedId ? `/api/subscriptions/${encodeURIComponent(state.selectedId)}` : "/api/subscriptions";
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
  if (!confirm(`删除「${item?.name || "此订阅"}」？`)) {
    return;
  }

  await api(`/api/subscriptions/${encodeURIComponent(state.selectedId)}`, { method: "DELETE" });
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
  link.download = "subscriptions.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importJSON() {
  const file = els.importInput.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const json = JSON.parse(text);
    const result = await api("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json)
    });
    showToast(`已导入 ${result.items.length} 项订阅`);
    await loadSubscriptions(result.items[0]?.id ?? null);
  } finally {
    els.importInput.value = "";
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
    `<option value="${escapeHTML(value)}">${escapeHTML(label)}</option>`
  )).join("");
}

function calculateNextRenewalDate(startDate, cycle) {
  if (!startDate) {
    return "";
  }

  let candidate = addCycle(startDate, cycle);
  const today = new Date().toISOString().slice(0, 10);
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

function toISODate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function cycleLabel(value) {
  return billingCycles.find(([cycle]) => cycle === value)?.[1] || value;
}

function formatMoney(amount, currency) {
  return `${currencySymbols[currency] || ""}${Number(amount || 0).toLocaleString("zh-CN", {
    maximumFractionDigits: 2
  })} ${currency}`;
}

function formatDate(value) {
  if (!value) {
    return "--";
  }
  const [, month, day] = value.split("-");
  return `${month}/${day}`;
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
