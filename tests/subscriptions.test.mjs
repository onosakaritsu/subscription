import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  calculateNextRenewalDate,
  copySubscriptionDraft,
  createRenewalCalendarICS,
  diagnoseSubscriptions,
  exportSubscriptionFileName,
  filterAndSortSubscriptions,
  formatCurrencyAmount,
  formatCurrencyLabel,
  getCurrencyMeta,
  getStatusMeta,
  monthlyEquivalent,
  normalizeSubscription,
  renewalCalendarGroups,
  renewalStatus,
  renewSubscription,
  sortForManagement,
  summarizeSubscriptions,
  upcomingRenewals,
  yearlyEquivalent
} from "../src/domain/subscriptions.mjs";
import {
  backupFileName,
  createDataBackup,
  createManualBackup,
  listBackupFiles,
  manualBackupFileName,
  pruneBackups,
  readBackupDownload,
  readBackupFile
} from "../src/storage/backups.mjs";
import {
  createApp,
  createManualBackupForDataFile,
  getBackupPreview,
  getDataIntegrityReport,
  importJSONTextToDataFile,
  restoreBackupToDataFile,
  restoreUploadedBackupToDataFile,
  renewSubscriptionById,
  updateSubscriptionEnabled
} from "../src/server.mjs";

describe("subscription domain", () => {
  it("calculates the next monthly renewal after the reference date", () => {
    assert.equal(
      calculateNextRenewalDate("2026-01-31", "monthly", "2026-03-01"),
      "2026-03-28"
    );
  });

  it("calculates renewal status labels from the next renewal date", () => {
    assert.equal(renewalStatus(enabledItem("Overdue", "2026-07-01"), "2026-07-02").key, "overdue");
    assert.equal(renewalStatus(enabledItem("Today", "2026-07-02"), "2026-07-02").key, "today");
    assert.equal(renewalStatus(enabledItem("Soon", "2026-07-05"), "2026-07-02").key, "within3Days");
    assert.equal(renewalStatus(enabledItem("Week", "2026-07-09"), "2026-07-02").key, "within7Days");
    assert.equal(renewalStatus(enabledItem("Month", "2026-07-20"), "2026-07-02").key, "thisMonth");
    assert.equal(renewalStatus(enabledItem("Normal", "2026-08-01"), "2026-07-02").key, "normal");
    assert.equal(renewalStatus({ ...enabledItem("Off", "2026-07-01"), isEnabled: false }, "2026-07-02").key, "disabled");
  });

  it("sorts enabled subscriptions first, then disabled subscriptions by renewal date", () => {
    const items = [
      { ...enabledItem("DisabledSoon", "2026-07-01"), isEnabled: false },
      enabledItem("Later", "2026-07-20"),
      enabledItem("Overdue", "2026-06-30"),
      enabledItem("Soon", "2026-07-04"),
      { ...enabledItem("DisabledLater", "2026-07-09"), isEnabled: false }
    ];

    assert.deepEqual(sortForManagement(items, "2026-07-02").map((item) => item.name), [
      "Overdue",
      "Soon",
      "Later",
      "DisabledSoon",
      "DisabledLater"
    ]);
  });

  it("keeps disabled subscriptions visible in management sorting but excludes them from upcoming renewals", () => {
    const items = [
      enabledItem("Enabled", "2026-07-09"),
      { ...enabledItem("Disabled", "2026-07-04"), isEnabled: false }
    ];

    assert.deepEqual(sortForManagement(items, "2026-07-02").map((item) => item.name), ["Enabled", "Disabled"]);
    assert.deepEqual(upcomingRenewals(items, 5, "2026-07-02").map((item) => item.name), ["Enabled"]);
  });

  it("calculates monthly and yearly equivalents for supported recurring billing cycles", () => {
    assert.equal(monthlyEquivalent(cycleItem("monthly", 12)), 12);
    assert.equal(yearlyEquivalent(cycleItem("monthly", 12)), 144);
    assert.equal(monthlyEquivalent(cycleItem("quarterly", 90)), 30);
    assert.equal(yearlyEquivalent(cycleItem("quarterly", 90)), 360);
    assert.equal(monthlyEquivalent(cycleItem("semiannual", 600)), 100);
    assert.equal(yearlyEquivalent(cycleItem("semiannual", 600)), 1200);
    assert.equal(monthlyEquivalent(cycleItem("yearly", 1200)), 100);
    assert.equal(yearlyEquivalent(cycleItem("yearly", 1200)), 1200);
  });

  it("summarizes multiple currencies separately", () => {
    const items = [
      cycleItem("monthly", 128, "CNY"),
      cycleItem("yearly", 240, "USD"),
      cycleItem("quarterly", 3900, "JPY")
    ];

    const summary = summarizeSubscriptions(items, "2026-07-02");
    assert.deepEqual(summary.monthlyByCurrency, { CNY: 128, JPY: 1300, USD: 20 });
    assert.deepEqual(summary.yearlyByCurrency, { CNY: 1536, JPY: 15600, USD: 240 });
  });

  it("does not mix one-time purchases into recurring monthly or yearly totals", () => {
    const items = [
      cycleItem("monthly", 20, "USD"),
      cycleItem("oneTime", 99, "USD")
    ];

    const summary = summarizeSubscriptions(items, "2026-07-02");
    assert.deepEqual(summary.monthlyByCurrency, { USD: 20 });
    assert.deepEqual(summary.yearlyByCurrency, { USD: 240 });
    assert.deepEqual(summary.oneTimeByCurrency, { USD: 99 });
  });


  it("groups current month and next month renewals for the calendar view", () => {
    const items = [
      enabledItem("Overdue", "2026-06-30"),
      enabledItem("Current", "2026-07-12"),
      enabledItem("Next", "2026-08-01"),
      enabledItem("Later", "2026-09-01"),
      { ...enabledItem("Disabled", "2026-07-15"), isEnabled: false }
    ];

    const calendar = renewalCalendarGroups(items, "2026-07-02");
    assert.deepEqual(calendar.currentMonth.map((item) => item.name), ["Current"]);
    assert.deepEqual(calendar.nextMonth.map((item) => item.name), ["Next"]);
  });


  it("returns status metadata with label tone and priority", () => {
    assert.deepEqual(getStatusMeta("overdue"), {
      statusKey: "overdue",
      label: "已过期",
      tone: "danger",
      priority: 100,
      description: "续费日期早于今天"
    });
    assert.equal(getStatusMeta("within7Days").label, "7日内");
    assert.equal(getStatusMeta("oneTime").tone, "purple");
  });

  it("recognizes one-time projects as a separate status", () => {
    const item = cycleItem("oneTime", 99, "USD");
    assert.equal(renewalStatus(item, "2026-07-02").key, "oneTime");
  });

  it("filters by status and currency and searches name category notes and currency", () => {
    const items = [
      { ...enabledItem("Overdue", "2026-07-01"), currency: "USD", notes: "alpha" },
      { ...enabledItem("Normal", "2026-08-20"), currency: "CNY", category: "云服务", notes: "beta" },
      { ...enabledItem("Disabled", "2026-07-02"), isEnabled: false, currency: "JPY" }
    ];
    assert.deepEqual(filterAndSortSubscriptions(items, { status: "overdue" }, "2026-07-02").map((item) => item.name), ["Overdue"]);
    assert.deepEqual(filterAndSortSubscriptions(items, { currency: "CNY" }, "2026-07-02").map((item) => item.name), ["Normal"]);
    assert.deepEqual(filterAndSortSubscriptions(items, { search: "beta" }, "2026-07-02").map((item) => item.name), ["Normal"]);
    assert.deepEqual(filterAndSortSubscriptions(items, { search: "jpy" }, "2026-07-02").map((item) => item.name), ["Disabled"]);
  });

  it("sorts filtered subscriptions by amount name and renewal date", () => {
    const items = [enabledItem("B", "2026-07-10"), { ...enabledItem("A", "2026-07-12"), amount: 30 }, { ...enabledItem("C", "2026-07-08"), amount: 5 }];
    assert.deepEqual(filterAndSortSubscriptions(items, { sort: "amount-desc" }, "2026-07-02").map((item) => item.name), ["A", "B", "C"]);
    assert.deepEqual(filterAndSortSubscriptions(items, { sort: "name-asc" }, "2026-07-02").map((item) => item.name), ["A", "B", "C"]);
    assert.deepEqual(filterAndSortSubscriptions(items, { sort: "renewal-desc" }, "2026-07-02").map((item) => item.name), ["A", "B", "C"]);
  });

  it("renews overdue subscriptions until the next date is after today", () => {
    const renewed = renewSubscription(enabledItem("Old", "2026-01-01"), "2026-07-05", new Date(2026, 6, 5));
    assert.equal(renewed.nextRenewalDate > "2026-07-05", true);
  });

  it("rejects renewal for one-time projects and creates copy drafts without ids", () => {
    assert.throws(() => renewSubscription(cycleItem("oneTime", 99), "2026-07-05"), /一次性项目不能确认续费/);
    const draft = copySubscriptionDraft(enabledItem("Cloud", "2026-07-10"));
    assert.equal(draft.name, "Cloud 副本");
    assert.equal("id" in draft, false);
  });

  it("rejects invalid subscription data", () => {
    assert.throws(() => normalizeSubscription({ ...enabledItem("", "2026-07-02"), name: "" }), /订阅名称不能为空/);
    assert.throws(() => normalizeSubscription({ ...enabledItem("Bad", "2026-07-02"), amount: -1 }), /金额必须/);
    assert.throws(() => normalizeSubscription({ ...enabledItem("Bad", "2026-07-02"), billingCycle: "bad" }), /计费周期不符合要求/);
    assert.throws(() => normalizeSubscription({ ...enabledItem("Bad", "2026-07-02"), startDate: "2026-02-31" }), /日期不存在/);
  });

  it("formats export file names with the local date", () => {
    assert.equal(
      exportSubscriptionFileName(new Date(2026, 6, 2, 8, 9, 5)),
      "subscriptions-export-2026-07-02.json"
    );
  });

  it("formats currency labels and amounts for known and unknown currencies", () => {
    assert.equal(formatCurrencyLabel("CNY"), "¥ / CNY / 人民币");
    assert.equal(formatCurrencyLabel("USD"), "$ / USD / 美元");
    assert.equal(formatCurrencyLabel("JPY"), "¥ / JPY / 日元");
    assert.equal(formatCurrencyLabel("EUR"), "€ / EUR / 欧元");
    assert.equal(formatCurrencyLabel("HKD"), "HK$ / HKD / 港币");
    assert.equal(getCurrencyMeta("XYZ").nameZh, "其他币种");
    assert.equal(formatCurrencyAmount(1300, "JPY"), "¥ 1,300 · JPY · 日元");
    assert.equal(formatCurrencyAmount(20, "USD"), "$ 20.00 · USD · 美元");
  });

  it("diagnoses valid data warnings errors duplicate ids and unknown currencies", () => {
    const valid = [enabledItem("Valid", "2026-07-08")];
    assert.equal(diagnoseSubscriptions(valid).ok, true);

    const report = diagnoseSubscriptions([
      { ...enabledItem("Duplicate", "2026-07-08"), id: "same" },
      { ...enabledItem("Duplicate 2", "2026-07-09"), id: "same", currency: "XYZ" },
      { id: "", name: "", category: "云服务", amount: -1, currency: "USD", billingCycle: "monthly", startDate: "2026-02-31", nextRenewalDate: "bad-date", isEnabled: "yes" }
    ]);

    assert.equal(report.ok, false);
    assert.equal(report.issues.some((issue) => issue.type === "empty_name" && issue.level === "error"), true);
    assert.equal(report.issues.some((issue) => issue.type === "invalid_amount" && issue.level === "error"), true);
    assert.equal(report.issues.some((issue) => issue.type === "invalid_next_renewal_date" && issue.level === "error"), true);
    assert.equal(report.issues.some((issue) => issue.type === "duplicate_id" && issue.level === "error"), true);
    assert.equal(report.issues.some((issue) => issue.type === "unknown_currency" && issue.level === "warning"), true);
  });

  it("checks data integrity without modifying the data file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "subscription-integrity-"));
    const dataFile = join(dir, "subscriptions.json");
    const original = JSON.stringify([{ ...enabledItem("Unknown", "2026-07-08"), currency: "XYZ" }], null, 2);
    await writeFile(dataFile, original, "utf8");

    const report = await getDataIntegrityReport(dataFile, { now: new Date(2026, 6, 5, 12, 0, 0) });
    assert.equal(report.ok, true);
    assert.equal(report.summary.warnings, 1);
    assert.equal(await readFile(dataFile, "utf8"), original);
  });

  it("creates escaped ICS renewal events for enabled subscriptions only", () => {
    const ics = createRenewalCalendarICS([
      { ...enabledItem("ChatGPT, Plus", "2026-07-05"), notes: "Line 1\nLine 2; test" },
      { ...enabledItem("Disabled", "2026-07-05"), isEnabled: false },
      { ...cycleItem("oneTime", 99, "CNY"), id: "once", name: "One Time", nextRenewalDate: "2026-07-06", isRenewalDateManuallyAdjusted: true }
    ], { referenceDate: "2026-07-05", generatedAt: new Date("2026-07-05T00:00:00Z") });

    assert.equal(ics.includes("BEGIN:VCALENDAR"), true);
    assert.equal(ics.includes("订阅续费：ChatGPT\\, Plus"), true);
    assert.equal(ics.includes("Disabled"), false);
    assert.equal(ics.includes("订阅续费：One Time（一次性）"), true);
    assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length >= 13, true);
    assert.equal(ics.includes("Line 1\\nLine 2\\; test"), true);
  });
});

