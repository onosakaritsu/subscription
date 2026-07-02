import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const maxBackupFiles = 20;

export function backupDirectoryFor(dataFile) {
  return join(dirname(dataFile), "backups");
}

export function backupFileName(now = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    "subscriptions-backup-",
    now.getFullYear(),
    "-",
    pad(now.getMonth() + 1),
    "-",
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    "-",
    pad(now.getMinutes()),
    "-",
    pad(now.getSeconds()),
    ".json"
  ].join("");
}

export async function createDataBackup(dataFile, items, options = {}) {
  const backupDir = options.backupDir ?? backupDirectoryFor(dataFile);
  const now = options.now ?? new Date();
  await mkdir(backupDir, { recursive: true });

  const targetFile = join(backupDir, backupFileName(now));
  await writeFile(targetFile, `${JSON.stringify(items, null, 2)}\n`, "utf8");
  await pruneBackups(backupDir, options.maxFiles ?? maxBackupFiles);
  return targetFile;
}

export async function pruneBackups(backupDir, maxFiles = maxBackupFiles) {
  const entries = await readdir(backupDir, { withFileTypes: true });
  const backupFiles = entries
    .filter((entry) => entry.isFile() && /^subscriptions-backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  const filesToDelete = backupFiles.slice(0, Math.max(0, backupFiles.length - maxFiles));
  await Promise.all(filesToDelete.map((fileName) => unlink(join(backupDir, fileName))));
  return filesToDelete;
}
