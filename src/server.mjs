import { createServer as createHttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, rename, stat, writeFile, mkdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import {
  backupDirectoryFor,
  createBeforeImportBackup,
  createBeforeRestoreBackup,
  createDataBackup,
  listBackupFiles,
  readBackupFile
} from "./storage/backups.mjs";
import {
  normalizeSubscription,
  sortForManagement,
  summarizeSubscriptions,
  exportSubscriptionFileName
} from "./domain/subscriptions.mjs";

const projectRoot = resolve(new URL("..", import.meta.url).pathname);
const defaultPublicDir = join(projectRoot, "public");
const defaultDataFile = join(projectRoot, "data", "subscriptions.json");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

export function createApp(options = {}) {
  const publicDir = options.publicDir ?? defaultPublicDir;
  const dataFile = options.dataFile ?? process.env.SUBSCRIPTIONS_DATA_FILE ?? defaultDataFile;

  return createHttpServer(async (request, response) => {
    try {
      await routeRequest(request, response, { publicDir, dataFile });
    } catch (error) {
      sendJSON(response, error.statusCode || 500, {
        error: error.statusCode ? error.message : "服务器内部错误"
      });
    }
  });
}

export function startServer(options = {}) {
  const port = Number(options.port ?? process.env.PORT ?? 5173);
  const host = options.host ?? process.env.HOST ?? "127.0.0.1";
  const server = createApp(options);

  server.listen(port, host, () => {
    const address = server.address();
    console.log(`Subscription Web App running at http://${address.address}:${address.port}`);
  });

  return server;
}

async function routeRequest(request, response, context) {
  const url = new URL(request.url, "http://localhost");

  if (url.pathname.startsWith("/api/")) {
    await routeAPI(request, response, url, context);
    return;
  }

  await serveStatic(request, response, url, context.publicDir);
}

async function routeAPI(request, response, url, context) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJSON(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/subscriptions") {
    const items = sortForManagement(await loadItems(context.dataFile));
    const summary = summarizeSubscriptions(items);
    sendJSON(response, 200, {
      items,
      summary,
      calendar: summary.calendar
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/backups") {
    const backups = await listBackupFiles(backupDirectoryFor(context.dataFile));
    sendJSON(response, 200, { backups });
    return;
  }

  const backupMatch = url.pathname.match(/^\/api\/backups\/([^/]+)$/);
  if (backupMatch && request.method === "GET") {
    const fileName = decodeURIComponent(backupMatch[1]);
    const backup = await getBackupPreview(context.dataFile, fileName);
    sendJSON(response, 200, backup);
    return;
  }

  const restoreMatch = url.pathname.match(/^\/api\/backups\/([^/]+)\/restore$/);
  if (restoreMatch && request.method === "POST") {
    const fileName = decodeURIComponent(restoreMatch[1]);
    const result = await restoreBackupToDataFile(context.dataFile, fileName);
    sendJSON(response, 200, result);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/subscriptions") {
    const body = await readJSONBody(request);
    const items = await loadItems(context.dataFile);
    const item = normalizeSubscription({ ...body, id: randomUUID() });
    items.push(item);
    await saveItems(context.dataFile, items);
    sendJSON(response, 201, { item });
    return;
  }

  const itemMatch = url.pathname.match(/^\/api\/subscriptions\/([^/]+)$/);
  if (itemMatch && request.method === "PUT") {
    const id = decodeURIComponent(itemMatch[1]);
    const body = await readJSONBody(request);
    const items = await loadItems(context.dataFile);
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) {
      throw httpError(404, "订阅不存在");
    }

    const item = normalizeSubscription({ ...body, id }, items[index]);
    items[index] = item;
    await saveItems(context.dataFile, items);
    sendJSON(response, 200, { item });
    return;
  }

  if (itemMatch && request.method === "DELETE") {
    const id = decodeURIComponent(itemMatch[1]);
    const items = await loadItems(context.dataFile);
    const nextItems = items.filter((item) => item.id !== id);
    if (nextItems.length === items.length) {
      throw httpError(404, "订阅不存在");
    }

    await saveItems(context.dataFile, nextItems);
    sendJSON(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/export") {
    const items = await loadItems(context.dataFile);
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportSubscriptionFileName()}"`
    });
    response.end(JSON.stringify(items, null, 2));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/import") {
    const textBody = await readTextBody(request);
    const result = await importJSONTextToDataFile(context.dataFile, textBody);
    sendJSON(response, 200, result);
    return;
  }

  throw httpError(404, "接口不存在");
}