describe("subscription data backups", () => {

  it("generates manual backup file names", () => {
    assert.equal(manualBackupFileName(new Date(2026, 6, 5, 9, 30, 12)), "subscriptions-manual-backup-2026-07-05-09-30-12.json");
  });

  it("creates manual backups and includes them in pruning", async () => {
    const dir = await mkdtemp(join(tmpdir(), "subscription-manual-backup-"));
    const dataFile = join(dir, "subscriptions.json");
    for (let index = 1; index <= 21; index += 1) {
      await createManualBackup(dataFile, [enabledItem("A", "2026-07-02")], { now: new Date(2026, 6, 5, 9, 30, index) });
    }
    const backups = await listBackupFiles(join(dir, "backups"));
    assert.equal(backups.length, 20);
    assert.equal(backups[0].type.label, "手动备份");
  });

  it("downloads an existing backup and rejects missing or traversal downloads", async () => {
    const dir = await mkdtemp(join(tmpdir(), "subscription-download-backup-"));
    const backupDir = join(dir, "backups");
    await mkdir(backupDir, { recursive: true });
    const name = "subscriptions-backup-2026-07-05-09-30-12.json";
    await writeFile(join(backupDir, name), "[]", "utf8");
    const download = await readBackupDownload(backupDir, name);
    assert.equal(download.fileName, name);
    assert.equal(download.content, "[]");
    await assert.rejects(() => readBackupDownload(backupDir, "subscriptions-backup-2026-07-05-09-30-13.json"), { code: "ENOENT" });
    await assert.rejects(() => readBackupDownload(backupDir, "../" + name), /备份文件名不合法/);
  });

  it("creates manual backups through the server helper", async () => {
    const dir = await mkdtemp(join(tmpdir(), "subscription-manual-helper-"));
    const dataFile = join(dir, "subscriptions.json");
    await writeFile(dataFile, JSON.stringify([enabledItem("Current", "2026-07-08")]), "utf8");
    const backup = await createManualBackupForDataFile(dataFile, { now: new Date(2026, 6, 5, 9, 30, 12) });
    assert.equal(backup.fileName, "subscriptions-manual-backup-2026-07-05-09-30-12.json");
    assert.equal(backup.subscriptionCount, 1);
  });

  it("restores uploaded backups and protects current data first", async () => {
    const dir = await mkdtemp(join(tmpdir(), "subscription-upload-restore-"));
    const dataFile = join(dir, "subscriptions.json");
    await writeFile(dataFile, JSON.stringify([enabledItem("Current", "2026-07-08")]), "utf8");
    await restoreUploadedBackupToDataFile(dataFile, JSON.stringify([enabledItem("Uploaded", "2026-07-12")]), { now: new Date(2026, 6, 5, 9, 40, 0) });
    const data = JSON.parse(await readFile(dataFile, "utf8"));
    const backups = await readdir(join(dir, "backups"));
    assert.equal(data[0].name, "Uploaded");
    assert.equal(backups.includes("subscriptions-before-restore-2026-07-05-09-40-00.json"), true);
  });

  it("does not overwrite current data when uploaded backup JSON or structure is invalid", async () => {
    const dir = await mkdtemp(join(tmpdir(), "subscription-upload-invalid-"));
    const dataFile = join(dir, "subscriptions.json");
    await writeFile(dataFile, JSON.stringify([enabledItem("Current", "2026-07-08")]), "utf8");
    await assert.rejects(() => restoreUploadedBackupToDataFile(dataFile, "{broken"), /JSON 格式无效/);
    await assert.rejects(() => restoreUploadedBackupToDataFile(dataFile, JSON.stringify({ bad: true })), /订阅数据结构不符合要求/);
    const data = JSON.parse(await readFile(dataFile, "utf8"));
    assert.equal(data[0].name, "Current");
  });

  it("quickly enables and disables subscriptions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "subscription-toggle-"));
    const dataFile = join(dir, "subscriptions.json");
    const item = { ...enabledItem("Toggle", "2026-07-08"), isEnabled: true };
    await writeFile(dataFile, JSON.stringify([item]), "utf8");
    let result = await updateSubscriptionEnabled(dataFile, item.id, false);
    assert.equal(result.item.isEnabled, false);
    result = await updateSubscriptionEnabled(dataFile, item.id, true);
    assert.equal(result.item.isEnabled, true);
  });

  it("renews subscriptions through the server helper", async () => {
    const dir = await mkdtemp(join(tmpdir(), "subscription-renew-helper-"));
    const dataFile = join(dir, "subscriptions.json");
    const item = enabledItem("Renew", "2026-01-01");
    await writeFile(dataFile, JSON.stringify([item]), "utf8");
    const result = await renewSubscriptionById(dataFile, item.id, "2026-07-05", new Date(2026, 6, 5));
    assert.equal(result.item.nextRenewalDate > "2026-07-05", true);
  });

  it("rejects invalid import structures without overwriting current data", async () => {
    const dir = await mkdtemp(join(tmpdir(), "subscription-import-invalid-"));
    const dataFile = join(dir, "subscriptions.json");
    await writeFile(dataFile, JSON.stringify([enabledItem("Current", "2026-07-08")]), "utf8");
    await assert.rejects(() => importJSONTextToDataFile(dataFile, JSON.stringify([{ name: "Bad", amount: -1, currency: "USD", billingCycle: "monthly", startDate: "2026-07-02" }])), /订阅数据结构不符合要求/);
    const data = JSON.parse(await readFile(dataFile, "utf8"));
    assert.equal(data[0].name, "Current");
  });

  it("generates timestamped backup file names", () => {
    assert.equal(
      backupFileName(new Date(2026, 6, 2, 8, 9, 5)),
      "subscriptions-backup-2026-07-02-08-09-05.json"
    );
  });

  it("keeps only the newest 20 backup files", async () => {
    const backupDir = await mkdtemp(join(tmpdir(), "subscription-backups-"));
    await mkdir(backupDir, { recursive: true });

    for (let index = 1; index <= 25; index += 1) {
      await writeFile(
        join(backupDir, "subscriptions-backup-2026-07-02-00-00-" + String(index).padStart(2, "0") + ".json"),
        "[]\n",
        "utf8"
      );
    }

    const deleted = await pruneBackups(backupDir, 20);
    const remaining = (await readdir(backupDir)).filter((name) => name.endsWith(".json")).sort();
    assert.equal(deleted.length, 5);
    assert.equal(remaining.length, 20);
    assert.equal(remaining[0], "subscriptions-backup-2026-07-02-00-00-06.json");
  });

  it("creates a backup and prunes old files after saving data", async () => {
    const dir = await mkdtemp(join(tmpdir(), "subscription-data-"));
    const dataFile = join(dir, "subscriptions.json");
    const backupPath = await createDataBackup(dataFile, [enabledItem("A", "2026-07-02")], {
      now: new Date(2026, 6, 2, 8, 9, 5)
    });

    assert.equal(backupPath.endsWith("subscriptions-backup-2026-07-02-08-09-05.json"), true);
  });

  it("lists backup files with newest first and keeps damaged backups visible", async () => {
    const backupDir = await mkdtemp(join(tmpdir(), "subscription-list-backups-"));
    const older = "subscriptions-backup-2026-07-02-00-00-01.json";
    const newer = "subscriptions-backup-2026-07-03-00-00-01.json";
    const damaged = "subscriptions-backup-2026-07-04-00-00-01.json";
    await writeFile(join(backupDir, older), JSON.stringify([enabledItem("Older", "2026-07-10")]), "utf8");
    await writeFile(join(backupDir, newer), JSON.stringify([enabledItem("Newer", "2026-07-11"), enabledItem("Two", "2026-07-12")]), "utf8");
    await writeFile(join(backupDir, damaged), "{broken", "utf8");
    await writeFile(join(backupDir, "not-a-backup.json"), "[]", "utf8");

    const backups = await listBackupFiles(backupDir);
    assert.deepEqual(backups.map((backup) => backup.fileName), [damaged, newer, older]);
    assert.equal(backups[0].isValid, false);
    assert.equal(backups[0].error, "Invalid JSON");
    assert.equal(backups[1].subscriptionCount, 2);
  });

  it("previews a valid backup and rejects a damaged backup", async () => {
    const backupDir = await mkdtemp(join(tmpdir(), "subscription-preview-backups-"));
    const valid = "subscriptions-backup-2026-07-05-09-30-12.json";
    const damaged = "subscriptions-backup-2026-07-05-09-31-12.json";
    await writeFile(join(backupDir, valid), JSON.stringify([enabledItem("Preview", "2026-07-10")]), "utf8");
    await writeFile(join(backupDir, damaged), "{broken", "utf8");

    const preview = await readBackupFile(backupDir, valid);
    assert.equal(preview.fileName, valid);
    assert.equal(preview.subscriptionCount, 1);
    await assert.rejects(() => readBackupFile(backupDir, damaged), /Invalid JSON/);
  });

  it("rejects path traversal when reading a backup", async () => {
    const backupDir = await mkdtemp(join(tmpdir(), "subscription-safe-backups-"));
    await assert.rejects(() => readBackupFile(backupDir, "../subscriptions-backup-2026-07-05-09-30-12.json"), /备份文件名不合法/);
  });

  it("restores a valid backup and creates a before-restore backup", async () => {
    const dir = await mkdtemp(join(tmpdir(), "subscription-restore-"));
    const dataFile = join(dir, "subscriptions.json");
    const backupDir = join(dir, "backups");
    await mkdir(backupDir, { recursive: true });
    await writeFile(dataFile, JSON.stringify([enabledItem("Current", "2026-07-08")]), "utf8");
    const backupName = "subscriptions-backup-2026-07-05-09-30-12.json";
    await writeFile(join(backupDir, backupName), JSON.stringify([enabledItem("Restored", "2026-07-10")]), "utf8");

    const result = await restoreBackupToDataFile(dataFile, backupName, { now: new Date(2026, 6, 5, 9, 40, 0) });
    const data = JSON.parse(await readFile(dataFile, "utf8"));
    const files = await readdir(backupDir);
    assert.equal(result.restoredCount, 1);
    assert.equal(data[0].name, "Restored");
    assert.equal(files.includes("subscriptions-before-restore-2026-07-05-09-40-00.json"), true);
  });

  it("does not overwrite current data when restoring a damaged backup", async () => {
    const dir = await mkdtemp(join(tmpdir(), "subscription-restore-damaged-"));
    const dataFile = join(dir, "subscriptions.json");
    const backupDir = join(dir, "backups");
    await mkdir(backupDir, { recursive: true });
    await writeFile(dataFile, JSON.stringify([enabledItem("Current", "2026-07-08")]), "utf8");
    const backupName = "subscriptions-backup-2026-07-05-09-30-12.json";
    await writeFile(join(backupDir, backupName), "{broken", "utf8");

    await assert.rejects(() => restoreBackupToDataFile(dataFile, backupName), /备份文件 JSON 格式无效/);
    const data = JSON.parse(await readFile(dataFile, "utf8"));
    assert.equal(data[0].name, "Current");
  });

  it("creates a before-import backup and rejects invalid import JSON without overwriting current data", async () => {
    const dir = await mkdtemp(join(tmpdir(), "subscription-import-"));
    const dataFile = join(dir, "subscriptions.json");
    await writeFile(dataFile, JSON.stringify([enabledItem("Current", "2026-07-08")]), "utf8");

    await importJSONTextToDataFile(dataFile, JSON.stringify([enabledItem("Imported", "2026-07-11")]), { now: new Date(2026, 6, 5, 10, 0, 0) });
    let data = JSON.parse(await readFile(dataFile, "utf8"));
    let backups = await readdir(join(dir, "backups"));
    assert.equal(data[0].name, "Imported");
    assert.equal(backups.includes("subscriptions-before-import-2026-07-05-10-00-00.json"), true);

    await assert.rejects(() => importJSONTextToDataFile(dataFile, "{broken"), /JSON 格式无效/);
    data = JSON.parse(await readFile(dataFile, "utf8"));
    assert.equal(data[0].name, "Imported");
  });

  it("returns normalized preview data through the server helper", async () => {
    const dir = await mkdtemp(join(tmpdir(), "subscription-preview-helper-"));
    const dataFile = join(dir, "subscriptions.json");
    const backupDir = join(dir, "backups");
    await mkdir(backupDir, { recursive: true });
    const backupName = "subscriptions-backup-2026-07-05-09-30-12.json";
    await writeFile(join(backupDir, backupName), JSON.stringify([enabledItem("Preview", "2026-07-10")]), "utf8");

    const preview = await getBackupPreview(dataFile, backupName);
    assert.equal(preview.subscriptionCount, 1);
    assert.equal(typeof preview.subscriptions[0].renewalStatus.label, "string");
  });
});

