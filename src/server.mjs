import { createServer as createHttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, rename, stat, writeFile, mkdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import {
  normalizeSubscription,
  sortForManagement,
  summarizeSubscriptions
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
    sendJSON(response, 200, {
      items,
      summary: summarizeSubscriptions(items)
    });
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
      "Content-Disposition": "attachment; filename=\"subscriptions.json\""
    });
    response.end(JSON.stringify(items, null, 2));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/import") {
    const body = await readJSONBody(request);
    if (!Array.isArray(body)) {
      throw httpError(400, "导入内容必须是订阅数组");
    }

    const now = new Date();
    const items = body.map((item) => normalizeSubscription({
      ...item,
      id: item.id || randomUUID()
    }, null, now));
    await saveItems(context.dataFile, items);
    sendJSON(response, 200, { items: sortForManagement(items) });
    return;
  }

  throw httpError(404, "接口不存在");
}

async function loadItems(dataFile) {
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

async function saveItems(dataFile, items) {
  await mkdir(resolve(dataFile, ".."), { recursive: true });
  const tempFile = `${dataFile}.${process.pid}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(sortForManagement(items), null, 2)}\n`, "utf8");
  await rename(tempFile, dataFile);
}

async function readJSONBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) {
      throw httpError(413, "请求体过大");
    }
    chunks.push(chunk);
  }

  try {
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
  } catch {
    throw httpError(400, "JSON 格式无效");
  }
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
