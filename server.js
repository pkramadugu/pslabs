const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const skincareAppointmentHandler = require("./api/skincare-appointment");
const { guardApiRequest, isStaticPathAllowed } = require("./lib/guard");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const loadLocalEnv = async () => {
  const envPath = path.join(root, ".env.local");
  try {
    const raw = await fs.readFile(envPath, "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const separator = trimmed.indexOf("=");
      if (separator === -1) return;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    // .env.local is optional; production hosts should use real environment variables.
  }
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

const send = (res, statusCode, body, contentType = "text/plain; charset=utf-8") => {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(body);
};

const requestPath = (req) => {
  return new URL(req.url || "/", "http://localhost").pathname;
};

const redirectToSkincare = (res) => {
  res.writeHead(308, { Location: "/skincare/" });
  res.end();
};

const isSkincarePath = (pathname) => {
  return pathname === "/skincare" || pathname.startsWith("/skincare/");
};

const fileForUrl = (urlPath) => {
  const safePath = decodeURIComponent(urlPath).split("?")[0];
  const normalized = path.normalize(safePath).replace(/^(\.\.[/\\])+/, "");
  const relative = normalized === "/" ? "index.html" : normalized.replace(/^[/\\]/, "");
  return relative.endsWith("/") ? path.join(root, relative, "index.html") : path.join(root, relative);
};

const isSeoRootFile = (pathname) => {
  return pathname === "/robots.txt" || pathname === "/sitemap.xml";
};

const serveStatic = async (req, res) => {
  let filePath = fileForUrl(req.url || "/");

  if (!isStaticPathAllowed(root, filePath)) {
    send(res, 404, "Not found");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (!isStaticPathAllowed(root, filePath)) {
      send(res, 404, "Not found");
      return;
    }
    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    const body = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, body, contentTypes[ext] || "application/octet-stream");
  } catch (error) {
    send(res, 404, "Not found");
  }
};

loadLocalEnv().then(() => {
  const server = http.createServer(async (req, res) => {
    const pathname = requestPath(req);

    if (pathname.startsWith("/api/skincare-appointment")) {
      if (!guardApiRequest(req, res, "skincare")) return;
      await skincareAppointmentHandler(req, res);
      return;
    }

    if (pathname === "/skincare") {
      redirectToSkincare(res);
      return;
    }

    if (isSkincarePath(pathname) || isSeoRootFile(pathname)) {
      await serveStatic(req, res);
      return;
    }

    redirectToSkincare(res);
  });

  server.listen(port, host, () => {
    console.log(`PSLabs server running at http://${host}:${port}/`);
  });
});