describe("subscription http API", () => {
  it("returns integrity and calendar ICS responses with expected headers", async () => {
    const dir = await mkdtemp(join(tmpdir(), "subscription-http-"));
    const dataFile = join(dir, "subscriptions.json");
    await writeFile(dataFile, JSON.stringify([
      enabledItem("Calendar", "2026-07-08"),
      { ...enabledItem("Off", "2026-07-08"), isEnabled: false }
    ]), "utf8");

    const server = createApp({ dataFile, publicDir: dir });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const integrityResponse = await fetch(baseUrl + "/api/integrity");
      const integrity = await integrityResponse.json();
      assert.equal(integrityResponse.status, 200);
      assert.equal(integrity.ok, true);

      const calendarResponse = await fetch(baseUrl + "/api/calendar.ics");
      const ics = await calendarResponse.text();
      assert.equal(calendarResponse.status, 200);
      assert.equal(calendarResponse.headers.get("content-type").startsWith("text/calendar"), true);
      assert.equal(calendarResponse.headers.get("content-disposition"), 'attachment; filename="subscriptions-renewals.ics"');
      assert.equal(ics.includes("订阅续费：Calendar"), true);
      assert.equal(ics.includes("订阅续费：Off"), false);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});

function enabledItem(name, nextRenewalDate) {
  return normalizeSubscription({
    id: name,
    name,
    category: "云服务",
    amount: 10,
    currency: "USD",
    billingCycle: "monthly",
    startDate: "2026-07-02",
    nextRenewalDate,
    isRenewalDateManuallyAdjusted: true,
    isEnabled: true
  }, null, new Date(2026, 6, 2));
}

function cycleItem(billingCycle, amount, currency = "USD") {
  return normalizeSubscription({
    id: billingCycle + amount + currency,
    name: billingCycle,
    category: "效率工具",
    amount,
    currency,
    billingCycle,
    startDate: "2026-07-02",
    isEnabled: true
  }, null, new Date(2026, 6, 2));
}
