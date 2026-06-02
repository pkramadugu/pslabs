const path = require("node:path");

const buckets = new Map();

const windowMs = () => Number(process.env.API_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const maxRequests = (key) => {
  const defaults = {
    skincare: Number(process.env.API_RATE_LIMIT_SKINCARE_MAX || 20),
    thyrocare: Number(process.env.API_RATE_LIMIT_THYROCARE_MAX || 60)
  };
  return defaults[key] ?? Number(process.env.API_RATE_LIMIT_MAX || 60);
};

const clientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim().slice(0, 80);
  }
  return String(req.socket?.remoteAddress || "unknown").slice(0, 80);
};

const rateLimitKey = (req, bucket) => `${bucket}:${clientIp(req)}`;

const isRateLimited = (req, bucket) => {
  const key = rateLimitKey(req, bucket);
  const now = Date.now();
  const limit = maxRequests(bucket);
  const entry = buckets.get(key);

  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs() });
    return false;
  }

  entry.count += 1;
  if (entry.count > limit) {
    return true;
  }

  return false;
};

const requiredApiKey = () => process.env.PSLABS_API_KEY;

const hasValidApiKey = (req) => {
  const expected = requiredApiKey();
  if (!expected) return true;

  const headerKey = req.headers["x-pslabs-api-key"];
  if (headerKey && headerKey === expected) return true;

  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ") && auth.slice(7) === expected) return true;

  return false;
};

const isStaticPathAllowed = (root, filePath) => {
  const relative = path.relative(root, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return false;
  }

  const segments = relative.split(path.sep);
  if (segments.some((segment) => segment.startsWith("."))) {
    return false;
  }

  if (segments[0] === "api" || segments[0] === "lib") {
    return false;
  }

  return true;
};

const jsonError = (res, statusCode, body) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

const guardApiRequest = (req, res, bucket) => {
  if (!hasValidApiKey(req)) {
    jsonError(res, 401, { error: "Unauthorized" });
    return false;
  }

  if (isRateLimited(req, bucket)) {
    jsonError(res, 429, { error: "Too many requests. Try again later." });
    return false;
  }

  return true;
};

module.exports = {
  clientIp,
  guardApiRequest,
  isStaticPathAllowed,
  requiredApiKey
};
