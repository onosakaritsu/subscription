const categories = ["影音娱乐", "效率工具", "云服务", "学习", "健康", "财务", "其他"];
const currencies = ["CNY", "USD", "EUR", "HKD", "JPY", "GBP"];
const billingCycles = [["weekly", "每周"], ["monthly", "每月"], ["quarterly", "每季度"], ["semiannual", "每半年"], ["yearly", "每年"], ["oneTime", "一次性"]];
const currencySymbols = { CNY: "¥", USD: "$", EUR: "€", HKD: "HK$", JPY: "¥", GBP: "£" };
const statusOptions = [["all", "全部状态"], ["overdue", "已过期"], ["today", "今日续费"], ["within3Days", "3日内"], ["within7Days", "7日内"], ["thisMonth", "本月内"], ["normal", "正常"], ["disabled", "已停用"], ["oneTime", "一次性"]];
const statusClass = { disabled: "status-inactive", overdue: "status-overdue", today: "status-today", within3Days: "status-upcoming-3", within7Days: "status-upcoming-7", thisMonth: "status-this-month", normal: "status-normal", oneTime: "status-one-time" };
const statusPriority = { overdue: 100, today: 95, within3Days: 90, within7Days: 80, thisMonth: 60, normal: 30, oneTime: 20, disabled: 10 };

const state = { items: [], summary: null, calendar: { currentMonth: [], nextMonth: [] }, backups: [], showAllBackups: false, selectedId: null, filters: { search: "", category: "all", enabled: "all", status: "all", currency: "all", sort: "default" } };
const els = Object.fromEntries([...document.querySelectorAll("[id]")].map((el) => [el.id, el]));

init();

async function init() {
  fillSelect(els.categoryInput, categories.map((value) => [value, value]));
  fillSelect(els.currencyInput, currencies.map((value) => [value, value]));
  fillSelect(els.billingCycleInput, billingCycles);
  fillSelect(els.categoryFilter, [["all", "全部分类"], ...categories.map((value) => [value, value])]);
  fillSelect(els.statusFilter, statusOptions);
  fillSelect(els.currencyFilter, [["all", "全部币种"], ...currencies.map((value) => [value, value])]);
  bindEvents();
  setBlankForm(false);
  await loadSubscriptions();
  await loadBackups();
}

function bindEvents() {
  els.newButton.addEventListener("click", () => { setBlankForm(true); });
  els.closeDialogButton.addEventListener("click", closeDialog);
  els.cancelButton.addEventListener("click", closeDialog);
  els.deleteButton.addEventListener("click", deleteSelected);
  els.subscriptionForm.addEventListener("submit", saveForm);
  els.exportButton.addEventListener("click", exportJSON);
  els.importInput.addEventListener("change", importJSON);
  els.externalRestoreInput.addEventListener("change", restoreExternalBackup);
  els.manualBackupButton.addEventListener("click", createManualBackup);
  els.refreshBackupsButton.addEventListener("click", loadBackups);
  els.backupList.addEventListener("click", handleBackupAction);
  els.toggleBackupsButton.addEventListener("click", () => { state.showAllBackups = !state.showAllBackups; renderBackups(); });
  els.subscriptionList.addEventListener("click", handleSubscriptionAction);

  for (const id of ["searchInput", "categoryFilter", "enabledFilter", "statusFilter", "currencyFilter", "sortSelect"]) {
    els[id].addEventListener(id === "searchInput" ? "input" : "change", () => {
      state.filters.search = els.searchInput.value.trim().toLowerCase();
      state.filters.category = els.categoryFilter.value;
      state.filters.enabled = els.enabledFilter.value;
      state.filters.status = els.statusFilter.value;
      state.filters.currency = els.currencyFilter.value;
      state.filters.sort = els.sortSelect.value;
      renderList();
    });
  }

  for (const input of [els.startDateInput, els.billingCycleInput]) {
    input.addEventListener("change", () => {
      if (!els.manualRenewalInput.checked) els.nextRenewalInput.value = calculateNextRenewalDate(els.startDateInput.value, els.billingCycleInput.value);
    });
  }
  els.nextRenewalInput.addEventListener("change", () => { els.manualRenewalInput.checked = true; });
  els.manualRenewalInput.addEventListener("change", () => {
    if (!els.manualRenewalInput.checked) els.nextRenewalInput.value = calculateNextRenewalDate(els.startDateInput.value, els.billingCycleInput.value);
  });
}

