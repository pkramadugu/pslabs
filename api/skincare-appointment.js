const { createSign } = require("node:crypto");

let cachedGoogleToken = "";
let cachedGoogleTokenExpiry = 0;

const jsonResponse = (res, statusCode, body) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

const readRequestBody = async (req) => {
  let raw = "";

  for await (const chunk of req) {
    raw += chunk;
  }

  return raw ? JSON.parse(raw) : {};
};

const clean = (value, maxLength = 500) => {
  return String(value || "").trim().slice(0, maxLength);
};

const jsonOrText = async (response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    return { raw: text };
  }
};

const base64Url = (input) => {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};

const serviceAccountFromEnv = () => {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
  if (rawJson) {
    const parsed = JSON.parse(rawJson);
    return {
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key ? parsed.private_key.replace(/\\n/g, "\n") : ""
    };
  }

  return {
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY_BASE64
      ? Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, "base64").toString("utf8")
      : process.env.GOOGLE_PRIVATE_KEY
  };
};

const googleConfig = () => {
  const serviceAccount = serviceAccountFromEnv();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const missing = [];

  if (!spreadsheetId) missing.push("GOOGLE_SHEETS_SPREADSHEET_ID");
  if (!serviceAccount.clientEmail) {
    missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_KEY_JSON");
  }
  if (!serviceAccount.privateKey) {
    missing.push("GOOGLE_PRIVATE_KEY, GOOGLE_PRIVATE_KEY_BASE64, or GOOGLE_SERVICE_ACCOUNT_KEY_JSON");
  }

  return {
    ...serviceAccount,
    spreadsheetId,
    range: process.env.GOOGLE_SHEETS_RANGE || "Appointments!A:J",
    missing
  };
};

const googleAccessToken = async (config) => {
  if (cachedGoogleToken && cachedGoogleTokenExpiry > Date.now() + 60000) {
    return cachedGoogleToken;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  const claims = {
    iss: config.clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };
  const unsignedToken = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const privateKey = config.privateKey.replace(/\\n/g, "\n");
  const signature = createSign("RSA-SHA256").update(unsignedToken).sign(privateKey);
  const assertion = `${unsignedToken}.${base64Url(signature)}`;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });
  const data = await jsonOrText(response);

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Unable to authenticate Google Sheets service account");
  }

  cachedGoogleToken = data.access_token;
  cachedGoogleTokenExpiry = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cachedGoogleToken;
};

const appendToGoogleSheet = async (appointment) => {
  const config = googleConfig();
  if (config.missing.length) {
    return {
      ok: false,
      configured: false,
      missing: config.missing
    };
  }

  const accessToken = await googleAccessToken(config);
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(config.range)}:append`
  );
  url.searchParams.set("valueInputOption", "USER_ENTERED");
  url.searchParams.set("insertDataOption", "INSERT_ROWS");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      values: [[
        appointment.createdAt,
        appointment.name,
        appointment.phone,
        appointment.concern,
        appointment.preferredDay,
        appointment.message,
        appointment.source,
        appointment.pageUrl,
        appointment.userAgent,
        appointment.ip
      ]]
    })
  });
  const data = await jsonOrText(response);

  if (!response.ok) {
    throw new Error(data.error?.message || "Unable to append appointment to Google Sheets");
  }

  return {
    ok: true,
    configured: true,
    updatedRange: data.updates?.updatedRange || null
  };
};

const whatsappConfig = () => {
  const missing = [];
  const config = {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    alertTo: process.env.WHATSAPP_ALERT_TO,
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION || "v23.0"
  };

  if (!config.accessToken) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!config.phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!config.alertTo) missing.push("WHATSAPP_ALERT_TO");

  return {
    ...config,
    missing
  };
};

const sendWhatsAppAlert = async (appointment) => {
  const config = whatsappConfig();
  if (config.missing.length) {
    return {
      ok: false,
      configured: false,
      missing: config.missing
    };
  }

  const body = [
    "New skincare appointment request",
    `Name: ${appointment.name}`,
    `Phone: ${appointment.phone}`,
    `Concern: ${appointment.concern}`,
    `Preferred day: ${appointment.preferredDay || "Not specified"}`,
    appointment.message ? `Message: ${appointment.message}` : "",
    `Source: ${appointment.source}`
  ].filter(Boolean).join("\n");

  const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(config.phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: config.alertTo,
      type: "text",
      text: {
        preview_url: false,
        body
      }
    })
  });
  const data = await jsonOrText(response);

  if (!response.ok) {
    throw new Error(data.error?.message || "Unable to send WhatsApp appointment alert");
  }

  return {
    ok: true,
    configured: true,
    messageId: data.messages?.[0]?.id || null,
    messageStatus: data.messages?.[0]?.message_status || null
  };
};

const integrationResult = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    return {
      ok: false,
      configured: true,
      error: error.message
    };
  }
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    jsonResponse(res, 405, { error: "Use POST" });
    return;
  }

  try {
    const body = await readRequestBody(req);
    const appointment = {
      createdAt: new Date().toISOString(),
      name: clean(body.name, 120),
      phone: clean(body.phone, 32),
      concern: clean(body.concern, 160),
      preferredDay: clean(body.preferredDay, 160),
      message: clean(body.message, 900),
      source: clean(body.source || "Priyanka's Skin Care website", 160),
      pageUrl: clean(body.pageUrl, 300),
      userAgent: clean(req.headers["user-agent"], 240),
      ip: clean(req.headers["x-forwarded-for"] || req.socket.remoteAddress, 80)
    };

    const missingFields = [];
    if (!appointment.name) missingFields.push("name");
    if (!appointment.phone) missingFields.push("phone");
    if (!appointment.concern) missingFields.push("concern");

    if (missingFields.length) {
      jsonResponse(res, 400, {
        error: "Missing required appointment fields",
        missingFields
      });
      return;
    }

    const [googleSheets, whatsapp] = await Promise.all([
      integrationResult(() => appendToGoogleSheet(appointment)),
      integrationResult(() => sendWhatsAppAlert(appointment))
    ]);
    const integrations = {
      googleSheets,
      whatsapp
    };
    const anyConfigured = googleSheets.configured || whatsapp.configured;
    const anySucceeded = googleSheets.ok || whatsapp.ok;

    if (!anyConfigured) {
      jsonResponse(res, 501, {
        error: "Appointment integrations are not configured",
        integrations
      });
      return;
    }

    if (!anySucceeded) {
      jsonResponse(res, 502, {
        error: "Appointment integrations failed",
        integrations
      });
      return;
    }

    jsonResponse(res, 200, {
      message: "Appointment request received",
      appointment: {
        createdAt: appointment.createdAt,
        name: appointment.name,
        concern: appointment.concern
      },
      integrations
    });
  } catch (error) {
    jsonResponse(res, 400, {
      error: error.message || "Invalid appointment request"
    });
  }
};
