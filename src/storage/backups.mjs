import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

export const maxBackupFiles = 20;

const backupNamePattern = /^subscriptions-(backup|before-restore|before-import)-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.json$/;

export function backupDirectoryFor(dataFile) {
  return join(dirname(dataFile), "backups");
}

export function backupFileName(now = new Date()) {
  return timestampedBackupFileName("backup", now);
}

export function beforeRestoreBackupFileName(now = new Date()) {
  return timestampedBackupFileName("before-restore", now);
}

export function beforeImportBackupFileName(now = new Date()) {
  return timestampedBackupFileName("before-import", now);
}

export function isManagedBackupFileName(fileName) {
  return typeof fileName === "string" && basename(fileName) === fileName && backupNamePattern.test(fileName);
}

export function safeBackupPath(backupDir, fileName) {
  if (!isManagedBackupFileName(fileName)) {
    const error = new Error("备份文件名不合法");
    error.code = "INVALID_BACKUP_FILE_NAME";
    throw error;
  }

  const resolvedDir = resolve(backupDir);
  const resolvedFile = resolve(resolvedDir, fileName);
  if (!resolvedFile.startsWith(resolvedDir + "/")) {
    const error = new Error("备份文件路径不可访问");
    error.code = "INVALID_BACKUP_FILE_NAME";
    throw error;
  }

  return resolvedFile;
}

export async function createDataBackup(dataFile, items, options = {}) {
  const backupDir = options.backupDir ?? backupDirectoryFor(dataFile);
  const now = options.now ?? new Date();
  const fileName = options.fileName ?? backupFileName(now);
  await mkdir(backupDir, { recursive: true });

  const targetFile = safeBackupPath(backupDir, fileName);
  await writeFile(targetFile, JSON.stringify(items, null, 2) + "\n", "utf8");
  await pruneBackups(backupDir, options.maxFiles ?? maxBackupFiles);
  return targetFile;
}

export async function createBeforeRestoreBackup(dataFile, items, options = {}) {
  const now = options.now ?? new Date();
  return createDataBackup(dataFile, items, {
    ...options,
    now,
    fileName: options.fileName ?? beforeRestoreBackupFileName(now)
  });
}

export async function createBeforeImportBackup(dataFile, items, options = {}) {
  const now = options.now ?? new Date();
  return createDataBackup(dataFile, items, {
    ...options,
    now,
    fileName: options.fileName ?? beforeImportBackupFileName(now)
  });
}

export async function listBackupFiles(backupDir) {
  let entries;
  try {
    entries = await readdir(backupDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const backups = [];
  for (const entry of entries) {
    if (!entry.isFile() || !isManagedBackupFileName(entry.name)) {
      continue;
    }

    backups.push(await describeBackupFile(backupDir, entry.name));
  }

  return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.fileName.localeCompare(a.fileName));
}

export async function readBackupFile(backupDir, fileName) {
  const filePath = safeBackupPath(backupDir, fileName);
  const [fileStat, text] = await Promise.all([stat(filePath), readFile(filePath, "utf8")]);
  const parsed = parseBackupJSON(text);
  return {
    fileName,
    createdAt: createdAtFromFileName(fileName),
    size: fileStat.size,
    subscriptionCount: parsed.length,
    subscriptions: parsed
  };
}

export async function pruneBackups(backupDir, maxFiles = maxBackupFiles) {
  const entries = await readdir(backupDir, { withFileTypes: true });
  const backupFiles = entries
    .filter((entry) => entry.isFile() && isManagedBackupFileName(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => createdAtFromFileName(a).localeCompare(createdAtFromFileName(b)) || a.localeCompare(b));

  const filesToDelete = backupFiles.slice(0, Math.max(0, backupFiles.length - maxFiles));
  await Promise.all(filesToDelete.map((fileName) => unlink(join(backupDir, fileName))));
  return filesToDelete;
}

async function describeBackupFile(backupDir, fileName) {
  const filePath = safeBackupPath(backupDir, fileName);
  const fileStat = await stat(filePath);
  const base = {
    fileName,
    createdAt: createdAtFromFileName(fileName),
    size: fileStat.size
  };

  try {
    const parsed = parseBackupJSON(await readFile(filePath, "utf8"));
    return {
      ...base,
      subscriptionCount: parsed.length,
      isValid: true
    };
  } catch (error) {
    return {
      ...base,
      subscriptionCount: 0,
      isValid: false,
      error: error.message
    };
  }
}

function parseBackupJSON(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const error = new Error("Invalid JSON");
    error.code = "INVALID_JSON";
    throw error;
  }

  if (!Array.isArray(parsed)) {
    const error = new Error("订阅数据结构不符合要求");
    error.code = "INVALID_SUBSCRIPTION_DATA";
    throw error;
  }

  return parsed;
}

function timestampedBackupFileName(kind, now) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    "subscriptions-",
    kind,
    "-",
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

function createdAtFromFileName(fileName) {
  const match = fileName.match(backupNamePattern);
  if (!match) {
    return new Date(0).toISOString();
  }

  const [, , year, month, day, hour, minute, second] = match.map((value, index) => index < 2 ? value : Number(value));
  return new Date(year, month - 1, day, hour, minute, second).toISOString();
}
