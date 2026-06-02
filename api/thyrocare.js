const STAGING_BASE_URL = "https://api-sandbox.thyrocare.com";
const { randomUUID } = require("node:crypto");

let cachedToken = "";
let cachedTokenExpiry = 0;

const requiredEnv = [
  "THYROCARE_PARTNER_ID",
  "THYROCARE_USERNAME",
  "THYROCARE_PASSWORD"
];

const hasCredentials = () => requiredEnv.every((key) => process.env[key]);

const jsonResponse = (res, statusCode, body) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

const requestId = () => {
  return randomUUID();
};

const baseHeaders = (includeEntityType = false) => {
  const headers = {
    "Partner-Id": process.env.THYROCARE_PARTNER_ID,
    "Request-Id": requestId(),
    "User-Agent": process.env.THYROCARE_USER_AGENT || "PSLabs-Web",
    "Client-Type": process.env.THYROCARE_CLIENT_TYPE || "web",
    "Content-Type": "application/json"
  };

  if (includeEntityType) {
    headers["Entity-Type"] = process.env.THYROCARE_ENTITY_TYPE || "DSA";
  }

  return headers;
};

const thyrocareBaseUrl = () => process.env.THYROCARE_BASE_URL || STAGING_BASE_URL;

const login = async () => {
  if (cachedToken && cachedTokenExpiry > Date.now() + 60000) {
    return cachedToken;
  }

  const response = await fetch(`${thyrocareBaseUrl()}/partners/v1/auth/login`, {
    method: "POST",
    headers: baseHeaders(true),
    body: JSON.stringify({
      username: process.env.THYROCARE_USERNAME,
      password: process.env.THYROCARE_PASSWORD
    })
  });

  const data = await response.json();

  if (!response.ok || !data.token) {
    throw new Error(data?.errors?.[0]?.message || "Unable to authenticate with Thyrocare");
  }

  cachedToken = data.token;
  cachedTokenExpiry = Date.now() + 30 * 60 * 1000;
  return cachedToken;
};

const thyrocareFetch = async (path, options = {}) => {
  const token = await login();
  const response = await fetch(`${thyrocareBaseUrl()}${path}`, {
    method: options.method || "GET",
    headers: {
      ...baseHeaders(false),
      Authorization: `Bearer ${token}`
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data?.errors?.[0]?.message || `Thyrocare API failed with ${response.status}`;
    const apiError = new Error(message);
    apiError.statusCode = response.status;
    apiError.body = data;
    throw apiError;
  }

  return data;
};

const handlers = {
  session: async () => {
    await login();
    return {
      authenticated: true,
      environment: thyrocareBaseUrl() === STAGING_BASE_URL ? "staging" : "custom",
      message: "Authenticated with Thyrocare"
    };
  },
  catalog: (payload = {}) => {
    const params = new URLSearchParams({
      minPrice: String(payload.minPrice ?? 0),
      maxPrice: String(payload.maxPrice ?? 10000),
      gender: String(payload.gender || "MALE"),
      page: String(payload.page || 1),
      pageSize: String(payload.pageSize || 12)
    });
    return thyrocareFetch(`/partners/v1/catalog/products?${params.toString()}`);
  },
  pincodes: () => thyrocareFetch("/partners/v1/serviceability/pincodes"),
  priceBreakup: (payload) => thyrocareFetch("/partners/v1/cart/price-breakup", {
    method: "POST",
    body: payload
  }),
  slots: (payload) => thyrocareFetch("/partners/v1/slots/search", {
    method: "POST",
    body: payload
  }),
  createOrder: (payload) => thyrocareFetch("/partners/v1/orders", {
    method: "POST",
    body: payload
  }),
  orderDetails: (payload = {}) => {
    if (!payload.orderId) throw new Error("orderId is required");
    return thyrocareFetch(`/partners/v1/orders/${encodeURIComponent(payload.orderId)}?include=tracking,items,price`);
  },
  report: (payload = {}) => {
    if (!payload.orderId || !payload.leadId) throw new Error("orderId and leadId are required");
    const type = payload.type || "pdf";
    return thyrocareFetch(`/partners/v1/${encodeURIComponent(payload.orderId)}/reports/${encodeURIComponent(payload.leadId)}?type=${encodeURIComponent(type)}`);
  }
};

const readRequestBody = async (req) => {
  if (req.body) {
    return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
  }

  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
  }

  return raw ? JSON.parse(raw) : {};
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    jsonResponse(res, 405, { error: "Use POST" });
    return;
  }

  if (!hasCredentials()) {
    jsonResponse(res, 501, {
      error: "Thyrocare staging credentials are not configured",
      requiredEnv,
      stagingBaseUrl: STAGING_BASE_URL
    });
    return;
  }

  try {
    const body = await readRequestBody(req);
    const action = body.action;
    const handler = handlers[action];

    if (!handler) {
      jsonResponse(res, 400, { error: "Unsupported action", actions: Object.keys(handlers) });
      return;
    }

    const data = await handler(body.payload || {});
    jsonResponse(res, 200, data);
  } catch (error) {
    const payload = { error: error.message };
    if (process.env.PSLABS_DEBUG_ERRORS === "true") {
      payload.details = error.body;
    }
    jsonResponse(res, error.statusCode || 500, payload);
  }
};