async function loadSubscriptions(selectId = state.selectedId) {
  const data = await api("/api/subscriptions");
  state.items = data.items || [];
  state.summary = data.summary || emptySummary();
  state.calendar = data.calendar || data.summary?.calendar || { currentMonth: [], nextMonth: [] };
  state.selectedId = state.items.some((item) => item.id === selectId) ? selectId : null;
  renderAll();
}
function renderAll() { renderSummary(); renderUpcomingSummary(); renderCalendar(); renderList(); }
function renderSummary() {
  const s = state.summary || emptySummary();
  els.overdueCount.textContent = s.overdueCount || 0;
  els.todayCount.textContent = s.todayRenewalCount || 0;
  els.within7Count.textContent = s.within7DaysRenewalCount || 0;
  els.enabledCount.textContent = s.enabled || 0;
  els.disabledCount.textContent = s.disabled || 0;
  els.statusText.textContent = s.total ? `管理 ${s.total} 项订阅` : "记录、统计和保护你的本地订阅数据";
  els.monthlySummary.innerHTML = formatCurrencyTotals(s.monthlyByCurrency);
  els.yearlySummary.innerHTML = formatCurrencyTotals(s.yearlyByCurrency);
}
function renderUpcomingSummary() {
  const items = state.summary?.urgentUpcoming || [];
  if (!items.length) { els.upcomingSummaryList.innerHTML = '<div class="empty-state compact"><strong>近期暂无需要关注的续费项目</strong><span>7 日内没有需要处理的启用订阅。</span></div>'; return; }
  els.upcomingSummaryList.innerHTML = items.slice(0, 5).map((item) => `<div class="upcoming-item ${cardStatusClass(item)}"><span class="status-dot ${statusClassFor(item)}"></span>${renderStatusBadge(item)}<strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(formatDate(item.nextRenewalDate))} · ${escapeHTML(item.renewalStatusText)}</span><span class="amount-text">${escapeHTML(formatMoney(item.amount, item.currency))}</span></div>`).join("");
}
function renderCalendar() { renderCalendarGroup(els.renewalCalendarCurrent, state.calendar?.currentMonth || []); renderCalendarGroup(els.renewalCalendarNext, state.calendar?.nextMonth || []); }
function renderCalendarGroup(container, items) {
  if (!items.length) { container.innerHTML = '<div class="empty-state compact"><strong>暂无续费</strong><span>该月份没有启用订阅需要续费。</span></div>'; return; }
  container.innerHTML = items.map((item) => `<div class="calendar-item ${cardStatusClass(item)}"><strong>${escapeHTML(formatDate(item.nextRenewalDate))}</strong><span class="calendar-name">${escapeHTML(item.name)}</span>${renderStatusBadge(item)}<span class="amount-text">${escapeHTML(formatMoney(item.amount, item.currency))}</span></div>`).join("");
}
function renderList() {
  const items = filteredItems();
  els.subscriptionList.innerHTML = items.map(renderSubscriptionCard).join("");
  els.emptyList.classList.toggle("hidden", items.length > 0);
}
function renderSubscriptionCard(item) {
  const isOneTime = item.billingCycle === "oneTime" || item.renewalStatus?.key === "oneTime";
  const toggleText = item.isEnabled ? "停用" : "启用";
  return `<article class="subscription-card ${cardStatusClass(item)} ${item.isEnabled ? "" : "is-inactive"}">
    <div class="card-main">
      <div class="title-line"><strong>${escapeHTML(item.name || "未命名订阅")}</strong>${renderStatusBadge(item)}</div>
      <div class="meta-line"><span>${escapeHTML(item.category)}</span><span>${escapeHTML(cycleLabel(item.billingCycle))}</span><span>开始 ${escapeHTML(formatDate(item.startDate))}</span></div>
      ${item.notes ? `<p class="note-line">${escapeHTML(item.notes)}</p>` : ""}
    </div>
    <div class="card-side"><span>${escapeHTML(item.renewalStatusText || "续费")}</span><strong>${escapeHTML(formatDate(item.nextRenewalDate))}</strong><span>${escapeHTML(formatMoney(item.amount, item.currency))}</span></div>
    <div class="card-actions">
      <button class="secondary" type="button" data-action="edit" data-id="${escapeHTML(item.id)}">编辑</button>
      <button class="secondary" type="button" data-action="copy" data-id="${escapeHTML(item.id)}">复制</button>
      <button class="secondary" type="button" data-action="toggle" data-id="${escapeHTML(item.id)}">${toggleText}</button>
      <button class="secondary" type="button" data-action="renew" data-id="${escapeHTML(item.id)}" ${!item.isEnabled || isOneTime ? "disabled" : ""}>已续费</button>
      <button class="danger" type="button" data-action="delete" data-id="${escapeHTML(item.id)}">删除</button>
    </div>
  </article>`;
}
function filteredItems() {
  const f = state.filters;
  const filtered = state.items.filter((item) => {
    if (f.category !== "all" && item.category !== f.category) return false;
    if (f.enabled === "enabled" && !item.isEnabled) return false;
    if (f.enabled === "disabled" && item.isEnabled) return false;
    if (f.status !== "all" && item.renewalStatus?.key !== f.status) return false;
    if (f.currency !== "all" && item.currency !== f.currency) return false;
    if (!f.search) return true;
    return [item.name, item.category, item.notes, item.currency].join(" ").toLowerCase().includes(f.search);
  });
  return filtered.sort((a, b) => compareItems(a, b, f.sort));
}
function compareItems(a, b, sort) {
  if (sort === "renewal-desc") return b.nextRenewalDate.localeCompare(a.nextRenewalDate) || a.name.localeCompare(b.name, "zh-Hans-CN");
  if (sort === "amount-desc") return Number(b.amount || 0) - Number(a.amount || 0) || a.name.localeCompare(b.name, "zh-Hans-CN");
  if (sort === "amount-asc") return Number(a.amount || 0) - Number(b.amount || 0) || a.name.localeCompare(b.name, "zh-Hans-CN");
  if (sort === "name-asc") return a.name.localeCompare(b.name, "zh-Hans-CN");
  if (sort === "updated-desc") return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  return 0;
}
async function handleSubscriptionAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const item = state.items.find((entry) => entry.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.action === "edit") { fillForm(item); openDialog(); return; }
  if (button.dataset.action === "copy") { fillForm({ ...copyDraft(item), id: null }); state.selectedId = null; els.formTitle.textContent = "复制订阅"; openDialog(); return; }
  if (button.dataset.action === "delete") { state.selectedId = item.id; await deleteSelected(); return; }
  if (button.dataset.action === "toggle") { await toggleSubscription(item); return; }
  if (button.dataset.action === "renew") { await confirmRenew(item); }
}
function openDialog() { els.subscriptionDialog.showModal(); }
function closeDialog() { els.subscriptionDialog.close(); }
function fillForm(item) {
  state.selectedId = item.id || null;
  els.formTitle.textContent = state.selectedId ? "编辑订阅" : "新增订阅";
  els.formHint.textContent = `${formatMoney(item.amount, item.currency)} · ${cycleLabel(item.billingCycle)}`;
  els.nameInput.value = item.name || ""; els.categoryInput.value = item.category || "效率工具"; els.amountInput.value = item.amount ?? 0; els.currencyInput.value = item.currency || "CNY"; els.billingCycleInput.value = item.billingCycle || "monthly"; els.startDateInput.value = item.startDate || localDateISO(); els.nextRenewalInput.value = item.nextRenewalDate || calculateNextRenewalDate(els.startDateInput.value, els.billingCycleInput.value); els.manualRenewalInput.checked = Boolean(item.isRenewalDateManuallyAdjusted); els.enabledInput.checked = item.isEnabled !== false; els.notesInput.value = item.notes || "";
  els.deleteButton.classList.toggle("hidden", !state.selectedId);
}
function setBlankForm(open = false) { const today = localDateISO(); fillForm({ name: "", category: "效率工具", amount: 0, currency: "CNY", billingCycle: "monthly", startDate: today, nextRenewalDate: calculateNextRenewalDate(today, "monthly"), isEnabled: true, notes: "" }); if (open) openDialog(); }
async function saveForm(event) {
  event.preventDefault();
  const path = state.selectedId ? "/api/subscriptions/" + encodeURIComponent(state.selectedId) : "/api/subscriptions";
  const method = state.selectedId ? "PUT" : "POST";
  try {
    const result = await api(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formPayload()) });
    showToast("已保存订阅"); closeDialog(); await loadSubscriptions(result.item.id); await loadBackups();
  } catch (error) { showToast(error.message || "保存失败", true); }
}
async function deleteSelected() {
  if (!state.selectedId) return;
  const item = state.items.find((entry) => entry.id === state.selectedId);
  if (!confirm("删除「" + (item?.name || "此订阅") + "」？")) return;
  await api("/api/subscriptions/" + encodeURIComponent(state.selectedId), { method: "DELETE" });
  showToast("已删除订阅"); closeDialog(); setBlankForm(false); await loadSubscriptions(null); await loadBackups();
}
async function toggleSubscription(item) { const result = await api("/api/subscriptions/" + encodeURIComponent(item.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isEnabled: !item.isEnabled }) }); showToast(result.item.isEnabled ? "已启用订阅" : "已停用订阅"); await loadSubscriptions(result.item.id); await loadBackups(); }
async function confirmRenew(item) { if (!confirm("确认已完成续费并更新下次续费日吗？")) return; const result = await api("/api/subscriptions/" + encodeURIComponent(item.id) + "/renew", { method: "POST" }); showToast("已更新下次续费日"); await loadSubscriptions(result.item.id); await loadBackups(); }
function formPayload() { return { name: els.nameInput.value, category: els.categoryInput.value, amount: Number(els.amountInput.value || 0), currency: els.currencyInput.value, billingCycle: els.billingCycleInput.value, startDate: els.startDateInput.value, nextRenewalDate: els.nextRenewalInput.value, isRenewalDateManuallyAdjusted: els.manualRenewalInput.checked, isEnabled: els.enabledInput.checked, notes: els.notesInput.value }; }
function copyDraft(item) { return { ...item, name: `${item.name || "未命名订阅"} 副本`, isRenewalDateManuallyAdjusted: item.isRenewalDateManuallyAdjusted }; }