export async function getBackupPreview(dataFile, fileName) {
  try {
    const preview = await readBackupFile(backupDirectoryFor(dataFile), fileName);
    return {
      ...preview,
      subscriptions: sortForManagement(validateSubscriptionArray(preview.subscriptions))
    };
  } catch (error) {
    throw backupHttpError(error);
  }
}

export async function restoreBackupToDataFile(dataFile, fileName, options = {}) {
  let preview;
  try {
    preview = await readBackupFile(backupDirectoryFor(dataFile), fileName);
  } catch (error) {
    throw backupHttpError(error);
  }

  const restoredItems = validateSubscriptionArray(preview.subscriptions, options.now);
  const currentItems = await loadItems(dataFile);
  const beforeRestoreBackup = await createBeforeRestoreBackup(dataFile, stripAllDerivedFields(currentItems), options);
  await saveItems(dataFile, restoredItems);
  console.log("Restored subscription data from backup " + fileName);

  return {
    ok: true,
    restoredFrom: fileName,
    restoredCount: restoredItems.length,
    beforeRestoreBackupFileName: beforeRestoreBackup.split("/").pop(),
    items: sortForManagement(restoredItems),
    summary: summarizeSubscriptions(restoredItems)
  };
}

export async function importJSONTextToDataFile(dataFile, textBody, options = {}) {
  const parsed = parseImportJSON(textBody);
  const items = validateSubscriptionArray(parsed, options.now);
  const currentItems = await loadItems(dataFile);
  const beforeImportBackup = await createBeforeImportBackup(dataFile, stripAllDerivedFields(currentItems), options);
  await saveItems(dataFile, items);
  return {
    items: sortForManagement(items),
    summary: summarizeSubscriptions(items),
    beforeImportBackupFileName: beforeImportBackup.split("/").pop()
  };
}

export function parseImportJSON(textBody) {
  try {
    return textBody ? JSON.parse(textBody) : {};
  } catch {
    throw httpError(400, "JSON 格式无效");
  }
}

export function validateSubscriptionArray(input, now = new Date()) {
  if (!Array.isArray(input)) {
    throw httpError(400, "订阅数据结构不符合要求");
  }

  try {
    return input.map((item) => normalizeSubscription({
      ...item,
      id: item.id || randomUUID()
    }, null, now));
  } catch {
    throw httpError(400, "订阅数据结构不符合要求");
  }
}

function backupHttpError(error) {
  if (error.code === "INVALID_BACKUP_FILE_NAME") {
    return httpError(400, "备份文件名不合法");
  }
  if (error.code === "ENOENT") {
    return httpError(404, "备份文件不存在");
  }
  if (error.code === "INVALID_JSON") {
    return httpError(400, "备份文件 JSON 格式无效");
  }
  if (error.code === "INVALID_SUBSCRIPTION_DATA") {
    return httpError(400, "订阅数据结构不符合要求");
  }
  return error;
}

export async function loadItems(dataFile) {
  try {
    const data = await readFile(dataFile, "utf8");
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      await saveItems(dataFile, []);
      return [];
    }
    throw error;
  }
}

export async function saveItems(dataFile, items) {
  await mkdir(resolve(dataFile, ".."), { recursive: true });
  const cleanItems = sortForManagement(items).map(stripDerivedFields);
  const tempFile = `${dataFile}.${process.pid}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(cleanItems, null, 2)}\n`, "utf8");
  await rename(tempFile, dataFile);

  try {
    await createDataBackup(dataFile, cleanItems);
  } catch (error) {
    console.error(`Failed to create subscription data backup: ${error.message}`);
  }
}

async function readTextBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) {
      throw httpError(413, "请求体过大");
    }
    chunks.push(chunk);
  }

  return chunks.length ? Buffer.concat(chunks).toString("utf8") : "";
}

async function readJSONBody(request) {
  return parseImportJSON(await readTextBody(request));
}

async function serveStatic(request, response, url, publicDir) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    throw httpError(405, "方法不支持");
  }

  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = normalize(join(publicDir, requestedPath));
  if (!filePath.startsWith(publicDir)) {
    throw httpError(403, "路径不可访问");
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      throw httpError(404, "页面不存在");
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream"
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw httpError(404, "页面不存在");
    }
    throw error;
  }
}

function stripAllDerivedFields(items) {
  return sortForManagement(items).map(stripDerivedFields);
}

function stripDerivedFields(item) {
  const { renewalStatus, renewalStatusText, ...cleanItem } = item;
  return cleanItem;
}


function sendJSON(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
