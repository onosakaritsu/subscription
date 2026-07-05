import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  calculateNextRenewalDate,
  exportSubscriptionFileName,
  monthlyEquivalent,
  normalizeSubscription,
  renewalCalendarGroups,
  renewalStatus,
  sortForManagement,
  summarizeSubscriptions,
  upcomingRenewals,
  yearlyEquivalent
} from "../src/domain/subscriptions.mjs";
import {
  backupFileName,
  createDataBackup,
  listBackupFiles,
  pruneBackups,
  readBackupFile
} from "../src/storage/backups.mjs";
import {
  getBackupPreview,
  importJSONTextToDataFile,
  restoreBackupToDataFile
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

  it("formats export file names with the local date", () => {
    assert.equal(
      exportSubscriptionFileName(new Date(2026, 6, 2, 8, 9, 5)),
      "subscriptions-backup-2026-07-02.json"
    );
  });
});

describe("subscription data backups", () => {
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