async function exportJSON() { const response = await fetch("/api/export"); const blob = await response.blob(); downloadBlob(blob, exportFileName()); }
async function importJSON() { const file = els.importInput.files?.[0]; if (!file) return; try { const json = await readJSONFile(file); const result = await api("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) }); showToast("已导入 " + result.items.length + " 项订阅"); await loadSubscriptions(result.items[0]?.id ?? null); await loadBackups(); } catch (error) { showToast(error.message || "导入失败，当前数据未被修改", true); } finally { els.importInput.value = ""; } }
async function restoreExternalBackup() { const file = els.externalRestoreInput.files?.[0]; if (!file) return; try { const json = await readJSONFile(file); if (!confirm("恢复前会自动备份当前数据。确认要使用所选文件覆盖当前订阅数据吗？")) return; const result = await api("/api/backups/restore-uploaded", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) }); showToast("已从外部备份恢复订阅数据"); await loadSubscriptions(result.items[0]?.id ?? null); await loadBackups(); } catch (error) { showToast(error.message || "恢复失败，请检查备份文件或查看服务端日志", true); } finally { els.externalRestoreInput.value = ""; } }
async function readJSONFile(file) { const text = await file.text(); try { return JSON.parse(text); } catch { throw new Error("JSON 格式无效"); } }
async function createManualBackup() { try { await api("/api/backups", { method: "POST" }); showToast("已创建手动备份"); await loadBackups(); } catch { showToast("手动备份失败，请查看服务端日志", true); } }
async function loadBackups() { const data = await api("/api/backups"); state.backups = data.backups || []; renderBackups(); }
function renderBackups() { const backups = state.showAllBackups ? state.backups : state.backups.slice(0, 10); els.backupList.innerHTML = backups.map(renderBackupRow).join(""); els.emptyBackups.classList.toggle("hidden", state.backups.length > 0); els.toggleBackupsButton.classList.toggle("hidden", state.backups.length <= 10); els.toggleBackupsButton.textContent = state.showAllBackups ? "收起" : "显示全部"; }
function renderBackupRow(backup) { return `<div class="backup-item"><div class="backup-main"><strong>${escapeHTML(backup.type?.label || "自动备份")} · ${escapeHTML(formatDateTime(backup.createdAt))}</strong><span>${escapeHTML(backup.fileName)}</span></div><div class="backup-meta"><span>${escapeHTML(formatFileSize(backup.size))}</span><span>${escapeHTML(String(backup.subscriptionCount || 0) + " 项")}</span>${backup.isValid === false ? '<span class="backup-invalid">不可恢复</span>' : '<span class="backup-valid">可恢复</span>'}</div><div class="backup-actions"><button class="secondary" type="button" data-action="preview" data-file="${escapeHTML(backup.fileName)}">预览</button><button class="secondary" type="button" data-action="download" data-file="${escapeHTML(backup.fileName)}">下载</button><button class="danger" type="button" data-action="restore" data-file="${escapeHTML(backup.fileName)}" ${backup.isValid === false ? "disabled" : ""}>恢复</button></div></div>`; }
async function handleBackupAction(event) { const button = event.target.closest("button[data-action]"); if (!button) return; const fileName = button.dataset.file; if (button.dataset.action === "preview") return previewBackup(fileName); if (button.dataset.action === "download") return downloadBackup(fileName); if (button.dataset.action === "restore") return restoreBackup(fileName); }
async function previewBackup(fileName) { try { const backup = await api("/api/backups/" + encodeURIComponent(fileName)); els.backupPreview.classList.remove("hidden"); els.backupPreview.innerHTML = `<div class="preview-heading"><strong>备份预览</strong><span>${escapeHTML(backup.fileName)} · ${escapeHTML(String(backup.subscriptionCount || 0) + " 项")}</span></div>${(backup.subscriptions || []).slice(0, 8).map((item) => `<div class="preview-row"><strong>${escapeHTML(item.name || "未命名订阅")}</strong><span>${escapeHTML(formatDate(item.nextRenewalDate))} · ${escapeHTML(formatMoney(item.amount, item.currency))}</span></div>`).join("") || '<div class="empty-state compact"><strong>空备份</strong><span>该备份内没有订阅。</span></div>'}`; } catch { els.backupPreview.classList.remove("hidden"); els.backupPreview.innerHTML = '<strong>无法预览该备份</strong><span>备份文件可能已损坏。</span>'; } }
async function downloadBackup(fileName) { const response = await fetch("/api/backups/" + encodeURIComponent(fileName) + "/download"); if (!response.ok) { showToast("备份下载失败", true); return; } downloadBlob(await response.blob(), fileName); }
async function restoreBackup(fileName) { if (!confirm("恢复前会自动备份当前数据。确认要使用该备份覆盖当前订阅数据吗？")) return; try { const result = await api("/api/backups/" + encodeURIComponent(fileName) + "/restore", { method: "POST" }); showToast("已从备份恢复订阅数据"); await loadSubscriptions(result.items[0]?.id ?? null); await loadBackups(); } catch { showToast("恢复失败，请检查备份文件或查看服务端日志", true); } }

async function api(path, options = {}) { const response = await fetch(path, options); const data = await response.json().catch(() => ({})); if (!response.ok) { throw new Error(data.error || "请求失败"); } return data; }
function downloadBlob(blob, fileName) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = fileName; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url); }
function renderStatusBadge(item) { const status = item.renewalStatus || { key: item.isEnabled ? "normal" : "disabled", label: item.isEnabled ? "正常" : "已停用" }; return `<span class="status-badge ${statusClassFor(item)}" title="${escapeHTML(status.description || status.label)}">${escapeHTML(status.label)}</span>`; }
function statusClassFor(item) { return statusClass[item.renewalStatus?.key] || "status-normal"; }
function cardStatusClass(item) { const key = item.renewalStatus?.key || "normal"; if (key === "disabled") return "is-inactive"; if (key === "overdue") return "is-overdue"; if (key === "today") return "is-today"; if (key === "within3Days") return "is-upcoming-3"; if (key === "within7Days") return "is-upcoming-7"; if (key === "thisMonth") return "is-this-month"; if (key === "oneTime") return "is-one-time"; return "is-normal"; }
function fillSelect(select, options) { select.innerHTML = options.map(([value, label]) => `<option value="${escapeHTML(value)}">${escapeHTML(label)}</option>`).join(""); }
function calculateNextRenewalDate(startDate, cycle) { if (!startDate) return ""; if (cycle === "oneTime") return startDate; let candidate = addCycle(startDate, cycle); const today = localDateISO(); while (candidate < today) candidate = addCycle(candidate, cycle); return candidate; }
function addCycle(dateISO, cycle) { if (cycle === "weekly") { const d = parseLocalDate(dateISO); d.setDate(d.getDate() + 7); return toISODate(d); } if (cycle === "quarterly") return addMonths(dateISO, 3); if (cycle === "semiannual") return addMonths(dateISO, 6); if (cycle === "yearly") return addMonths(dateISO, 12); return addMonths(dateISO, 1); }
function addMonths(dateISO, months) { const date = parseLocalDate(dateISO); const day = date.getDate(); const targetMonth = date.getMonth() + months; const daysInTargetMonth = new Date(date.getFullYear(), targetMonth + 1, 0).getDate(); return toISODate(new Date(date.getFullYear(), targetMonth, Math.min(day, daysInTargetMonth))); }
function parseLocalDate(value) { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); }
function localDateISO(date = new Date()) { return toISODate(date); }
function toISODate(date) { return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-"); }
function exportFileName(date = new Date()) { return "subscriptions-export-" + localDateISO(date) + ".json"; }
function cycleLabel(value) { return billingCycles.find(([cycle]) => cycle === value)?.[1] || value; }
function formatCurrencyTotals(totals = {}) { const entries = Object.entries(totals); if (!entries.length) return '<span class="muted-value">暂无</span>'; return entries.map(([currency, amount]) => `<span class="currency-line">${escapeHTML(currency + " " + Number(amount || 0).toFixed(2))}</span>`).join(""); }
function formatMoney(amount, currency) { return (currencySymbols[currency] || "") + Number(amount || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 }) + " " + currency; }
function formatDate(value) { if (!value) return "--"; const [, month, day] = value.split("-"); return month + "/" + day; }
function formatDateTime(value) { if (!value) return "--"; return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function formatFileSize(size) { const value = Number(size || 0); return value < 1024 ? value + " B" : (value / 1024).toFixed(1) + " KB"; }
function emptySummary() { return { total: 0, enabled: 0, disabled: 0, overdueCount: 0, todayRenewalCount: 0, within7DaysRenewalCount: 0, monthlyByCurrency: {}, yearlyByCurrency: {}, urgentUpcoming: [], calendar: { currentMonth: [], nextMonth: [] } }; }
function escapeHTML(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function showToast(message, isError = false) { els.toast.textContent = message; els.toast.classList.toggle("is-error", isError); els.toast.classList.remove("hidden"); window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => els.toast.classList.add("hidden"), 3000); }
